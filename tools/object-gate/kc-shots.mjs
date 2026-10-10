// kc-shots: ONE headless browser kept open, driven by JSON lines on stdin (one reply line per command on stdout).
// Used by imagine-to-3d/placement_v2.py (camera match + real-render greedy placement) and tools/lighting (sun test).
//   {"cmd":"open","url":U,"cam":{x,z,yaw,pitch,eye,fovDeg},"vp":[480,270],"settle":6000}   load (or reload) a page
//   {"cmd":"pose","cam":{...,"dy":0},"wait":2500}   move the camera in-page (no reload)
//   {"cmd":"shot","path":P}                          screenshot
//   {"cmd":"probe"}                                  frame fractions of the spire top / base and of the avenue vanishing
//                                                    point, from the camera the game actually rendered with (+ dy)
//   {"cmd":"quit"}
// Staging pages only (the caller passes the URL). Never edits files.
import { createInterface } from "node:readline";
const LAUNCH = { headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
async function loadPlaywright() {
  for (const p of [process.env.OG_PLAYWRIGHT, "playwright", "/workspace/playtest/node_modules/playwright/index.mjs"].filter(Boolean)) { try { return await import(p); } catch (e) {} }
  throw new Error("playwright not found (set OG_PLAYWRIGHT)");
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch(LAUNCH);
let ctx = null, page = null, vp = null;
const withQuery = (u, q) => u + (u.includes("?") ? "&" : "?") + new URLSearchParams(q).toString();
async function hook(fov, dy) {
  await page.evaluate(([f, d]) => {
    window.__kc = { fov: f, dy: d || 0 };
    const R = window.__renderer; if (!R || R.__kcHooked) return; R.__kcHooked = true;
    const orig = R.render.bind(R);
    R.render = (s, c) => {
      if (c && c.isPerspectiveCamera && window.__kc) {
        if (window.__kc.fov) { c.fov = window.__kc.fov; c.updateProjectionMatrix(); }
        c.position.y += window.__kc.dy; c.updateMatrixWorld(true);
        window.__kcScene = s; window.__kcCam = c.clone(); window.__kcFrames = (window.__kcFrames || 0) + 1;
        const r = orig(s, c); c.position.y -= window.__kc.dy; return r;
      }
      return orig(s, c);
    };
  }, [fov || 0, dy || 0]);
}
async function frames(n, maxMs) {
  const f0 = await page.evaluate(() => window.__kcFrames || 0); const t0 = Date.now();
  while (Date.now() - t0 < maxMs) { await page.waitForTimeout(250); if ((await page.evaluate(() => window.__kcFrames || 0)) >= f0 + n) return; }
}
const H = {
  async open(m) {
    if (ctx && (!vp || vp[0] !== m.vp[0] || vp[1] !== m.vp[1])) { await ctx.close(); ctx = null; }
    if (!ctx) { vp = m.vp; ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1 }); page = await ctx.newPage(); page.setDefaultTimeout(600000); }
    const c = m.cam; const u = withQuery(m.url, { hud: "0", lockq: "1", x: c.x, z: c.z, yaw: c.yaw, pitch: c.pitch, eye: c.eye });
    const t0 = Date.now();
    await page.goto(u, { waitUntil: "load", timeout: 600000 });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
    await hook(c.fovDeg, c.dy); await page.waitForTimeout(m.settle ?? 6000); await frames(2, 30000);
    return { loadMs: Date.now() - t0 };
  },
  async pose(m) {
    await page.evaluate((c) => { const st = window.__st; st.x = c.x; st.z = c.z; st.yaw = c.yaw; st.pitch = c.pitch; window.__kc.fov = c.fovDeg; window.__kc.dy = c.dy || 0; }, m.cam);
    await frames(2, m.wait ?? 20000); return {};
  },
  async shot(m) { await page.screenshot({ path: m.path, type: m.path.endsWith(".jpg") ? "jpeg" : "png", timeout: 300000 }); return { path: m.path }; },
  async probe() {
    return await page.evaluate(() => {
      const T = window.__gdTHREE, c = window.__kcCam, s = window.__kcScene; if (!T || !c || !s) return { error: "no frame yet" };
      const f = (p) => { const v = p.clone().project(c); return [+(0.5 + 0.5 * v.x).toFixed(4), +(0.5 - 0.5 * v.y).toFixed(4), v.z < 1]; };
      let sp = null; s.traverse((o) => { if (!sp && /^spire-lod/.test(o.name) && o.visible) sp = o; });
      const out = { cam: { x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2), fov: c.fov } };
      if (sp) { const b = new T.Box3().setFromObject(sp); const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
        out.spireTop = f(new T.Vector3(cx, b.max.y, cz)); out.spireBase = f(new T.Vector3(cx, b.min.y, cz)); out.spireWorld = [cx, b.max.y, cz, b.min.y]; }
      const F = new T.Vector3(0.97933, 0, -0.20233);   // avenue direction (objects layout frame)
      out.vp = f(c.position.clone().addScaledVector(F, 1e5));
      return out;
    });
  },
};
const rl = createInterface({ input: process.stdin });
for await (const line of rl) {
  if (!line.trim()) continue;
  let m; try { m = JSON.parse(line); } catch (e) { console.log(JSON.stringify({ ok: false, error: "bad json" })); continue; }
  if (m.cmd === "quit") break;
  try { const r = await H[m.cmd](m); console.log(JSON.stringify({ ok: true, ...r })); }
  catch (e) { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 400) })); }
}
await browser.close(); process.exit(0);
