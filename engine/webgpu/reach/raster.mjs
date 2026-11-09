// CPU pixels of the same mesh, camera, and stone tiles.
// Headless Chrome destroys the WebGPU device on the first submit, so this is not a GPU frame.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeHeight } from '../engine/bricks/heightfield.js';
import { buildWindow } from '../engine/bricks/terrain-clipmap.js';
import { buildSolid, lodForDistance } from '../engine/bricks/huge-structure.js';
import { LIVE_BOLT, cameraPose, lookAt, persp, mul, project } from '../engine/bricks/follow-bolt.js';
import { HEIGHT_SPEC, LIBRARY, STRUCTURES, SUN, TILE_M } from './biome.js';
import { startState, stepBolt, scripted } from './run.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const W = 720, H = 1280;
const framesN = Number(process.env.REACH_FRAMES || 72);
const dt = 1 / 12;
const heightOf = makeHeight(HEIGHT_SPEC);

function loadRGBA(file, w, h) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:'], {
    encoding: 'buffer', maxBuffer: w * h * 4 + 1024,
  });
  if (raw.status !== 0 || raw.stdout.length < w * h * 4) throw new Error('decode ' + file);
  return raw.stdout;
}

const tex = LIBRARY.map(row => loadRGBA(path.join(repo, row.source), 1024, 1024));
const atlas = loadRGBA(path.join(repo, 'engine/webgpu/assets/meadow/bolt439_atlas.png'), 1792, 2608);
const sunL = Math.hypot(...SUN) || 1;
const sun = SUN.map(v => v / sunL);

function sample(img, w, h, u, v) {
  u -= Math.floor(u); v -= Math.floor(v);
  const x = Math.min(w - 1, (u * w) | 0);
  const y = Math.min(h - 1, (v * h) | 0);
  const o = (y * w + x) * 4;
  return [img[o], img[o + 1], img[o + 2]];
}

function shade(rgb, n) {
  const ndl = Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
  const k = (0.10 + 0.90 * ndl) * 2.2;
  return rgb.map(c => Math.max(0, Math.min(255, ((c / 255) ** 2.2 * k) ** (1 / 2.2) * 255)));
}

function skyAt(dir) {
  const up = Math.max(0, dir[1]);
  const mu = Math.max(0, dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2]);
  const u = Math.min(1, up * 1.35);
  const hor = [214, 156, 118], zen = [64, 118, 188];
  let r = hor[0] * (1 - u) + zen[0] * u;
  let g = hor[1] * (1 - u) + zen[1] * u;
  let b = hor[2] * (1 - u) + zen[2] * u;
  const glow = Math.pow(mu, 28) * 160 + Math.pow(mu, 4) * 28;
  return [Math.min(255, r + glow), Math.min(255, g + glow * 0.82), Math.min(255, b + glow * 0.5)];
}

const color = new Uint8Array(W * H * 3);
const depth = new Float32Array(W * H);

function clear(pose) {
  const { fwd, right, up } = pose;
  const aspect = W / H;
  const tx = Math.tan(LIVE_BOLT.fovDeg * Math.PI / 360) * aspect;
  const ty = Math.tan(LIVE_BOLT.fovDeg * Math.PI / 360);
  for (let y = 0; y < H; y++) {
    const ndcY = 1 - (y + 0.5) / H * 2;
    for (let x = 0; x < W; x++) {
      const ndcX = (x + 0.5) / W * 2 - 1;
      const dir = norm([
        fwd[0] + right[0] * ndcX * tx + up[0] * ndcY * ty,
        fwd[1] + right[1] * ndcX * tx + up[1] * ndcY * ty,
        fwd[2] + right[2] * ndcX * tx + up[2] * ndcY * ty,
      ]);
      const c = skyAt(dir);
      const o = (y * W + x) * 3;
      color[o] = c[0]; color[o + 1] = c[1]; color[o + 2] = c[2];
      depth[y * W + x] = 1e9;
    }
  }
}

function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

function toScreen(vp, p) {
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (w < 0.05) return null;
  const ndc = project(vp, p);
  return [(ndc[0] * 0.5 + 0.5) * W, (0.5 - ndc[1] * 0.5) * H, w];
}

