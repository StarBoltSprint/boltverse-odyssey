// object-gate — the mandatory quality gate for every Boltverse Odyssey 3D object and biome.
// API:   import { gateScene, gateObject, loadScene } from "tools/object-gate/gate.mjs"
// CLI:   node tools/object-gate/cli.mjs --scene <scene.yaml> [--url ...] [--only id,id] [--out dir]
// Every FAIL blocks the delivery. Every FAIL carries fix hints. Nothing here edits the game.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";   // npm ci in tools/object-gate
import { scoreVisible, screenPxPerM, resolveView, footprintsFromBoxes } from "./lib/visible.mjs";
export { scoreVisible, screenPxPerM, resolveView };

/** Stable API contract (see API.md). Bump the major only with a migration note; additions bump the minor. */
export const API_VERSION = "1.3";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "lib/analyze.py");
const INJECT = join(HERE, "lib/inject.js");
const PROBE = readFileSync(join(HERE, "lib/probe.js"), "utf8");
const PROBE_VIEW = readFileSync(join(HERE, "lib/probe-view.js"), "utf8");   // 1.3: surfaceHit + zoom

// ------------------------------------------------------------------ specs + profiles
export function readYaml(p) { return yaml.load(readFileSync(p, "utf8")); }
function deepMerge(a, b) {
  if (Array.isArray(b) || typeof b !== "object" || b === null) return b === undefined ? a : b;
  const out = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) out[k] = typeof v === "object" && v !== null && !Array.isArray(v) ? deepMerge(out[k], v) : v;
  return out;
}
/** Object types that have a profile (for classifiers: pick one of these). */
export function listProfiles() {
  return readdirSync(join(HERE, "profiles")).filter((f) => f.endsWith(".yaml") && !f.startsWith("_")).map((f) => f.slice(0, -5)).sort();
}
export function loadProfile(type) {
  const p = join(HERE, "profiles", `${type}.yaml`);
  if (!existsSync(p)) throw new Error(`unknown object type "${type}" (profiles: building, rock, vehicle, prop, vegetation, ice, creature, effect, terrain)`);
  const prof = readYaml(p);
  const base = prof.extends ? loadProfile(prof.extends) : {};
  return deepMerge(base, prof);
}
/** Object spec + its profile -> effective config (spec.thresholds override the profile). */
export function resolveObject(spec, specDir = process.cwd()) {
  const prof = loadProfile(spec.type);
  const cfg = deepMerge(prof, spec.thresholds || {});
  const abs = (p) => (p && !p.startsWith("/") ? resolve(specDir, p) : p);
  return { ...spec, keyCrop: abs(spec.keyCrop), record: abs(spec.record || `records/${spec.id}.verified.yaml`), cfg, specDir };
}
export function loadScene(p) {
  const dir = dirname(resolve(p));
  const scene = readYaml(p);
  scene.dir = dir;
  scene.objects = (scene.objects || []).map((o) => {
    const file = typeof o === "string" ? resolve(dir, o) : null;
    const spec = file ? readYaml(file) : o;
    return resolveObject(spec, file ? dirname(file) : dir);
  });
  if (scene.adapter && !scene.adapter.startsWith("/")) scene.adapter = resolve(dir, scene.adapter);
  return scene;
}

// ------------------------------------------------------------------ helpers
function py(op, arg) { return JSON.parse(execFileSync("python3", [PY, op, JSON.stringify(arg)], { encoding: "utf8", maxBuffer: 1 << 26 }).trim()); }
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a.charCodeAt(k) === 49, y = b.charCodeAt(k) === 49; if (x && y) i++; if (x || y) u++; } return u ? i / u : 1; };
const ham = (a, b) => { let n = 0; let x = BigInt("0x" + a) ^ BigInt("0x" + b); while (x) { n += Number(x & 1n); x >>= 1n; } return n; };
const fmt = (x, d = 1) => (x == null || !isFinite(x) ? String(x) : Number(x).toFixed(d));
async function loadPlaywright() {
  for (const p of [process.env.OG_PLAYWRIGHT, "playwright", "/workspace/playtest/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return await import(p); } catch (e) {}
  }
  throw new Error("playwright not found: npm i playwright, or set OG_PLAYWRIGHT=/path/to/playwright/index.mjs");
}
function roleOf(spec, t) {
  const hay = `${t.url || ""} ${t.slots.join(" ")}`;
  for (const d of spec.textures || []) if (new RegExp(d.match).test(hay)) return d;
  return null;
}

/** size + mtime of every file under dir (no content read): detects edits during a run. */
function treeStamp(dir) {
  const out = {};
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else { const st = statSync(p); out[p.slice(dir.length + 1)] = `${st.size}:${st.mtimeMs}`; } } };
  try { walk(dir); } catch (e) {}
  return out;
}

/** request URLs -> live-tree relative paths of the files the page actually loaded (same origin, inside the page's folder) */
export function loadedLiveFiles(urls, pageUrl, liveDir) {
  const base = new URL(".", pageUrl), out = new Set();
  for (const u of urls || []) {
    let x; try { x = new URL(u); } catch (e) { continue; }
    if (x.origin !== base.origin || !x.pathname.startsWith(base.pathname)) continue;
    let rel = decodeURIComponent(x.pathname.slice(base.pathname.length));
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    out.add(rel);
  }
  return out;
}

