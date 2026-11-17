// Horizon, side-drop, and slab gate. Thresholds are not lowered.
//   node horizon-gate.mjs
// The camera position is the t=30 chase eye on the sealed route (speed 7, accel 9).
// mcam is the level look yaw in radians: 0 is world -Z, 1.57 is world +X.
import { MAT, GLACIER } from './biome.js';
import { buildWorld, spawn, integrate, chaseInput, pathX, floorH, floorHalf } from './world.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';

export const HORIZON_MIN = 0.98;
export const SHOULDER_DROP_MAX = 0.4;
export const SLAB_SHEETS_MAX = 0;
export const SLAB_CAPS_MAX = 0;
export const TRIS_MAX = 197000;
export const CORRIDOR_CLEARANCE_M = 0.5;
export const MCAMS = [0, 0.9, 1.57];
const W = 720;
const H = 1280;
const GRAZE = 0.08;

const world = buildWorld();
const verts = world.verts;
const nTri = verts.length / 24;

function chase(T) {
  const live = spawn();
  const dt = 1 / 60;
  let t = 0;
  while (t < T - 1e-6) {
    const input = chaseInput(t, live);
    if (input.run) live.v = Math.min(7, live.v + 9 * dt);
    integrate(live, dt, input);
    t += dt;
  }
  const y = world.heightAt(live.x, live.z);
  const cam = followEye([live.x, y, live.z], live.cam, world.heightAt, 0);
  return { eye: cam.eye, tgt: cam.tgt, live, y };
}

function project(vp, x, y, z) {
  const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
  const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
  const cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
  const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
  if (cw <= 0.08) return null;
  return [(cx / cw * 0.5 + 0.5) * W, (1 - (cy / cw * 0.5 + 0.5)) * H, cz / cw, cw];
}

function raster(vp, y0, y1) {
  const h = y1 - y0;
  const zbuf = new Float32Array(W * h);
  const id = new Int32Array(W * h);
  const dist = new Float32Array(W * h);
  zbuf.fill(2);
  id.fill(-1);
  for (let i = 0; i < nTri; i++) {
    const b = i * 24;
    const p0 = project(vp, verts[b], verts[b + 1], verts[b + 2]);
    const p1 = project(vp, verts[b + 8], verts[b + 9], verts[b + 10]);
    const p2 = project(vp, verts[b + 16], verts[b + 17], verts[b + 18]);
    if (!p0 || !p1 || !p2) continue;
    let minY = Math.min(p0[1], p1[1], p2[1]);
    let maxY = Math.max(p0[1], p1[1], p2[1]);
    if (maxY < y0 || minY >= y1) continue;
    let minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
    let maxX = Math.min(W - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
    minY = Math.max(y0, Math.floor(minY));
    maxY = Math.min(y1 - 1, Math.ceil(maxY));
    if (minX > maxX) continue;
    for (let y = minY; y <= maxY; y++) {
      const row = (y - y0) * W;
      for (let x = minX; x <= maxX; x++) {
        const w0 = (p1[0] - x) * (p2[1] - y) - (p2[0] - x) * (p1[1] - y);
        const w1 = (p2[0] - x) * (p0[1] - y) - (p0[0] - x) * (p2[1] - y);
        const w2 = (p0[0] - x) * (p1[1] - y) - (p1[0] - x) * (p0[1] - y);
        const s = w0 + w1 + w2;
        if (!s || w0 * s < 0 || w1 * s < 0 || w2 * s < 0) continue;
        const z = (w0 * p0[2] + w1 * p1[2] + w2 * p2[2]) / s;
        if (z < zbuf[row + x]) {
          zbuf[row + x] = z;
          id[row + x] = i;
          dist[row + x] = (w0 * p0[3] + w1 * p1[3] + w2 * p2[3]) / s;
        }
      }
    }
  }
  return { id, dist, y0 };
}

// LOD dither in glacier.js. Fall, arch, wall, mountain. Snow and horizon are not in it.
function dithered(mat) {
  return (mat > 0.5 && mat < 2.5) || (mat > 5.5 && mat < 7.5);
}
function cover(d) {
  const t = Math.min(1, Math.max(0, (d - 460) / (160 - 460)));
  return t * t * (3 - 2 * t);
}

function tri(i) {
  const b = i * 24;
  const P = [0, 8, 16].map((k) => [verts[b + k], verts[b + k + 1], verts[b + k + 2]]);
  const e = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
  const nx = verts[b + 4];
  const ny = verts[b + 5];
  const nz = verts[b + 6];
  return {
    mat: Math.round(verts[b + 3]),
    nx, ny, nz,
    emax: Math.max(e(P[0], P[1]), e(P[1], P[2]), e(P[2], P[0])),
    c: [(P[0][0] + P[1][0] + P[2][0]) / 3, (P[0][1] + P[1][1] + P[2][1]) / 3, (P[0][2] + P[1][2] + P[2][2]) / 3],
  };
}

function horizonAt(eye, yaw) {
  const cf = [-Math.sin(yaw), 0, -Math.cos(yaw)];
  const tgt = [eye[0] + cf[0] * 80, eye[1], eye[2] + cf[2] * 80];
  const vp = mul(persp(FOV_Y, W / H, 0.08, 14000), lookAt(eye, tgt, [0, 1, 0]));
  const far = project(vp, eye[0] + cf[0] * 8000, eye[1], eye[2] + cf[2] * 8000);
  const hy = Math.max(1, Math.min(H - 2, Math.round(far[1])));
  const { id, dist, y0 } = raster(vp, hy, hy + 1);
  let closed = 0;
  let sky = 0;
  let graze = 0;
  for (let x = 0; x < W; x++) {
    const i = id[x];
    if (i < 0) { sky++; continue; }
    const f = tri(i);
    const vx = eye[0] - f.c[0];
    const vy = eye[1] - f.c[1];
    const vz = eye[2] - f.c[2];
    const vl = Math.hypot(vx, vy, vz) || 1;
    const ndv = Math.abs((f.nx * vx + f.ny * vy + f.nz * vz) / vl);
    if (ndv < GRAZE) { graze++; continue; }
    closed += dithered(f.mat) ? cover(dist[x]) : 1;
  }
  return { yaw, hy, closed: closed / W, sky: sky / W, graze: graze / W, y0 };
}

// Positive-lat ditch beside the lane. The chase camera's right is +X.
function shoulderDrop() {
  let worst = 0;
  let at = null;
  for (let z = -40; z >= -400; z -= 4) {
    const lane = floorH(pathX(z), z);
    for (let lat = 2; lat <= 12; lat += 0.5) {
      const drop = lane - floorH(pathX(z) + lat, z);
      if (drop > worst) { worst = drop; at = { z, lat: +lat.toFixed(2) }; }
    }
  }
  return { metres: worst, at };
}

// Near the chase, a snow face is a slab when it is a tall vertical sheet or a
// wide flat cap. The lane's own small quads stay under these edges.
function nearSlabs() {
  let sheets = 0;
  let caps = 0;
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const mat = Math.round(verts[t + 3]);
    if (mat !== MAT.snow && mat !== MAT.horizon) continue;
    const z = (verts[t + 2] + verts[t + 10] + verts[t + 18]) / 3;
    if (z < -700) continue;
    const P = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
    const e = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const emax = Math.max(e(P[0], P[1]), e(P[1], P[2]), e(P[2], P[0]));
    const ny = verts[t + 5];
    if (Math.abs(ny) < 0.25 && emax > 10) sheets++;
    if (ny > 0.8 && emax > 12) caps++;
  }
  return { sheets, caps };
}

