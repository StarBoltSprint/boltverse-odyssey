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

// Near 2048² over a 1024² far map. depth32float.
// 2048 * 3072 * 4 = 25165824 bytes (24 MiB).
export const PHONE_SHADOW = {
  lambda: 0.7,
  near: 2048,
  far: 1024,
  atlas: [2048, 3072],
  memoryBytes: 2048 * 3072 * 4,
  penumbraM: 0.08,
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
export const SUNWARD = 240;
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

export function buildCascades({ eye, tgt, fovY, aspect, sun, tier = 'phone', snap = true }) {
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
    const center = snap === false ? raw : snapCenter(raw, sun, radius, cfg.tiles[i]);
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
  // u.csm.w is the atlas height. 4096 stacks two 2048 maps. 3072 is a
  // 2048 near map over a 1024 far map on the left.
  if (u.csm.w > 3500.0) {
    if (ci == 0u) {
      o.y = clip.y * 0.5 + clip.w * 0.5;
      return o;
    }
    o.y = clip.y * 0.5 - clip.w * 0.5;
    return o;
  }
  if (ci == 0u) {
    o.y = clip.y * (2.0 / 3.0) + clip.w * (1.0 / 3.0);
    return o;
  }
  o.x = clip.x * 0.5 - clip.w * 0.5;
  o.y = clip.y * (1.0 / 3.0) - clip.w * (2.0 / 3.0);
  return o;
}
fn tileOf(ci: f32) -> vec4f {
  if (u.csm.z > 3.5) {
    let col = ci % 2.0;
    let row = floor(ci / 2.0);
    return vec4f(col * 0.5, row * 0.5, col * 0.5 + 0.5, row * 0.5 + 0.5);
  }
  if (u.csm.w > 3500.0) {
    if (ci < 0.5) { return vec4f(0.0, 0.0, 1.0, 0.5); }
    return vec4f(0.0, 0.5, 1.0, 1.0);
  }
  if (ci < 0.5) { return vec4f(0.0, 0.0, 1.0, 2.0 / 3.0); }
  return vec4f(0.0, 2.0 / 3.0, 0.5, 1.0);
}
fn shadowUv(q: vec4f, ci: f32) -> vec2f {
  let ndc = vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
  let tile = tileOf(ci);
  return vec2f(mix(tile.x, tile.z, ndc.x), mix(tile.y, tile.w, ndc.y));
}
// 1.5 texels keeps a bilinear footprint inside the tile. Half a texel still
// reads the next cascade across the 2048 boundary.
fn clampTileInset(uv: vec2f, tile: vec4f, inset: f32) -> vec2f {
  let dims = vec2f(textureDimensions(smap));
  let h = inset / dims;
  return clamp(uv, tile.xy + h, tile.zw - h);
}
// Four bilinear compares. Together they cover a 3x3 of depth tests.
// less-equal on this stack is stored >= reference (0 at the sun, 1 at the far side).
fn hw4(uv: vec2f, zRef: f32, penM: f32, texelM: f32, tile: vec4f) -> f32 {
  let dims = vec2f(textureDimensions(smap));
  let rad = max(penM * 0.5 / max(texelM, 1e-4), 0.0);
  let inset = max(rad + 1.0, 1.5);
  let o = vec2f(rad / dims.x, rad / dims.y);
  let z = clamp(zRef, 0.0, 1.0);
  var s = 0.0;
  s += textureSampleCompareLevel(smap, scmp, clampTileInset(uv + vec2f(-o.x, -o.y), tile, inset), z);
  s += textureSampleCompareLevel(smap, scmp, clampTileInset(uv + vec2f(o.x, -o.y), tile, inset), z);
  s += textureSampleCompareLevel(smap, scmp, clampTileInset(uv + vec2f(-o.x, o.y), tile, inset), z);
  s += textureSampleCompareLevel(smap, scmp, clampTileInset(uv + vec2f(o.x, o.y), tile, inset), z);
  return s * 0.25;
}
fn viewBand(w: vec3f) -> f32 {
  let dist = length(w.xz - u.cam.xz);
  return smoothstep(16.0, 32.0, dist);
}
// Blocker search is one depth load. The sun's angular radius is 0.27 degrees,
// so the four taps widen with the blocker-receiver gap and stay tight at contact.
fn penumbraWidth(uv: vec2f, zRef: f32, range: f32, camD: f32) -> f32 {
  let dims = vec2f(textureDimensions(smap));
  let stored = textureLoad(smap, vec2i(clamp(uv, vec2f(0.0), vec2f(0.999)) * dims), 0);
  let gap = select(0.0, max(zRef - stored, 0.0), stored + 0.001 < zRef);
  // 0.27° against the blocker keeps contact hard. On this grazing ground that
  // angle is under a pixel past the near shelf, so the view term is 0.032 rad
  // and a far edge does not stay a one-pixel sliver.
  let fromBlocker = gap * range * 0.00471239;
  let fromView = camD * 0.032;
  return clamp(max(fromBlocker, fromView), 0.05, 2.4);
}
fn shadeCascade(ci: f32, q: vec4f, bias: f32, texelM: f32, range: f32, camD: f32) -> f32 {
  if (q.z < 0.0 || q.z > 1.0) { return 1.0; }
  let uv = shadowUv(q, ci);
  let tile = tileOf(ci);
  if (uv.x < tile.x || uv.y < tile.y || uv.x > tile.z || uv.y > tile.w) { return 1.0; }
  let zRef = q.z - bias;
  return hw4(uv, zRef, penumbraWidth(uv, zRef, range, camD), texelM, tile);
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
  let b1 = slopeBias(q1.z) + u.extra.x;
  let e0 = max(abs(q0.x), abs(q0.y));
  let band = viewBand(w);
  // One world width on both maps. Two far texels on the far map and 8 cm on
  // the near map was a penumbra step, which is what the seam crops show.
  let camD = length(w.xz - u.cam.xz);
  let s0 = shadeCascade(0.0, q0, b0, u.soft.x, u.extra.z, camD);
  let s1 = shadeCascade(1.0, q1, b1, u.soft.y, u.extra.w, camD);
  return vec4f(s0, s1, e0, band);
}
fn shadowPhone(w: vec3f, nrm: vec3f) -> f32 {
  let p = cascadePair(w, nrm);
  let e0 = p.z;
  if (e0 >= 0.995) { return p.y; }
  return mix(p.x, p.y, p.w);
}
fn shadowHigh(w: vec3f, nrm: vec3f) -> f32 {
  let ws = w + nrm * 0.035;
  let q0 = u.c0 * vec4f(ws, 1.0);
  let q1 = u.c1 * vec4f(ws, 1.0);
  let b0 = slopeBias(q0.z);
  let b1 = slopeBias(q1.z);
  let e0 = max(abs(q0.x), abs(q0.y));
  let camD = length(w.xz - u.cam.xz);
  if (e0 < 0.98) { return shadeCascade(0.0, q0, b0, u.soft.x, u.extra.z, camD); }
  return shadeCascade(1.0, q1, b1, u.soft.y, u.extra.w, camD);
}
fn depthProbe(w: vec3f) -> vec4f {
  let q = u.c0 * vec4f(w, 1.0);
  let uv = shadowUv(q, 0.0);
  let dims = vec2f(textureDimensions(smap));
  let stored = textureLoad(smap, vec2i(clamp(uv, vec2f(0.0), vec2f(0.999)) * dims), 0);
  let hw = textureSampleCompareLevel(smap, scmp, clamp(uv, vec2f(0.001), vec2f(0.999)), q.z);
  return vec4f(stored, q.z, hw, 1.0);
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
  return viewBand(w);
}
struct SH {
  @builtin(position) p: vec4f,
  @location(0) @interpolate(linear) clip: vec4f,
  @location(1) mat: f32,
  @location(2) @interpolate(flat) who: u32,
  @location(3) @interpolate(flat) prim: u32,
};
struct SB {
  @builtin(position) p: vec4f,
  @location(0) @interpolate(linear) clip: vec4f,
  @location(1) uv: vec2f,
  @location(2) @interpolate(flat) who: u32,
};
@vertex fn vsWorldSh(@location(0) a: vec4f, @builtin(vertex_index) vi: u32, @builtin(instance_index) inst: u32) -> SH {
  let clip = cascadeOf(inst) * vec4f(a.xyz, 1.0);
  var o: SH;
  o.clip = clip;
  o.p = atlasClip(clip, inst);
  o.mat = a.w;
  o.who = (inst << 16u) | 1u;
  o.prim = vi / 3u;
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
  o.who = (ci << 16u) | 1u;
  o.prim = 0u;
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
  o.who = (inst << 16u) | 2u;
  return o;
}
@fragment fn fsShadowId(v: SH) -> @location(0) vec2u {
  if (abs(v.clip.x) > v.clip.w || abs(v.clip.y) > v.clip.w) { discard; }
  if (v.mat < 0.5) { discard; }
  return vec2u(v.who, v.prim);
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
@fragment fn fsBoltId(v: SB) -> @location(0) vec2u {
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
  return vec2u(v.who, 0u);
}
struct PR {
  @builtin(position) p: vec4f,
  @location(0) w: vec3f,
  @location(1) n: vec3f,
};
@vertex fn vsShadeProbe(@location(0) p: vec4f, @location(1) nrm: vec4f, @builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> PR {
  // A 1px point sits on the pixel boundary and the top-left rule drops it, so the
  // clear value (0) was read back as a full shadow. One triangle covers the pixel.
  let col = ii % 512u;
  let row = ii / 512u;
  var xy = vec2f(f32(col) / 512.0, f32(row) / 256.0);
  if (vi == 0u) { xy = xy + vec2f(-0.2 / 512.0, -0.2 / 256.0); }
  if (vi == 1u) { xy = xy + vec2f(1.2 / 512.0, -0.2 / 256.0); }
  if (vi == 2u) { xy = xy + vec2f(0.5 / 512.0, 1.4 / 256.0); }
  var o: PR;
  o.p = vec4f(xy.x * 2.0 - 1.0, 1.0 - xy.y * 2.0, 0.0, 1.0);
  o.w = p.xyz;
  o.n = nrm.xyz;
  return o;
}
@fragment fn fsShadeProbe(v: PR) -> @location(0) vec4f {
  return vec4f(shadowAt(v.w, v.n), 0.0, 0.0, 1.0);
}
fn r3Tap(q: vec4f, ci: f32, bias: f32, o: vec2f) -> f32 {
  if (q.z < 0.0 || q.z > 1.0) { return 1.0; }
  let uv = shadowUv(q, ci) + o;
  let tile = tileOf(ci);
  if (uv.x < tile.x || uv.y < tile.y || uv.x > tile.z || uv.y > tile.w) { return 1.0; }
  let dims = vec2f(textureDimensions(smap));
  let stored = textureLoad(smap, vec2i(clamp(uv, vec2f(0.0), vec2f(0.999)) * dims), 0);
  let zRef = q.z - bias;
  return select(0.0, 1.0, stored >= zRef);
}
// Both cascades, same sampler as the blend. Alpha is 1 only for a snow vertex
// inside the 16–32 m band and inside the near map, which is where the two
// factors are mixed. extra.y selects the round-3 kernel (wide near, one far tap).
@fragment fn fsCascadePair(v: PR) -> @location(0) vec4f {
  let nn = normalize(v.n);
  var s0: f32;
  var s1: f32;
  var e0: f32;
  if (u.extra.y > 0.5) {
    // Round 3: a point load, a near kernel that grows to about eleven texels,
    // and a single far tap. The two biases are not the same world distance.
    let ws = v.w + nn * 0.02;
    let q0 = u.c0 * vec4f(ws, 1.0);
    let q1 = u.c1 * vec4f(ws, 1.0);
    e0 = max(abs(q0.x), abs(q0.y));
    let wBlend = smoothstep(0.40, 0.98, e0);
    let rad = mix(1.0, 4.4, wBlend) * 2.6;
    // Round 3 stepped the kernel in texels of a 2048 x 1024 map, not this atlas.
    let tx = vec2f(rad / 2048.0, rad / 1024.0);
    s0 = 0.25 * (
      r3Tap(q0, 0.0, 0.00008, vec2f(-tx.x, -tx.y)) +
      r3Tap(q0, 0.0, 0.00008, vec2f(tx.x, -tx.y)) +
      r3Tap(q0, 0.0, 0.00008, vec2f(-tx.x, tx.y)) +
      r3Tap(q0, 0.0, 0.00008, vec2f(tx.x, tx.y))
    );
    s1 = r3Tap(q1, 1.0, 0.00012 + u.extra.x, vec2f(0.0));
  } else {
    let p = cascadePair(v.w, nn);
    s0 = p.x;
    s1 = p.y;
    e0 = p.z;
  }
  let dist = length(v.w.xz - u.cam.xz);
  let covered = e0 < 0.995 && dist >= 16.0 && dist <= 32.0;
  return vec4f(s0, s1, e0, select(0.0, 1.0, covered));
}
struct TL {
  @builtin(position) p: vec4f,
  @location(0) w: vec3f,
  @location(1) n: vec3f,
  @location(2) @interpolate(flat) slot: u32,
};
@vertex fn vsTapLog(@location(0) p: vec4f, @location(1) nrm: vec4f) -> TL {
  let code = u32(p.w + 0.5);
  let col = code / 4u;
  let corner = code % 4u;
  let row = u32(nrm.w + 0.5);
  var xy = vec2f(f32(col) / 8.0, f32(row) / 20.0);
  if (corner == 0u) { xy = xy + vec2f(-0.2 / 8.0, -0.2 / 20.0); }
  if (corner == 1u) { xy = xy + vec2f(1.2 / 8.0, -0.2 / 20.0); }
  if (corner == 2u) { xy = xy + vec2f(0.5 / 8.0, 1.4 / 20.0); }
  var o: TL;
  o.p = vec4f(xy.x * 2.0 - 1.0, 1.0 - xy.y * 2.0, 0.0, 1.0);
  o.w = p.xyz;
  o.n = nrm.xyz;
  o.slot = col;
  return o;
}
@fragment fn fsTapLog(v: TL) -> @location(0) vec4f {
  let ws = v.w + v.n * 0.035;
  let q0 = u.c0 * vec4f(ws, 1.0);
  let q1 = u.c1 * vec4f(ws, 1.0);
  let e0 = max(abs(q0.x), abs(q0.y));
  let band = viewBand(v.w);
  let width = max(u.soft.z, u.soft.y);
  let useFar = e0 >= 0.995;
  let q = select(q0, q1, useFar);
  let ci = select(0.0, 1.0, useFar);
  let texelM = select(u.soft.x, u.soft.y, useFar);
  let bias = 0.00004;
  let zRef = q.z - bias;
  let uv = shadowUv(q, ci);
  let tile = tileOf(ci);
  let inside = q.z >= 0.0 && q.z <= 1.0 && uv.x >= tile.x && uv.y >= tile.y && uv.x <= tile.z && uv.y <= tile.w;
  let dims = vec2f(textureDimensions(smap));
  let rad = max(width * 0.5 / max(texelM, 1e-4), 0.0);
  let step = vec2f(rad / dims.x, rad / dims.y);
  let inset = max(rad + 1.0, 1.5);
  var tapUv: vec2f;
  if (v.slot == 0u) { tapUv = uv + vec2f(-step.x, -step.y); }
  else if (v.slot == 1u) { tapUv = uv + vec2f(step.x, -step.y); }
  else if (v.slot == 2u) { tapUv = uv + vec2f(-step.x, step.y); }
  else { tapUv = uv + vec2f(step.x, step.y); }
  let clamped = clampTileInset(tapUv, tile, inset);
  let pix = vec2i(clamp(clamped, vec2f(0.0), vec2f(0.999)) * dims);
  let stored = textureLoad(smap, pix, 0);
  let cmpv = textureSampleCompareLevel(smap, scmp, clamped, clamp(zRef, 0.0, 1.0));
  let camD = length(v.w.xz - u.cam.xz);
  let s0 = shadeCascade(0.0, q0, bias, u.soft.x, u.extra.z, camD);
  let s1 = shadeCascade(1.0, q1, bias, u.soft.y, u.extra.w, camD);
  let factor = shadowAt(v.w, v.n);
  let uv0 = shadowUv(q0, 0.0);
  let uv1 = shadowUv(q1, 1.0);
  let d0 = textureLoad(smap, vec2i(clamp(uv0, vec2f(0.0), vec2f(0.999)) * dims), 0);
  let d1 = textureLoad(smap, vec2i(clamp(uv1, vec2f(0.0), vec2f(0.999)) * dims), 0);
  if (v.slot == 4u) { return vec4f(select(0.0, 1.0, useFar), e0, band, factor); }
  if (v.slot == 5u) { return vec4f(uv.x, uv.y, zRef, select(0.0, 1.0, inside)); }
  if (v.slot == 6u) { return vec4f(s0, s1, q0.z, q1.z); }
  // Centre texel of each cascade, then the centre the shader actually samples.
  if (v.slot == 7u) { return vec4f(d0, d1, select(d0, d1, useFar), textureSampleCompareLevel(smap, scmp, clamp(uv, vec2f(0.001), vec2f(0.999)), clamp(zRef, 0.0, 1.0))); }
  if (v.slot > 3u) { return vec4f(0.0); }
  return vec4f(clamped.x, clamped.y, stored, cmpv);
}
`;
}
