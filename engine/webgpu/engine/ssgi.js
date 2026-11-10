// Screen-space one-bounce GI. Optional, off unless a biome sets on: true.
// Half resolution, 2 cosine rays per pixel, adaptive steps (default 32),
// the hit reads the previous frame's lit colour, then a temporal blend of
// up to 8 frames and a 3x3 depth/normal-guided filter. Added on top of the
// direct buffer: direct + albedo * bounce. It does not replace the sun.
// Written in-house from that description. No third-party source.

import { POST_STRUCT, SAMPLE_FNS, FULLSCREEN_VS } from './postu.js';

export const SSGI_DEFAULT = {
  on: false,
  scale: 0.5,
  rays: 2,
  steps: 32,
  frames: 8,
  strength: 1,
  thickness: 0.02,
  stepBase: 0.06,
  stepGrow: 1.22,
  maxStep: 0.7,
  sky: [0.10, 0.13, 0.18],
};

// The trace loop starts at t0 and grows the step the same way the shader does.
export function marchSchedule(steps = 32, base = 0.06, grow = 1.22, maxStep = 0.7, t0 = 0.12) {
  const out = [];
  let step = base;
  let t = t0;
  const n = steps | 0;
  for (let i = 0; i < n; i++) {
    const prev = t;
    t += step;
    out.push({ prev, t, step });
    step = Math.min(step * grow, maxStep);
  }
  return out;
}

// prevCount is the number of accepted history frames already stored (0..frames).
// A rejected sample starts again at 1 and contributes no history.
export function temporalWeight(prevCount, maxFrames = 8, reject = false) {
  const cap = Math.max(1, maxFrames | 0);
  let n = reject ? 0 : Math.min(Math.max(prevCount | 0, 0), cap);
  n = Math.min(n + 1, cap);
  return { n, w: 1 - 1 / n };
}

