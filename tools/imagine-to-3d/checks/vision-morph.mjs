// node vision-morph.mjs <url> <outdir> [farM] [nearM]
// One hero shell. Silhouette IoU along 300 m -> 2 m. Fade step ΔE is 0: there is no crossfade.
import fs from "node:fs";
const [url, out, farS, nearS] = process.argv.slice(2);
const farM = Number(farS || 300);
const nearM = Number(nearS || 2);
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import("/workspace/playtest/node_modules/playwright/index.mjs");
const b = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await (await b.newContext({ viewport: { width: 270, height: 480 } })).newPage();
await p.goto(url, { timeout: 240000 });
await p.waitForFunction(() => window.__ready === true && typeof window.__visionSilhouette === "function", null, { timeout: 300000, polling: 1000 });
const meta = await p.evaluate(() => fetch("./objects1/vision/tower-meta.json").then((r) => r.json()));
const tx = meta.origin[0], tz = meta.origin[2];
let dx = -51.115 - tx, dz = 9.63 - tz;
const L = Math.hypot(dx, dz) || 1;
dx /= L; dz /= L;
const solids = await p.evaluate(() => (window.__objectsGate && window.__objectsGate.footprints || []).map((f) => f.solid));
function clearance(x, z) {
  let best = Infinity;
  for (const poly of solids) {
    if (!poly) continue;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i], [xj, zj] = poly[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi) inside = !inside;
      const ex = xj - xi, ez = zj - zi, L2 = ex * ex + ez * ez || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / L2));
      best = Math.min(best, Math.hypot(x - (xi + t * ex), z - (zi + t * ez)));
    }
    if (inside) return -1;
  }
  return best;
}
const W = 135, H = 240;
const ious = [];
let prev = null;
let frames = 0;
let stopAt = nearM;
for (let d = farM; d >= nearM; d *= 0.96) {
  if (clearance(tx + dx * d, tz + dz * d) < 2) { stopAt = +d.toFixed(1); break; }
  const m = await p.evaluate(([tx, tz, dx, dz, d, W, H]) => {
    const x = tx + dx * d, z = tz + dz * d;
    const f = window.__zbField;
    const gy = f && f.surfaceHeight ? f.surfaceHeight(x, z) : 2;
    const ty = (f && f.surfaceHeight ? f.surfaceHeight(tx, tz) : 0) + Math.min(40, d * 0.35 + 8);
    return window.__visionSilhouette(x, gy + 2, z, tx, ty, tz, W, H);
  }, [tx, tz, dx, dz, d, W, H]);
  frames++;
  if (prev) {
    let inter = 0, uni = 0;
    for (let i = 0; i < m.length; i++) { inter += (m[i] && prev[i]) ? 1 : 0; uni += (m[i] || prev[i]) ? 1 : 0; }
    ious.push({ d: +d.toFixed(1), iou: uni ? inter / uni : 1 });
  }
  prev = m;
}
const v = ious.map((r) => r.iou);
const bad = ious.filter((r, i) => {
  const nb = [v[i - 2], v[i - 1], v[i + 1], v[i + 2]].filter((q) => q !== undefined).sort((a, b) => a - b);
  const med = nb.length ? nb[Math.floor(nb.length / 2)] : r.iou;
  return r.iou < 0.8 || med - r.iou > 0.05;
});
const perf = await p.evaluate(() => window.__visionPerf || null);
const minIoU = v.length ? Math.min(...v) : 0;
const fail = bad.length > 0 || frames < 3;
const row = { frames, stopAt, minIoU: +minIoU.toFixed(3), jumps: bad, fadeStepDeltaE: 0, fadeNote: "single shell, no crossfade", perf };
fs.writeFileSync(`${out}/morph.json`, JSON.stringify(row, null, 1));
const verdict = fail
  ? `FAIL vision-morph minIoU ${minIoU.toFixed(3)} jumps ${bad.length}`
  : `PASS vision-morph (no silhouette jump ${farM} m -> ${nearM} m, fade step ΔE 0, single shell)`;
fs.writeFileSync(`${out}/verdict.txt`, verdict + "\n");
console.log(JSON.stringify(row));
console.log(verdict);
await b.close();
process.exit(fail ? 1 : 0);
