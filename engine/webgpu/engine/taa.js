// Temporal anti-aliasing. Optional, off unless a biome sets on: true.
// Halton(2,3) 8-point jitter, depth reprojection, history clamped to the
// current 3x3 neighbourhood, ~95% history reduced as the pixel's motion grows.
// Dynamic pixels (Bolt) can use a per-object motion vector instead of the
// camera reprojection so the coat keeps its own history.
// Written in-house from that description. No third-party source.

import { POST_STRUCT, SAMPLE_FNS, FULLSCREEN_VS } from './postu.js';

export const TAA_DEFAULT = {
  on: false,
  history: 0.95,
  samples: 8,
  motionPx: 24,
  objectMv: true,
  clamp: true,
  reject: true,
};

export function halton(index, base) {
  let f = 1, r = 0, i = index | 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

// 8-point Halton(2, 3). Index 0 uses the first non-zero sample.
export function halton8(frame) {
  const i = (Math.abs(frame | 0) % TAA_DEFAULT.samples) + 1;
  return [halton(i, 2), halton(i, 3)];
}

// NDC offset, ± half a pixel. Added to the projection so the raster moves
// and the resolve can put the sample back.
export function jitterNdc(frame, width, height) {
  const [hx, hy] = halton8(frame);
  return [(hx - 0.5) * 2 / width, (hy - 0.5) * 2 / height];
}

// Column-major perspective used by this engine: clip.w = -z_view.
// m02 += -jx puts +jx into NDC for a point in front of the camera.
export function applyJitter(proj, jx, jy) {
  const p = proj.slice();
  p[8] += -jx;
  p[9] += -jy;
  return p;
}

// Same curve the resolve shader uses.
// Static pixels: history * exp(-cameraSpeed / motionPx).
// Dynamic pixels with a motion vector: history * exp(-objectSpeed / (motionPx * 3))
// so a tracked coat keeps more history than an untracked smear.
export function historyWeight({ history = 0.95, motionPx = 24, speedPx = 0, dynamic = false, objSpeedPx = 0 } = {}) {
  if (!(history > 0)) return 0;
  if (dynamic) return history * Math.exp(-objSpeedPx / Math.max(motionPx * 3, 1));
  return history * Math.exp(-speedPx / Math.max(motionPx, 1));
}

export function clampToNeighbourhood(history, samples) {
  const min = samples[0].slice();
  const max = samples[0].slice();
  for (const s of samples) {
    for (let k = 0; k < 3; k++) {
      if (s[k] < min[k]) min[k] = s[k];
      if (s[k] > max[k]) max[k] = s[k];
    }
  }
  return history.map((v, k) => Math.min(max[k], Math.max(min[k], v)));
}

export function makeTAA(user) {
  const c = { ...TAA_DEFAULT, ...user };
  const resolve = /* wgsl */`
${POST_STRUCT}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(5) var tMotion: texture_2d<f32>;
@group(0) @binding(7) var tCurr: texture_2d<f32>;
@group(0) @binding(8) var tTaa: texture_2d<f32>;
${SAMPLE_FNS}
${FULLSCREEN_VS}
@fragment fn fs_taa(v: PO) -> @location(0) vec4f {
  let dim = vec2f(textureDimensions(tCurr));
  let ip = vec2i(v.uv * dim);
  let curr = loadC(tCurr, ip);
  if (curr.a < 1e-4) { return vec4f(curr.rgb, 0.0); }
  let mot = loadC(tMotion, ip);
  let dynamic = mot.z > 0.5 && u.p1.z > 0.5;
  let wpos = worldFrom(v.uv, curr.a);
  var prevUv = uvOf(wpos, u.prev);
  if (dynamic) { prevUv = v.uv - mot.xy; }
  let speed = length((v.uv - prevUv) * dim);
  var w = u.p0.x * exp(-speed / max(u.p0.y, 1.0));
  if (dynamic) {
    let os = length(mot.xy * dim);
    w = u.p0.x * exp(-os / max(u.p0.y * 3.0, 1.0));
  }
  if (u.p0.w > 0.5) {
    let prevPlane = planeOf(wpos, u.prevEye.xyz, u.prevFwd.xyz);
    let hd = bilerp(tTaa, prevUv).a;
    if (abs(hd - prevPlane) > max(0.08, abs(prevPlane) * 0.04)) { w = 0.0; }
  }
  if (any(prevUv <= vec2f(0.0)) || any(prevUv >= vec2f(1.0))) { w = 0.0; }
  var hist = bilerp(tTaa, prevUv).rgb;
  if (u.p0.z > 0.5) {
    var cmin = curr.rgb;
    var cmax = curr.rgb;
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let s = loadC(tCurr, ip + vec2i(dx, dy)).rgb;
        cmin = min(cmin, s);
        cmax = max(cmax, s);
      }
    }
    hist = clamp(hist, cmin, cmax);
  }
  return vec4f(mix(curr.rgb, hist, w), curr.a);
}
`;
  return { cfg: c, resolve, halton8, jitterNdc, applyJitter, historyWeight };
}
