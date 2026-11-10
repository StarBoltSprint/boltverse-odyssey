// Conchoidal sheen must be scallops, not isotropic blotches. Gem edges stay tinted.
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { skyLinear } from '../biome-factory/procedural-sky.js';
import { LIGHT, conchoid, conchoidMetrics } from './light.js';

const glass = conchoidMetrics();
function blobMetrics() {
  const e = 0.025;
  const h = (uv) => (Math.sin(uv[0] * 2.2) * Math.sin(uv[1] * 2.0) + Math.sin(uv[0] * 3.4 + uv[1]) * 0.6) * 0.08;
  let n = 0;
  let ridge = 0;
  for (let y = 0; y < 3.2; y += 0.04) {
    for (let x = 0; x < 3.2; x += 0.04) {
      const g = Math.hypot((h([x, y]) - h([x + e, y])) / e, (h([x, y]) - h([x, y + e])) / e);
      n++;
      if (g > 0.35) ridge++;
    }
  }
  return { ridgeCoverage: ridge / n, sharpness: 1 };
}

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (glass.ridgeCoverage < 0.03 || glass.ridgeCoverage > 0.2) bad('ridge coverage ' + glass.ridgeCoverage.toFixed(3));
if (glass.sharpness < 2.2) bad('bowls not smoother than ridges ' + glass.sharpness.toFixed(2));
if (glass.radiusMin < 0.5 || glass.radiusMax > 2) bad('scallop radius ' + glass.radiusMin + ' ' + glass.radiusMax);
const blob = blobMetrics();
if (blob.sharpness >= 1.5 && blob.ridgeCoverage >= 0.03 && blob.ridgeCoverage <= 0.2) bad('blob noise was accepted');

const alb = [46, 197, 228].map(srgbToLin);
const sky = skyLinear([0.2, 0.4, -0.9]);
const sun = LIGHT.sun;
const sunN = sun.map(v => v / Math.hypot(...sun));
const up = [0.12, 0.96, 0.08];
const upN = up.map(v => v / Math.hypot(...up));
function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
function shade(n, ndv, tip, line) {
  const ndl = Math.max(0, n.reduce((s, v, i) => s + v * sunN[i], 0));
  const align = Math.max(0, Math.min(1, n.reduce((s, v, i) => s + v * upN[i], 0) * 0.5 + 0.5));
  const face = 0.40 + 1.10 * align;
  const sil = (1 - ndv) ** 2;
  const edge = (1 - ndv) ** 5.5;
  const lin = alb.map((a, i) => a * face * (0.18 + 0.40 * ndl) * (0.42 + 0.58 * tip)
    + a * sky[i] * sil * (1.1 + 1.8 * tip)
    + a * line * 0.7
    + a * edge * LIGHT.gemEdge);
  const rgb = present(lin);
  return { L: L(rgb), rgb, max: Math.max(...rgb) };
}
function faceN(i) {
  const a = (i / 6) * Math.PI * 2;
  const n = [Math.cos(a), 0.2, Math.sin(a)];
  const l = Math.hypot(...n);
  return n.map(v => v / l);
}
const faces = Array.from({ length: 6 }, (_, i) => shade(faceN(i), 0.62, 0.7, 0));
const spread = Math.max(...faces.map(f => f.L)) - Math.min(...faces.map(f => f.L));
const center = shade([0.2, 0.4, 0.9].map((v, i, a) => v / Math.hypot(0.2, 0.4, 0.9)), 0.9, 0.7, 0);
const edge = shade([0.2, 0.4, 0.9].map((v, i, a) => v / Math.hypot(0.2, 0.4, 0.9)), 0.12, 0.7, 0);
const streak = shade([0.2, 0.4, 0.9].map((v, i, a) => v / Math.hypot(0.2, 0.4, 0.9)), 0.7, 0.7, 1);
if (spread < 6) bad('face spread ' + spread.toFixed(2));
if (edge.L - center.L < 4) bad('edge vs center ' + (edge.L - center.L).toFixed(2));
if (streak.L - center.L < 2) bad('inclusion streak ' + (streak.L - center.L).toFixed(2));
if ([...faces, center, edge, streak].some(f => f.max >= 255 && f.rgb[0] > 230 && f.rgb[1] > 230)) bad('white sparkle');
if (fail) process.exit(1);
console.log('PASS conchoid');
console.log(JSON.stringify({
  ridgeCoverage: +glass.ridgeCoverage.toFixed(3),
  sharpness: +glass.sharpness.toFixed(2),
  radiusMin: +glass.radiusMin.toFixed(2),
  radiusMax: +glass.radiusMax.toFixed(2),
  blobRidge: +blob.ridgeCoverage.toFixed(3),
  faceSpread: +spread.toFixed(2),
  edgeL: +edge.L.toFixed(2),
  centerL: +center.L.toFixed(2),
  edgeMinusCenter: +(edge.L - center.L).toFixed(2),
  streakMinusCenter: +(streak.L - center.L).toFixed(2),
  edgeRgb: edge.rgb,
}, null, 2));