export function makeSSGI(user) {
  const c = { ...SSGI_DEFAULT, ...user };
  const rays = c.rays | 0;
  const steps = c.steps | 0;
  const pass = /* wgsl */`
${POST_STRUCT}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(2) var tDirect: texture_2d<f32>;
@group(0) @binding(3) var tAlbedo: texture_2d<f32>;
@group(0) @binding(4) var tNormal: texture_2d<f32>;
@group(0) @binding(6) var tPrev: texture_2d<f32>;
@group(0) @binding(9) var tGiRaw: texture_2d<f32>;
@group(0) @binding(10) var tGiHist: texture_2d<f32>;
@group(0) @binding(11) var tGiFilt: texture_2d<f32>;
${SAMPLE_FNS}
${FULLSCREEN_VS}
fn hash13(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }
fn cosineDir(n: vec3f, seed: f32, ray: u32, frame: f32) -> vec3f {
  let h = hash13(vec3f(seed, f32(ray) * 1.7 + 0.3, frame + 1.0));
  let h2 = hash13(vec3f(h + 0.2, seed + 4.1, f32(ray) + 3.1));
  // Ray 0 is stratified toward world-down in the tangent frame so one of the two
  // rays can see a lit floor. Ray 1 stays a free cosine sample.
  let phi = select(6.2831853 * fract(h + frame * 0.6180339), 4.71239 + (fract(h2) - 0.5) * 0.9, ray == 0u);
  let r2 = fract(h2 + f32(ray) * 0.37);
  let s = sqrt(r2);
  let cz = sqrt(max(0.0, 1.0 - r2));
  var t = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.9) { t = vec3f(1.0, 0.0, 0.0); }
  let uax = normalize(cross(t, n));
  let vax = cross(n, uax);
  return normalize(uax * (s * cos(phi)) + vax * (s * sin(phi)) + n * cz);
}
@fragment fn fs_trace(v: PO) -> @location(0) vec4f {
  let full = vec2f(textureDimensions(tDirect));
  let ip = vec2i(clamp(v.uv, vec2f(0.0), vec2f(0.999)) * full);
  let surf = loadC(tDirect, ip);
  if (surf.a < 1e-3) { return vec4f(0.0); }
  let n = normalize(loadC(tNormal, ip).xyz);
  let pos = worldFrom(v.uv, surf.a);
  var acc = vec3f(0.0);
  for (var r = 0; r < ${rays}; r++) {
    let seed = hash13(vec3f(vec2f(ip), f32(r) + u.eye.w * 0.17));
    let dir = cosineDir(n, seed, u32(r), u.eye.w);
    var step = u.p2.y;
    var t = 0.12;
    var hit = vec3f(0.0);
    var found = false;
    for (var s = 0; s < ${steps}; s++) {
      t = t + step;
      let q = pos + dir * t;
      let uvq = uvOf(q, u.vp);
      if (any(uvq <= vec2f(0.0)) || any(uvq >= vec2f(1.0))) { break; }
      let rayPlane = planeOf(q, u.eye.xyz, u.fwd.xyz);
      if (rayPlane < 0.05) { break; }
      let sp = vec2i(uvq * full);
      let sd = loadC(tDirect, sp).a;
      let hw = worldFrom(uvq, sd);
      // World distance, not a farther-than-depth test: the lit floor is closer to
      // the camera than the wall, so a ray walking toward it gets nearer, not farther.
      let dist = length(q - hw);
      if (sd > 1e-3 && t > 0.18 && dist < step + u.p3.x) {
        let puv = uvOf(hw, u.prev);
        var bounce = vec3f(u.p3.y, u.p3.z, u.p3.w) * 0.25;
        if (all(puv > vec2f(0.0)) && all(puv < vec2f(1.0))) {
          bounce = min(bilerp(tPrev, puv).rgb, vec3f(2.0));
        }
        let fall = 1.0 / (1.0 + t * t * 0.12);
        hit = bounce * fall;
        found = true;
        break;
      }
      step = min(step * u.p2.z, u.sun.w);
    }
    if (!found) { hit = vec3f(0.0); }
    acc += hit;
  }
  return vec4f(acc / f32(${rays}), surf.a);
}
@fragment fn fs_temporal(v: PO) -> @location(0) vec4f {
  let full = vec2f(textureDimensions(tDirect));
  let ip = vec2i(clamp(v.uv, vec2f(0.0), vec2f(0.999)) * full);
  let surf = loadC(tDirect, ip);
  let raw = loadC(tGiRaw, vec2i(v.uv * vec2f(textureDimensions(tGiRaw))));
  if (surf.a < 1e-3) { return vec4f(0.0); }
  let wpos = worldFrom(v.uv, surf.a);
  let prevUv = uvOf(wpos, u.prev);
  var reject = any(prevUv <= vec2f(0.0)) || any(prevUv >= vec2f(1.0));
  let hist = bilerp(tGiHist, prevUv);
  let prevPlane = planeOf(wpos, u.prevEye.xyz, u.prevFwd.xyz);
  // tPrev.a is the previous frame's plane distance. hist.a is the running frame count.
  let prevLit = bilerp(tPrev, prevUv);
  if (prevLit.a > 1e-3 && abs(prevLit.a - prevPlane) > max(0.10, abs(prevPlane) * 0.05)) { reject = true; }
  var n = select(round(hist.a * u.p2.w), 0.0, reject || hist.a < 1e-4);
  let cap = max(u.p2.w, 1.0);
  n = min(n + 1.0, cap);
  let w = 1.0 - 1.0 / n;
  return vec4f(mix(raw.rgb, hist.rgb, w), n / cap);
}
@fragment fn fs_filter(v: PO) -> @location(0) vec4f {
  let full = vec2f(textureDimensions(tDirect));
  let ip0 = vec2i(clamp(v.uv, vec2f(0.0), vec2f(0.999)) * full);
  let d0 = loadC(tDirect, ip0).a;
  let n0 = normalize(loadC(tNormal, ip0).xyz + vec3f(1e-5));
  let hdim = vec2f(textureDimensions(tGiHist));
  let hp = vec2i(v.uv * hdim);
  var acc = vec3f(0.0);
  var ws = 0.0;
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      let q = hp + vec2i(dx, dy);
      let g = loadC(tGiHist, q);
      let uvq = (vec2f(q) + vec2f(0.5)) / hdim;
      let ip = vec2i(uvq * full);
      let d = loadC(tDirect, ip).a;
      let nn = normalize(loadC(tNormal, ip).xyz + vec3f(1e-5));
      let wd = exp(-abs(d - d0) * 6.0);
      let wn = pow(max(dot(nn, n0), 0.0), 8.0);
      let wgt = wd * wn;
      acc += g.rgb * wgt;
      ws += wgt;
    }
  }
  return vec4f(acc / max(ws, 1e-4), d0);
}
@fragment fn fs_comp(v: PO) -> @location(0) vec4f {
  let full = vec2f(textureDimensions(tDirect));
  let ip = vec2i(v.uv * full);
  let d = loadC(tDirect, ip);
  if (d.a < 1e-3 || u.p1.w < 0.5) { return vec4f(d.rgb, d.a); }
  let alb = loadC(tAlbedo, ip).rgb;
  let g = bilerp(tGiFilt, v.uv);
  let wd = exp(-abs(g.a - d.a) * 4.0);
  return vec4f(d.rgb + alb * g.rgb * u.p2.x * wd, d.a);
}
`;
  return { cfg: c, pass, marchSchedule, temporalWeight };
}
