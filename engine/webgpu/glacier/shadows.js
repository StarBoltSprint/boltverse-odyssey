// Glacier cascaded sun shadows. Phone: 2 cascades in a 2048x1024 depth32float
// atlas, 4-tap PCF near, 1 tap far, blended seam. Projections snap to the
// world texel and use a fixed bounding-sphere radius. No polygon depth bias.
// The receiver offset is along the normal, smaller than one shadow texel.
import { lookAt, mul } from '../engine/bricks/follow-cam.js';

export const SHADOW_DRAWS = ['casters', 'bolt'];
const RADIUS_PAD = 1.08;

function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }

export function practicalSplit(i, n, near, far, lambda) {
  const p = i / n;
  const log = near * (far / near) ** p;
  const lin = near + (far - near) * p;
  return lambda * log + (1 - lambda) * lin;
}

export function highSplits() {
  const near = 1;
  const far = 120;
  const n = 4;
  const lambda = 0.7;
  const s = [0];
  for (let i = 1; i < n; i++) s.push(practicalSplit(i, n, near, far, lambda));
  s.push(far);
  return s;
}

export function tierConfig(tier) {
  if (tier === 'high') {
    return { tier: 'high', count: 4, atlas: [2048, 2048], tile: 1024, splits: highSplits(), lambda: 0.7 };
  }
  return { tier: 'phone', count: 2, atlas: [2048, 1024], tile: 1024, splits: [0, 25, 120], lambda: 0.7 };
}

export function fixedRadius(fovY, aspect, d0, d1) {
  const tanY = Math.tan(fovY / 2);
  const tanX = tanY * aspect;
  const mid = (d0 + d1) * 0.5;
  const hyp = Math.hypot(tanX, tanY);
  return Math.max(Math.hypot(d1 - mid, d1 * hyp), Math.hypot(mid - d0, d0 * hyp)) * RADIUS_PAD;
}

export function lightAxes(sun) {
  const L = norm(sun);
  const f = [-L[0], -L[1], -L[2]];
  let up = [0, 1, 0];
  if (Math.abs(dot(up, f)) > 0.95) up = [0, 0, 1];
  const s = norm(cross(f, up));
  const u = cross(s, f);
  return { s, u, f, L, up };
}

export function snapCenter(center, sun, radius, tile) {
  const { s, u, L } = lightAxes(sun);
  const texel = (2 * radius) / tile;
  let lx = dot(center, s);
  let ly = dot(center, u);
  const lz = dot(center, L);
  lx = Math.round(lx / texel) * texel;
  ly = Math.round(ly / texel) * texel;
  return add(add(scale(s, lx), scale(u, ly)), scale(L, lz));
}

// z is 0 toward the sun and 1 at the far side of the sphere. The near plane
// sits sunward of the sphere by more than the tallest wall, so a spire top
// is not clipped into a triangle that covers the whole shadow map.
const SUNWARD = 240;
export function cascadeMatrix(center, radius, sun) {
  const { L, up } = lightAxes(sun);
  const dist = radius + SUNWARD;
  const eye = add(center, scale(L, dist));
  const view = lookAt(eye, center, up);
  const n = dist - SUNWARD;
  const f = dist + radius;
  const ortho = [
    1 / radius, 0, 0, 0,
    0, 1 / radius, 0, 0,
    0, 0, 1 / (n - f), 0,
    0, 0, n / (n - f), 1,
  ];
  return mul(ortho, view);
}

export function buildCascades({ eye, tgt, fovY, aspect, sun, tier = 'phone' }) {
  const cfg = tierConfig(tier);
  const forward = norm([tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]]);
  const mats = [];
  const radii = [];
  const centers = [];
  for (let i = 0; i < cfg.count; i++) {
    const d0 = cfg.splits[i];
    const d1 = cfg.splits[i + 1];
    const radius = fixedRadius(fovY, aspect, d0, d1);
    const mid = (d0 + d1) * 0.5;
    const raw = [eye[0] + forward[0] * mid, eye[1] + forward[1] * mid, eye[2] + forward[2] * mid];
    const center = snapCenter(raw, sun, radius, cfg.tile);
    mats.push(cascadeMatrix(center, radius, sun));
    radii.push(radius);
    centers.push(center);
  }
  return {
    mats, radii, centers, splits: cfg.splits.slice(), count: cfg.count,
    atlas: cfg.atlas.slice(), tile: cfg.tile, tier: cfg.tier, lambda: cfg.lambda,
    draws: SHADOW_DRAWS.slice(),
  };
}

