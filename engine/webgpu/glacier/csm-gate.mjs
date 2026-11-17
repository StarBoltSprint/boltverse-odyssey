// Cascaded-shadow gate. Thresholds live in csm-limits.json and are not lowered here.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { norm3 } from '../biome-factory/light-rig.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';
import { LIGHT } from './biome.js';
import { buildWorld } from './world.js';
import { buildCascades, applyMat } from './shadows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const limits = JSON.parse(fs.readFileSync(path.join(here, 'csm-limits.json'), 'utf8'));
const SPIRE = new Set([1, 2, 3, 6, 7]);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { raw, w, h };
}
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function matOf(r) { return Math.round(r / 255 * 8 - 0.5); }
function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function raster(mask, w, h, a, b, c) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-3) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) mask[y * w + x] = 1;
    }
  }
}
function dropToSnow(p, sun, heightAt) {
  const dir = [-sun[0], -sun[1], -sun[2]];
  if (dir[1] > -0.04) return null;
  let x = p[0], y = p[1], z = p[2];
  for (let i = 0; i < 12; i++) {
    const h = heightAt(x, z);
    if (y <= h + 0.2) return [x, h, z];
    const step = Math.min((y - h) / -dir[1], 40);
    x += dir[0] * step; y += dir[1] * step; z += dir[2] * step;
    if (y < -30 || y > 500) return null;
  }
  return null;
}
function cpuOcclusion(world, eye, tgt, W, H) {
  const casc = buildCascades({
    eye, tgt, fovY: FOV_Y, aspect: W / H, sun: norm3(LIGHT.sun.direction), tier: 'phone',
  });
  const S = 384;
  const depth = [new Float32Array(S * S).fill(1), new Float32Array(S * S).fill(1)];
  const verts = world.verts;
  let used = 0;
  function rast(buf, tri) {
    const xs = tri.map((v) => v[0]);
    const ys = tri.map((v) => v[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > S || Math.max(...ys) < 0 || Math.min(...ys) > S) return;
    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const maxX = Math.min(S - 1, Math.ceil(Math.max(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(S - 1, Math.ceil(Math.max(...ys)));
    if (maxX - minX > S * 0.85 && maxY - minY > S * 0.85) return;
    const [a, b, c] = tri;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(area) < 1e-3) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
        const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
        if (z < 0 || z > 1) continue;
        const i = y * S + x;
        if (z < buf[i]) buf[i] = z;
      }
    }
  }
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const m = Math.round(verts[t + 3]);
    if (!SPIRE.has(m)) continue;
    const tri = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
    const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const mz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3;
    if ((mx - eye[0]) ** 2 + (mz - eye[2]) ** 2 > 180 * 180) continue;
    for (let ci = 0; ci < 2; ci++) {
      const q = tri.map((v) => applyMat(casc.mats[ci], v));
      rast(depth[ci], q.map((v) => [(v[0] * 0.5 + 0.5) * S, (0.5 - v[1] * 0.5) * S, v[2]]));
    }
    used++;
  }
  function blocked(p) {
    for (let ci = 0; ci < 2; ci++) {
      const q = applyMat(casc.mats[ci], p);
      const e = Math.max(Math.abs(q[0]), Math.abs(q[1]));
      if (e >= 0.98 || q[2] < 0 || q[2] > 1) continue;
      const x = Math.max(0, Math.min(S - 1, (q[0] * 0.5 + 0.5) * S | 0));
      const y = Math.max(0, Math.min(S - 1, (0.5 - q[1] * 0.5) * S | 0));
      if (depth[ci][y * S + x] + 0.008 < q[2]) return true;
    }
    return false;
  }
  return { blocked, used, casc };
}