// ------------------------------------------------------------------ pages
export async function openPage(browser, adapter, url, viewport, query, log) {
  const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: 1, isMobile: false });
  await ctx.addInitScript({ path: INJECT });
  const page = await ctx.newPage();
  // every URL the page really loads: the live guard only watches these files (not staging files in the same folder)
  if (browser.__ogLoaded) page.on("request", (r) => browser.__ogLoaded.add(r.url()));
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()} ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror ${e.message}`));
  const u = new URL(url);
  for (const [k, v] of Object.entries(query || {})) u.searchParams.set(k, String(v));
  log(`  open ${u.href} @${viewport.join("x")}`);
  await page.goto(u.href, { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(adapter.readyExpr, null, { timeout: adapter.readyTimeoutMs || 300000, polling: 500 });
  await adapter.setupInPage(page);
  await page.evaluate(PROBE);
  await page.evaluate(PROBE_VIEW);
  return { ctx, page, logs, href: u.href };
}
const SHADER_RE = /Shader Error|WebGLProgram|ERROR: 0:|VALIDATE_STATUS|could not compile/i;

// ------------------------------------------------------------------ main
/**
 * gateScene(scene, opts) -> report. scene: loadScene() result (or the same shape).
 * opts: { url, out, only: [ids], fast (skip morph), log }
 */
export async function gateScene(scene, opts = {}) {
  const log = opts.log || ((s) => console.log(s));
  const adapter = (await import(pathToFileURL(scene.adapter).href)).default;
  const url = opts.url || scene.url || adapter.defaultUrl;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const out = resolve(opts.out || join(scene.dir || ".", "out", ts));
  mkdirSync(out, { recursive: true });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  // live-tree guard: the live preview is read-only; edits go to a staging copy that swaps in only after a PASS
  const liveDir = scene.liveDir || adapter.liveDir;
  const live0 = liveDir ? treeStamp(liveDir) : null;
  browser.__ogLoaded = new Set();
  const report = { tool: "object-gate", version: 1, apiVersion: API_VERSION, url, adapter: adapter.name, startedAt: new Date().toISOString(), out, runtime: [], objects: [] };
  try {
    // ---------------- 8. runtime (whole page, every phone viewport)
    const vps = (scene.runtime && scene.runtime.viewports) || [[412, 915], [540, 1200]];
    let stats = null;
    for (const vp of vps) {
      const h = await openPage(browser, adapter, url, vp, {}, log);
      await h.page.waitForTimeout(2500);
      const errs = h.logs.filter((l) => /^(error|pageerror)/.test(l));
      const shader = h.logs.filter((l) => SHADER_RE.test(l));
      const appErr = await h.page.evaluate(() => window.__errors || []);
      rowR(report, `console ${vp.join("x")}`, errs.length + appErr.length === 0, errs.concat(appErr).slice(0, 5).join(" | ") || "no console / page errors", ["Open the page with DevTools, fix the first error, re-run (a ?v= bump never fixes code)."]);
      rowR(report, `shader compile ${vp.join("x")}`, shader.length === 0, shader.slice(0, 3).join(" | ") || "all programs compiled", ["A shader edit broke compilation. Run this gate locally BEFORE every ?v= bump (lesson 10-09 v28)."]);
      if (scene.hud) {
        const hud = await h.page.evaluate((s) => (document.querySelector(s) || {}).textContent || "", scene.hud.selector || adapter.hud.selector);
        rowR(report, `HUD text ${vp.join("x")}`, hud.trim() === scene.hud.text, JSON.stringify(hud.trim()) + " vs " + JSON.stringify(scene.hud.text), ["Update the HUD/title text to describe what the build contains today."]);
      }
      if (scene.title) { const t = await h.page.title(); rowR(report, `title ${vp.join("x")}`, t === scene.title, JSON.stringify(t), ["Update <title>."]); }
      const inner = await h.page.evaluate(() => [innerWidth, innerHeight]);
      rowR(report, `portrait viewport ${vp.join("x")}`, inner[1] > inner[0], `inner ${inner.join("x")}`, ["The page must fill a portrait phone viewport."]);
      stats = await h.page.evaluate(() => window.__og.stats());
      report.runtime.push({ id: "runtime.budgets", check: `budgets ${vp.join("x")} (report only, quality first)`, status: "INFO", detail: JSON.stringify(stats), hints: [] });
      await h.ctx.close();
    }
    // ---------------- capture page (shared by every object)
    const cap = await openPage(browser, adapter, url, [412, 915], adapter.captureQuery || {}, log);
    await cap.page.evaluate(() => window.__ogHost.freeze && window.__ogHost.freeze());
    const self = adapter.selfReport ? await adapter.selfReport(cap.page) : {};
    const sources = adapter.sources ? adapter.sources() : [];
    for (const spec of scene.objects) {
      if (opts.only && !opts.only.includes(spec.id)) continue;
      log(`object ${spec.id} (${spec.type})`);
      const o = { id: spec.id, type: spec.type, rows: [], files: {} };
      report.objects.push(o);
      const odir = join(out, spec.id); mkdirSync(odir, { recursive: true });
      try { await gateOne(cap, adapter, spec, o, odir, { self, sources, fast: opts.fast, log }); }
      catch (e) { row(o, "gate run", false, "gate crashed: " + (e && e.stack || e).toString().slice(0, 400), ["Fix the spec selector / adapter; a crash is a FAIL."]); }
      o.verdict = o.rows.some((r) => r.status === "FAIL") ? "FAIL" : "PASS";
      log(`  -> ${o.verdict} (${o.rows.filter((r) => r.status === "FAIL").length} FAIL / ${o.rows.length})`);
    }
    await cap.ctx.close();
  } finally {
    await browser.close();
  }
  if (live0) {
    const live1 = treeStamp(liveDir);
    const all = [...new Set([...Object.keys(live0), ...Object.keys(live1)])].filter((k) => live0[k] !== live1[k]);
    const loaded = loadedLiveFiles(browser.__ogLoaded, url, liveDir);
    const changed = all.filter((k) => loaded.has(k));
    const other = all.length - changed.length;
    const note = other ? `; ${other} other files in the folder changed but the live page does not load them (staging copies, tests): ignored` : "";
    rowR(report, "live preview untouched during the gate run", changed.length === 0, changed.length ? `${changed.length} files the live page loads changed while gating: ${changed.slice(0, 6).join(", ")}${note}` : `${loaded.size} files the live page loads unchanged${note}`,
      ["Never edit live preview files in place: work in a staging copy, gate the staging URL, swap live only after PASS (lesson 2026-10-09 17:14). Re-run the gate on a stable tree."]);
  }
  report.verdict = [...report.runtime, ...report.objects.flatMap((o) => o.rows)].some((r) => r.status === "FAIL") ? "FAIL" : "PASS";
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(out, "report.md"), toMarkdown(report));
  return report;
}

/** Gate one object spec (type + selector + textures + checklist) on its own. Same rows as gateScene. */
export async function gateObject(spec, opts = {}) {
  const resolved = spec.cfg ? spec : resolveObject(spec, opts.specDir);
  return gateScene({ adapter: opts.adapter, url: opts.url, dir: opts.dir || process.cwd(), hud: opts.hud, title: opts.title, objects: [resolved] }, opts);
}

/** Stable machine id per row (check text may be reworded; ids never change). */
export const CHECK_IDS = [
  [/^select/, "select"], [/^gate run/, "gate.crash"],
  [/^texture roles/, "textures.roles"], [/^texture filtering/, "textures.filtering"], [/^plates not downscaled/, "textures.native-size"],
  [/^native Imagine px\/m/, "texel.unique-px-per-m"], [/^visible px\/m/, "texel.visible-px-per-m"],
  [/^repetition \(visible\): identical/, "repetition.visible-radius"], [/^repetition \(visible\): neighbours/, "repetition.visible-neighbours"], [/^repetition \(UV\)/, "repetition.uv"], [/^UV stretch/, "texel.stretch"],
  [/^scene self-report/, "texel.self-report"], [/^repetition \(capture/, "repetition.captures"], [/^approach morph/, "morph"],
  [/^shadow light/, "shadow.light"], [/^shadow cast/, "shadow.cast"], [/^shadow world-fixed/, "shadow.world-fixed"], [/^shadow colour/, "shadow.colour"],
  [/^grounding/, "grounding"], [/^mesh sealed/, "geometry.sealed"], [/^facade relief/, "geometry.relief"], [/^proportions/, "geometry.proportions"],
  [/^effects take/, "effects.imagine-texture"], [/^effects: no typed/, "effects.no-colour-literals"],
  [/^key checklist written/, "checklist.written"], [/^key crop present/, "checklist.key-crop"], [/^key checklist: every/, "checklist.verified"], [/^colour vs key/, "checklist.colour"],
  [/^console/, "runtime.console"], [/^shader compile/, "runtime.shader"], [/^HUD text/, "runtime.hud"], [/^title/, "runtime.title"],
  [/^portrait viewport/, "runtime.portrait"], [/^budgets/, "runtime.budgets"], [/^live preview untouched/, "runtime.live-untouched"],
];
export const checkId = (check) => (CHECK_IDS.find(([re]) => re.test(check)) || [null, "other"])[1];
function row(o, check, pass, detail, hints = [], status) {
  o.rows.push({ id: checkId(check), check, status: status || (pass ? "PASS" : "FAIL"), detail, hints: pass ? [] : hints });
}
function rowR(rep, check, pass, detail, hints) { rep.runtime.push({ id: checkId(check), check, status: pass ? "PASS" : "FAIL", detail, hints: pass ? [] : hints }); }

async function settle(page, ms = 1200) {
  await page.evaluate(() => window.__og.frames(4));
  await page.waitForTimeout(ms);
  await page.evaluate(() => window.__og.frames(2));
}

/**
 * Render-based visible px/m: stand minViewM (8 m) in front of the hero copy's surface (raycast), eye height, looking
 * at it horizontally; zoom the game camera so the capture has `renderHeadroom` x the needed screen px/m (an optical
 * zoom = a sharper screen at the same distance: same LOD, same distance fades, finer mips); screenshot; measure the
 * detail really present in the pixels (analyze.py visible_px). Effects (dust, veils) are hidden for the shot.
 */
export async function visibleShot(page, adapter, sel, hero, t, view, odir, vv = {}) {
  const D = t.minViewM, need = screenPxPerM(t, view, D), head = t.renderHeadroom ?? 2;
  const path0 = await page.evaluate(() => window.__ogHost.path || []);
  // direction from the copy toward the camera: spec `visibleView.towardXZ` (e.g. the A/B zone side), else the front
  // face that looks at the player path (same side as the captures)
  let dir;
  if (vv.towardXZ) { const dx = vv.towardXZ[0] - hero.center[0], dz = vv.towardXZ[1] - hero.center[2], l = Math.hypot(dx, dz) || 1; dir = [dx / l, dz / l]; }
  else {
    const fl = Math.hypot(hero.front[0], hero.front[1]) || 1, f = [hero.front[0] / fl, hero.front[1] / fl];
    const dP = (x, z) => Math.min(...path0.map((p) => Math.hypot(p[0] - x, p[1] - z)));
    const s = path0.length && dP(hero.center[0] - f[0] * 50, hero.center[2] - f[1] * 50) < dP(hero.center[0] + f[0] * 50, hero.center[2] + f[1] * 50) ? -1 : 1;
    dir = [s * f[0], s * f[1]];
  }
  const R = Math.hypot(hero.max[0] - hero.min[0], hero.max[2] - hero.min[2]) / 2;
  // aim at a STEEP surface (|normal.y| < 0.6: a wall, not the sand apron / talus top) at one of these heights above
  // the ground, then stand so the eye is exactly D metres from that point
  // stand roughly D m in front first and let the game run: its LOD logic then shows the level the phone sees at 8 m
  const pre = [hero.center[0] + dir[0] * (hero.halfD + D), hero.center[2] + dir[1] * (hero.halfD + D)];
  await page.evaluate(([x, z, c]) => window.__ogHost.setPose({ x, z, look: [c[0], c[1], c[2]] }), [pre[0], pre[1], [hero.center[0], hero.min[1] + 5, hero.center[2]]]);
  await settle(page);
  const heights = vv.aimHeightM || [4, 5, 3, 6, 7, 8, 2.5];
  const search = () => page.evaluate(([sel, c, dir, R, D, heights]) => {
    const h = window.__ogHost, eye = 1.6;
    const ox = c[0] + dir[0] * (R + 40), oz = c[2] + dir[1] * (R + 40);
    for (const a of heights) {
      const hit = window.__og.surfaceHit(sel, [ox, h.groundHeight(ox, oz) + a, oz], [-dir[0], 0, -dir[1]], R + 80);
      if (!hit || !hit.normal || Math.abs(hit.normal[1]) > 0.6) continue;
      const P = hit.point, g = h.groundHeight(P[0], P[2]); if (P[1] - g < 1) continue;
      const nl = Math.hypot(hit.normal[0], hit.normal[2]) || 1, n = [hit.normal[0] / nl, hit.normal[2] / nl];
      let x = P[0] + n[0] * D, z = P[2] + n[1] * D;
      for (let i = 0; i < 3; i++) {   // eye height follows the ground under the camera
        const dy = P[1] - (h.groundHeight(x, z) + eye); if (Math.abs(dy) >= D * 0.95) break;
        const hz = Math.sqrt(D * D - dy * dy); x = P[0] + n[0] * hz; z = P[2] + n[1] * hz;
      }
      return { x, z, look: P, aimM: a, normal: hit.normal, hitName: hit.name };
    }
    return null;
  }, [sel, hero.center, dir, R, D, heights]);
  let place = await search();
  if (!place && !vv.towardXZ) {   // the path-facing side has no wall at those heights: try the other three sides
    const d0 = dir;
    for (const d of [[-d0[0], -d0[1]], [d0[1], -d0[0]], [-d0[1], d0[0]]]) {
      dir = d;
      const p2 = [hero.center[0] + dir[0] * (hero.halfD + D), hero.center[2] + dir[1] * (hero.halfD + D)];
      await page.evaluate(([x, z, c]) => window.__ogHost.setPose({ x, z, look: c }), [p2[0], p2[1], [hero.center[0], hero.min[1] + 5, hero.center[2]]]);
      await settle(page);
      place = await search(); if (place) { place.side = "fallback"; break; }
    }
  }
  if (!place) return { ok: false, why: `no steep surface of ${hero.id} found at ${heights.join("/")} m above the ground on its ${vv.towardXZ ? "requested" : "path-facing"} side` };
  await page.evaluate((n) => { window.__ogRestoreFx = (() => { const { scene } = window.__ogHost; const re = new RegExp(n); const hid = []; scene.traverse((o) => { if (o.name && re.test(o.name) && o.visible) { o.visible = false; hid.push(o); } }); return () => hid.forEach((o) => (o.visible = true)); })(); }, adapter.fxNames || "^$");
  try {
    const pose = await page.evaluate((p) => window.__ogHost.setPose(p), place);
    await settle(page);
    const vp = page.viewportSize();
    const g = await page.evaluate(([sel, P]) => {
      const c = window.__ogHost.camera, r = window.__ogHost.renderer, p = c.position;
      const hit = window.__og.surfaceHit(sel, [p.x, p.y, p.z], [P[0] - p.x, P[1] - p.y, P[2] - p.z]);
      return { d: hit && hit.d, pr: r.getPixelRatio(), cam: [p.x, p.y, p.z].map((v) => +v.toFixed(2)) };
    }, [sel, place.look]);
    if (!g.d) return { ok: false, why: "surface lost after placing the 8 m camera (LOD swap at the final pose?)" };
    const renderH = vp.height * g.pr, target = head * need;
    const fovZ = (2 * Math.atan(renderH / (2 * g.d * target)) * 180) / Math.PI;
    const fovReal = await page.evaluate((v) => window.__og.zoom(v), fovZ);
    await settle(page);
    const img = join(odir, "cap-visible-8m.png");
    await page.screenshot({ path: img, timeout: 240000 });
    const bits = await page.evaluate(([s, w, h]) => window.__og.maskFromGameCamera(s, w, h), [sel, vp.width >> 1, vp.height >> 1]);
    const m = py("mask_png", { w: vp.width >> 1, h: vp.height >> 1, bits, out: join(odir, "cap-visible-8m-mask.png") });
    await page.evaluate(() => window.__og.zoom(null));
    const S = renderH / (2 * g.d * Math.tan((fovReal * Math.PI) / 360));
    // central band around the aimed point (the surface really at ~D m; the ground below and the sky above stay out), inside the object mask
    const rect = [Math.round(vp.width * 0.15), Math.round(vp.height * 0.3), Math.round(vp.width * 0.85), Math.round(vp.height * 0.7)];
    const a = py("visible_px", { img, mask: m.out, rect, screenPxPerM: S });
    return { ...a, img, mask: m.out, cover: m.cover, distM: +g.d.toFixed(2), needPxPerM: +need.toFixed(1), zoomFovDeg: +fovReal.toFixed(2), wantedFovDeg: +fovZ.toFixed(2), renderH, camera: g.cam, aimM: place.aimM, normal: place.normal && place.normal.map((v) => +v.toFixed(2)), rect, pose };
  } finally {
    await page.evaluate(() => window.__ogRestoreFx && window.__ogRestoreFx());
  }
}

async function gateOne(cap, adapter, spec, o, odir, ctx) {
  const { page } = cap; const cfg = spec.cfg; const checks = new Set(cfg.checks);
  const sel = spec.select;
  const boxes = await page.evaluate((s) => window.__og.instanceBoxes(s), sel);
  if (!boxes.length) { row(o, "select", false, `selector ${JSON.stringify(sel)} matched no object`, ["Fix select.names (regex on object names in the scene)."]); return; }
  row(o, "select", true, `${boxes.length} placed copies`);
  writeFileSync(join(odir, "boxes.json"), JSON.stringify(boxes, null, 1));
  const spawn = await page.evaluate(() => (window.__ogHost.path || [[0, 0]])[0]);
  const dSpawn = (b) => Math.hypot(b.center[0] - spawn[0], b.center[2] - spawn[1]);
  // hero copy: the one the player meets first (closest to the spawn), unless the spec names one
  const hero = (spec.hero && boxes.find((b) => b.id === spec.hero)) || boxes.slice().sort((a, b) => dSpawn(a) - dSpawn(b))[0];
  o.hero = hero.id;

  // ---------------- 1. textures: roles, source originals, filtering
  const tx = await page.evaluate((s) => window.__og.texturesOf(s), sel);
  const usedTex = tx.textures.filter((t) => t.kind !== "rendertarget" && t.kind !== "depth");
  if (checks.has("textures") || checks.has("texel")) {
    const undeclared = usedTex.filter((t) => !roleOf(spec, t));
    row(o, "texture roles declared", undeclared.length === 0, undeclared.map((t) => `${t.slots.join("/")} ${t.url}`).join("; ") || usedTex.map((t) => `${basename((t.url || "?").split("?")[0])}=${roleOf(spec, t).role}`).join(" "),
      ["Declare every texture in the spec `textures:` with a role (plate | detail | tile | normal | mask | emit | env). Only `plate` counts as native Imagine px/m."]);
    const bad = [];
    for (const t of usedTex) {
      const r = roleOf(spec, t) || {};
      if (cfg.textures.trilinear && (t.kind === "image" || (t.kind === "array" && r.role && r.role.startsWith("plate"))) && !(t.mipmaps && t.minFilter === 1008)) bad.push(`${basename(t.url || t.slots[0])}: mipmaps ${t.mipmaps} minFilter ${t.minFilter}`);
      if (cfg.textures.anisotropyMax && t.anisotropy < tx.anisoMax) bad.push(`${basename(t.url || t.slots[0])}: anisotropy ${t.anisotropy} < max ${tx.anisoMax}`);
      if (t.url && t.url.includes("#resized")) bad.push(`${basename(t.url)}: decoded with a resize/crop`);
      if (r.role === "plate" && t.kind === "image" && t.fileW && (t.w !== t.fileW || t.h !== t.fileH)) bad.push(`${basename(t.url)}: GPU ${t.w}x${t.h} != file ${t.fileW}x${t.fileH}`);
    }
    row(o, "texture filtering (mips, trilinear, anisotropy = max, no resize)", bad.length === 0, bad.join("; ") || `${usedTex.length} textures trilinear + aniso ${tx.anisoMax}`,
      ["tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(). Never draw a plate through a resized canvas."]);
    // originals: served file >= Imagine source, GPU == served
    const srcRows = [], srcFail = [];
    for (const t of usedTex) {
      const r = roleOf(spec, t); if (!r || r.role !== "plate") continue;
      if (r.pool) {
        // array layers: every layer file must be at native size (declared originals or the files themselves)
        for (const f of r.pool.files || []) {
          const m = ctx.sources.find((s) => f.endsWith(s.file) || s.file.endsWith(f));
          const src = (m && m.source) || null;
          if (!m) { srcFail.push(`${f}: not in the texture manifest`); continue; }
          if (t.w < m.nativeW || t.h < m.nativeH) srcFail.push(`${f}: GPU layer ${t.w}x${t.h} < native ${m.nativeW}x${m.nativeH}`);
          if (src && existsSync(src)) { const s = py("size", { img: src }); if (s.w > t.w || s.h > t.h) srcFail.push(`${f}: Imagine original ${s.w}x${s.h} > GPU layer ${t.w}x${t.h}`); }
        }
        srcRows.push(`pool ${t.slots.join("/")} ${t.depth} layers ${t.w}x${t.h} (${(r.pool.files || []).length} files checked)`);
        continue;
      }
      const file = (t.url || "").split("?")[0];
      const m = (r.source && { source: r.source }) || ctx.sources.find((s) => file.endsWith(s.file));
      if (!m || !m.source) { if (cfg.textures.requireSourceForPlates) srcFail.push(`${basename(file)}: no Imagine original declared`); continue; }
      if (!existsSync(m.source)) { srcFail.push(`${basename(file)}: original ${m.source} missing`); continue; }
      const s = py("size", { img: m.source });
      const tmp = join(odir, "_served_" + basename(file));
      writeFileSync(tmp, Buffer.from(await (await fetch(t.url)).arrayBuffer()));
      const f = py("size", { img: tmp });
      srcRows.push(`${basename(file)} gpu ${t.w}x${t.h} served ${f.w}x${f.h} original ${s.w}x${s.h}`);
      if (f.w < s.w || f.h < s.h) srcFail.push(`${basename(file)}: served ${f.w}x${f.h} < Imagine original ${s.w}x${s.h} (downscaled)`);
      if (t.w !== f.w || t.h !== f.h) srcFail.push(`${basename(file)}: GPU ${t.w}x${t.h} != served ${f.w}x${f.h}`);
    }
    row(o, "plates not downscaled vs Imagine originals", srcFail.length === 0, srcFail.concat(srcRows).join("; ") || "no plate", ["Ship the Imagine output at its native size (lossless or q>=95). Record the original path in tex-manifest.json / spec `source:`."]);
  }

  // ---------------- 1b. native px/m per surface (plates only)
  let texelRows = [];
  if (checks.has("texel")) {
    const plates = (spec.textures || []).filter((d) => d.role === "plate");
    texelRows = await page.evaluate(([s, p]) => window.__og.texel(s, p), [sel, plates]);
    writeFileSync(join(odir, "texel.json"), JSON.stringify(texelRows, null, 1));
    const t = cfg.texel;
    const visible = t.policy === "visible";
    const fails = visible ? [] : texelRows.filter((r) => r.uniquePxPerM < (r.nearPathM <= t.nearM ? t.nearPxPerM : t.minPxPerM));
    const worst = texelRows.slice().sort((a, b) => a.uniquePxPerM - b.uniquePxPerM)[0];
    const byCls = {};
    for (const r of texelRows) { const k = r.cls; if (!byCls[k] || r.uniquePxPerM < byCls[k].uniquePxPerM) byCls[k] = r; }
    const hints = [];
    for (const r of Object.values(byCls)) {
      const need = r.nearPathM <= t.nearM ? t.nearPxPerM : t.minPxPerM;
      if (r.uniquePxPerM >= need) continue;
      const px = r.areaM2 * need * need; const plates = Math.ceil(px / (r.texW * r.texH));
      hints.push(`${r.cls} face (${fmt(r.areaM2, 0)} m², ${fmt(r.nearPathM)} m from the path): ${fmt(r.uniquePxPerM)} unique px/m < ${need}. Needs ~${(px / 1e6).toFixed(1)} Mpx of UNIQUE Imagine pixels = ${plates} full-res ${r.texW}x${r.texH} plates (sections), or larger plates. A tiled detail texture does not count.`);
    }
    if (!visible) row(o, "native Imagine px/m (plates only, unique pixels)", fails.length === 0 && texelRows.length > 0,
      texelRows.length ? `worst ${worst.cls} ${fmt(worst.uniquePxPerM)} unique px/m (sampling ${fmt(worst.samplingPxPerM)}, plate repeats x${worst.repeats}) on ${worst.inst}; ${fails.length}/${texelRows.length} surfaces under threshold (${t.minPxPerM}, ${t.nearPxPerM} within ${t.nearM} m)` : "no plate-textured surface measured",
      hints.length ? hints : ["Declare plate textures and give the mesh a uv attribute."]);
    if (t.maxRepeats != null && !visible) {
      const tiled = texelRows.filter((r) => r.repeats > t.maxRepeats);
      const w = tiled.sort((a, b) => b.repeats - a.repeats)[0];
      row(o, "repetition (UV): plates do not tile", tiled.length === 0, tiled.length ? `${tiled.length} surfaces tile their plate; worst ${w.cls} x${w.repeats} (${basename((w.tex || "").split("?")[0])})` : "every plate covers its surface once",
        ["A plate repeated across a facade is the 'carrelage' SmiR saw. Give each facade section its own Imagine plate (crop-sourced edits, consistent), UV 0..1 once per section."]);
    }
    const st = texelRows.filter((r) => r.stretchP95 > t.maxStretch);
    row(o, "UV stretch <= " + t.maxStretch, st.length === 0, st.length ? st.slice(0, 4).map((r) => `${r.cls} ${r.stretchP95}`).join(", ") : `max ${fmt(Math.max(1, ...texelRows.map((r) => r.stretchP95)), 3)}`, ["Re-unwrap with equal metres per texel on both axes (surface-aware UV)."]);
    // cross-check the scene's own claim (the 10-09 lesson: gate-v37 said 256 px/m, real plates were 11-29)
    const claimKey = spec.selfReportKey; const claim = claimKey && ctx.self[claimKey];
    if (claim && worst) {
      const meas = visible ? Math.min(...texelRows.map((r) => r.samplingPxPerM)) : worst.uniquePxPerM;
      const ok = claim.claimedPxPerM <= meas * t.selfReportTolerance;
      row(o, "scene self-report vs measured", ok, `scene claims ${claim.claimedPxPerM} px/m; measured ${visible ? "visible (sampling)" : "unique"} ${fmt(meas)} px/m${claim.detailPxPerM ? ` (detail tile ${claim.detailPxPerM} px/m does not count)` : ""}`,
        ["The scene's own texel number is misleading: compute it from the plate's unique pixels over the surface's metres, never from a tiled detail texture."]);
    }
  }

  // ---------------- captures (close, low-portrait, far) for repetition + checklist
  const wanted = new Set([...(checks.has("repetition") ? cfg.repetition.captures : []), ...(checks.has("checklist") ? cfg.checklist.captures : [])]);
  const captures = {};
  if (wanted.size && checks.has("checklist") | checks.has("repetition")) {
    const path0 = await page.evaluate(() => window.__ogHost.path || []);
    const fx = hero.front, fl = Math.hypot(fx[0], fx[1]) || 1; const f = [fx[0] / fl, fx[1] / fl];
    const dP = (x, z) => Math.min(...path0.map((p) => Math.hypot(p[0] - x, p[1] - z)));
    const s = dP(hero.center[0] + f[0] * 50, hero.center[2] + f[1] * 50) <= dP(hero.center[0] - f[0] * 50, hero.center[2] - f[1] * 50) ? 1 : -1;
    const base = hero.min[1], H = hero.height, hd = hero.halfD;
    const poses = {
      close: { d: hd + Math.max(12, 0.15 * H), ty: base + Math.min(0.4 * H, 20) },
      "low-portrait": { d: hd + 6, ty: base + 1.6 + 6 * Math.tan((42 * Math.PI) / 180) },
      far: { d: hd + Math.max(2.2 * H, 120), ty: base + 0.45 * H },
    };
    await page.evaluate((n) => { window.__ogRestoreFx = (() => { const { scene } = window.__ogHost; const re = new RegExp(n); const hid = []; scene.traverse((o) => { if (o.name && re.test(o.name) && o.visible) { o.visible = false; hid.push(o); } }); return () => hid.forEach((o) => (o.visible = true)); })(); }, adapter.fxNames || "^$");
    // far: stand ON the player path, at the path point whose distance to the object is closest to P.d
    const farPt = path0.slice().sort((p, q) => Math.abs(Math.hypot(p[0] - hero.center[0], p[1] - hero.center[2]) - poses.far.d) - Math.abs(Math.hypot(q[0] - hero.center[0], q[1] - hero.center[2]) - poses.far.d))[0];
    for (const name of wanted) {
      const P = poses[name]; if (!P) continue;
      let x = hero.center[0] + s * f[0] * P.d, z = hero.center[2] + s * f[1] * P.d;
      if (name === "far" && farPt) { x = farPt[0]; z = farPt[1]; }
      const pose = await page.evaluate(([x, z, t]) => window.__ogHost.setPose({ x, z, look: t }), [x, z, [hero.center[0], P.ty, hero.center[2]]]);
      await settle(page);
      const real = await page.evaluate(() => { const c = window.__ogHost.camera; return [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(2)); });
      const img = join(odir, `cap-${name}.png`);
      await page.screenshot({ path: img, timeout: 240000 });
      const vp = page.viewportSize();
      const bits = await page.evaluate(([s, w, h]) => window.__og.maskFromGameCamera(s, w, h), [sel, vp.width >> 1, vp.height >> 1]);
      const m = py("mask_png", { w: vp.width >> 1, h: vp.height >> 1, bits, out: join(odir, `cap-${name}-mask.png`) });
      captures[name] = { img, mask: m.out, cover: m.cover, pose: { ...pose, camera: real }, hash: py("phash", { img }).hash };
    }
    await page.evaluate(() => window.__ogRestoreFx && window.__ogRestoreFx());
    o.files.captures = captures;
  }

  // ---------------- 2. repetition (fronto-parallel facade views + phone captures)
  let repRows = [];
  if (checks.has("repetition")) {
    const res = [];
    for (const axis of ["z", "x"]) {
      const v = await page.evaluate(([s, id, ax]) => window.__og.orthoFace(s, id, ax, 512, 1024), [sel, hero.id, axis]);
      const img = join(odir, `face-${axis}.png`), msk = join(odir, `face-${axis}-mask.png`);
      writeFileSync(img, Buffer.from(v.png.split(",")[1], "base64")); writeFileSync(msk, Buffer.from(v.mask.split(",")[1], "base64"));
      // expected tile period of the plate on this face (from the texel rows of the hero copy)
      const tr = texelRows.find((r) => r.inst === hero.id && (r.cls === "+" + axis || r.cls === "pool") && r.repeats > 1.05);
      const lag = tr ? Math.round((tr.texW / tr.samplingPxPerM) * v.pxPerM) : null;
      const r = py("repetition", { img, mask: msk, expectLagPx: lag && lag < 900 ? lag : null });
      res.push({ name: `face ${axis}`, ...r, pxPerM: v.pxPerM, tileM: tr ? +(tr.texW / tr.samplingPxPerM).toFixed(2) : null });
      captures[`face-${axis}`] = { img, mask: msk, pose: { camera: ["ortho", axis] }, cover: 1 };
    }
    for (const name of cfg.repetition.captures) {
      const c = captures[name]; if (!c) continue;
      if (c.cover < 0.02) { res.push({ name, ok: false, why: `object covers ${fmt(c.cover * 100)}% of the ${name} capture (capture angle unusable)` }); continue; }
      const r = py("repetition", { img: c.img, mask: c.mask });
      res.push({ name, ...r });
    }
    writeFileSync(join(odir, "repetition.json"), JSON.stringify(res, null, 1));
    repRows = res;
    const R = cfg.repetition;
    const fails = res.filter((r) => !r.ok || r.peak > R.maxPeak || (r.atExpectedLag != null && r.atExpectedLag > R.maxAtTileLag));
    row(o, "repetition (capture autocorrelation)", fails.length === 0 && res.length > 0,
      res.map((r) => (r.ok ? `${r.name} peak ${r.peak} at lag ${r.lagPx} px${r.atExpectedLag != null ? `, at the plate period (${r.tileM} m = ${r.expectLagPx} px) ${r.atExpectedLag}` : ""}` : `${r.name}: ${r.why}`)).join("; ") + ` (max ${R.maxPeak}, at plate period ${R.maxAtTileLag})`,
      ["Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.", "If the capture angle is unusable, fix the spec `hero:` or the object's front axis."]);
  }

  // ---------------- 1+2 under texel policy "visible" (SmiR 2026-10-09 20:19): visible px/m + no visible repetition
  if (checks.has("texel") && cfg.texel.policy === "visible") {
    const view = resolveView(cfg.texel, typeof adapter.view === "function" ? adapter.view() : adapter.view);
    // measured on the FINAL render (works for any material method: unique plates, or tiling + macro + hex tiling)
    let render = null;
    if ((cfg.texel.visibleMeasure || "render") === "render") {
      try { const vv = spec.visibleView || {}; render = await visibleShot(page, adapter, sel, (vv.hero && boxes.find((b) => b.id === vv.hero)) || hero, cfg.texel, view, odir, vv); }
      catch (e) { render = { ok: false, why: "8 m capture failed: " + String((e && e.message) || e).slice(0, 200) }; }
      try { await page.evaluate(() => window.__og.zoom(null)); } catch (e) {}
    }
    const v = scoreVisible(cfg.texel, cfg.repetition, view, texelRows, repRows, footprintsFromBoxes(boxes), spec, render);
    writeFileSync(join(odir, "visible.json"), JSON.stringify({ view, render, perSurface: v.perSurface }, null, 1));
    if (render && render.img) o.files.captures = { ...(o.files.captures || {}), "visible-8m": { img: render.img, mask: render.mask } };
    for (const r of v.rows) row(o, r.check, r.pass, r.detail, r.hints);
  }

  // ---------------- 3. approach morph
  if (checks.has("morph") && !ctx.fast) {
    const M = cfg.morph; const targets = boxes.slice().sort((a, b) => a.nearPathM - b.nearPathM).slice(0, M.instances);
    const res = [];
    for (const b of targets) {
      const sp = await page.evaluate(() => (window.__ogHost.path || [[0, 0]])[0]);
      let dx = sp[0] - b.center[0], dz = sp[1] - b.center[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const r0 = Math.max(b.halfW, b.halfD);
      let prev = null; const ious = []; const strip = [];
      for (let d = M.fromM; d >= M.toM; d *= M.step) {
        const x = b.center[0] + dx * (r0 + d), z = b.center[2] + dz * (r0 + d);
        const m = await page.evaluate(async ([s, x, z, b, d]) => {
          const H = window.__ogHost; H.setPose({ x, z, look: [b.center[0], b.min[1] + Math.min(40, d * 0.35 + 8), b.center[2]] });
          await window.__og.frames(2);
          const gy = H.groundHeight(x, z);
          return window.__og.mask(s, [x, gy + 2, z], [b.center[0], b.min[1] + Math.min(b.height * 0.5, 40, d * 0.35 + 8), b.center[2]], 135, 240, 58);
        }, [sel, x, z, b, d]);
        if (prev) ious.push({ d: +d.toFixed(1), iou: iou(m, prev) });
        prev = m; strip.push(m);
      }
      const v = ious.map((r) => r.iou);
      const bad = ious.filter((r, i) => { const nb = [v[i - 2], v[i - 1], v[i + 1], v[i + 2]].filter((q) => q !== undefined).sort((a, c) => a - c); const med = nb[nb.length >> 1]; return r.iou < M.minIoU || med - r.iou > M.maxDropVsNeighbours; });
      res.push({ inst: b.id, frames: strip.length, minIoU: +Math.min(...v).toFixed(3), jumps: bad });
    }
    writeFileSync(join(odir, "morph.json"), JSON.stringify(res, null, 1));
    const fails = res.filter((r) => r.jumps.length);
    row(o, `approach morph ${cfg.morph.fromM}->${cfg.morph.toM} m`, fails.length === 0,
      res.map((r) => `${r.inst}: ${r.frames} frames, min IoU ${r.minIoU}${r.jumps.length ? `, jumps at ${r.jumps.slice(0, 4).map((j) => j.d + " m (" + j.iou.toFixed(2) + ")").join(", ")}` : ""}`).join("; "),
      ["A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable."]);
  }

  // ---------------- 4. shadows
  if (checks.has("shadow")) {
    const lights = await page.evaluate(() => window.__og.lights());
    const L = lights.find((l) => l.cast);
    if (!L) row(o, "shadow light", false, "no shadow-casting directional light", ["Add one static, world-fixed directional shadow (see METHOD lighting)."]);
    else {
      const sd = [-L.dir[0], -L.dir[2]]; const sl = Math.hypot(sd[0], sd[1]) || 1; sd[0] /= sl; sd[1] /= sl;
      const r0 = Math.max(hero.halfW, hero.halfD), Hh = hero.height;
      const T = [hero.center[0] + sd[0] * (r0 + Math.min(Hh * 0.5, 40)), 0, hero.center[2] + sd[1] * (r0 + Math.min(Hh * 0.5, 40))];
      const pp = [-sd[1], sd[0]];
      const P = [T[0] + pp[0] * Math.min(Hh, 80), 0, T[2] + pp[1] * Math.min(Hh, 80)];
      const probe = async (px, pz) => page.evaluate(async ([s, P, T, px, pz, fx]) => {
        const H = window.__ogHost; H.setPose({ x: px, z: pz }); await window.__og.frames(3);
        const gT = H.groundHeight(T[0], T[2]);
        return window.__og.shadow(s, [P[0], gT + Math.max(25, P[1]), P[2]], [T[0], gT, T[2]], 180, 320, fx);
      }, [sel, [P[0], Math.min(Hh * 0.6, 50), P[2]], T, px, pz, adapter.fxNames || null]);
      const path0 = await page.evaluate(() => window.__ogHost.path || [[0, 0]]);
      const A = path0[0], B = path0[Math.min(path0.length - 1, 9)];
      const s1 = await probe(A[0], A[1]); const s2 = await probe(B[0], B[1]);
      if (cfg.shadow.mustCast) row(o, "shadow cast", s1.n > 30, `${s1.n} ground pixels in this object's shadow (${fmt(s1.frac * 100)}% of the probe view)`, ["castShadow = true on every LOD; the ground must receive (receiveShadow / ground shader lookup)."]);
      if (s1.n > 30) {
        const fixedIoU = iou(s1.mask, s2.mask);
        row(o, "shadow world-fixed", fixedIoU >= cfg.shadow.minWorldFixedIoU, `shadow mask IoU ${fmt(fixedIoU, 3)} after moving the player ${fmt(Math.hypot(A[0] - B[0], A[1] - B[1]), 0)} m (min ${cfg.shadow.minWorldFixedIoU})`,
          ["The shadow camera follows the player: fit one static map over all casters (autoUpdate false) or snap the shadow camera in light space."]);
        const ratio = s1.meanOn.map((v, k) => v / Math.max(1, s1.meanOff[k]));
        const mean = (ratio[0] + ratio[1] + ratio[2]) / 3; const nr = ratio.map((v) => v / mean);
        const chroma = Math.max(...nr) - Math.min(...nr);
        const violet = ratio[0] > ratio[1] * cfg.shadow.violetRatio && ratio[2] > ratio[1] * cfg.shadow.violetRatio;
        row(o, "shadow colour neutral (not violet)", !violet && chroma <= cfg.shadow.maxTintChroma, `shadow multiply r ${fmt(ratio[0], 3)} g ${fmt(ratio[1], 3)} b ${fmt(ratio[2], 3)}, chroma ${fmt(chroma, 3)} (max ${cfg.shadow.maxTintChroma})${violet ? ", VIOLET" : ""}`,
          ["Shadow tint must be dark neutral (slight cool OK). Check the shadow lookup (depth unpack order, double bias) and the tint constant."]);
        writeFileSync(join(odir, "shadow.json"), JSON.stringify({ light: L, at: { P, T }, s1: { ...s1, mask: undefined }, s2: { ...s2, mask: undefined } }, null, 1));
      }
    }
  }

  // ---------------- 5. grounding
  if (checks.has("grounding")) {
    const g = await page.evaluate((s) => window.__og.grounding(s), sel);
    const fl = g.filter((r) => r.maxAirM > cfg.grounding.maxAirM);
    const w = g.slice().sort((a, b) => b.maxAirM - a.maxAirM)[0];
    row(o, "grounding (no floating)", fl.length === 0, `${fl.length}/${g.length} copies float; worst ${w.inst} ${fmt(w.maxAirM, 2)} m at ${w.at}`, [`Sink each copy below its LOWEST footprint corner (worst needs ${fmt((w.maxAirM || 0) + 0.3, 2)} m), fill concave bases, add sand drift.`]);
    writeFileSync(join(odir, "grounding.json"), JSON.stringify(g, null, 1));
  }

  // ---------------- 6. geometry
  if (checks.has("geometry")) {
    const geo = await page.evaluate((s) => window.__og.geometry(s), sel);
    writeFileSync(join(odir, "geometry.json"), JSON.stringify(geo, null, 1));
    const G = cfg.geometry;
    const nm = geo.filter((g) => G.maxNonManifold != null && g.nonManifold > G.maxNonManifold);
    const op = geo.filter((g) => G.maxOpenEdges != null && g.open > G.maxOpenEdges);
    row(o, "mesh sealed (non-manifold / open edges)", nm.length + op.length === 0, geo.map((g) => `${g.usedBy} tris ${g.tris} nonManifold ${g.nonManifold} open ${g.open}`).join("; "), ["Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export."]);
    if (G.minReliefM > 0) {
      const flat = geo.filter((g) => Object.values(g.reliefM).filter((v) => v != null && v >= G.minReliefM).length < G.minReliefFaces);
      row(o, `facade relief >= ${G.minReliefM} m`, flat.length === 0, geo.map((g) => `${g.usedBy} ${Object.entries(g.reliefM).map(([k, v]) => k + " " + v).join(" ")}`).join("; "),
        ["Model the relief (fins, ledges, recessed bays, cornices, strata) in the geometry; a plate on a flat face reads as a picture."]);
    }
    if (spec.proportions) {
      const P = spec.proportions; const bad = [];
      for (const g of geo) for (const s of g.sizes) {
        const r = { hOverW: s.h / s.w, dOverW: s.d / s.w, heightM: s.h };
        for (const [k, [lo, hi]] of Object.entries(P)) if (r[k] < lo || r[k] > hi) bad.push(`${s.inst} ${k} ${fmt(r[k], 2)} not in ${lo}-${hi}`);
      }
      row(o, "proportions vs spec", bad.length === 0, bad.slice(0, 6).join("; ") || `${Object.keys(P).join(", ")} in range on every copy`, ["Scale the solid in Blender to the spec ratios (never by spending more images)."]);
    }
  }

  // ---------------- 9. effects
  if (checks.has("effects")) {
    const fx = await page.evaluate((s) => window.__og.effects(s), sel);
    const imag = (spec.imagineSources || []).map((r) => new RegExp(r));
    const bad = fx.filter((m) => !m.textures.some((t) => imag.some((r) => r.test(t.url || ""))));
    row(o, "effects take their look from Imagine textures", bad.length === 0, fx.map((m) => `${m.mesh} (${m.kind}): textures ${m.textures.map((t) => basename((t.url || t.slot).split("?")[0])).join(",") || "none"}${m.colours.length ? "; colours " + m.colours.slice(0, 3).join(", ") : ""}`).join(" | "),
      ["Sample the particle/veil colour and alpha from an Imagine plate (grain sheet, veil sheet cut from the key), not from a typed colour."]);
    if (cfg.effects && cfg.effects.forbidColourLiterals) {
      const lit = fx.filter((m) => m.colours.length);
      row(o, "effects: no typed colours", lit.length === 0, lit.map((m) => m.mesh + ": " + m.colours.join(", ")).join(" | ") || "none", ["Replace the colour constants with texture samples."]);
    }
  }

  // ---------------- 7. key-image checklist + capture sheet
  if (checks.has("checklist")) {
    const items = spec.checklist || [];
    const tiles = Object.entries(captures).map(([k, c]) => ({ img: c.img, label: `${k} ${c.pose.camera.join(",")}` }));
    const sheetPath = join(odir, "capture-sheet.jpg");
    py("sheet", { out: sheetPath, key: spec.keyCrop && existsSync(spec.keyCrop) ? spec.keyCrop : null, tiles, title: `${spec.id} (${spec.type}) vs key crop - object-gate` });
    o.files.sheet = sheetPath;
    if (!items.length) row(o, "key checklist written", false, "spec has no checklist", ["Copy the profile `checklistTemplate`, make one item per visible key feature (volume, relief, damage, materials, colours, details), each with capture angles."]);
    if (!spec.keyCrop || !existsSync(spec.keyCrop)) row(o, "key crop present", false, `keyCrop ${spec.keyCrop}`, ["Point keyCrop at the object's crop of the biome key still."]);
    const rec = existsSync(spec.record) ? readYaml(spec.record) || {} : {};
    const recItems = rec.items || {};
    const todo = { object: spec.id, sheet: sheetPath, captures: Object.fromEntries(Object.entries(captures).map(([k, c]) => [k, c.hash])), items: {} };
    const missing = [];
    for (const it of items) {
      const r = recItems[it.id];
      todo.items[it.id] = { feature: it.feature, captures: it.captures, pass: r ? r.pass : null, note: r ? r.note : "" };
      if (!r || r.pass !== true) { missing.push(`${it.id}: ${r ? "recorded FAIL" : "no recorded pass"}`); continue; }
      for (const a of it.captures || []) {
        if (a === "clip") continue;
        const now = captures[a] && captures[a].hash, then = r.captures && r.captures[a];
        if (!now) missing.push(`${it.id}: capture ${a} not produced`);
        else if (!then) missing.push(`${it.id}: no ${a} capture recorded`);
        else if (ham(now, then) > cfg.checklist.maxHashDistance) missing.push(`${it.id}: ${a} capture changed since the pass (dHash ${ham(now, then)}) - re-verify`);
      }
    }
    writeFileSync(join(odir, "checklist-todo.yaml"), yaml.dump(todo, { lineWidth: 140 }));
    if (items.length) row(o, "key checklist: every item verified on a current capture", missing.length === 0, missing.slice(0, 8).join("; ") || `${items.length}/${items.length} items pass on current captures`,
      [`Look at ${sheetPath} next to the key crop. For each item write pass/fail + note in ${spec.record} (copy ${join(odir, "checklist-todo.yaml")}: it has the current capture hashes). Fix every fail first.`]);
    if (spec.keyCrop && existsSync(spec.keyCrop) && captures.close) {
      const c = py("colour", { img: captures.close.img, mask: captures.close.mask, key: spec.keyCrop });
      const lim = cfg.checklist.maxDeltaE;
      row(o, "colour vs key crop (CIELAB)", lim == null || c.deltaE <= lim, `deltaE ${c.deltaE} object L*a*b* ${c.labObject} key ${c.labKey}${lim == null ? " (report only)" : ""}`, ["Re-grade the plate or the lighting toward the key."], lim == null ? "INFO" : undefined);
    }
  }
}

