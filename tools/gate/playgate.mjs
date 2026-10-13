// tools/13 play-build gate: render the SERVED play page headless at the phone buffer and inventory its live scene.
// node playgate.mjs <play_url> <out_dir> [--views a,b]   -> JSON on stdout (renders as PNG in out_dir)
import { chromium } from "/workspace/playtest/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const CFG = JSON.parse(readFileSync(here + "playgate.views.json", "utf8"));
const [url, out, ...rest] = process.argv.slice(2);
const only = rest[0] === "--views" ? rest[1].split(",") : Object.keys(CFG.views);
const HOOK = "if (window.__gcam) { const g = window.__gcam; cam.fov = g.fov; cam.updateProjectionMatrix(); cam.position.set(...g.eye); "
  + "if (g.look) cam.lookAt(...g.look); else cam.rotation.set(g.pitch_deg * Math.PI / 180, 0, 0, 'YXZ'); bolt.visible = false; } lod.update(cam);";
const EXPOSE = "window.__scene = scene; window.__cam = cam; window.__cfg = { BOOM, EYE, AIM, fov0: cam.fov }; window.__ready = true;";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = { url, views: {}, inventory: null, camera: null };
for (const n of only) {
  const v = CFG.views[n];
  const ctx = await browser.newContext({ viewport: { width: CFG.buffer.css[0], height: CFG.buffer.css[1] }, deviceScaleFactor: CFG.buffer.dpr });
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.route(/index\.html(\?.*)?$/, async (route) => {
    const r = await route.fetch(); let h = await r.text();
    if (!h.includes("lod.update(cam);") || !h.includes("window.__ready = true;")) throw new Error("hook points missing in served page");
    h = h.replace("lod.update(cam);", HOOK).replace("window.__ready = true;", EXPOSE);
    await route.fulfill({ response: r, body: h, headers: { ...r.headers(), "content-type": "text/html" } });
  });
  if (!v.page) await page.addInitScript((g) => { window.__gcam = g; }, v);
  await page.goto(url.replace(/\/?$/, "/") + "index.html?modeb=1&aa=1" + (v.page ? "&" + v.page : ""), { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.addStyleTag({ content: "#hud,#bar,#stick{display:none!important}" });
  await page.waitForTimeout(2500);
  const p = `${out}/${n}.png`; await page.screenshot({ path: p, type: "png" });
  if (!res.inventory) {
    res.inventory = await page.evaluate(() => {
      const L = [];
      window.__scene.traverse((o) => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        let lodLevel = null; for (let q = o.parent; q; q = q.parent) if (q.isLOD) lodLevel = q.levels.findIndex((l) => l.object === o);
        L.push({ name: o.name || "", type: o.geometry.type, lodLevel, visible: o.visible,
          materials: ms.map((m) => ({ name: m.name, type: m.type, side: m.side, transparent: m.transparent, opacity: m.opacity,
            map: m.map && m.map.image ? (m.map.image.currentSrc || m.map.image.src || "").split("/").pop() : null })) }); });
      return L; });
    const c = await page.evaluate(() => ({ ...window.__cfg }));
    c.pitch_deg = Math.atan2(c.AIM - c.EYE, c.BOOM) * 180 / Math.PI; res.camera = c;
  }
  res.views[n] = { png: p, errors: errs }; await ctx.close();
}
await browser.close(); console.log(JSON.stringify(res));
