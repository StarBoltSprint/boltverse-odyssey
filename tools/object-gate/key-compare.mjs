#!/usr/bin/env node
// object-gate key-compare (2026-10-10, additive to API 1.3): the biome key image vs the in-game view from the key camera, element by element.
// MANDATORY: cli.mjs / gateSceneKC() / gateAndFix() run it whenever the scene yaml has `keyCompare:`; imagine-to-3d auto.py runs it as stage
// `keycompare` and fixloop.py loops on it. Every run writes the side-by-side sheet (sheet.jpg + sheet-small.jpg).
//
//   node tools/object-gate/key-compare.mjs --spec specs/zone-b/key-compare.yaml [--url U] [--out DIR] [--only a,b]
//        [--game shot.png]        # score an existing key-camera render (no browser)
//        [--solve]                # search the camera that best reproduces the key (writes <out>/camera.json; no gate)
// Exit 0 = PASS, 1 = FAIL (a gated metric out of bounds or an element missing), 2 = bad invocation.
//
// Thresholds: per element TYPE from the object-gate profiles (`keyCompare: {gate: {...}, target: {...}}`): object
// types (building, rock, terrain, vehicle, prop, effect, ...) read profiles/<type>.yaml; scene-only types (sky,
// celestial, atmosphere, light) read `_base.yaml` keyCompare.types. `gate` FAILs the run; `target` is the level the
// fix loop drives toward (reported as a gap, never a FAIL).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join, isAbsolute } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import yaml from "js-yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const PY = join(HERE, "lib/keycompare.py");
const LAUNCH = { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

async function loadPlaywright() {
  for (const p of [process.env.OG_PLAYWRIGHT, "playwright", "/workspace/playtest/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { return await import(p); } catch (e) {}
  }
  throw new Error("playwright not found: npm i playwright, or set OG_PLAYWRIGHT=/path/to/playwright/index.mjs");
}
const readYaml = (p) => yaml.load(readFileSync(p, "utf8"));
function deepMerge(a, b) {
  const o = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) o[k] = v && typeof v === "object" && !Array.isArray(v) && typeof o[k] === "object" ? deepMerge(o[k], v) : v;
  return o;
}

/** keyCompare thresholds for one element type: profiles/<type>.yaml keyCompare (extends _base), else _base keyCompare.types[type]. */
export function keyCompareThresholds(type) {
  const base = readYaml(join(HERE, "profiles/_base.yaml")).keyCompare || {};
  const def = { gate: base.gate || {}, target: base.target || {} };
  const pf = join(HERE, "profiles", `${type}.yaml`);
  if (existsSync(pf) && type !== "_base") {
    const p = readYaml(pf);
    let kc = p.keyCompare || {};
    if (p.extends && p.extends !== "_base" && existsSync(join(HERE, "profiles", `${p.extends}.yaml`))) kc = deepMerge(readYaml(join(HERE, "profiles", `${p.extends}.yaml`)).keyCompare || {}, kc);
    return deepMerge(def, kc);
  }
  return deepMerge(def, (base.types || {})[type] || {});
}

export function loadKeySpec(p) {
  const s = readYaml(p); s.dir = dirname(resolve(p));
  const abs = (x) => (x && !isAbsolute(x) && !/^https?:/.test(x) ? resolve(s.dir, x) : x);
  s.key = abs(s.key);
  for (const e of s.elements) for (const side of ["key", "game"]) if (e[side] && e[side].mask && e[side].mask.render) e[side].mask.render = e[side].mask.render;
  return s;
}

const withQuery = (u, q) => u + (u.includes("?") ? "&" : "?") + new URLSearchParams(q).toString();

/** In-page: fixed fov + eye offset on the game's perspective camera, applied right before every render (no file edit). */
async function camHook(page, fovDeg, dy) {
  await page.evaluate(([f, d]) => {
    window.__kc = { fov: f, dy: d || 0 };
    const R = window.__renderer; if (!R || R.__kcHooked) return; R.__kcHooked = true;
    const orig = R.render.bind(R);
    R.render = (s, c) => { if (c && c.isPerspectiveCamera && window.__kc) { if (window.__kc.fov) { c.fov = window.__kc.fov; c.updateProjectionMatrix(); } c.position.y += window.__kc.dy; const r = orig(s, c); c.position.y -= window.__kc.dy; return r; } return orig(s, c); };
  }, [fovDeg || 0, dy || 0]);
}

async function openAt(browser, url, cam, vp, log) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); page.setDefaultTimeout(600000); const logs = [];
  page.on("console", (m) => { if (/^(error|warning)$/.test(m.type())) logs.push(m.type() + " " + m.text()); });
  page.on("pageerror", (e) => logs.push("pageerror " + e.message));
  const q = { hud: "0", lockq: "1" };
  if (cam) Object.assign(q, { x: cam.x, z: cam.z, yaw: cam.yaw, pitch: cam.pitch, eye: cam.eye });
  const u = withQuery(url, q); log && log("open " + u);
  await page.goto(u, { waitUntil: "load", timeout: 600000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
  if (cam) await camHook(page, cam.fovDeg, 0);
  return { ctx, page, logs };
}

/** Render the key camera: main view + every mask render the elements ask for. -> {game, masks:{name: png}, logs} */
export async function renderKeyView(spec, opts = {}) {
  const log = opts.log || console.log; const out = opts.out; mkdirSync(out, { recursive: true });
  const url = opts.url || spec.url; const vp = spec.viewport || [1280, 720]; const cam = spec.camera; const settle = spec.settleMs ?? 10000;
  const { chromium } = await loadPlaywright(); const browser = await chromium.launch(LAUNCH);
  const res = { masks: {}, logs: [] };
  try {
    const renders = [["game", url]];
    for (const [name, r] of Object.entries(spec.maskRenders || {})) renders.push([name, r.startsWith("http") ? r : new URL(r, url).href]);
    for (const [name, u] of renders) {
      const h = await openAt(browser, u, cam, vp, log);
      await h.page.waitForTimeout(settle);
      const p = join(out, `${name}.png`); await h.page.screenshot({ path: p, timeout: 300000 });
      if (name === "game") res.game = p; else res.masks[name] = p;
      res.logs.push(...h.logs.map((l) => `${name}: ${l}`)); await h.ctx.close();
    }
  } finally { await browser.close(); }
  return res;
}

/** Search the in-game camera that best reproduces the key (sky / dark-structure / rest class agreement, 256x144). */
export async function solveCamera(spec, opts = {}) {
  const log = opts.log || console.log; const out = join(opts.out, "solve"); mkdirSync(out, { recursive: true });
  const url = opts.url || spec.url; const S = spec.solve || {}; const c0 = spec.camera;
  const { chromium } = await loadPlaywright(); const browser = await chromium.launch(LAUNCH);
  const scored = [];
  try {
    const h = await openAt(browser, url, { ...c0, eye: S.eye ?? c0.eye }, S.viewport || [384, 216], log);
    await h.page.waitForTimeout(6000);
    let n = 0;
    const shoot = async (batch) => {
      const pngs = [];
      for (const c of batch) {
        await h.page.evaluate((c) => { const st = window.__st; st.x = c.x; st.z = c.z; st.yaw = c.yaw; st.pitch = c.pitch; window.__kc.fov = c.fovDeg; window.__kc.dy = c.dy || 0; }, c);
        await h.page.waitForTimeout(S.waitMs ?? 1500);
        const p = join(out, `p${String(n++).padStart(4, "0")}.jpg`); await h.page.screenshot({ path: p, type: "jpeg", quality: 80 }); pngs.push(p);
      }
      writeFileSync(join(out, "batch.json"), JSON.stringify(pngs));
      const sc = JSON.parse(execFileSync("python3", [PY, "score", spec.key, join(out, "batch.json")], { encoding: "utf8" }));
      batch.forEach((c, i) => scored.push({ ...c, ...sc[i] }));
      log(`  solve batch ${batch.length}: best ${Math.max(...sc.map((x) => x.score))}`);
    };
    // stage 1: positions x yaw at the base fov / eye
    const P = S.positions || [[c0.x, c0.z]]; const Y = S.yaws || [c0.yaw];
    await shoot(P.flatMap(([x, z]) => Y.map((yaw) => ({ x, z, yaw, pitch: c0.pitch, fovDeg: c0.fovDeg, dy: 0 }))));
    // stage 2: refine the top candidates (yaw, pitch, fov, eye offset)
    const top = [...scored].sort((a, b) => b.score - a.score).slice(0, S.refineTop ?? 4);
    const R = [];
    for (const t of top) for (const dyaw of [-4, 0, 4]) for (const pitch of [t.pitch - 3, t.pitch, t.pitch + 3]) for (const fovDeg of [c0.fovDeg]) for (const dy of S.dys || [0])
      R.push({ x: t.x, z: t.z, yaw: t.yaw + dyaw, pitch, fovDeg, dy });
    await shoot(R);
    // stage 3: position nudge around the best
    const b = [...scored].sort((a, b) => b.score - a.score)[0]; const st = S.nudgeM ?? 6;
    await shoot([[-st, 0], [st, 0], [0, -st], [0, st]].map(([dx, dz]) => ({ ...b, x: b.x + dx, z: b.z + dz })));
    // stage 4: field of view (the key's lens is unknown) at the best pose
    const b2 = [...scored].sort((a, b) => b.score - a.score)[0];
    await shoot((S.fovs || []).filter((f) => f !== b2.fovDeg).map((fovDeg) => ({ ...b2, fovDeg })));
    await h.ctx.close();
  } finally { await browser.close(); }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const camera = { x: +best.x.toFixed(2), z: +best.z.toFixed(2), yaw: best.yaw, pitch: best.pitch, fovDeg: best.fovDeg, eye: +((S.eye ?? c0.eye) + (best.dy || 0)).toFixed(2), score: best.score, skyIoU: best.skyIoU, darkIoU: best.darkIoU, png: best.png };
  writeFileSync(join(opts.out, "camera.json"), JSON.stringify({ camera, top: scored.slice(0, 12), shots: scored.length }, null, 1));
  return camera;
}

/** Full key-compare: render (or reuse --game), score every element, apply per-type thresholds, write sheet + report. */
export async function keyCompare(spec, opts = {}) {
  const log = opts.log || console.log;
  const out = resolve(opts.out || join(spec.dir, "out", "key-compare-" + new Date().toISOString().replace(/[:.]/g, "-")));
  mkdirSync(out, { recursive: true });
  let r = opts.game ? { game: resolve(opts.game), masks: opts.masks || {}, logs: [] } : await renderKeyView(spec, { ...opts, out, log });
  const elements = spec.elements.filter((e) => !opts.only || opts.only.includes(e.id)).map((e) => {
    // a mask render that was not produced (--game without --masks) falls back to the key's colour rule (logged)
    const fix = (side) => side && side.mask && side.mask.render ? (r.masks[side.mask.render] ? { ...side, mask: { img: r.masks[side.mask.render] } } : { ...side, mask: e.key.mask, maskFallback: side.mask.render }) : side;
    const gameRender = e.gameRender && r.masks[e.gameRender] ? e.gameRender : undefined;
    return { ...e, gameRender, key: fix(e.key), game: { ...e.key, ...(fix(e.game) || {}) } };
  });
  const types = [...new Set(elements.map((e) => e.type))];
  const thresholds = Object.fromEntries(types.map((t) => [t, keyCompareThresholds(t)]));
  const job = { key: spec.key, game: r.game, renders: r.masks, out, elements, thresholds, title: spec.title || "Clé vs jeu" };
  writeFileSync(join(out, "job.json"), JSON.stringify(job, null, 1));
  const res = JSON.parse(execFileSync("python3", [PY, join(out, "job.json")], { encoding: "utf8", maxBuffer: 1 << 26 }).trim().split("\n").pop());
  const full = JSON.parse(readFileSync(join(out, "key-compare.json"), "utf8"));
  const rows = [];
  for (const e of full.elements) {
    const hint = { iou: "shape: shape-seed search / silhouette warp toward the key mask (fixloop kc-shape)", deLit: "colour: grade-match the lit side toward the key (fixloop kc-colour)", deShadow: "colour: grade-match the shadow side (fixloop kc-colour)", structure: "detail: plate re-pick from the key crop, relief strength, detail-layer tuning (fixloop kc-detail)" };
    if (e.verdict === "N/A") continue;
    if (e.verdict === "MISSING") { rows.push({ id: "key-compare.missing", element: e.id, check: `key-compare ${e.id}: present in game`, status: e.reportOnly ? "INFO" : "FAIL", detail: "element of the key not found in the key-camera render", hints: ["Build / mount the element (or mark it reportOnly with a reason)."] }); continue; }
    for (const [m, id, lim, op] of [["iou", "key-compare.iou", "iouMin", ">="], ["deLit", "key-compare.lit-de", "deLitMax", "<="], ["deShadow", "key-compare.shadow-de", "deShadowMax", "<="], ["structure", "key-compare.structure", "structureMin", ">="]]) {
      if (e[m] == null) continue;
      const L = (e.gate || {})[lim]; const ok = L == null || (op === ">=" ? e[m] >= L : e[m] <= L);
      const gap = (e.gaps || []).find((g) => g.metric === m);
      rows.push({ id, element: e.id, check: `key-compare ${e.id}: ${m} ${op} ${L ?? "-"}`, status: L == null || e.reportOnly ? "INFO" : ok ? "PASS" : "FAIL",
        detail: `${m} ${e[m]}${gap ? ` (target ${gap.target}, gap ${gap.gap})` : ""}${m === "iou" ? ` · shape-only ${e.iouAligned}` : ""}${m === "structure" && e.lpips != null ? ` · LPIPS ${e.lpips}` : ""}`, hints: ok ? [] : [hint[m]] });
    }
  }
  const verdict = rows.some((x) => x.status === "FAIL") ? "FAIL" : "PASS";
  const rep = { tool: "object-gate key-compare", apiVersion: "1.3", module: "key-compare", verdict, out, sheet: join(out, "sheet.jpg"), sheetSmall: join(out, "sheet-small.jpg"), game: r.game, key: spec.key, camera: spec.camera, rows, elements: full.elements, renderLogs: r.logs, summary: full.summary };
  writeFileSync(join(out, "report.json"), JSON.stringify(rep, null, 1));
  log(`key-compare ${verdict}: ${JSON.stringify(full.summary)} · sheet ${rep.sheet}`);
  return rep;
}

// ------------------------------------------------------------------ scene integration (mandatory)
export const KC_CHECK_IDS = [
  [/^key-compare run/, "key-compare.crash"], [/^key-compare .*: present/, "key-compare.missing"], [/^key-compare .*: iou/, "key-compare.iou"],
  [/^key-compare .*: deLit/, "key-compare.lit-de"], [/^key-compare .*: deShadow/, "key-compare.shadow-de"], [/^key-compare .*: structure/, "key-compare.structure"],
];

/** Run key-compare for a gate report when the scene has `keyCompare:` and fold it into the verdict + report files.
 *  Called by gateSceneKC() (cli.mjs, hooks/imagine-to-3d.mjs gateAndFix). Own browser, after the gate's one closed. */
export async function withKeyCompare(report, scene, opts = {}) {
  if (!scene.keyCompare || opts.noKeyCompare) return report;
  const log = opts.log || console.log;
  const p = isAbsolute(scene.keyCompare) ? scene.keyCompare : resolve(scene.dir || ".", scene.keyCompare);
  const spec = loadKeySpec(p); if (opts.keyCamera) Object.assign(spec.camera, opts.keyCamera);
  let kc;
  try { kc = await keyCompare(spec, { out: join(report.out, "key-compare"), url: opts.keyCompareUrl, only: opts.keyCompareOnly || null, log }); }
  catch (e) { kc = { verdict: "FAIL", rows: [{ id: "key-compare.crash", check: "key-compare run", status: "FAIL", detail: String(e && e.stack || e).slice(0, 400), hints: ["Fix the key-compare spec / staging URL; a crash is a FAIL."] }] }; }
  report.keyCompare = { verdict: kc.verdict, sheet: kc.sheet, sheetSmall: kc.sheetSmall, report: kc.out && join(kc.out, "key-compare.md"), rows: kc.rows, summary: kc.summary };
  if (kc.verdict === "FAIL") report.verdict = "FAIL";
  writeFileSync(join(report.out, "report.json"), JSON.stringify(report, null, 2));
  const md = existsSync(join(report.out, "report.md")) ? readFileSync(join(report.out, "report.md"), "utf8") : "";
  const L = [md.replace(/^# object-gate report — \w+/, `# object-gate report — ${report.verdict}`), "", `## Key-compare (key image vs key camera) — ${kc.verdict}`, "",
    `sheet \`${kc.sheet}\` · table \`${kc.out ? join(kc.out, "key-compare.md") : "-"}\``, "", "| Check | Status | Detail | Fix hints |", "|---|---|---|---|"];
  for (const r of kc.rows || []) L.push(`| ${r.check} | ${r.status} | ${String(r.detail).replace(/\|/g, "/")} | ${(r.hints || []).join("<br>")} |`);
  writeFileSync(join(report.out, "report.md"), L.join("\n") + "\n");
  return report;
}

/** gateScene() + the mandatory key-compare (when the scene yaml has `keyCompare:`). Use this instead of gateScene(). */
export async function gateSceneKC(scene, opts = {}) {
  const { gateScene } = await import("./gate.mjs");
  return withKeyCompare(await gateScene(scene, opts), scene, opts);
}

// ------------------------------------------------------------------ CLI
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const a = process.argv.slice(2); const opt = {};
  for (let i = 0; i < a.length; i++) { const k = a[i]; if (!k.startsWith("--")) continue; const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true; opt[k.slice(2)] = v; }
  if (!opt.spec) { console.error("usage: key-compare.mjs --spec <key-compare.yaml> [--url U] [--out DIR] [--only a,b] [--game shot.png] [--solve]"); process.exit(2); }
  const spec = loadKeySpec(opt.spec);
  if (opt.camera) Object.assign(spec.camera, JSON.parse(readFileSync(opt.camera, "utf8")).camera);
  const out = resolve(opt.out || join(spec.dir, "out", "key-compare"));
  if (opt.solve) { const c = await solveCamera(spec, { url: opt.url, out }); console.log(JSON.stringify(c)); process.exit(0); }
  const masks = {}; if (opt.masks) for (const kv of String(opt.masks).split(",")) { const [k, v] = kv.split("="); masks[k] = resolve(v); }
  const rep = await keyCompare(spec, { url: opt.url, out, only: opt.only ? String(opt.only).split(",") : null, game: opt.game, masks });
  for (const r of rep.rows) console.log(`${r.status}\t${r.check}\t${r.detail}`);
  console.log(`---\n${rep.verdict}  sheet ${rep.sheet}  report ${out}/key-compare.md`);
  process.exit(rep.verdict === "PASS" ? 0 : 1);
}
