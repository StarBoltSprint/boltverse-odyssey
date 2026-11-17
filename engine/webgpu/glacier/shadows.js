// Glacier cascaded sun shadows. Phone: 2 cascades in a 2048x1024 depth32float
// atlas, 4-tap PCF near, 1 tap far, blended seam. Projections snap to the
// world texel and use a fixed bounding-sphere radius. No polygon depth bias.
// The receiver offset is along the normal, smaller than one shadow texel.

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

// Both maps are 2048², stacked. depth32float.
// 2048 * 4096 * 4 = 33554432 bytes (32 MiB).
export const PHONE_SHADOW = {
  lambda: 0.7,
  near: 2048,
  far: 2048,
  atlas: [2048, 4096],
  memoryBytes: 2048 * 4096 * 4,
  penumbraM: 0.11,
};

export function tierConfig(tier) {
  if (tier === 'high') {
    return { tier: 'high', count: 4, atlas: [2048, 2048], tile: 1024, tiles: [1024, 1024, 1024, 1024], splits: highSplits(), lambda: 0.7, memoryBytes: 2048 * 2048 * 4 };
  }
  const split = practicalSplit(1, 2, 1, 120, PHONE_SHADOW.lambda);
  return {
    tier: 'phone', count: 2, atlas: PHONE_SHADOW.atlas.slice(), tile: PHONE_SHADOW.near,
    tiles: [PHONE_SHADOW.near, PHONE_SHADOW.far],
    splits: [0, split, 120], lambda: PHONE_SHADOW.lambda,
    memoryBytes: PHONE_SHADOW.memoryBytes, penumbraM: PHONE_SHADOW.penumbraM,
  };
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

// z is 0 on the sunward plane and 1 past the sphere. The light axes are fixed
// by the sun, not by lookAt, and the ortho origin is the snapped centre so a
// camera move smaller than one shadow texel does not move the map.
const SUNWARD = 240;
export function cascadeMatrix(center, radius, sun) {
  const { s, u, L } = lightAxes(sun);
  const range = SUNWARD + radius;
  const lx = dot(center, s);
  const ly = dot(center, u);
  const lz = dot(center, L);
  const invR = 1 / radius;
  const invZ = 1 / range;
  return [
    s[0] * invR, u[0] * invR, -L[0] * invZ, 0,
    s[1] * invR, u[1] * invR, -L[1] * invZ, 0,
    s[2] * invR, u[2] * invR, -L[2] * invZ, 0,
    -lx * invR, -ly * invR, (SUNWARD + lz) * invZ, 1,
  ];
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
    const center = snapCenter(raw, sun, radius, cfg.tiles[i]);
    mats.push(cascadeMatrix(center, radius, sun));
    radii.push(radius);
    centers.push(center);
  }
  return {
    mats, radii, centers, splits: cfg.splits.slice(), count: cfg.count,
    atlas: cfg.atlas.slice(), tile: cfg.tile, tiles: cfg.tiles.slice(), tier: cfg.tier, lambda: cfg.lambda,
    memoryBytes: cfg.memoryBytes, penumbraM: cfg.penumbraM || 0.11,
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
  if (u.csm.z > 3.5) {
    let col = ci % 2u;
    let row = ci / 2u;
    o.x = clip.x * 0.5 + select(-0.5, 0.5, col == 1u) * clip.w;
    o.y = clip.y * 0.5 + select(0.5, -0.5, row == 1u) * clip.w;
    return o;
  }
  // Phone atlas 2048 x 4096. Near is the top half, far the bottom half.
  if (ci == 0u) {
    o.y = clip.y * 0.5 + clip.w * 0.5;
    return o;
  }
  o.y = clip.y * 0.5 - clip.w * 0.5;
  return o;
}
fn tileOf(ci: f32) -> vec4f {
  if (u.csm.z > 3.5) {
    let col = ci % 2.0;
    let row = floor(ci / 2.0);
    return vec4f(col * 0.5, row * 0.5, col * 0.5 + 0.5, row * 0.5 + 0.5);
  }
  if (ci < 0.5) { return vec4f(0.0, 0.0, 1.0, 0.5); }
  return vec4f(0.0, 0.5, 1.0, 1.0);
}
fn shadowUv(q: vec4f, ci: f32) -> vec2f {
  let ndc = vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
  let tile = tileOf(ci);
  return vec2f(mix(tile.x, tile.z, ndc.x), mix(tile.y, tile.w, ndc.y));
}
fn clampTile(uv: vec2f, tile: vec4f) -> vec2f {
  let dims = vec2f(textureDimensions(smap));
  let h = 0.5 / dims;
  return clamp(uv, tile.xy + h, tile.zw - h);
}
fn depthLit(pix: vec2i, zRef: f32) -> f32 {
  let dims = vec2i(textureDimensions(smap));
  let p = clamp(pix, vec2i(0), dims - vec2i(1));
  return select(0.0, 1.0, textureLoad(smap, p, 0) >= zRef);
}
// Bilinear compare of the four depth texels. The comparison sampler on this
// GPU does not match those texels, so the weights are applied here. The
// sampler is still read so the binding stays live.
fn cmpBilinear(uv: vec2f, zRef: f32) -> f32 {
  let dims = vec2f(textureDimensions(smap));
  let p = uv * dims - 0.5;
  let i = vec2i(floor(p));
  let f = fract(p);
  let s00 = depthLit(i, zRef);
  let s10 = depthLit(i + vec2i(1, 0), zRef);
  let s01 = depthLit(i + vec2i(0, 1), zRef);
  let s11 = depthLit(i + vec2i(1, 1), zRef);
  let sw = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  let hw = textureSampleCompareLevel(smap, scmp, uv, zRef);
  return select(sw, sw, hw >= 0.0);
}
// 3x3 of those taps. step is the spacing in atlas UV, from the world penumbra.
fn pcf3(uv: vec2f, zRef: f32, step: vec2f, tile: vec4f) -> f32 {
  var s = 0.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      s += cmpBilinear(clampTile(uv + vec2f(f32(i), f32(j)) * step, tile), zRef);
    }
  }
  return s / 9.0;
}
fn penumbraM(w: vec3f) -> f32 {
  // World metres, the same at a fixed point for every camera. A camera-varying
  // radius would shimmer. 12 cm hides a near texel without washing out a band.
  return u.soft.z + w.x * 0.0;
}
fn shadeCascade(ci: f32, q: vec4f, bias: f32, texelM: f32, penM: f32) -> f32 {
  if (q.z < 0.0 || q.z > 1.0) { return 1.0; }
  let uv = shadowUv(q, ci);
  let tile = tileOf(ci);
  if (uv.x < tile.x || uv.y < tile.y || uv.x > tile.z || uv.y > tile.w) { return 1.0; }
  let dims = vec2f(textureDimensions(smap));
  let texels = max(penM * 0.5 / max(texelM, 1e-4), 0.5);
  let step = vec2f(texels / dims.x, texels / dims.y);
  return pcf3(uv, q.z - bias, step, tile);
}
fn slopeBias(z: f32) -> f32 {
  let slope = min(max(abs(dpdx(z)), abs(dpdy(z))), 0.0004);
  return slope + 0.00004;
}
fn cascadePair(w: vec3f, nrm: vec3f) -> vec4f {
  let ws = w + nrm * 0.035;
  let q0 = u.c0 * vec4f(ws, 1.0);
  let q1 = u.c1 * vec4f(ws, 1.0);
  let b0 = slopeBias(q0.z);
  let b1 = slopeBias(q1.z);
  let e0 = max(abs(q0.x), abs(q0.y));
  let pen = penumbraM(w);
  let s0 = shadeCascade(0.0, q0, b0, u.soft.x, pen);
  let s1 = shadeCascade(1.0, q1, b1, u.soft.y, pen);
  return vec4f(s0, s1, e0, max(abs(q1.x), abs(q1.y)));
}
fn shadowPhone(w: vec3f, nrm: vec3f) -> f32 {
  let p = cascadePair(w, nrm);
  let s0 = p.x;
  let s1 = p.y;
  let e0 = p.z;
  let e1 = p.w;
  let wBlend = smoothstep(0.75, 0.97, e0);
  if (e0 >= 0.995) { return select(1.0, s1, e1 < 0.995); }
  return mix(s0, s1, wBlend);
}
fn shadowHigh(w: vec3f, nrm: vec3f) -> f32 {
  let ws = w + nrm * 0.035;
  let q0 = u.c0 * vec4f(ws, 1.0);
  let q1 = u.c1 * vec4f(ws, 1.0);
  let b0 = slopeBias(q0.z);
  let b1 = slopeBias(q1.z);
  let e0 = max(abs(q0.x), abs(q0.y));
  let pen = penumbraM(w);
  if (e0 < 0.98) { return shadeCascade(0.0, q0, b0, u.soft.x, pen); }
  return shadeCascade(1.0, q1, b1, u.soft.y, pen);
}
fn shadowAt(w: vec3f, nrm: vec3f) -> f32 {
  if (u.csm.x > 0.5) { return 1.0; }
  let nn = normalize(nrm);
  if (u.csm.z > 3.5) { return shadowHigh(w, nn); }
  return shadowPhone(w, nn);
}
fn cascadeMix(w: vec3f) -> f32 {
  if (u.csm.z > 3.5) {
    let q = u.c0 * vec4f(w, 1.0);
    return smoothstep(0.75, 0.95, max(abs(q.x), abs(q.y)));
  }
  let q = u.c0 * vec4f(w, 1.0);
  return smoothstep(0.75, 0.97, max(abs(q.x), abs(q.y)));
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
