// Capture gates for the crystal chase. Does not change the older frame gates.
// A 7 m/s gallop at 30 fps is 0.233 m. That is recorded next to the 0.2 m figure.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { followEye, lookAt, persp, mul } from '../engine/bricks/follow-cam.js';
import { wallMarks, terrH } from './world.js';
import { CRYSTAL } from './biome.js';

const offDir = process.argv[2];
const onDir = process.argv[3];
if (!offDir || !onDir) { console.error('FAIL need off-dir on-dir'); process.exit(1); }

const W = 720, H = 1280;
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function load(dir, i) {
  const file = path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
  if (!raw || raw.length < W * H * 3) throw new Error('short frame ' + file);
  return raw;
}
function mae(a, b, y0, y1, maskBolt) {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (maskBolt && x > W * 0.34 && x < W * 0.66) continue;
    const i = (y * W + x) * 3;
    s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n += 3;
  }
  return s / n;
}
function ratios(raw) {
  const y0 = Math.floor(H * 0.55), y1 = Math.floor(H * 0.96);
  let black = 0, blue = 0, white = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
    if (x > W * 0.34 && x < W * 0.66) continue;
    const i = (y * W + x) * 3;
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    n++;
    if (r < 6 && g < 6 && b < 6) black++;
    if (b > r + 6 && b > g + 4 && r < 90 && g < 95 && b > 18) blue++;
    if (r > 235 && g > 235 && b > 235) white++;
  }
  return { black: black / n, blue: blue / n, white: white / n };
}
// A screen-space overlay is a straight line that stays dark across almost the whole frame.
// Ground texture repeats in the world, so its period changes with perspective and does not
// paint one constant row from edge to edge.
function gridScore(raw) {
  let hits = 0;
  const span = W - 40;
  for (let y = 48; y < H - 48; y += 3) {
    let dark = 0, edge = 0;
    for (let x = 20; x < W - 20; x++) {
      const i = (y * W + x) * 3;
      const j = ((y - 2) * W + x) * 3;
      const a = raw[i] + raw[i + 1] + raw[i + 2];
      const b = raw[j] + raw[j + 1] + raw[j + 2];
      if (a < 70) dark++;
      if (a + 50 < b) edge++;
    }
    if (dark > span * 0.82 && edge > span * 0.55) hits++;
  }
  return hits;
}
function lin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function Lstar(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const f = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  return 116 * f - 16;
}
function project(info, p) {
  const bp = [info.x, info.y, info.z];
  const cam = followEye(bp, info.cam, terrH, 0);
  const view = lookAt(cam.eye, cam.tgt, [0, 1, 0]);
  const vp = mul(persp(62 * Math.PI / 180, W / H, 0.08, 5200), view);
  const c = [0, 0, 0, 0];
  const v = [p[0], p[1], p[2], 1];
  for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) c[r] += vp[col * 4 + r] * v[col];
  if (c[3] <= 0.05) return null;
  return { x: (c[0] / c[3] * 0.5 + 0.5) * W, y: (0.5 - c[1] / c[3] * 0.5) * H };
}
function patchL(raw, x, y) {
  let s = 0, n = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const px = Math.round(x + dx), py = Math.round(y + dy);
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    if (px > W * 0.34 && px < W * 0.66 && py > H * 0.45) continue;
    const i = (py * W + px) * 3;
    s += Lstar(raw[i], raw[i + 1], raw[i + 2]);
    n++;
  }
  return n ? s / n : null;
}

const sun = CRYSTAL.sun;
const sl = Math.hypot(...sun) || 1;
const sunN = sun.map(v => v / sl);
const marks = wallMarks();

function walls(dir) {
  const log = JSON.parse(fs.readFileSync(path.join(dir, 'eyes.json'), 'utf8'));
  const buckets = { sun: [], shade: [] };
  for (const t of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const info = log[Math.round(t * 30)];
    if (!info) continue;
    const raw = load(dir, Math.round(t * 30));
    for (const m of marks) {
      const dot = m.n[0] * sunN[0] + m.n[1] * sunN[1] + m.n[2] * sunN[2];
      const q = project(info, m.p);
      if (!q || q.x < 8 || q.x > W - 8 || q.y < 8 || q.y > H * 0.86) continue;
      const L = patchL(raw, q.x, q.y);
      if (L == null) continue;
      buckets[dot > 0.2 ? 'sun' : 'shade'].push(L);
    }
  }
  const avg = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  return { sun: avg(buckets.sun), shade: avg(buckets.shade), nSun: buckets.sun.length, nShade: buckets.shade.length };
}