// The player can reach |lat| <= max(6, floorHalf - 1.3) from z0 to z1.
// Horizon geometry inside that volume, above the floor, blocks the run.
function corridorHalf(z) {
  return Math.max(6, floorHalf(z) - 1.3);
}

function triHeight(x, z, a, b, c) {
  const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(den) < 1e-6) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
  const w = 1 - u - v;
  if (u < -0.02 || v < -0.02 || w < -0.02) return null;
  return u * a[1] + v * b[1] + w * c[1];
}

function corridorBlock() {
  const bins = new Map();
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    if (Math.round(verts[t + 3]) !== MAT.horizon) continue;
    const P = [0, 8, 16].map((k) => [verts[t + k], verts[t + k + 1], verts[t + k + 2]]);
    const z0 = Math.min(P[0][2], P[1][2], P[2][2]);
    const z1 = Math.max(P[0][2], P[1][2], P[2][2]);
    const tri = { P, z0, z1 };
    for (let k = Math.floor(z0 / 40); k <= Math.floor(z1 / 40); k++) {
      let list = bins.get(k);
      if (!list) { list = []; bins.set(k, list); }
      list.push(tri);
    }
  }
  let hits = 0;
  let worst = null;
  for (let z = GLACIER.z0; z >= GLACIER.z1; z -= 4) {
    const list = bins.get(Math.floor(z / 40));
    if (!list) continue;
    const half = corridorHalf(z);
    for (let lat = -half; lat <= half; lat += 2) {
      const x = pathX(z) + lat;
      const floor = floorH(x, z);
      for (const tri of list) {
        const y = triHeight(x, z, tri.P[0], tri.P[1], tri.P[2]);
        if (y == null || y <= floor + CORRIDOR_CLEARANCE_M) continue;
        hits++;
        const rise = y - floor;
        if (!worst || rise > worst.rise) worst = { z, lat: +lat.toFixed(1), rise: +rise.toFixed(1) };
      }
    }
  }
  return { hits, worst };
}

const pose = chase(30);
const horizons = MCAMS.map((yaw) => horizonAt(pose.eye, yaw));
const shoulder = shoulderDrop();
const slabs = nearSlabs();
const corridor = corridorBlock();
const report = {
  tris: world.budget.totalTris,
  draws: world.budget.draws,
  eye: pose.eye.map((v) => +v.toFixed(2)),
  horizons,
  shoulder,
  slabs,
  corridor,
  limits: {
    horizon: HORIZON_MIN,
    shoulderDrop: SHOULDER_DROP_MAX,
    slabSheets: SLAB_SHEETS_MAX,
    slabCaps: SLAB_CAPS_MAX,
    tris: TRIS_MAX,
    corridorHits: 0,
  },
};
let fail = 0;
for (const h of horizons) {
  if (h.closed < HORIZON_MIN) fail++;
}
if (shoulder.metres > SHOULDER_DROP_MAX) fail++;
if (slabs.sheets > SLAB_SHEETS_MAX) fail++;
if (slabs.caps > SLAB_CAPS_MAX) fail++;
if (world.budget.totalTris > TRIS_MAX) fail++;
if (corridor.hits > 0) fail++;
console.log(JSON.stringify(report, null, 2));
if (fail) {
  console.error('FAIL horizon-gate', fail);
  process.exit(1);
}
console.log('PASS horizon-gate');
