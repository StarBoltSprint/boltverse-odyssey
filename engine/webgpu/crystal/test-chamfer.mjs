// Chamfer light is broken, capped, and dark when the face is turned away.
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';

function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
const alb = [46, 197, 228].map(srgbToLin);
function shade({ ndl, ndv, tip, chamfer, broken }) {
  const core = ndv ** 1.15;
  const depth = 0.92 * (1 - core) + 0.58 * core;
  const lit = Math.max(ndl, 0);
  const scale = chamfer ? 0.7 : 1;
  const fres = (1 - ndv) ** 3;
  const thin = (1 - ndv) ** 1.7;
  return alb.map(a => a * depth * (0.14 + 0.78 * lit) * (0.5 + 0.5 * tip) * scale
    + a * 0.2 * thin * 0.08 * (0.25 + 0.75 * lit)
    + a * fres * lit * broken * 0.16 * chamfer);
}
const facet = (tip) => L(present(shade({ ndl: 0.55, ndv: 0.75, tip, chamfer: 0, broken: 0 })));
let maxDelta = 0;
let hot = 0;
let n = 0;
for (let i = 0; i <= 40; i++) {
  const tip = (i / 40) * 0.6;
  const broken = (tip * 6.5) % 1 > 0.9 ? 1 : 0;
  const cham = L(present(shade({ ndl: 0.55, ndv: 0.4, tip, chamfer: 1, broken })));
  const d = cham - facet(tip);
  maxDelta = Math.max(maxDelta, d);
  if (d > 12) hot++;
  n++;
}
const away = L(present(shade({ ndl: -0.4, ndv: 0.4, tip: 0.3, chamfer: 1, broken: 1 })));
const awayFacet = L(present(shade({ ndl: -0.4, ndv: 0.75, tip: 0.3, chamfer: 0, broken: 0 })));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (maxDelta > 10) bad('chamfer dL ' + maxDelta.toFixed(2));
if (hot / n > 0.3) bad('chamfer hot fraction ' + (hot / n).toFixed(2));
if (away > awayFacet + 0.5) bad('shadow chamfer ' + away.toFixed(2) + ' vs facet ' + awayFacet.toFixed(2));
if (fail) process.exit(1);
console.log('PASS chamfer', JSON.stringify({
  maxDelta: +maxDelta.toFixed(2),
  hotFraction: +(hot / n).toFixed(3),
  shadowChamfer: +away.toFixed(2),
  shadowFacet: +awayFacet.toFixed(2),
}));
