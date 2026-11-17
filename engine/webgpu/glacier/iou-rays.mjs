// Classify snow vertices the GPU shades and the shadow reference does not.
// A ray from the vertex toward the sun is tested against every triangle,
// including the snow sheet. Origin is 4 cm along the normal so the surface
// under the vertex is not the hit.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { norm3 } from '../biome-factory/light-rig.js';
import { LIGHT } from './biome.js';
import { buildWorld } from './world.js';
import { buildCascades, applyMat } from './shadows.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sun = norm3(LIGHT.sun.direction);
const world = buildWorld();

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
  return { raw, w, h };
}
function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

const tris = [];
function addTri(a, b, c, kind) {
  tris.push({ a, b, c, kind });
}
const verts = world.verts;
for (let t = 0; t + 24 <= verts.length; t += 24) {
  const m = Math.round(verts[t + 3]);
  const tri = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
  addTri(tri[0], tri[1], tri[2], m === 0 ? 'snow' : 'wall');
}
function bake(proto, data, kind) {
  const vCount = proto.length / 8;
  const count = data.length / 8;
  for (let i = 0; i < count; i++) {
    const ix = data[i * 8], iy = data[i * 8 + 1], iz = data[i * 8 + 2], yaw = data[i * 8 + 3];
    const sx = data[i * 8 + 4], sy = data[i * 8 + 5], sz = data[i * 8 + 6], tilt = data[i * 8 + 7];
    const cl = Math.cos(tilt), sl = Math.sin(tilt), c = Math.cos(yaw), s = Math.sin(yaw);
    const pts = [];
    for (let v = 0; v < vCount; v++) {
      const px = proto[v * 8] * sx, py = proto[v * 8 + 1] * sy, pz = proto[v * 8 + 2] * sz;
      const pLx = cl * px - sl * py;
      pts.push([c * pLx + s * pz + ix, sl * px + cl * py + iy, -s * pLx + c * pz + iz]);
    }
    for (let v = 0; v + 2 < pts.length; v += 3) addTri(pts[v], pts[v + 1], pts[v + 2], kind);
  }
}
for (const name of ['icicle', 'chunk', 'drift']) bake(world.instances[name].proto, world.instances[name].data, name);

const CELL = 24;
const grid = new Map();
function cellKey(x, z) { return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; }
for (let i = 0; i < tris.length; i++) {
  const t = tris[i];
  const minX = Math.min(t.a[0], t.b[0], t.c[0]);
  const maxX = Math.max(t.a[0], t.b[0], t.c[0]);
  const minZ = Math.min(t.a[2], t.b[2], t.c[2]);
  const maxZ = Math.max(t.a[2], t.b[2], t.c[2]);
  for (let x = Math.floor(minX / CELL); x <= Math.floor(maxX / CELL); x++) {
    for (let z = Math.floor(minZ / CELL); z <= Math.floor(maxZ / CELL); z++) {
      const k = `${x},${z}`;
      let list = grid.get(k);
      if (!list) { list = []; grid.set(k, list); }
      list.push(i);
    }
  }
}
console.log('tris', tris.length, 'cells', grid.size);

function rayKind(origin, nrm) {
  const dir = sun;
  const orig = [origin[0] + nrm[0] * 0.04, origin[1] + nrm[1] * 0.04, origin[2] + nrm[2] * 0.04];
  let best = 200;
  let kind = null;
  const seen = new Set();
  const steps = 28;
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * 160;
    const x = orig[0] + dir[0] * t;
    const z = orig[2] + dir[2] * t;
    const list = grid.get(cellKey(x, z));
    if (!list) continue;
    for (const id of list) {
      if (seen.has(id)) continue;
      seen.add(id);
      const tri = tris[id];
      const e1 = sub(tri.b, tri.a);
      const e2 = sub(tri.c, tri.a);
      const pvec = cross(dir, e2);
      const det = dot(e1, pvec);
      if (Math.abs(det) < 1e-8) continue;
      const inv = 1 / det;
      const tvec = sub(orig, tri.a);
      const u = dot(tvec, pvec) * inv;
      if (u < -0.001 || u > 1.001) continue;
      const qvec = cross(tvec, e1);
      const v = dot(dir, qvec) * inv;
      if (v < -0.001 || u + v > 1.001) continue;
      const hit = dot(e2, qvec) * inv;
      if (hit > 0.03 && hit < best) { best = hit; kind = tri.kind; }
    }
  }
  return kind;
}

