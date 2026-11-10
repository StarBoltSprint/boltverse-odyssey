// Internal cracks stay short, faint, and on at most two faces.
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { cracksInCell, fractureAt, LIGHT } from './light.js';

function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
const alb = [46, 197, 228].map(srgbToLin);
function lit(crack) {
  const lin = alb.map(a => a * 0.5 + a * crack * LIGHT.fractureGain);
  return L(present(lin));
}

const crack = cracksInCell(0, 1, -1)[0];
const view = [crack.nrm[1], -crack.nrm[0], 0];
const vl = Math.hypot(...view) || 1;
const caught = view.map(v => v / vl);
const on = fractureAt(crack.origin, caught);
const missed = fractureAt(crack.origin, crack.nrm);
const delta = lit(on) - lit(0);

function facesHit(seg) {
  const radius = 0.22;
  const hit = new Set();
  for (let s = -1; s <= 1; s += 0.2) {
    const local = seg.dir.map(d => d * seg.len * s);
    for (let face = 0; face < 6; face++) {
      const a = (face + 0.5) / 6 * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const plane = nx * local[0] + nz * local[2];
      const tangent = -nz * local[0] + nx * local[2];
      if (Math.abs(plane - radius) < 0.03 && Math.abs(tangent) < radius * 0.85) hit.add(face);
    }
  }
  return hit.size;
}
let worst = 0;
for (let cz = -3; cz <= 3; cz++) {
  for (let cy = 0; cy <= 3; cy++) {
    for (let cx = -2; cx <= 2; cx++) {
      for (const seg of cracksInCell(cx, cy, cz)) worst = Math.max(worst, facesHit(seg));
    }
  }
}
const ring = new Set([0, 1, 2, 3, 4, 5]);
if (ring.size <= 2) throw new Error('span check cannot see a ring');

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (delta < 5 || delta > 12) bad('fracture dL ' + delta.toFixed(2) + ' on=' + on.toFixed(3));
if (worst > 2) bad('fracture spans ' + worst + ' faces');
if (!(missed < on * 0.25)) bad('fracture shows off-angle ' + missed.toFixed(3) + ' vs ' + on.toFixed(3));
if (fail) process.exit(1);
console.log('PASS fracture', JSON.stringify({
  on: +on.toFixed(3),
  missed: +missed.toFixed(3),
  dL: +delta.toFixed(2),
  worstSpan: worst,
}));
