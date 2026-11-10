// Enclosed-hole gate. Far-plane depth inside a wall's screen hull.
// A punched pixel is the negative control and must fail.
import { lookAt, persp, mul } from '../engine/bricks/follow-cam.js';
import { buildWorld, wallPoint } from './world.js';
import { MAT } from './biome.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const z = vp[2] * p[0] + vp[6] * p[1] + vp[10] * p[2] + vp[14];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0.05)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, z / w];
}

function countHoles(depth, W, H) {
  let holes = 0;
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const id = y * W + x;
      if (depth[id] < 0.9995) continue;
      let around = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (depth[(y + dy) * W + (x + dx)] < 0.9995) around++;
      }
      if (around === 4) holes++;
    }
  }
  return holes;
}

function rasterHoles(world, eye, tgt, punch) {
  const W = 160, H = 280;
  const view = lookAt(eye, tgt, [0, 1, 0]);
  const proj = persp(62 * Math.PI / 180, W / H, 0.08, 14000);
  const vp = mul(proj, view);
  const depth = new Float32Array(W * H).fill(1);
  const verts = world.verts;
  for (let v = 0; v < verts.length; v += 24) {
    if (Math.abs(verts[v + 3] - MAT.wall) > 0.2) continue;
    const P = [];
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const o = v + k * 8;
      const pr = project(vp, [verts[o], verts[o + 1], verts[o + 2]], W, H);
      if (!pr) ok = false;
      P.push(pr);
    }
    if (!ok) continue;
    const ax = P[0][0], ay = P[0][1], bx = P[1][0], by = P[1][1], cx = P[2][0], cy = P[2][1];
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxy = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    if (maxx < minx || maxy < miny) continue;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-4) continue;
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
        const id = y * W + x;
        if (z < depth[id]) depth[id] = z;
      }
    }
  }
  if (punch) {
    for (let y = 8; y < H - 8; y++) {
      for (let x = 8; x < W - 8; x++) {
        const id = y * W + x;
        if (depth[id] < 0.9995 && depth[id - 1] < 0.9995 && depth[id + 1] < 0.9995 && depth[id - W] < 0.9995 && depth[id + W] < 0.9995) {
          depth[id] = 1;
          return countHoles(depth, W, H);
        }
      }
    }
  }
  return countHoles(depth, W, H);
}

const world = buildWorld();
const at = wallPoint(-36, -1, 0.42);
const eye = [at[0] + 8, at[1], at[2] + 0.4];
const clean = rasterHoles(world, eye, at, false);
const injected = rasterHoles(world, eye, at, true);
if (clean > 0) bad('far depth inside a wall hull ' + clean);
if (!(injected > clean)) bad('hole injection did not fail ' + injected);
if (fail) process.exit(1);
console.log('PASS holes', JSON.stringify({ wallHoles: clean, holeControl: injected }));