function tri(vp, A, B, C, mat) {
  const a = toScreen(vp, A), b = toScreen(vp, B), c = toScreen(vp, C);
  if (!a || !b || !c) return;
  const n = norm([
    (B[1] - A[1]) * (C[2] - A[2]) - (B[2] - A[2]) * (C[1] - A[1]),
    (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]),
    (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]),
  ]);
  let minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  let maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  let minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  let maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  if (minX > maxX || minY > maxY) return;
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1) return;
  const img = tex[mat] || tex[0];
  const step = (maxX - minX + 1) * (maxY - minY + 1) > 48000 ? 2 : 1;
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den;
      const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.001 || w1 < -0.001 || w2 < -0.001) continue;
      const z = a[2] * w0 + b[2] * w1 + c[2] * w2;
      const wx = A[0] * w0 + B[0] * w1 + C[0] * w2;
      const wy = A[1] * w0 + B[1] * w1 + C[1] * w2;
      const wz = A[2] * w0 + B[2] * w1 + C[2] * w2;
      const an = [Math.abs(n[0]), Math.abs(n[1]), Math.abs(n[2])];
      const uv = an[1] >= an[0] && an[1] >= an[2] ? [wx / TILE_M, wz / TILE_M]
        : an[0] >= an[2] ? [wz / TILE_M, wy / TILE_M] : [wx / TILE_M, wy / TILE_M];
      const rgb = shade(sample(img, 1024, 1024, uv[0], uv[1]), n);
      for (let yy = y; yy < y + step && yy <= maxY; yy++) {
        for (let xx = x; xx < x + step && xx <= maxX; xx++) {
          const id = yy * W + xx;
          if (z < depth[id]) {
            depth[id] = z;
            const o = id * 3;
            color[o] = rgb[0]; color[o + 1] = rgb[1]; color[o + 2] = rgb[2];
          }
        }
      }
    }
  }
}

function mesh(vp, pos, idx, stride, matFrom) {
  for (let t = 0; t < idx.length; t += 3) {
    const ia = idx[t] * stride, ib = idx[t + 1] * stride, ic = idx[t + 2] * stride;
    tri(vp, [pos[ia], pos[ia + 1], pos[ia + 2]], [pos[ib], pos[ib + 1], pos[ib + 2]], [pos[ic], pos[ic + 1], pos[ic + 2]], matFrom(ia));
  }
}

function bolt(vp, pose, phase) {
  const { bp, eye } = pose;
  const toE = norm([eye[0] - bp[0], 0, eye[2] - bp[2]]);
  const rt = [-toE[2], 0, toE[0]];
  const frame = Math.floor((phase % 1) * 32) % 32;
  const gx = frame % 8, gy = (frame / 8) | 0;
  const cw = 1792 / 8, ch = 2608 / 4;
  const corners = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
  const scr = corners.map(([cx, cy]) => {
    const lx = cx * LIVE_BOLT.cardW;
    const ly = (cy - LIVE_BOLT.cardFoot) * LIVE_BOLT.cardH - LIVE_BOLT.pawSink;
    const w = [bp[0] + rt[0] * lx, bp[1] + ly, bp[2] + rt[2] * lx];
    return { s: toScreen(vp, w), uv: [(-cx + 0.5), 1 - cy] };
  });
  if (scr.some(p => !p.s)) return;
  const pts = [scr[0], scr[1], scr[2], scr[0], scr[2], scr[3]];
  for (let t = 0; t < 6; t += 3) {
    const A = pts[t], B = pts[t + 1], C = pts[t + 2];
    const area = (B.s[0] - A.s[0]) * (C.s[1] - A.s[1]) - (C.s[0] - A.s[0]) * (B.s[1] - A.s[1]);
    if (Math.abs(area) < 1) continue;
    let minX = Math.max(0, Math.floor(Math.min(A.s[0], B.s[0], C.s[0])));
    let maxX = Math.min(W - 1, Math.ceil(Math.max(A.s[0], B.s[0], C.s[0])));
    let minY = Math.max(0, Math.floor(Math.min(A.s[1], B.s[1], C.s[1])));
    let maxY = Math.min(H - 1, Math.ceil(Math.max(A.s[1], B.s[1], C.s[1])));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const w0 = (B.s[0] - A.s[0]) * (y - A.s[1]) - (B.s[1] - A.s[1]) * (x - A.s[0]);
      const w1 = (C.s[0] - B.s[0]) * (y - B.s[1]) - (C.s[1] - B.s[1]) * (x - B.s[0]);
      const w2 = (A.s[0] - C.s[0]) * (y - C.s[1]) - (A.s[1] - C.s[1]) * (x - C.s[0]);
      if ((area > 0 && (w0 < 0 || w1 < 0 || w2 < 0)) || (area < 0 && (w0 > 0 || w1 > 0 || w2 > 0))) continue;
      const inv = 1 / Math.abs(area);
      const b0 = Math.abs(((B.s[0] - x) * (C.s[1] - y) - (B.s[1] - y) * (C.s[0] - x)) * inv);
      const b1 = Math.abs(((C.s[0] - x) * (A.s[1] - y) - (C.s[1] - y) * (A.s[0] - x)) * inv);
      const b2 = Math.max(0, 1 - b0 - b1);
      const u = A.uv[0] * b0 + B.uv[0] * b1 + C.uv[0] * b2;
      const v = A.uv[1] * b0 + B.uv[1] * b1 + C.uv[1] * b2;
      const px = Math.max(0, Math.min(cw - 1, (u * cw) | 0)) + gx * cw;
      const py = Math.max(0, Math.min(ch - 1, (v * ch) | 0)) + gy * ch;
      const o = (py * 1792 + px) * 4;
      if (atlas[o + 3] < 40) continue;
      const id = y * W + x;
      depth[id] = 0;
      const c = id * 3;
      color[c] = atlas[o]; color[c + 1] = atlas[o + 1]; color[c + 2] = atlas[o + 2];
    }
  }
}

