// node lod-morph-gate.mjs <url> <outdir>
// Deterministic approach 300 m -> 10 m on 2 towers; silhouette masks of the tower batches through the real LOD
// assignment (window.__zbSilhouette); FAIL on any frame-to-frame IoU jump (LOD swap / morph).
import fs from "node:fs";
const [url, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import("/workspace/playtest/node_modules/playwright/index.mjs");
const b = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
await p.goto(url, { timeout: 240000 });
await p.waitForFunction(() => window.__ready === true && window.__zbSilhouette && window.__air, null, { timeout: 300000, polling: 1000 });
const feet = await p.evaluate(() => window.__air.feet);
// Grok Bot 10-10: the approach stops 2 m outside any collision footprint (a player cannot stand inside the tower base).
const solids = await p.evaluate(() => (window.__objectsGate.footprints || []).map((f) => f.solid));
const CLEAR_M = 2;
function clearance(x, z) {
  let best = Infinity;
  for (const poly of solids) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      const ex = xj - xi, ez = zj - zi, L2 = ex * ex + ez * ez || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / L2));
      best = Math.min(best, Math.hypot(x - (xi + t * ex), z - (zi + t * ez)));
    }
    if (inside) return -1;
  }
  return best;
}
const targets = [feet[0], feet[1]];
const W = 135, H = 240;
let fail = false; const rows = [];
for (const [ti, [tx, tz]] of targets.entries()) {
  // approach from the spawn side
  let dx = -51.1 - tx, dz = 9.6 - tz; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
  const ious = []; let prev = null; const strip = []; let stopAt = 10;
  for (let d = 300; d >= 10; d *= 0.96) {
    if (clearance(tx + dx * d, tz + dz * d) < CLEAR_M) { stopAt = +d.toFixed(1); break; }
    const m = await p.evaluate(([tx, tz, dx, dz, d, W, H]) => {
      const x = tx + dx * d, z = tz + dz * d, f = window.__zbField;
      const gy = f && f.surfaceHeight ? f.surfaceHeight(x, z) : 0;
      const ty = (f && f.surfaceHeight ? f.surfaceHeight(tx, tz) : 0) + Math.min(40, d * 0.35 + 8);
      return window.__zbSilhouette(x, gy + 2, z, tx, ty, tz, W, H);
    }, [tx, tz, dx, dz, d, W, H]);
    if (prev) {
      let inter = 0, uni = 0;
      for (let i = 0; i < m.length; i++) { inter += m[i] & prev[i]; uni += m[i] | prev[i]; }
      ious.push({ d: +d.toFixed(1), iou: uni ? inter / uni : 1 });
    }
    prev = m; strip.push(m);
  }
  // a smooth approach changes the mask slowly; a LOD swap shows as an outlier drop vs the neighbours
  const v = ious.map((r) => r.iou);
  const bad = ious.filter((r, i) => {
    const nb = [v[i - 2], v[i - 1], v[i + 1], v[i + 2]].filter((q) => q !== undefined).sort((a, b) => a - b);
    const med = nb[Math.floor(nb.length / 2)];
    return r.iou < 0.8 || med - r.iou > 0.05;
  });
  if (bad.length) fail = true;
  rows.push({ tower: ti, at: [tx, tz], stopAt, frames: strip.length, minIoU: Math.min(...v).toFixed(3), jumps: bad });
  fs.writeFileSync(`${out}/masks-t${ti}.json`, JSON.stringify({ W, H, n: strip.length, ious }));
  // contact strip (every 4th mask) as PGM
  const pick = strip.filter((_, i) => i % 4 === 0); const cw = W * pick.length;
  const buf = Buffer.alloc(cw * H);
  pick.forEach((m, k) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf[(H - 1 - y) * cw + k * W + x] = m[y * W + x] * 255; });
  fs.writeFileSync(`${out}/strip-t${ti}.pgm`, Buffer.concat([Buffer.from(`P5 ${cw} ${H} 255\n`), buf]));
}
for (const r of rows) console.log(JSON.stringify(r));
console.log(fail ? "FAIL lod-morph" : "PASS lod-morph (no silhouette jump 300 m -> 2 m outside the footprint, 2 towers)");
await b.close();
process.exit(fail ? 1 : 0);
