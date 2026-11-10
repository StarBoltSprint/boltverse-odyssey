// Inner core, moon rim, and teal facet shift. No white, no chrome.
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { LIGHT } from './light.js';

function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
const alb = [46, 197, 228].map(srgbToLin);
function hueMul(hue) {
  return [1 * (1 - hue) + 0.76 * hue, 0.94 * (1 - hue) + 1.1 * hue, 1.06 * (1 - hue) + 0.8 * hue];
}
const a0 = alb.map((v, i) => v * hueMul(0)[i]);
const a1 = alb.map((v, i) => v * hueMul(1)[i]);
const c0 = present(a0);
const c1 = present(a1);
const teal = (c1[1] - c0[1]) > (c1[2] - c0[2]);

function rim(viewDot, nDot, ndv) {
  const edge = (1 - ndv) ** 2.6;
  return alb.map(a => a * 0.4 * edge * Math.max(viewDot, 0) * Math.max(nDot, 0) * 1.05);
}
const back = L(present(alb.map((a, i) => a * 0.25 + rim(0.85, 0.8, 0.08)[i])));
const front = L(present(alb.map((a, i) => a * 0.25 + rim(0.1, -0.5, 0.08)[i])));
const core = L(present(alb.map(a => a * 0.22 * 0.5)));
const face = L(present(alb.map(a => a * 0.7)));

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (!teal) bad('facet shift is not toward teal');
if (!(c1[1] > c0[1] - 2 && c1[2] < c0[2])) bad('teal move ' + c0 + ' -> ' + c1);
if (!(back > front + 4)) bad('moon rim back ' + back.toFixed(2) + ' front ' + front.toFixed(2));
if (!(face > core + 8)) bad('inner core not darker ' + core.toFixed(2) + ' face ' + face.toFixed(2));
if (LIGHT.roughness < 0.15 || LIGHT.roughness > 0.25) bad('roughness ' + LIGHT.roughness);
if (LIGHT.f0 !== 0.045) bad('F0');
if (fail) process.exit(1);
console.log('PASS gem', JSON.stringify({
  teal: [c0.join(','), c1.join(',')],
  moonRim: +back.toFixed(2),
  frontRim: +front.toFixed(2),
  coreL: +core.toFixed(2),
  faceL: +face.toFixed(2),
  rough: LIGHT.roughness,
}));
