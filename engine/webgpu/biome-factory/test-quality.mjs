// Ground repeat and foot slip. Crystal stride only; meadow bolt-idle defaults stay.
import { jpegPixels, srgbToLin, present8 } from './albedo-stats.mjs';
import { valueNoise } from './procedural-sky.js';
import { srgbToLab } from './colour-same-light.mjs';
import { skyLinear } from './procedural-sky.js';

const file = new URL('./fixtures/materials-v2/mineral-ground.jpg', import.meta.url);
const wallFile = new URL('./fixtures/materials-v2/obsidian-wall.jpg', import.meta.url);
const pix = jpegPixels(file, 4);
const w = 1024;
const step = 4;
const img = pix; // row-major subsampled? jpegPixels walks linearly every 4 pixels, not a grid.
// Rebuild a strided grid: every 4th pixel in x and we need 2D. Use step 1 via a local decode.
import { spawnSync } from 'child_process';
const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file.pathname, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }).stdout;
function at(u, v) {
  let uu = u % 1; if (uu < 0) uu += 1;
  let vv = v % 1; if (vv < 0) vv += 1;
  const x = Math.min(w - 1, Math.floor(uu * w));
  const y = Math.min(w - 1, Math.floor(vv * w));
  const i = (y * w + x) * 3;
  return [raw[i], raw[i + 1], raw[i + 2]];
}
function mix(a, b, k) { return a.map((v, i) => v + (b[i] - v) * k); }
function smoothstep(e0, e1, x) { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
const sc = 1 / 3;
function sample(x, z, blend) {
  const u = x * sc, v = z * sc;
  const a = at(u, v);
  if (!blend) return a;
  const b = at(u + 0.37, v + 0.53);
  const n = valueNoise([x * 0.17, z * 0.17, 3]);
  return mix(a, b, smoothstep(0.46, 0.54, n));
}
function periodSad(blend) {
  let s = 0, n = 0;
  for (let z = 0; z < 12; z += 0.5) {
    for (let x = 0; x < 9; x += 0.5) {
      const a = sample(x, z, blend);
      const b = sample(x + 3, z, blend);
      s += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      n++;
    }
  }
  return s / n;
}
function contrast(blend) {
  const vals = [];
  for (let z = 0; z < 12; z += 0.35) for (let x = 0; x < 9; x += 0.35) vals.push(sample(x, z, blend)[0]);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  let d = 0;
  for (const v of vals) d += (v - mean) ** 2;
  return Math.sqrt(d / vals.length);
}
const before = periodSad(false);
const after = periodSad(true);
const c0 = contrast(false);
const c1 = contrast(true);
const loss = 1 - c1 / c0;
if (after <= before) { console.error('FAIL repeat did not fall', before, after); process.exit(1); }
if (loss > 0.25) { console.error('FAIL contrast loss', loss); process.exit(1); }

function L(rgb) { return srgbToLab(rgb)[0]; }
function median(file) {
  const b = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }).stdout;
  const ch = [[], [], []];
  for (let i = 0; i < b.length; i += 3 * 16) { ch[0].push(b[i]); ch[1].push(b[i + 1]); ch[2].push(b[i + 2]); }
  const mid = (a) => a.sort((x, y) => x - y)[Math.floor((a.length - 1) / 2)];
  return [mid(ch[0]), mid(ch[1]), mid(ch[2])];
}
const wall = median(wallFile.pathname);
const ground = median(file.pathname);
const sun = [0.48, 0.74, -0.42];
const ndl = Math.max(0, sun[1] / Math.hypot(...sun));
const side = 0.25;
function shadeRgb(rgb, n, extra = 0) {
  return rgb.map(v => present8(srgbToLin(v) * (0.10 + 0.90 * n) + srgbToLin(v) * extra * (1 - n)));
}
const sky = skyLinear([0, 0.25, -1]);
const skyLum = 0.2126 * sky[0] + 0.7152 * sky[1] + 0.0722 * sky[2];
const bounce = Math.min(0.28, Math.max(0, skyLum * 8));
const canon = 22 / (534 / 96);
function slip(hz, v = 7) { return v * (1 - hz / canon); }

console.log(JSON.stringify({
  repeatSadBefore: +before.toFixed(2),
  repeatSadAfter: +after.toFixed(2),
  contrastBefore: +c0.toFixed(2),
  contrastAfter: +c1.toFixed(2),
  contrastLoss: +loss.toFixed(3),
  wallL: +L(wall).toFixed(2),
  groundL: +L(ground).toFixed(2),
  wallSideLBefore: +L(shadeRgb(wall, side)).toFixed(2),
  wallSideLAfter: +L(shadeRgb(wall, side, bounce)).toFixed(2),
  wallSunLBefore: +L(shadeRgb(wall, ndl)).toFixed(2),
  wallSunLAfter: +L(shadeRgb(wall, ndl, bounce)).toFixed(2),
  skyLum: +skyLum.toFixed(4),
  bounce,
  slipBefore: +slip(1.95).toFixed(2),
  slipAfter: +slip(canon).toFixed(3),
  strideHz: +canon.toFixed(3),
}, null, 2));
