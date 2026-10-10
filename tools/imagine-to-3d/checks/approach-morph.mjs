// Approach-morph test (SmiR 20:52): deterministic camera path for one mesa, far -> 10 m -> far along a fixed heading,
// geometric steps (3 %/frame), silhouette mask (?mesaMask=1: mesas flat magenta) per frame, IoU between consecutive
// frames. Natural motion gives a smooth IoU curve; an LOD swap / streaming pop / relief jump shows as an outlier.
// FAIL if any frame's (1 - IoU) > max(0.02, 4 x the local median of its +-4 neighbours).
// node checks/approach-morph.mjs <url> <mesaId> <fromHeadingDeg> <outDir> [farM=300] [nearM=10]
// imagine-to-3d (2026-10-10): every camera position is checked against the collision hull (it.solid); a frame with the
// camera inside the hull is recorded in path.json cameraInside[] and morph_iou.py FAILs the run (a player can't be there).
import { mkdirSync, writeFileSync } from "fs";
const [url, id, from, out, far = "300", near = "10"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const { chromium } = await import("/workspace/playtest/node_modules/playwright/index.mjs");
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await (await browser.newContext({ viewport: { width: 270, height: 600 }, deviceScaleFactor: 1 })).newPage();
const logs = []; page.on("console", (m) => logs.push(m.type() + " " + m.text())); page.on("pageerror", (e) => logs.push("pageerror " + e.message));
await page.goto(url + (url.includes("?") ? "&" : "?") + "mesaMask=1&mesaOnly=1&hud=0", { waitUntil: "load", timeout: 600000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 600000 });
await page.waitForTimeout(3000);
// isolate the mesas: hide every other object (towers, terrain, drifts, props) so occluders and terrain parallax don't
// pollute the silhouette; the sky stays (the mask is flat magenta)
await page.evaluate(() => {
  const g = window.__zbDebug && window.__zbDebug.ground; let root = g; while (root && root.parent) root = root.parent;
  const keep = new Set(); root.traverse((o) => { if (o.name === "zb-mesas") { let p = o; while (p) { keep.add(p); p = p.parent; } o.traverse((c) => keep.add(c)); } });
  root.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && !keep.has(o) && !/sky/i.test(o.name || "")) o.visible = false; });
  window.__isolated = true;
});
// distances from the mesa's collider EDGE along the heading (SmiR: 300 m -> 10 m -> 300 m); a 4-frame pre-roll
// from 460 m crosses the LOD0 streaming threshold (built < 430 m from the origin) before the measured path
const ds = []; for (let d = +far; d > +near; d *= +(process.env.STEP || 0.95)) ds.push(d); ds.push(+near);
const pre = [460, 410, 360, 330].filter((x) => x > +far); const path = pre.concat(ds, ds.slice(0, -1).reverse(), pre.slice().reverse());
const masks = []; const cameraInside = [];
for (const [k, d] of path.entries()) {
  const r = await page.evaluate(({ id, from, d }) => {
    const st = window.__st, f = window.__zbField, it = window.__mesasGate.items.find((m) => m.id === id);
    const a = (from * Math.PI) / 180, dx = Math.sin(a), dz = -Math.cos(a);
    // distance is measured from the mesa ORIGIN (same measure as the LOD bands)
    const inside = (x, z) => { let c = false; const poly = it.solid; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
    let t = 0; while (inside(it.x + dx * t, it.z + dz * t) && t < 2000) t += 0.25;
    const x = it.x + dx * (t + d), z = it.z + dz * (t + d);
    st.x = x; st.z = z; st.yaw = (Math.atan2(it.x - x, -(it.z - z)) * 180) / Math.PI; st.pitch = 8; st.y = f.surfaceHeight(x, z) + 1.7;
    const ins = inside(x, z);
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => res({ x, z, ins })))));
  }, { id, from: +from, d });
  if (r.ins) cameraInside.push(k);
  const buf = await page.screenshot({ type: "png", timeout: 240000 });
  writeFileSync(`${out}/f${String(k).padStart(3, "0")}.png`, buf);
}
writeFileSync(`${out}/path.json`, JSON.stringify({ id, from: +from, path, cameraInside, console: logs.filter((l) => !/^(log|debug|info) /.test(l)) }));
console.log("frames", path.length, "console", JSON.stringify(logs.filter((l) => !/^(log|debug|info) /.test(l))));
await browser.close();
