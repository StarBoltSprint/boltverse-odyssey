// Lit facets stay near the cyan albedo. The core darkens by at most 20%.
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { LIGHT } from './light.js';

function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
function linY(rgb) {
  const x = rgb.map(v => v / 255);
  const lin = x.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
}
const alb = [46, 197, 228].map(srgbToLin);
function shade(lit, graze, hue) {
  const albH = alb.map((a, i) => a * [1, 1 + 0.035 * hue, 1 - 0.035 * hue][i]);
  return albH.map(a => a * (0.62 + 1.05 * lit) * 0.9 * (1 - graze * 0.2));
}
const faceLin = shade(0.75, 0, 0);
const coreLin = shade(0.75, 1, 0);
const face = present(faceLin);
const core = present(coreLin);
const shifted = present(shade(0.75, 0, 1));
const faceL = L(face);
const yOf = (v) => v[0] * 0.2126 + v[1] * 0.7152 + v[2] * 0.0722;
const ratio = yOf(coreLin) / yOf(faceLin);
const albLit = present(alb.map(a => a * (0.62 + 1.05 * 0.75)));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (ratio < 0.795) bad('core luminance ratio ' + ratio.toFixed(3));
if (!(shifted[2] > shifted[1])) bad('cyan no longer dominant ' + shifted);
if (Math.abs(shifted[1] - face[1]) > 12 || Math.abs(shifted[2] - face[2]) > 12) bad('hue shift too big ' + face + ' -> ' + shifted);
if (Math.abs(faceL - L(albLit)) > 8) bad('facet L ' + faceL.toFixed(1) + ' vs lit albedo ' + L(albLit).toFixed(1));
if (LIGHT.roughness < 0.15 || LIGHT.roughness > 0.25) bad('roughness');
if (LIGHT.f0 !== 0.045) bad('F0');
if (fail) process.exit(1);
console.log('PASS gem', JSON.stringify({
  face: face.join(','),
  faceL: +faceL.toFixed(1),
  litAlbedoL: +L(albLit).toFixed(1),
  coreRatio: +ratio.toFixed(3),
  shifted: shifted.join(','),
}));