const root = arg('--root');
if (!root) {
  console.error('usage: node csm-gate.mjs --root <dir>');
  process.exit(2);
}
const world = buildWorld();
const tags = JSON.parse(fs.readFileSync(path.join(root, 'tags.json'), 'utf8'));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const rows = [];
for (const tag of tags) {
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after', `t${tag}.json`), 'utf8'));
  const shadow = load(path.join(root, 'mask', `t${tag}.png`));
  const mat = load(path.join(root, 'after', `t${tag}-mat.png`));
  const beauty = load(path.join(root, 'after', `t${tag}.jpg`));
  const { w, h } = shadow;
  const snow = new Uint8Array(w * h);
  const gpu = new Uint8Array(w * h);
  let clip = 0, iceN = 0, iceBlue = 0, bright = 0, grey = 0;
  const shSnow = [], litSnow = [];
  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    const id = matOf(mat.raw[o]);
    const r = beauty.raw[o] / 255, g = beauty.raw[o + 1] / 255, b = beauty.raw[o + 2] / 255;
    const y = luma(r, g, b);
    if (r > limits.clipAt || g > limits.clipAt || b > limits.clipAt) clip++;
    if (id === 0) {
      snow[i] = 1;
      const sh = shadow.raw[o] / 255;
      const ndl = mat.raw[o + 1] / 255;
      if (sh < 0.5) gpu[i] = 1;
      // Sun-facing snow only. A pixel outside the cascade is marked lit and is still ambient blue.
      if (ndl > 0.4 && sh < 0.35) shSnow.push(b - r);
      else if (ndl > 0.4 && sh > 0.85) litSnow.push(b - r);
    }
    if (id === 1 || id === 2 || id === 3 || id === 6 || id === 7) {
      iceN++;
      iceBlue += b - r;
      if (y > limits.brightLuma) {
        bright++;
        if (Math.max(r, g, b) - Math.min(r, g, b) < limits.greyChroma) grey++;
      }
    }
  }
  const cpu = cpuOcclusion(world, info.eye, info.tgt, w, h);
  const vp = mul(persp(FOV_Y, w / h, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  let inter = 0, union = 0, gN = 0, cN = 0;
  const stride = 4;
  for (let t = 0; t < world.verts.length; t += 8 * stride) {
    if (Math.round(world.verts[t + 3]) !== 0) continue;
    const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
    if ((p[0] - info.eye[0]) ** 2 + (p[2] - info.eye[2]) ** 2 > 70 * 70) continue;
    const scr = project(vp, p, w, h);
    if (!scr || scr[0] < 1 || scr[1] < 1 || scr[0] >= w - 1 || scr[1] >= h - 1) continue;
    const pix = (scr[1] | 0) * w + (scr[0] | 0);
    if (!snow[pix]) continue;
    const g = gpu[pix] === 1;
    const c = cpu.blocked(p);
    if (g) gN++;
    if (c) cN++;
    if (g || c) union++;
    if (g && c) inter++;
  }
  const iou = union ? inter / union : 0;
  if (iou < limits.csmIouMin) bad(`csm_iou ${tag} ${iou.toFixed(3)} gpu ${gN} cpu ${cN}`);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const blueDelta = shSnow.length && litSnow.length ? mean(shSnow) - mean(litSnow) : 0;
  if (!(shSnow.length > 50 && litSnow.length > 50 && blueDelta > limits.snowShadowBlueMin)) {
    bad(`snow blue ${tag} ${blueDelta.toFixed(3)} n ${shSnow.length}/${litSnow.length}`);
  }
  let seamN = 0, seamSum = 0;
  for (let y = 8; y < h - 8; y += 3) {
    for (let x = 8; x < w - 8; x += 3) {
      const i = y * w + x;
      if (!snow[i] || shadow.raw[i * 3 + 1] / 255 > 0.15) continue;
      let found = -1;
      for (let dy = -16; dy <= 16 && found < 0; dy += 4) {
        for (let dx = -16; dx <= 16; dx += 4) {
          const j = (y + dy) * w + (x + dx);
          if (j < 0 || j >= w * h || !snow[j]) continue;
          if (shadow.raw[j * 3 + 1] / 255 > 0.85) { found = j; break; }
        }
      }
      if (found < 0) continue;
      const y0 = luma(beauty.raw[i * 3] / 255, beauty.raw[i * 3 + 1] / 255, beauty.raw[i * 3 + 2] / 255);
      const y1 = luma(beauty.raw[found * 3] / 255, beauty.raw[found * 3 + 1] / 255, beauty.raw[found * 3 + 2] / 255);
      seamSum += Math.abs(y0 - y1);
      seamN++;
    }
  }
  const seam = seamN ? seamSum / seamN : 1;
  if (seamN < 8) bad(`seam samples ${tag} ${seamN}`);
  else if (seam > limits.cascadeSeamJumpMax) bad(`seam ${tag} ${seam.toFixed(3)}`);
  const greyBright = bright ? grey / bright : null;
  const blue = iceN ? iceBlue / iceN : null;
  if (greyBright == null || !(greyBright < limits.greyBrightMax)) bad(`grey_bright ${tag} ${greyBright}`);
  if (!(blue > limits.iceBlueMin)) bad(`ice b-r ${tag} ${blue}`);
  if (clip / (w * h) > limits.clipFracMax) bad(`clip ${tag}`);
  rows.push({
    tag, iou: +iou.toFixed(4), gpu: gN, cpu: cN, inter, union, spireTris: cpu.used,
    blueDelta: +blueDelta.toFixed(4), seam: +seam.toFixed(4), seamN,
    greyBright: greyBright == null ? null : +greyBright.toFixed(4),
    iceBlue: blue == null ? null : +blue.toFixed(4),
    clip: +(clip / (w * h)).toFixed(5),
    draws: info.draws, shadowDraws: info.shadowDraws,
  });
  console.log(tag, 'iou', iou.toFixed(3), 'gpu', gN, 'cpu', cN, 'blue', blueDelta.toFixed(3), 'seam', seam.toFixed(3));
}
if (fs.existsSync(path.join(root, 'shimmer.json'))) {
  const shim = JSON.parse(fs.readFileSync(path.join(root, 'shimmer.json'), 'utf8'));
  if (shim.eyeA && fs.existsSync(path.join(root, 'shimmer-a.png'))) {
    const A = load(path.join(root, 'shimmer-a.png'));
    const B = load(path.join(root, 'shimmer-b.png'));
    const ca = cpuOcclusion(world, shim.eyeA, shim.tgtA, A.w, A.h);
    const cb = cpuOcclusion(world, shim.eyeB, shim.tgtB, B.w, B.h);
    let edge = 0;
    let changed = 0;
    for (let t = 0; t < world.verts.length; t += 8 * 3) {
      if (Math.round(world.verts[t + 3]) !== 0) continue;
      const p = [world.verts[t], world.verts[t + 1], world.verts[t + 2]];
      if ((p[0] - shim.eyeA[0]) ** 2 + (p[2] - shim.eyeA[2]) ** 2 > 40 * 40) continue;
      const sa = ca.blocked(p) ? 0 : 1;
      const sb = cb.blocked(p) ? 0 : 1;
      if ((sa > 0.05 && sa < 0.95) || (sb > 0.05 && sb < 0.95)) continue;
      const pa = project(mul(persp(FOV_Y, A.w / A.h, 0.08, 14000), lookAt(shim.eyeA, shim.tgtA, [0, 1, 0])), p, A.w, A.h);
      const pb = project(mul(persp(FOV_Y, B.w / B.h, 0.08, 14000), lookAt(shim.eyeB, shim.tgtB, [0, 1, 0])), p, B.w, B.h);
      if (!pa || !pb) continue;
      if (pa[0] < 1 || pb[0] < 1 || pa[1] < 1 || pb[1] < 1 || pa[0] >= A.w || pb[0] >= B.w || pa[1] >= A.h || pb[1] >= B.h) continue;
      const ga = A.raw[((pa[1] | 0) * A.w + (pa[0] | 0)) * 3] / 255;
      const gb = B.raw[((pb[1] | 0) * B.w + (pb[0] | 0)) * 3] / 255;
      const edgePix = (ga > 0.05 && ga < 0.95) || (gb > 0.05 && gb < 0.95);
      if (!edgePix) continue;
      edge++;
      if (Math.abs(ga - gb) > 0.1) changed++;
    }
    shim.fraction = edge ? changed / edge : 0;
    shim.edge = edge;
    shim.changed = changed;
    shim.worldSpace = true;
  }
  rows.push({ shimmer: shim });
  if (!(shim.fraction <= limits.edgeShimmerMax)) bad(`edge_shimmer ${shim.fraction}`);
}
if (fs.existsSync(path.join(root, 'cross.json'))) {
  const cross = JSON.parse(fs.readFileSync(path.join(root, 'cross.json'), 'utf8'));
  rows.push({ cross });
  if (!(cross.de76 <= limits.crossCameraDe76Max)) bad(`cross-camera ${cross.de76}`);
}
const report = { limits: { csmIouMin: limits.csmIouMin, edgeShimmerMax: limits.edgeShimmerMax, cascadeSeamJumpMax: limits.cascadeSeamJumpMax, snowShadowBlueMin: limits.snowShadowBlueMin }, rows, verdict: fail ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(root, 'csm-gate.json'), JSON.stringify(report, null, 2) + '\n');
console.log(report.verdict);
if (fail) process.exit(1);
