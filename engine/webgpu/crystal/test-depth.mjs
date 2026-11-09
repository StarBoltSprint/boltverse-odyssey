// Crystal inner depth, obsidian sheen relief, and far silhouette separation.
import { spawnSync } from 'child_process';
import { srgbToLab, srgbToLin } from '../biome-factory/colour-same-light.mjs';
import { skyLinear, dirFrom } from '../biome-factory/procedural-sky.js';

function median(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
  const ch = [[], [], []];
  for (let i = 0; i < raw.length; i += 24) { ch[0].push(raw[i]); ch[1].push(raw[i + 1]); ch[2].push(raw[i + 2]); }
  const mid = (a) => a.sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
  return [mid(ch[0]), mid(ch[1]), mid(ch[2])];
}
function present(lin) {
  return lin.map(v => Math.round(Math.min(255, Math.max(0, Math.min(1, v)) ** (1 / 2.2) * 255)));
}
function L(rgb) { return srgbToLab(rgb)[0]; }
function ss(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

const cyan = median(new URL('../biome-factory/fixtures/materials-v2/cyan-facets.jpg', import.meta.url).pathname);
const alb = cyan.map(srgbToLin);
const sky = skyLinear([0.2, 0.4, -0.9]);
const sun = [0.48, 0.74, -0.42];
const sunL = Math.hypot(...sun);
const sunN = sun.map(v => v / sunL);
const up = [0.12, 0.96, 0.08];
const upL = Math.hypot(...up);
const upN = up.map(v => v / upL);

function beforeFace(n, ndv) {
  const ndl = Math.max(0, n.reduce((s, v, i) => s + v * sunN[i], 0));
  const lin = alb.map(a => a * (0.12 + 0.45 * ndl + 0.10 * ndl ** 0.45) + a * (1 - ndv) ** 2.6 * 0.42 + a * (ndv ** 1.6) * 0.72);
  return L(present(lin));
}
function afterFace(n, tip, ndv) {
  const ndl = Math.max(0, n.reduce((s, v, i) => s + v * sunN[i], 0));
  const align = Math.max(0, Math.min(1, n.reduce((s, v, i) => s + v * upN[i], 0) * 0.5 + 0.5));
  const face = 0.40 + 1.10 * align;
  const back = Math.max(0, -n.reduce((s, v, i) => s + v * sunN[i], 0));
  const thin = (0.30 + 0.70 * tip) * (0.45 + 0.55 * (1 - ndv) ** 1.4);
  const bodyK = 0.32 + 0.68 * tip;
  const lin = alb.map((a, i) => a * bodyK * face * (0.20 + 0.55 * ndl) + a * sky[i] * (2.2 + 6.4 * back) * thin + a * (1 - ndv) ** 2.6 * 0.30);
  return L(present(lin));
}
function faceN(i) {
  const a = (i / 6) * Math.PI * 2;
  const n = [Math.cos(a), 0.15, Math.sin(a)];
  const l = Math.hypot(...n);
  return n.map(v => v / l);
}
const spreadBefore = (() => { const v = faceN.length ? Array.from({ length: 6 }, (_, i) => beforeFace(faceN(i), 0.55)) : []; return Math.max(...v) - Math.min(...v); })();
const spreadAfter = (() => { const v = Array.from({ length: 6 }, (_, i) => afterFace(faceN(i), 0.55, 0.55)); return Math.max(...v) - Math.min(...v); })();
const baseL = afterFace([1, 0, 0], 0, 0.7);
const tipL = afterFace([0, 1, 0], 1, 0.4);
const baseBefore = beforeFace([1, 0, 0], 0.7);

const wall = skyLinear(dirFrom(12, 0.4));
const skyL = L(present(wall));
const wallAlb = [23, 24, 27].map(srgbToLin);
const skyLin = 0.2126 * wall[0] + 0.7152 * wall[1] + 0.0722 * wall[2];
const fill = Math.min(1.2, Math.max(0.22, skyLin * 26));
function edgeL(dist) {
  const ndv = 0.12;
  const fres = (1 - ndv) ** 2.4;
  const far = ss(55, 130, dist);
  const mixK = Math.min(0.55, fres * (0.35 + 0.45 * far));
  const gain = 2.05;
  let lin = wallAlb.map(a => a * fill * (1 - mixK) + a * gain * mixK);
  const hk = ss(70, 190, dist) * 0.55;
  lin = lin.map((c, i) => c * (1 - hk) + wall[i] * hk);
  return skyL - L(present(lin));
}

const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', new URL('../biome-factory/fixtures/materials-v2/obsidian-wall.jpg', import.meta.url).pathname, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
const S = 64;
const block = 1024 / S;
const luma = new Float32Array(S * S);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let acc = 0, n = 0;
    for (let yy = 0; yy < block; yy += 4) {
      for (let xx = 0; xx < block; xx += 4) {
        const p = ((y * block + yy) * 1024 + (x * block + xx)) * 3;
        acc += 0.2126 * raw[p] + 0.7152 * raw[p + 1] + 0.0722 * raw[p + 2];
        n++;
      }
    }
    luma[y * S + x] = acc / n;
  }
}
let mean = 0;
for (const y of luma) mean += y;
mean /= luma.length;
let sd = 0;
for (const y of luma) sd += (y - mean) ** 2;
sd = Math.sqrt(sd / luma.length) || 1;
const H = luma.map(y => Math.max(-2.2, Math.min(2.2, (y - mean) / sd)) / 2.2 * 0.5 + 0.5);
const vals = [];
for (let y = 0; y < S; y += 2) {
  for (let x = 0; x < S; x += 2) {
    const h0 = H[y * S + x];
    const hu = H[y * S + ((x + 4) % S)];
    const hv = H[((y + 4) % S) * S + x];
    const tilt = Math.hypot(h0 - hu, h0 - hv) * 5.5;
    const ndv = Math.max(0.15, Math.min(0.95, 0.72 - tilt * 0.35));
    const F = 0.045 + 0.955 * (1 - ndv) ** 5;
    const lin = wallAlb.map((a, i) => a * fill + wall[i] * F * 0.9);
    vals.push(L(present(lin)));
  }
}
const flat = L(present(wallAlb.map((a, i) => a * fill + wall[i] * 0.045 * 0.9)));
const contrastBefore = 0;
const contrastAfter = Math.max(...vals) - Math.min(...vals);

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
if (!(tipL - baseL >= 8)) bad('tip/base ' + (tipL - baseL).toFixed(2));
if (!(spreadAfter >= 8)) bad('face spread ' + spreadAfter.toFixed(2));
if (!(contrastAfter >= 3)) bad('wall relief ' + contrastAfter.toFixed(2));
for (const d of [60, 100, 150]) {
  const dl = edgeL(d);
  if (dl < 6) bad('silhouette ' + d + ' m dL ' + dl.toFixed(2));
}
if (fail) process.exit(1);
console.log('PASS depth');
console.log(JSON.stringify({
  cyan,
  spreadBefore: +spreadBefore.toFixed(2),
  spreadAfter: +spreadAfter.toFixed(2),
  baseBefore: +baseBefore.toFixed(2),
  baseAfter: +baseL.toFixed(2),
  tipAfter: +tipL.toFixed(2),
  tipBase: +(tipL - baseL).toFixed(2),
  wallContrastBefore: contrastBefore,
  wallContrastAfter: +contrastAfter.toFixed(2),
  flatFace: +flat.toFixed(2),
  dL60: +edgeL(60).toFixed(2),
  dL100: +edgeL(100).toFixed(2),
  dL150: +edgeL(150).toFixed(2),
}, null, 2));