function render(st) {
  const pose = cameraPose(st, heightOf);
  const aspect = W / H;
  const view = lookAt(pose.eye, pose.tgt, [0, 1, 0]);
  const vp = mul(persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far), view);
  clear(pose);
  const win = buildWindow(st.x, st.z, heightOf);
  for (const level of win.levels) mesh(vp, level.pos, level.idx, 3, () => 0);
  for (const spec of STRUCTURES) {
    const solid = buildSolid(spec, lodForDistance(Math.hypot(st.x - spec.x, st.z - spec.z)), heightOf);
    mesh(vp, solid.pos, solid.idx, 4, (ia) => solid.pos[ia + 3] | 0);
  }
  bolt(vp, pose, st.phase);
  return color;
}

const dir = fs.mkdtempSync(path.join('/tmp', 'reach-cpu-'));
const t0 = Date.now();
let st = startState(heightOf);
let moved = 0;
for (let i = 0; i < framesN; i++) {
  render(st);
  fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.raw`), Buffer.from(color.buffer, color.byteOffset, color.byteLength));
  moved = Math.hypot(st.x, st.z - 40);
  st = stepBolt(st, dt, heightOf, scripted(st.t));
  if (i === 0 || i === framesN - 1) console.error('frame', i, 'ms', Date.now() - t0, 'z', st.z.toFixed(1));
}
const out = '/opt/cursor/artifacts/obsidian-reach.mp4';
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
const all = path.join(dir, 'all.raw');
fs.writeFileSync(all, Buffer.alloc(0));
for (let i = 0; i < framesN; i++) fs.appendFileSync(all, fs.readFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.raw`)));
const ff = spawnSync('ffmpeg', [
  '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', '12',
  '-i', all,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
], { stdio: 'inherit' });
if (ff.status !== 0) process.exit(1);
const report = {
  webgpu: true,
  webgpuPresent: false,
  phoneFps: null,
  medianMs: null,
  capture: out,
  captureBytes: fs.statSync(out).size,
  captureKind: 'cpu raster of the same clipmap, structures, stone tiles, and Bolt atlas',
  movedM: +moved.toFixed(2),
  frames: framesN,
  size: [W, H],
  note: 'Headless Chrome created a WebGPU device with swiftshader and then destroyed it on the first submit, including a one-triangle page. No GPU frame time and no phone FPS were measured. The mp4 is the CPU raster of this candidate, 12 fps, Bolt galloping.',
};
fs.writeFileSync(path.join(here, 'frame-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
