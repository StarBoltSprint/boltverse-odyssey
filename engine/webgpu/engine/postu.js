// Shared uniform for the optional TAA and SSGI bricks. Offsets are in floats.
// Written in-house. The live meadow page does not import this.

export const POST_FLOATS = 104;

export const OFF = {
  vp: 0,
  ivp: 16,
  prev: 32,
  eye: 48,       // xyz, frame index
  p0: 52,        // history blend, motionPx, clamp on, reject on
  p1: 56,        // width, height, object motion vectors, gi on
  p2: 60,        // gi strength, step base (m), step grow, temporal frames
  p3: 64,        // hit thickness (m), sky rgb
  p4: 68,        // jitter ndc x, jitter ndc y, near, far
  sun: 72,       // direction toward the sun xyz, max step (m)
  fwd: 76,       // camera forward xyz
  bolt: 80,      // xyz, atlas frame
  boltPrev: 84,  // previous xyz
  prevEye: 88,
  prevFwd: 92,
  extra: 96,     // atlas on, exposure, coat lift, pad
};

export const POST_STRUCT = /* wgsl */`
struct U {
  vp: mat4x4f,
  ivp: mat4x4f,
  prev: mat4x4f,
  eye: vec4f,
  p0: vec4f,
  p1: vec4f,
  p2: vec4f,
  p3: vec4f,
  p4: vec4f,
  sun: vec4f,
  fwd: vec4f,
  bolt: vec4f,
  boltPrev: vec4f,
  prevEye: vec4f,
  prevFwd: vec4f,
  extra: vec4f,
};
`;

export const SAMPLE_FNS = /* wgsl */`
fn loadC(t: texture_2d<f32>, p: vec2i) -> vec4f {
  let d = vec2i(textureDimensions(t));
  return textureLoad(t, clamp(p, vec2i(0), d - vec2i(1)), 0);
}
fn bilerp(t: texture_2d<f32>, uv: vec2f) -> vec4f {
  let d = vec2f(textureDimensions(t));
  let p = uv * d - vec2f(0.5);
  let i = vec2i(floor(p));
  let f = fract(p);
  let a = mix(loadC(t, i), loadC(t, i + vec2i(1, 0)), f.x);
  let b = mix(loadC(t, i + vec2i(0, 1)), loadC(t, i + vec2i(1, 1)), f.x);
  return mix(a, b, f.y);
}
fn rayDir(uv: vec2f) -> vec3f {
  let nx = uv.x * 2.0 - 1.0;
  let ny = (1.0 - uv.y) * 2.0 - 1.0;
  let a = u.ivp * vec4f(nx, ny, 0.0, 1.0);
  let b = u.ivp * vec4f(nx, ny, 1.0, 1.0);
  return normalize(b.xyz / b.w - a.xyz / a.w);
}
fn worldFrom(uv: vec2f, plane: f32) -> vec3f {
  let r = rayDir(uv);
  return u.eye.xyz + r * (plane / max(dot(r, u.fwd.xyz), 1e-4));
}
fn uvOf(w: vec3f, vp: mat4x4f) -> vec2f {
  let c = vp * vec4f(w, 1.0);
  let n = c.xy / max(c.w, 1e-6);
  return vec2f(n.x * 0.5 + 0.5, 0.5 - n.y * 0.5);
}
fn planeOf(w: vec3f, eye: vec3f, fwd: vec3f) -> f32 {
  return dot(w - eye, fwd);
}
`;

export const FULLSCREEN_VS = /* wgsl */`
struct PO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> PO {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: PO;
  o.p = vec4f(q[i], 0.0, 1.0);
  o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5);
  return o;
}
`;

const f32 = (v) => { const n = Number(v) || 0; return Math.abs(n) < 1e-8 ? 0 : n; };

export function packPost(o) {
  const U = new Float32Array(POST_FLOATS);
  const put = (off, a) => { for (let i = 0; i < a.length; i++) U[off + i] = f32(a[i]); };
  put(OFF.vp, o.vp);
  put(OFF.ivp, o.ivp);
  put(OFF.prev, o.prev);
  put(OFF.eye, [o.eye[0], o.eye[1], o.eye[2], o.frame]);
  put(OFF.p0, [o.history, o.motionPx, o.clamp, o.reject]);
  put(OFF.p1, [o.width, o.height, o.objectMv, o.gi]);
  put(OFF.p2, [o.strength, o.stepBase, o.stepGrow, o.giFrames]);
  put(OFF.p3, [o.thickness, o.sky[0], o.sky[1], o.sky[2]]);
  put(OFF.p4, [o.jx, o.jy, o.near, o.far]);
  put(OFF.sun, [o.sun[0], o.sun[1], o.sun[2], o.maxStep]);
  put(OFF.fwd, [o.fwd[0], o.fwd[1], o.fwd[2], 0]);
  put(OFF.bolt, [o.bolt[0], o.bolt[1], o.bolt[2], o.atlasFrame]);
  put(OFF.boltPrev, [o.boltPrev[0], o.boltPrev[1], o.boltPrev[2], 0]);
  put(OFF.prevEye, [o.prevEye[0], o.prevEye[1], o.prevEye[2], 0]);
  put(OFF.prevFwd, [o.prevFwd[0], o.prevFwd[1], o.prevFwd[2], 0]);
  put(OFF.extra, [o.atlas, o.exposure, o.coat, 0]);
  return U;
}
