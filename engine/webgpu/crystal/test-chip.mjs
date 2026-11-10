// Vertical silhouette bites are 10–40 cm. The outline does not grow.
import { createMesh } from '../engine/bricks/facet-mesh.js';

const mesh = createMesh();
const sx = 1.8, sz = 1.4, sy = 2.4;
mesh.chipBlock(0, 0, 0, sx, sy, sz, 0, 0, 0, 1, 7);
const f = mesh.finish();
const hx = sx / 2, hz = sz / 2;
const cols = new Map();
let outside = 0;
for (let i = 0; i < f.length; i += 8) {
  const x = f[i], y = f[i + 1], z = f[i + 2];
  if (Math.abs(x) > hx + 0.02 || Math.abs(z) > hz + 0.02) outside++;
  if (y < -0.01 || y > sy + 0.01) continue;
  const ang = Math.atan2(z, x).toFixed(2);
  if (!cols.has(ang)) cols.set(ang, []);
  cols.get(ang).push(Math.hypot(x, z));
}
let best = 0;
for (const rs of cols.values()) {
  if (rs.length < 4) continue;
  best = Math.max(best, Math.max(...rs) - Math.min(...rs));
}
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (best < 0.10 || best > 0.40) bad('silhouette bite ' + best.toFixed(3));
if (outside) bad('outline grew past the box ' + outside);
if (fail) process.exit(1);
console.log('PASS chip', JSON.stringify({ silhouette: +best.toFixed(3), columns: cols.size }));