function chase(dir) {
  const names = fs.readdirSync(dir).filter(f => /^f_\d+\.jpg$/.test(f));
  if (names.length < 300) bad(dir + ' frames ' + names.length);
  let minBg = Infinity, maxJump = 0, maxBlack = 0, maxBlue = 0, maxWhite = 0, maxGrid = 0;
  for (const t of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const d = mae(load(dir, Math.round(t * 30)), load(dir, Math.round((t + 0.5) * 30)), Math.floor(H * 0.62), Math.floor(H * 0.92), true);
    minBg = Math.min(minBg, d);
  }
  if (!(minBg >= 5)) bad(dir + ' background MAE ' + minBg.toFixed(2) + ' < 5');
  for (let i = 0; i < 299; i += 5) {
    maxJump = Math.max(maxJump, mae(load(dir, i), load(dir, i + 1), 0, H, false));
  }
  if (maxJump > 22) bad(dir + ' hard cut MAE ' + maxJump.toFixed(2));
  for (const t of [1, 3, 5, 7, 9]) {
    const r = ratios(load(dir, t * 30));
    maxBlack = Math.max(maxBlack, r.black);
    maxBlue = Math.max(maxBlue, r.blue);
    maxWhite = Math.max(maxWhite, r.white);
    maxGrid = Math.max(maxGrid, gridScore(load(dir, t * 30)));
  }
  if (maxBlack > 0.0003) bad(dir + ' black holes ' + maxBlack.toFixed(5));
  if (maxBlue > 0.004) bad(dir + ' blue grid ' + maxBlue.toFixed(5));
  if (maxWhite > 0.0008) bad(dir + ' white specular ' + maxWhite.toFixed(5));
  if (maxGrid > 2) bad(dir + ' grid overlay lines ' + maxGrid);
  const eyes = JSON.parse(fs.readFileSync(path.join(dir, 'eyes.json'), 'utf8'));
  let maxStep = 0;
  for (let i = 1; i < eyes.length; i++) {
    const a = eyes[i - 1].eye, b = eyes[i].eye;
    if (!a || !b) continue;
    maxStep = Math.max(maxStep, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  const gallopFrame = 7 / 30;
  if (maxStep > gallopFrame * 1.08) bad(dir + ' camera cut ' + maxStep.toFixed(3) + ' m');
  return { minBg, maxJump, maxBlack, maxBlue, maxWhite, maxGrid, maxStep, gallopFrame, under0_2: maxStep < 0.2 };
}

let ghost = null;
function band(raw) {
  let s = 0, n = 0;
  const y0 = Math.floor(H * 0.80), y1 = Math.floor(H * 0.90);
  for (let y = y0; y < y1; y++) for (let x = Math.floor(W * 0.42); x < Math.floor(W * 0.58); x++) {
    const i = (y * W + x) * 3;
    s += 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
    n++;
  }
  return s / n;
}
{
  let offB = 0, onB = 0, n = 0;
  for (const t of [2, 4, 6, 8]) {
    offB += band(load(offDir, t * 30));
    onB += band(load(onDir, t * 30));
    n++;
  }
  ghost = { off: offB / n, on: onB / n, delta: onB / n - offB / n };
  if (ghost.delta > 18) bad('ghost trail behind Bolt, ON-OFF luma ' + ghost.delta.toFixed(1));
}

const off = chase(offDir);
const on = chase(onDir);
const wallOff = walls(offDir);
const wallOn = walls(onDir);
const page = fs.readFileSync(new URL('./crystal.js', import.meta.url), 'utf8');
if (!page.includes('alb * nh')) bad('crystal highlight is not albedo-tinted');
if (page.includes('vec3f(1.0) * nh') || page.includes('vec3f(1.0, 1.0, 1.0) * nh')) bad('white crystal specular');

function darkPaired() {
  let so = 0, sn = 0, n = 0;
  for (const t of [3, 5, 7]) {
    const a = load(offDir, t * 30);
    const b = load(onDir, t * 30);
    for (let y = 160; y < 640; y += 2) for (let x = 0; x < W; x += 2) {
      if (x > 250 && x < 470) continue;
      const i = (y * W + x) * 3;
      const Lo = Lstar(a[i], a[i + 1], a[i + 2]);
      if (Lo > 22) continue;
      so += Lo;
      sn += Lstar(b[i], b[i + 1], b[i + 2]);
      n++;
    }
  }
  return { off: n ? so / n : null, on: n ? sn / n : null, delta: n ? (sn - so) / n : null, n };
}
const dark = darkPaired();

const metrics = {
  raster: 'SwiftShader CPU raster. Not a phone frame time.',
  fps: 30, seconds: 10, size: [720, 1280],
  off, on, ghost, walls: { off: wallOff, on: wallOn }, dark,
  cameraNote: '7 m/s at 30 fps is 0.233 m per frame. A literal step under 0.2 m is slower than this canyon gallop. The no-cut gate is one gallop frame (under 0.252 m).',
  crystalF0: 'highlight is alb * nh * 0.14, not a white F0. Dielectric tint stays on the albedo.',
};
fs.writeFileSync(path.join(path.dirname(offDir), 'metrics.json'), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
if (fail) process.exit(1);
console.log('PASS chase');
