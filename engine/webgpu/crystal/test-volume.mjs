// Obsidian readability at 30 m. Haze is off at that distance. Crystal stays dielectric.
import { skyLinear, dirFrom } from '../biome-factory/procedural-sky.js';
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { clusterSize } from './world.js';
import { spawnSync } from 'child_process';

const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', new URL('../biome-factory/fixtures/materials-v2/obsidian-wall.jpg', import.meta.url).pathname, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
const ch = [[], [], []];
for (let i = 0; i < raw.length; i += 24) { ch[0].push(raw[i]); ch[1].push(raw[i + 1]); ch[2].push(raw[i + 2]); }
const mid = (a) => a.sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
const alb8 = [mid(ch[0]), mid(ch[1]), mid(ch[2])];
const alb = alb8.map(srgbToLin);
const sky = skyLinear(dirFrom(12, 0.4));
const skyLin = 0.2126 * sky[0] + 0.7152 * sky[1] + 0.0722 * sky[2];

function present(lin) {
  return lin.map(v => {
    const x = Math.min(1, Math.max(0, v)) ** (1 / 2.2);
    return Math.round(Math.min(255, x * 255));
  });
}
function L(rgb) { return srgbToLab(rgb)[0]; }

function before(ndl) {
  const bounce = Math.min(0.28, Math.max(0, skyLin * 8));
  const lin = alb.map(a => a * (0.10 + 0.90 * ndl) + a * bounce * (1 - ndl));
  return L(present(lin));
}
function after(ndl, ndv, ny) {
  const fill = Math.min(1.20, Math.max(0.22, skyLin * 26));
  const F = 0.045 + 0.955 * (1 - ndv) ** 5;
  const edgeIn = Math.min(1, Math.max(0, (Math.abs(ny) - 0.18) / 0.24));
  const edgeOut = Math.min(1, Math.max(0, (Math.abs(ny) - 0.72) / 0.20));
  const edge = (edgeIn * edgeIn * (3 - 2 * edgeIn)) * (1 - edgeOut * edgeOut * (3 - 2 * edgeOut));
  const sheen = F * (1 - 0.28 * 0.35) * (1 + edge);
  const lin = alb.map((a, i) => a * (fill + 2.0 * ndl) + sky[i] * sheen);
  return L(present(lin));
}
function haze(dist) {
  const t = Math.min(1, Math.max(0, (dist - 70) / 120));
  return t * t * (3 - 2 * t) * 0.55;
}

const skyL = L(present(sky));
const side0 = before(0);
const sun0 = before(0.653);
const side1 = after(0, 0.82, 0);
const sun1 = after(0.653, 0.7, 0);
const bevel1 = after(0.95, 0.22, 0.62);
const dL = skyL - side1;
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (dL < 6) bad('side face not separated from the sky, dL ' + dL.toFixed(2));
if (!(sun1 - side1 >= 3)) bad('sun/side contrast ' + (sun1 - side1).toFixed(2));
if (!(bevel1 - side1 >= 6)) bad('bevel contrast ' + (bevel1 - side1).toFixed(2));
if (haze(10) !== 0 || haze(30) !== 0) bad('haze reaches the player or the 30 m wall');
if (haze(120) < 0.15) bad('far haze missing ' + haze(120));
for (let s = 0; s < 40; s++) {
  const n = clusterSize(s);
  if (n < 5 || n > 12) bad('cluster ' + n);
}
if (fail) process.exit(1);
console.log('PASS volume');
console.log(JSON.stringify({
  skyL: +skyL.toFixed(2),
  sideBefore: +side0.toFixed(2),
  sunBefore: +sun0.toFixed(2),
  localBefore: +(sun0 - side0).toFixed(2),
  sideAfter: +side1.toFixed(2),
  sunAfter: +sun1.toFixed(2),
  bevelAfter: +bevel1.toFixed(2),
  localAfter: +(sun1 - side1).toFixed(2),
  edgeAfter: +(bevel1 - side1).toFixed(2),
  dL: +dL.toFixed(2),
  haze30: haze(30),
  haze120: +haze(120).toFixed(3),
}, null, 2));
