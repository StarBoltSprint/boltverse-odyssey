// On-screen texel footprint. The shader samples world position, including on
// instanced icicles, chunks, and drifts, whose stored uv is only a proto chart.
// Phone view is 720×1280. Foreground is a triangle facing the chase camera
// inside 8 m. Mip is the one textureSampleGrad actually requests: derivative
// times the shader bias, then the 3-texel cover floor.
import { boltIdle } from '../bricks/bolt-idle.js';
import { followEye, lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';
import { buildWorld, chaseInput, integrate, spawn } from './world.js';
import { MAT } from './biome.js';
import { REPEATS_PER_M } from './texel-density.js';

const PHONE_W = 720;
const PHONE_H = 1280;
const TEX = 1024;
const ANG = 0.41;
const COVER = 3 / TEX;
const AUTHORED = TEX * REPEATS_PER_M;

const BIAS = {
  [MAT.snow]: 2,
  [MAT.fall]: 2,
  [MAT.arch]: 4,
  [MAT.icicle]: 4,
  [MAT.drift]: 2,
  [MAT.wall]: 4,
  [MAT.mountain]: 4,
};

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 1e-8 ? [a[0] / l, a[1] / l, a[2] / l] : null;
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }

export function chasePose(t, world) {
  const idle = boltIdle();
  const live = spawn();
  const dt = 1 / 60;
  let sim = 0;
  while (sim < t - 1e-9) {
    const h = Math.min(dt, t - sim);
    const input = chaseInput(sim, live);
    idle.stepMotion(live, h, input.run);
    integrate(live, h, input);
    sim += h;
  }
  const bp = [live.x, world.heightAt(live.x, live.z), live.z];
  const { eye, tgt } = followEye(bp, live.cam, world.heightAt, 0);
  const vp = mul(persp(FOV_Y, PHONE_W / PHONE_H, 0.08, 14000), lookAt(eye, tgt, [0, 1, 0]));
  return { eye, tgt, vp, live, bp };
}

function project(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0.05)) return null;
  return [(x / w * 0.5 + 0.5) * PHONE_W, (1 - (y / w * 0.5 + 0.5)) * PHONE_H];
}

function shaderUv(p, n, mat) {
  if (mat === MAT.snow) {
    const c = Math.cos(ANG);
    const s = Math.sin(ANG);
    return [(p[0] * c - p[2] * s) * REPEATS_PER_M, (p[0] * s + p[2] * c) * REPEATS_PER_M];
  }
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t = norm(cross(helper, n));
  if (!t) return [0, 0];
  const b = norm(cross(n, t));
  if (!b) return [0, 0];
  return [dot(p, t) * REPEATS_PER_M, dot(p, b) * REPEATS_PER_M];
}

function mipFrom(uvPerPx, bias) {
  let d = uvPerPx * bias;
  if (d < COVER) d = COVER;
  return Math.log2(Math.max(d * TEX, 1));
}

function consider(bucket, p0, p1, p2, mat, eye, vp, maxDist) {
  const n = norm(cross(sub(p1, p0), sub(p2, p0)));
  if (!n) return;
  const mid = [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3, (p0[2] + p1[2] + p2[2]) / 3];
  const toEye = sub(eye, mid);
  const dist = Math.hypot(toEye[0], toEye[1], toEye[2]);
  if (!(dist > 0.35 && dist <= maxDist)) return;
  if (dot(n, toEye) <= 0) return;
  const s0 = project(vp, p0);
  const s1 = project(vp, p1);
  const s2 = project(vp, p2);
  if (!s0 || !s1 || !s2) return;
  const on = [s0, s1, s2].some((s) => s[0] >= -40 && s[0] <= PHONE_W + 40 && s[1] >= -40 && s[1] <= PHONE_H + 40);
  if (!on) return;
  const uv0 = shaderUv(p0, n, mat);
  const uv1 = shaderUv(p1, n, mat);
  const uv2 = shaderUv(p2, n, mat);
  const edges = [[p0, p1, s0, s1, uv0, uv1], [p1, p2, s1, s2, uv1, uv2], [p2, p0, s2, s0, uv2, uv0]];
  const pxPerM = [];
  let uvPerPx = 0;
  for (const [a, b, sa, sb, ua, ub] of edges) {
    const world = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const screen = Math.hypot(sb[0] - sa[0], sb[1] - sa[1]);
    if (world > 1e-4 && screen > 0.25) pxPerM.push(screen / world);
    if (screen > 0.25) {
      const duv = Math.hypot(ub[0] - ua[0], ub[1] - ua[1]);
      uvPerPx = Math.max(uvPerPx, duv / screen);
    }
  }
  if (!pxPerM.length || !(uvPerPx > 0)) return;
  pxPerM.sort((a, b) => a - b);
  const screenPx = pxPerM[pxPerM.length >> 1];
  const bias = BIAS[mat] ?? 2;
  const mip = mipFrom(uvPerPx, bias);
  bucket.push({
    dist,
    screenPx,
    mip,
    effective: AUTHORED / (2 ** mip),
    mag: screenPx / AUTHORED,
  });
}