// ------------------------------------------------------------------ report
export function toMarkdown(rep) {
  const L = [];
  L.push(`# object-gate report — ${rep.verdict}`, "", `URL ${rep.url} · adapter ${rep.adapter} · ${rep.startedAt}`, "");
  const tbl = (rows) => { L.push("| Check | Status | Detail | Fix hints |", "|---|---|---|---|"); for (const r of rows) L.push(`| ${r.check} | ${r.status} | ${String(r.detail).replace(/\|/g, "/").slice(0, 600)} | ${(r.hints || []).join("<br>").replace(/\|/g, "/").slice(0, 900)} |`); L.push(""); };
  L.push("## Runtime"); tbl(rep.runtime);
  L.push("## Objects", "", "| Object | Type | Verdict | FAIL rows |", "|---|---|---|---|");
  for (const o of rep.objects) L.push(`| ${o.id} | ${o.type} | ${o.verdict} | ${o.rows.filter((r) => r.status === "FAIL").map((r) => r.check).join(", ")} |`);
  L.push("");
  for (const o of rep.objects) { L.push(`### ${o.id} (${o.type}) — ${o.verdict}`, "", `hero copy ${o.hero || "-"}${o.files.sheet ? ` · sheet \`${o.files.sheet}\`` : ""}`, ""); tbl(o.rows); }
  return L.join("\n");
}