export function applyMat(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
  return [x / w, y / w, z / w, w];
}

export function shadowFnsWgsl() {
  return /* wgsl */`
fn cascadeOf(ci: u32) -> mat4x4f {
  if (ci == 0u) { return u.c0; }
  if (ci == 1u) { return u.c1; }
  if (ci == 2u) { return u.c2; }
  return u.c3;
}
fn atlasClip(clip: vec4f, ci: u32) -> vec4f {
  var o = clip;
  let nC = u32(u.csm.z + 0.5);
  if (nC <= 2u) {
    o.x = clip.x * 0.5 + select(-0.5, 0.5, ci == 1u) * clip.w;
    return o;
  }
  let col = ci % 2u;
  let row = ci / 2u;
  o.x = clip.x * 0.5 + select(-0.5, 0.5, col == 1u) * clip.w;
  o.y = clip.y * 0.5 + select(0.5, -0.5, row == 1u) * clip.w;
  return o;
}
fn tileOf(ci: f32) -> vec4f {
  if (u.csm.z < 3.0) { return vec4f(ci * 0.5, 0.0, ci * 0.5 + 0.5, 1.0); }
  let col = ci % 2.0;
  let row = floor(ci / 2.0);
  return vec4f(col * 0.5, row * 0.5, col * 0.5 + 0.5, row * 0.5 + 0.5);
}
fn shadowUv(q: vec4f, ci: f32) -> vec2f {
  let ndc = vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
  let tile = tileOf(ci);
  return vec2f(mix(tile.x, tile.z, ndc.x), mix(tile.y, tile.w, ndc.y));
}
fn csmOne(M: mat4x4f, ci: f32, bias: f32, w: vec3f, nrm: vec3f, o: vec2f) -> f32 {
  let ws = w + nrm * 0.02;
  let q = M * vec4f(ws, 1.0);
  if (q.z < 0.0 || q.z > 1.0) { return 1.0; }
  let uv = shadowUv(q, ci) + o;
  let tile = tileOf(ci);
  if (uv.x < tile.x || uv.y < tile.y || uv.x > tile.z || uv.y > tile.w) { return 1.0; }
  let dims = vec2f(textureDimensions(smap));
  let stored = textureLoad(smap, vec2i(clamp(uv, vec2f(0.0), vec2f(0.999)) * dims), 0);
  let zRef = q.z - bias;
  let cmp = textureSampleCompareLevel(smap, scmp, uv, zRef);
  let loadLit = select(0.0, 1.0, stored >= zRef);
  // The comparison sampler on this GPU does not match the depth texel.
  // A false 0 would paint an empty map as shadow, so the load decides.
  return select(loadLit, loadLit, cmp >= 0.0);
}
fn csmStored(M: mat4x4f, ci: f32, w: vec3f, nrm: vec3f) -> vec4f {
  let q = M * vec4f(w + nrm * 0.02, 1.0);
  let uv = shadowUv(q, ci);
  let dims = vec2f(textureDimensions(smap));
  let stored = textureLoad(smap, vec2i(clamp(uv, vec2f(0.0), vec2f(0.999)) * dims), 0);
  return vec4f(q.xyz, stored);
}
fn csmTap(M: mat4x4f, ci: f32, bias: f32, w: vec3f, nrm: vec3f, four: bool, radius: f32) -> f32 {
  let info = csmStored(M, ci, w, nrm);
  let pen = clamp((info.z - info.w) * 80.0, 0.0, 1.0);
  let rad = radius * mix(1.0, 2.6, pen);
  if (!four) { return csmOne(M, ci, bias, w, nrm, vec2f(0.0)); }
  let tx = select(vec2f(1.0 / 2048.0), vec2f(1.0 / 2048.0, 1.0 / 1024.0), u.csm.z < 3.0) * rad;
  return 0.25 * (
    csmOne(M, ci, bias, w, nrm, vec2f(-tx.x, -tx.y)) +
    csmOne(M, ci, bias, w, nrm, vec2f(tx.x, -tx.y)) +
    csmOne(M, ci, bias, w, nrm, vec2f(-tx.x, tx.y)) +
    csmOne(M, ci, bias, w, nrm, vec2f(tx.x, tx.y))
  );
}
fn poissonAt(i: i32) -> vec2f {
  if (i == 0) { return vec2f(-0.94201624, -0.39906216); }
  if (i == 1) { return vec2f(0.94558609, -0.76890725); }
  if (i == 2) { return vec2f(-0.09418410, -0.92938870); }
  if (i == 3) { return vec2f(0.34495938, 0.29387760); }
  if (i == 4) { return vec2f(-0.91588581, 0.45771432); }
  if (i == 5) { return vec2f(-0.81544232, -0.87912464); }
  if (i == 6) { return vec2f(-0.38277543, 0.27676845); }
  if (i == 7) { return vec2f(0.97484398, 0.75648379); }
  if (i == 8) { return vec2f(0.44323325, -0.97511554); }
  if (i == 9) { return vec2f(0.53742981, -0.47373420); }
  if (i == 10) { return vec2f(-0.26496911, -0.41893023); }
  if (i == 11) { return vec2f(0.79197514, 0.19090188); }
  if (i == 12) { return vec2f(-0.24188840, 0.99706507); }
  if (i == 13) { return vec2f(-0.81409955, 0.91437590); }
  if (i == 14) { return vec2f(0.19984126, 0.78641367); }
  return vec2f(0.14383161, -0.14100790);
}
fn csmPoisson(M: mat4x4f, ci: f32, w: vec3f, nrm: vec3f) -> f32 {
  var s = 0.0;
  let sc = vec2f(1.6 / 2048.0);
  for (var i = 0; i < 16; i++) { s += csmOne(M, ci, 0.0008, w, nrm, poissonAt(i) * sc); }
  return s / 16.0;
}
fn extentOf(M: mat4x4f, w: vec3f) -> f32 {
  let q = M * vec4f(w, 1.0);
  return max(abs(q.x), abs(q.y));
}
fn shadowPhone(w: vec3f, nrm: vec3f) -> f32 {
  let e0 = extentOf(u.c0, w);
  let e1 = extentOf(u.c1, w);
  // One bias. The near kernel widens to the far texel as the blend opens,
  // so the two maps meet instead of stepping.
  // Bias is about 2 cm on the near cascade and 4 cm on the far one, in the
  // sunward depth range (240 m of caster plus the sphere).
  let bias0 = 0.00008;
  let bias1 = 0.00012;
  let wBlend = smoothstep(0.40, 0.98, e0);
  var s1 = 1.0;
  if (e1 < 0.995) { s1 = mix(1.0, csmTap(u.c1, 1.0, bias1, w, nrm, false, 1.0), smoothstep(0.995, 0.86, e1)); }
  if (e0 >= 0.995) { return s1; }
  let s0 = csmTap(u.c0, 0.0, bias0, w, nrm, true, mix(1.0, 4.4, wBlend));
  return mix(s0, s1, wBlend);
}
fn shadowHigh(w: vec3f, nrm: vec3f) -> f32 {
  let e0 = extentOf(u.c0, w);
  let e1 = extentOf(u.c1, w);
  let e2 = extentOf(u.c2, w);
  let e3 = extentOf(u.c3, w);
  if (e0 < 0.95) { return mix(csmPoisson(u.c0, 0.0, w, nrm), select(1.0, csmPoisson(u.c1, 1.0, w, nrm), e1 < 0.99), smoothstep(0.75, 0.95, e0)); }
  if (e1 < 0.95) { return mix(csmPoisson(u.c1, 1.0, w, nrm), select(1.0, csmPoisson(u.c2, 2.0, w, nrm), e2 < 0.99), smoothstep(0.75, 0.95, e1)); }
  if (e2 < 0.95) { return mix(csmPoisson(u.c2, 2.0, w, nrm), select(1.0, csmPoisson(u.c3, 3.0, w, nrm), e3 < 0.99), smoothstep(0.75, 0.95, e2)); }
  if (e3 < 0.99) { return mix(1.0, csmPoisson(u.c3, 3.0, w, nrm), smoothstep(0.99, 0.85, e3)); }
  return 1.0;
}
fn shadowAt(w: vec3f, nrm: vec3f) -> f32 {
  if (u.csm.x > 0.5) { return 1.0; }
  let nn = normalize(nrm);
  if (u.csm.z > 3.5) { return shadowHigh(w, nn); }
  return shadowPhone(w, nn);
}
fn cascadeMix(w: vec3f) -> f32 {
  if (u.csm.z > 3.5) {
    let e0 = extentOf(u.c0, w);
    if (e0 < 0.95) { return smoothstep(0.75, 0.95, e0) / 3.0; }
    let e1 = extentOf(u.c1, w);
    if (e1 < 0.95) { return (1.0 + smoothstep(0.75, 0.95, e1)) / 3.0; }
    return 1.0;
  }
  return smoothstep(0.40, 0.98, extentOf(u.c0, w));
}
struct SH {
  @builtin(position) p: vec4f,
  @location(0) @interpolate(linear) clip: vec4f,
  @location(1) mat: f32,
};
struct SB {
  @builtin(position) p: vec4f,
  @location(0) @interpolate(linear) clip: vec4f,
  @location(1) uv: vec2f,
};
@vertex fn vsWorldSh(@location(0) a: vec4f, @builtin(instance_index) inst: u32) -> SH {
  let clip = cascadeOf(inst) * vec4f(a.xyz, 1.0);
  var o: SH;
  o.clip = clip;
  o.p = atlasClip(clip, inst);
  o.mat = a.w;
  return o;
}
@vertex fn vsInstSh(@location(0) a: vec4f, @location(1) b: vec4f, @location(2) i0: vec4f, @location(3) i1: vec4f, @builtin(instance_index) inst: u32) -> SH {
  let nC = max(u32(u.csm.z + 0.5), 1u);
  let ci = inst % nC;
  let sc = i1.xyz;
  let p0 = vec3f(a.x * sc.x, a.y * sc.y, a.z * sc.z);
  let cl = cos(i1.w);
  let sl = sin(i1.w);
  let pL = vec3f(cl * p0.x - sl * p0.y, sl * p0.x + cl * p0.y, p0.z);
  let c = cos(i0.w);
  let s = sin(i0.w);
  let pr = vec3f(c * pL.x + s * pL.z, pL.y, -s * pL.x + c * pL.z) + i0.xyz;
  let clip = cascadeOf(ci) * vec4f(pr, 1.0);
  var o: SH;
  o.clip = clip;
  o.p = atlasClip(clip, ci);
  o.mat = a.w;
  return o;
}
@vertex fn vsBoltSh(@builtin(vertex_index) vi: u32, @builtin(instance_index) inst: u32) -> SB {
  var q = array<vec2f, 6>(vec2f(-0.5, 0.0), vec2f(0.5, 0.0), vec2f(0.5, 1.0), vec2f(-0.5, 0.0), vec2f(0.5, 1.0), vec2f(-0.5, 1.0));
  let c = q[vi];
  let bpos = vec3f(u.bolt.x, u.bolt.y, u.bolt.z);
  let Ls = normalize(u.sun.xz + vec2f(1e-4, 0.0));
  let rt = vec3f(-Ls.y, 0.0, Ls.x);
  let lr = idleCardLy(c);
  let cr = cos(u.bp.x);
  let sr = -sin(u.bp.x);
  let rx = lr.x * cr - lr.y * sr;
  let ry = lr.x * sr + lr.y * cr;
  let wpos = bpos + rt * rx + vec3f(0.0, ry, 0.0);
  let clip = cascadeOf(inst) * vec4f(wpos, 1.0);
  var o: SB;
  o.clip = clip;
  o.p = atlasClip(clip, inst);
  o.uv = vec2f(-c.x + 0.5, 1.0 - c.y);
  return o;
}
@fragment fn fsShadowClip(v: SH) {
  if (abs(v.clip.x) > v.clip.w || abs(v.clip.y) > v.clip.w) { discard; }
  // The snow sheet is the receiver. Walls, falls, arches, and peaks cast.
  if (v.mat < 0.5) { discard; }
}
fn boltShA(f: u32, uv: vec2f) -> f32 {
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return 0.0; }
  let g = vec2f(f32(f % 8u), f32(f / 8u));
  return textureSampleLevel(atex, samp, (g + clamp(uv, vec2f(0.003), vec2f(0.997))) / vec2f(8.0, 4.0), 0.0).a;
}
@fragment fn fsBoltSh(v: SB) {
  if (abs(v.clip.x) > v.clip.w || abs(v.clip.y) > v.clip.w) { discard; }
  let ff = u.bp.w;
  let a = u32(floor(ff)) % 32u;
  let bb = (a + 1u) % 32u;
  let k = fract(ff);
  let gph = ff / 32.0 * 6.2831853;
  let lw = smoothstep(0.60, 0.88, v.uv.y);
  let sw = smoothstep(0.40, 0.60, v.uv.x);
  let spd = u.bp.z;
  let lift = 0.045 * lw * ((1.0 - sw) * max(sin(gph), 0.0) + sw * max(-sin(gph), 0.0)) * smoothstep(0.25, 1.2, spd) * (1.0 - u.misc.x);
  let uvs = idleTailUV(v.uv + vec2f(0.0, lift));
  if (mix(boltShA(a, uvs), boltShA(bb, uvs), k) < 0.03) { discard; }
}
`;
}
