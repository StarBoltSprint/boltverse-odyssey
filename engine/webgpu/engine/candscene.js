// Candidate room shader. Quartz uses F0 0.04 and a broad highlight.
// There is no environment reflection and no fog.
import { POST_STRUCT } from './postu.js';
import { sunWgsl } from './biomes/crystal-candidate.js';

const v3 = (a) => `vec3f(${a.map((n) => Number(n).toFixed(4)).join(', ')})`;

export function sceneWgsl(cfg) {
  const q = cfg.crystal;
  return /* wgsl */`
${POST_STRUCT}
${sunWgsl(cfg)}
@group(0) @binding(0) var<uniform> u: U;
struct Box { c: vec4f, h: vec4f }
@group(1) @binding(0) var<storage, read> boxes: array<Box>;
@group(1) @binding(1) var atlas: texture_2d<f32>;
@group(1) @binding(2) var samp: sampler;

struct SO {
  @builtin(position) p: vec4f,
  @location(0) w: vec3f,
  @location(1) n: vec3f,
  @location(2) @interpolate(flat) mat: f32,
  @location(3) uv: vec2f,
  @location(4) puv: vec2f,
  @location(5) cuv: vec2f,
};
struct MRT {
  @location(0) direct: vec4f,
  @location(1) albedo: vec4f,
  @location(2) normal: vec4f,
  @location(3) motion: vec4f,
};

fn faceN(f: u32) -> vec3f {
  if (f == 0u) { return vec3f(1.0, 0.0, 0.0); }
  if (f == 1u) { return vec3f(-1.0, 0.0, 0.0); }
  if (f == 2u) { return vec3f(0.0, 1.0, 0.0); }
  if (f == 3u) { return vec3f(0.0, -1.0, 0.0); }
  if (f == 4u) { return vec3f(0.0, 0.0, 1.0); }
  return vec3f(0.0, 0.0, -1.0);
}
fn corner(vi: u32) -> vec3f {
  let f = vi / 6u;
  let m = array<u32, 6>(0u, 1u, 2u, 0u, 2u, 3u);
  let k = m[vi % 6u];
  let s0 = select(-1.0, 1.0, (k & 1u) == 1u);
  let s1 = select(-1.0, 1.0, (k & 2u) == 2u);
  if (f == 0u) { return vec3f(1.0, s1, s0); }
  if (f == 1u) { return vec3f(-1.0, s1, -s0); }
  if (f == 2u) { return vec3f(s0, 1.0, s1); }
  if (f == 3u) { return vec3f(s0, -1.0, -s1); }
  if (f == 4u) { return vec3f(-s0, s1, 1.0); }
  return vec3f(s0, s1, -1.0);
}
fn scr(clip: vec4f) -> vec2f {
  let n = clip.xy / clip.w;
  return vec2f(n.x * 0.5 + 0.5, 0.5 - n.y * 0.5);
}

@vertex fn vs_box(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  var o: SO;
  let b = boxes[ii];
  let lp = corner(vi);
  let world = b.c.xyz + lp * b.h.xyz;
  let clip = u.vp * vec4f(world, 1.0);
  o.p = clip; o.w = world; o.n = faceN(vi / 6u); o.mat = b.c.w;
  o.uv = vec2f(0.0); o.puv = vec2f(0.0); o.cuv = scr(clip);
  return o;
}

const HW = 0.25; const HH = 0.425;
fn boltAt(vi: u32, base: vec3f) -> vec3f {
  let x = select(-HW, HW, vi == 1u || vi == 2u || vi == 4u);
  let y = select(-HH, HH, vi == 2u || vi == 4u || vi == 5u);
  return base + vec3f(x, y, 0.0);
}
fn boltUv(vi: u32) -> vec2f {
  let x = select(0.0, 1.0, vi == 1u || vi == 2u || vi == 4u);
  let y = select(1.0, 0.0, vi == 2u || vi == 4u || vi == 5u);
  return vec2f(x, y);
}
@vertex fn vs_bolt(@builtin(vertex_index) vi: u32) -> SO {
  var o: SO;
  let world = boltAt(vi, u.bolt.xyz);
  let prev = boltAt(vi, u.boltPrev.xyz);
  let clip = u.vp * vec4f(world, 1.0);
  let pclip = u.prev * vec4f(prev, 1.0);
  o.p = clip; o.w = world; o.n = vec3f(0.0, 0.0, -1.0); o.mat = 4.0;
  o.uv = boltUv(vi); o.puv = scr(pclip); o.cuv = scr(clip);
  return o;
}

struct Lit { rad: vec3f, alb: vec3f, n: vec3f };
fn shade(p: vec3f, nIn: vec3f, mat: f32) -> Lit {
  var n = normalize(nIn);
  let V = normalize(u.eye.xyz - p);
  if (dot(n, V) < 0.0) { n = -n; }
  var alb = vec3f(0.48, 0.45, 0.40);
  if (mat > 0.5 && mat < 1.5) { alb = vec3f(0.11, 0.10, 0.09); }
  if (mat > 2.5 && mat < 3.5) { alb = vec3f(0.55, 0.50, 0.40); }
  let sun = normalize(u.sun.xyz);
  let vis = sunVis(p + n * 0.04);
  let ndl = max(dot(n, sun), 0.0) * vis;
  let amb = ${v3(cfg.ambient)};
  let sunC = ${v3(cfg.sunCol)};
  var rad = alb * (amb + sunC * ndl);
  if (mat > 1.5 && mat < 2.5) {
    alb = ${v3(q.albedo)};
    let H = normalize(V + sun);
    let spec = pow(max(dot(n, H), 0.0), 28.0) * ${Number(q.f0).toFixed(2)} * vis;
    rad = alb * (amb + sunC * ndl) + vec3f(spec) + ${v3(q.emit)};
  }
  var o: Lit;
  o.rad = rad; o.alb = alb; o.n = n;
  return o;
}
fn plane(w: vec3f) -> f32 { return max(dot(w - u.eye.xyz, u.fwd.xyz), 0.0); }

@fragment fn fs_box(v: SO) -> MRT {
  let lit = shade(v.w, v.n, v.mat);
  var o: MRT;
  let pl = plane(v.w);
  o.direct = vec4f(lit.rad, pl);
  o.albedo = vec4f(lit.alb, 0.0);
  o.normal = vec4f(lit.n, 1.0);
  o.motion = vec4f(0.0, 0.0, 0.0, 0.0);
  return o;
}
@fragment fn fs_bolt(v: SO) -> MRT {
  var n = normalize(v.n);
  let V = normalize(u.eye.xyz - v.w);
  if (dot(n, V) < 0.0) { n = -n; }
  let sun = normalize(u.sun.xyz);
  let vis = sunVis(v.w + n * 0.04);
  let ndl = max(dot(n, sun), 0.0) * vis;
  var alb = vec3f(0.90, 0.90, 0.88);
  if (u.extra.x > 0.5) {
    let f = u32(u.bolt.w) % 32u;
    let g = vec2f(f32(f % 8u), f32(f / 8u));
    let s = textureSampleLevel(atlas, samp, (g + clamp(v.uv, vec2f(0.002), vec2f(0.998))) / vec2f(8.0, 4.0), 0.0);
    if (s.a < 0.20) { discard; }
    alb = s.rgb;
  }
  let amb = ${v3(cfg.ambient)};
  let sunC = ${v3(cfg.sunCol)};
  let rad = alb * (amb + sunC * ndl * 0.45 + vec3f(u.extra.z));
  var o: MRT;
  o.direct = vec4f(rad, plane(v.w));
  o.albedo = vec4f(alb, 1.0);
  o.normal = vec4f(n, 1.0);
  o.motion = vec4f(v.cuv - v.puv, 1.0, 0.0);
  return o;
}
`;
}

export function toneWgsl() {
  return /* wgsl */`
${POST_STRUCT}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(7) var tCurr: texture_2d<f32>;
fn loadC(t: texture_2d<f32>, p: vec2i) -> vec4f {
  let d = vec2i(textureDimensions(t));
  return textureLoad(t, clamp(p, vec2i(0), d - vec2i(1)), 0);
}
struct PO { @builtin(position) p: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> PO {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: PO;
  o.p = vec4f(q[i], 0.0, 1.0);
  o.uv = vec2f(q[i].x * 0.5 + 0.5, 0.5 - q[i].y * 0.5);
  return o;
}
@fragment fn fs_tone(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tCurr));
  let c = max(loadC(tCurr, vec2i(v.uv * dim)).rgb * u.extra.y, vec3f(0.0));
  let m = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14);
  return vec4f(pow(clamp(m, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
@fragment fn fs_present(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tCurr));
  return loadC(tCurr, vec2i(v.uv * dim));
}
`;
}