function reference(eye, tgt, W, H) {
  const casc = buildCascades({ eye, tgt, fovY: FOV_Y, aspect: W / H, sun, tier: 'phone' });
  const S = 1024;
  const depth = [new Float32Array(S * S).fill(1), new Float32Array(S * S).fill(1)];
  function rast(tri) {
    for (let ci = 0; ci < 2; ci++) {
      const q = tri.map((v) => applyMat(casc.mats[ci], v));
      const proj = q.map((v) => [(v[0] * 0.5 + 0.5) * S, (0.5 - v[1] * 0.5) * S, v[2]]);
      const xs = proj.map((v) => v[0]);
      const ys = proj.map((v) => v[1]);
      if (Math.max(...xs) < 0 || Math.min(...xs) > S || Math.max(...ys) < 0 || Math.min(...ys) > S) continue;
      const minX = Math.max(0, Math.floor(Math.min(...xs)));
      const maxX = Math.min(S - 1, Math.ceil(Math.max(...xs)));
      const minY = Math.max(0, Math.floor(Math.min(...ys)));
      const maxY = Math.min(S - 1, Math.ceil(Math.max(...ys)));
      const [a, b, c] = proj;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      if (Math.abs(area) < 1e-3) continue;
      const buf = depth[ci];
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5, py = y + 0.5;
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
  }
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    if (Math.round(verts[t + 3]) < 0.5) continue;
    rast([0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]));
  }
  for (const name of ['icicle', 'chunk', 'drift']) {
    const inst = world.instances[name];
    const proto = inst.proto, data = inst.data;
    const vCount = proto.length / 8;
    const count = data.length / 8;
    for (let i = 0; i < count; i++) {
      const ix = data[i * 8], iy = data[i * 8 + 1], iz = data[i * 8 + 2], yaw = data[i * 8 + 3];
      const sx = data[i * 8 + 4], sy = data[i * 8 + 5], sz = data[i * 8 + 6], tilt = data[i * 8 + 7];
      const cl = Math.cos(tilt), sl = Math.sin(tilt), c = Math.cos(yaw), s = Math.sin(yaw);
      const pts = [];
      for (let v = 0; v < vCount; v++) {
        const px = proto[v * 8] * sx, py = proto[v * 8 + 1] * sy, pz = proto[v * 8 + 2] * sz;
        const pLx = cl * px - sl * py;
        pts.push([c * pLx + s * pz + ix, sl * px + cl * py + iy, -s * pLx + c * pz + iz]);
      }
      for (let v = 0; v + 2 < pts.length; v += 3) rast([pts[v], pts[v + 1], pts[v + 2]]);
    }
  }
  return (p) => {
    for (let ci = 0; ci < 2; ci++) {
      const q = applyMat(casc.mats[ci], p);
      if (Math.max(Math.abs(q[0]), Math.abs(q[1])) >= 0.98 || q[2] < 0 || q[2] > 1) continue;
      const x = Math.max(0, Math.min(S - 1, (q[0] * 0.5 + 0.5) * S | 0));
      const y = Math.max(0, Math.min(S - 1, (0.5 - q[1] * 0.5) * S | 0));
      if (depth[ci][y * S + x] + 0.008 < q[2]) return true;
    }
    return false;
  };
}

const root = process.argv[2];
const tags = (process.argv[3] || '117,24').split(',');
const out = {};
for (const tag of tags) {
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after', `t${tag}.json`), 'utf8'));
  const shadow = load(path.join(root, 'mask', `t${tag}.png`));
  const mat = load(path.join(root, 'after', `t${tag}-mat.png`));
  const { w, h } = shadow;
  const blocked = reference(info.eye, info.tgt, w, h);
  const vp = mul(persp(FOV_Y, w / h, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  const counts = { gpuOnly: 0, terrain: 0, drift: 0, wall: 0, none: 0, other: 0, refBlocked: 0, refHit: 0, refMiss: 0 };
  for (let t = 0; t < verts.length; t += 8 * 4) {
    if (Math.round(verts[t + 3]) !== 0) continue;
    const p = [verts[t], verts[t + 1], verts[t + 2]];
    const nrm = [verts[t + 4], verts[t + 5], verts[t + 6]];
    if ((p[0] - info.eye[0]) ** 2 + (p[2] - info.eye[2]) ** 2 > 70 * 70) continue;
    const scr = project(vp, p, w, h);
    if (!scr || scr[0] < 1 || scr[1] < 1 || scr[0] >= w - 1 || scr[1] >= h - 1) continue;
    const pix = (scr[1] | 0) * w + (scr[0] | 0);
    if (Math.round(mat.raw[pix * 3] / 255 * 8 - 0.5) !== 0) continue;
    const gpuDark = shadow.raw[pix * 3] / 255 < 0.5;
    const ref = blocked(p);
    if (ref) {
      counts.refBlocked++;
      if (counts.refBlocked <= 80) {
        const k = rayKind(p, nrm);
        if (k) counts.refHit++;
        else counts.refMiss++;
      }
    }
    if (!gpuDark || ref) continue;
    counts.gpuOnly++;
    const shifted = [p[0] + nrm[0] * 0.035, p[1] + nrm[1] * 0.035, p[2] + nrm[2] * 0.035];
    const kind = rayKind(p, nrm);
    const kindShift = rayKind(shifted, [0, 1, 0]);
    if (!counts.shift) counts.shift = { terrain: 0, none: 0, other: 0 };
    if (kindShift === 'snow') counts.shift.terrain++;
    else if (kindShift == null) counts.shift.none++;
    else counts.shift.other++;
    if (kind === 'snow') counts.terrain++;
    else if (kind === 'drift') counts.drift++;
    else if (kind === 'wall' || kind === 'icicle' || kind === 'chunk') counts.wall++;
    else if (kind == null) {
      counts.none++;
      if (counts.none <= 3) console.log(' clear', tag, p.map((v) => +v.toFixed(2)), 'px', [scr[0] | 0, scr[1] | 0]);
    }
    else counts.other++;
  }
  counts.a = counts.terrain + counts.drift;
  counts.b = counts.none;
  counts.c = counts.wall + counts.other;
  out[tag] = counts;
  console.log(tag, JSON.stringify(counts));
}
fs.writeFileSync(path.join(root, 'iou-rays.json'), JSON.stringify(out, null, 2) + '\n');