function summarise(name, rows) {
  if (!rows.length) {
    return { name, n: 0, screenPxPerM: null, mip: null, effectivePxPerM: null, mag: null, minScreenPxPerM: null, dist: null };
  }
  const mid = (key) => {
    const s = rows.map((r) => r[key]).sort((a, b) => a - b);
    return s[s.length >> 1];
  };
  const screen = rows.map((r) => r.screenPx);
  return {
    name,
    n: rows.length,
    dist: mid('dist'),
    screenPxPerM: mid('screenPx'),
    minScreenPxPerM: Math.min(...screen),
    mip: mid('mip'),
    effectivePxPerM: mid('effective'),
    mag: mid('mag'),
  };
}

function instancePoint(a, inst) {
  const [x, y, z, yaw, sx, sy, sz, lean] = inst;
  const p0x = a[0] * sx;
  const p0y = a[1] * sy;
  const p0z = a[2] * sz;
  const cl = Math.cos(lean);
  const sl = Math.sin(lean);
  const pLx = cl * p0x - sl * p0y;
  const pLy = sl * p0x + cl * p0y;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [c * pLx + s * p0z + x, pLy + y, -s * pLx + c * p0z + z];
}

function instanceNormal(n, inst) {
  const yaw = inst[3];
  const lean = inst[7];
  const cl = Math.cos(lean);
  const sl = Math.sin(lean);
  const nLx = cl * n[0] - sl * n[1];
  const nLy = sl * n[0] + cl * n[1];
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return norm([c * nLx + s * n[2], nLy, -s * nLx + c * n[2]]) || [0, 1, 0];
}

function readTri(verts, t) {
  const at = (k) => {
    const o = t + k * 8;
    return {
      p: [verts[o], verts[o + 1], verts[o + 2]],
      n: [verts[o + 4], verts[o + 5], verts[o + 6]],
      mat: Math.round(verts[o + 3]),
    };
  };
  return [at(0), at(1), at(2)];
}

export function measureForeground(world, pose) {
  const { eye, vp } = pose;
  const groups = { snow: [], icicle: [], chunk: [], drift: [] };
  const verts = world.verts;
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const tri = readTri(verts, t);
    if (tri[0].mat !== MAT.snow) continue;
    const mid = [
      (tri[0].p[0] + tri[1].p[0] + tri[2].p[0]) / 3,
      (tri[0].p[2] + tri[1].p[2] + tri[2].p[2]) / 3,
    ];
    if (Math.hypot(mid[0] - eye[0], mid[1] - eye[2]) > 6) continue;
    consider(groups.snow, tri[0].p, tri[1].p, tri[2].p, MAT.snow, eye, vp, 4);
  }
  for (const kind of ['icicle', 'chunk', 'drift']) {
    const slot = world.instances[kind];
    const proto = slot.proto;
    const data = slot.data;
    const mat = kind === 'icicle' ? MAT.icicle : MAT.drift;
    for (let i = 0; i < slot.count; i++) {
      const inst = data.subarray(i * 8, i * 8 + 8);
      const placed = [inst[0], inst[1], inst[2]];
      if (Math.hypot(placed[0] - eye[0], placed[1] - eye[1], placed[2] - eye[2]) > 80) continue;
      for (let t = 0; t + 24 <= proto.length; t += 24) {
        const tri = readTri(proto, t);
        const p0 = instancePoint(tri[0].p, inst);
        const p1 = instancePoint(tri[1].p, inst);
        const p2 = instancePoint(tri[2].p, inst);
        consider(groups[kind], p0, p1, p2, mat, eye, vp, 80);
      }
    }
  }
  return ['snow', 'icicle', 'chunk', 'drift'].map((name) => summarise(name, groups[name]));
}

function line(row) {
  if (!row.n) return `onscreen ${row.name} | no on-screen triangle`;
  const uv = row.name === 'snow' ? 'planar-xz' : 'world-frame';
  return `onscreen ${row.name} | uv ${uv} | n ${row.n} | dist ${row.dist.toFixed(2)} m | authored px/m ${AUTHORED} | screen px/m ${row.screenPxPerM.toFixed(1)} | min ${row.minScreenPxPerM.toFixed(1)} | mip ${row.mip.toFixed(2)} | sampled px/m ${row.effectivePxPerM.toFixed(1)} | mag ${row.mag.toFixed(3)}`;
}

export function foregroundReport(t = 5.1) {
  const world = buildWorld();
  const pose = chasePose(t, world);
  const rows = measureForeground(world, pose);
  return {
    t,
    z: pose.live.z,
    eye: pose.eye,
    rows,
    text: rows.map(line).join('\n'),
  };
}
