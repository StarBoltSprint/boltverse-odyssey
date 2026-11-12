// Authored linear albedo. Ice, snow, and dawn rock in their own colours.
// Photographs are sampled in real colour. The shader multiplies by the dawn rig.
// Nothing here is fitted to a render.
import { shadeAt, norm3 } from '../biome-factory/light-rig.js';
import { REPEATS_PER_M } from './texel-density.js';

export const ICE = {
  snow: [0.78, 0.80, 0.84],
  snowShade: [0.56, 0.62, 0.72],
  crevasse: [0.08, 0.16, 0.32],
  wallPale: [0.58, 0.72, 0.92],
  wallBlue: [0.22, 0.42, 0.78],
  fallPale: [0.54, 0.70, 0.90],
  fallClear: [0.28, 0.48, 0.76],
  archPale: [0.60, 0.76, 0.94],
  archBlue: [0.26, 0.48, 0.82],
  icicle: [0.66, 0.80, 0.94],
  drift: [0.74, 0.77, 0.82],
  rock: [0.32, 0.34, 0.40],
  peak: [0.70, 0.76, 0.84],
  planetPale: [0.74, 0.76, 0.82],
  planetShade: [0.52, 0.58, 0.70],
  sheen: 0.045,
  specPower: 36,
};

function v3(a) { return `vec3f(${a[0]}, ${a[1]}, ${a[2]})`; }

export function albedoWgsl() {
  const C = ICE;
  const repeats = REPEATS_PER_M;
  return `
fn hash21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn rot2(v: vec2f, ang: f32) -> vec2f {
  let c = cos(ang);
  let s = sin(ang);
  return vec2f(v.x * c - v.y * s, v.x * s + v.y * c);
}
fn cover(d: vec2f) -> vec2f {
  let len = length(d);
  let floor = 3.0 / 1024.0;
  if (len > 1e-6 && len < floor) { return d * (floor / len); }
  return d;
}
// One lead still, a little of the other three. The pick is the hex cell, not the pixel.
fn variantW(id: vec2f) -> vec4f {
  let lead = i32(floor(hash21(id + vec2f(8.0, 1.0)) * 4.0)) % 4;
  return vec4f(
    select(0.05, 0.85, lead == 0),
    select(0.05, 0.85, lead == 1),
    select(0.05, 0.85, lead == 2),
    select(0.05, 0.85, lead == 3)
  );
}
fn blend4(arr: texture_2d_array<f32>, uv: vec2f, du: vec2f, dv: vec2f, w: vec4f, gain: vec4f) -> vec3f {
  let s0 = textureSampleGrad(arr, samp, uv, 0, du, dv).rgb * gain.x;
  let s1 = textureSampleGrad(arr, samp, uv, 1, du, dv).rgb * gain.y;
  let s2 = textureSampleGrad(arr, samp, uv, 2, du, dv).rgb * gain.z;
  let s3 = textureSampleGrad(arr, samp, uv, 3, du, dv).rgb * gain.w;
  return s0 * w.x + s1 * w.y + s2 * w.z + s3 * w.w;
}
fn cellMean(arr: texture_2d_array<f32>, uv: vec2f, id: vec2f, gain: vec4f) -> vec3f {
  let lead = i32(floor(hash21(id + vec2f(8.0, 1.0)) * 4.0)) % 4;
  let gv = dot(gain, vec4f(select(0.0, 1.0, lead == 0), select(0.0, 1.0, lead == 1), select(0.0, 1.0, lead == 2), select(0.0, 1.0, lead == 3)));
  return textureSampleLevel(arr, samp, uv, lead, 5.0).rgb * gv;
}
// Hex lattice for ice. Each cell rotates and shifts its own still.
// Weights are the triangle inside the hex, so a cell edge is a blend, not a hash flicker.
fn sampleArr(arr: texture_2d_array<f32>, p: vec3f, nrm: vec3f, px: vec3f, py: vec3f, gain: vec4f, cells: f32, bias: f32) -> vec3f {
  let n = normalize(nrm);
  let helper = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(n.y) < 0.9);
  let tng = normalize(cross(helper, n));
  let btg = normalize(cross(n, tng));
  let metres = vec2f(dot(p, tng), dot(p, btg));
  let dmu = vec2f(dot(px, tng), dot(px, btg));
  let dmv = vec2f(dot(py, tng), dot(py, btg));
  let skew = vec2f(metres.x + metres.y * 0.5, metres.y * 0.8660254) * cells;
  let i = floor(skew);
  let f = fract(skew);
  let lower = f.x > f.y;
  let w0 = select(1.0 - f.y, 1.0 - f.x, lower);
  let w1 = select(f.y - f.x, f.x - f.y, lower);
  let w2 = select(f.x, f.y, lower);
  let ws = vec3f(w0, w1, w2);
  let sm = ws * ws * (3.0 - 2.0 * ws);
  let w = sm / max(sm.x + sm.y + sm.z, 1e-4);
  let id1 = i + select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), lower);
  let id2 = i + vec2f(1.0, 1.0);
  let a0 = hash21(i + vec2f(3.7, 9.1)) * 6.2831853;
  let a1 = hash21(id1 + vec2f(3.7, 9.1)) * 6.2831853;
  let a2 = hash21(id2 + vec2f(3.7, 9.1)) * 6.2831853;
  let o0 = vec2f(hash21(i + vec2f(2.2, 5.1)), hash21(i + vec2f(4.4, 1.3)));
  let o1 = vec2f(hash21(id1 + vec2f(2.2, 5.1)), hash21(id1 + vec2f(4.4, 1.3)));
  let o2 = vec2f(hash21(id2 + vec2f(2.2, 5.1)), hash21(id2 + vec2f(4.4, 1.3)));
  let m0 = rot2(metres, a0) + o0 * 0.5;
  let m1 = rot2(metres, a1) + o1 * 0.5;
  let m2 = rot2(metres, a2) + o2 * 0.5;
  // A face that under-reports its derivative was sampling the raw still
  // and reading as glitter. Three texels per pixel is the floor.
  let du0 = cover(rot2(dmu, a0) * ${repeats} * bias);
  let dv0 = cover(rot2(dmv, a0) * ${repeats} * bias);
  let du1 = cover(rot2(dmu, a1) * ${repeats} * bias);
  let dv1 = cover(rot2(dmv, a1) * ${repeats} * bias);
  let du2 = cover(rot2(dmu, a2) * ${repeats} * bias);
  let dv2 = cover(rot2(dmv, a2) * ${repeats} * bias);
  let uv0 = m0 * ${repeats};
  let uv1 = m1 * ${repeats};
  let uv2 = m2 * ${repeats};
  let c0 = blend4(arr, uv0, du0, dv0, variantW(i), gain);
  let c1 = blend4(arr, uv1, du1, dv1, variantW(id1), gain);
  let c2 = blend4(arr, uv2, du2, dv2, variantW(id2), gain);
  let hi = c0 * w.x + c1 * w.y + c2 * w.z;
  let lo = cellMean(arr, uv0, i, gain) * w.x + cellMean(arr, uv1, id1, gain) * w.y + cellMean(arr, uv2, id2, gain) * w.z;
  let restore = min(inverseSqrt(max(dot(w, w), 0.45)), 1.2);
  return lo + (hi - lo) * restore;
}
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// One heading for all four stills. Weights drift over several metres.
// A cell lattice, and a blue crevasse painted down the lane, both read as columns.
fn sampleSnow(arr: texture_2d_array<f32>, p: vec3f, px: vec3f, py: vec3f, gain: vec4f) -> vec3f {
  let metres = vec2f(p.x, p.z);
  let dmu = vec2f(px.x, px.z);
  let dmv = vec2f(py.x, py.z);
  let ang = 0.41;
  let uv = rot2(metres, ang);
  let du = cover(rot2(dmu, ang) * ${repeats} * 2.0);
  let dv = cover(rot2(dmv, ang) * ${repeats} * 2.0);
  let s = uv * 0.11;
  let n = vec4f(
    vnoise(s),
    vnoise(s + vec2f(5.2, 1.7)),
    vnoise(s + vec2f(2.4, 8.1)),
    vnoise(s + vec2f(9.0, 3.4))
  );
  let ww = n * n;
  let wt = ww / max(dot(ww, vec4f(1.0)), 1e-4);
  return blend4(arr, uv * ${repeats}, du, dv, wt, gain);
}
fn albedoOf(m: f32, p: vec3f, nrm: vec3f, px: vec3f, py: vec3f) -> vec3f {
  if (m < 0.5) {
    let snowGain = vec4f(0.949, 1.005, 1.005, 1.355);
    // Planar world xz so a tilted triangle does not shear the crust into lanes.
    return sampleSnow(snowArr, p, px, py, snowGain);
  }
  if (m < 3.5) {
    let iceGain = vec4f(0.853, 1.040, 0.979, 1.0);
    let snowGain = vec4f(0.949, 1.005, 1.005, 1.355);
    if (m < 1.5) {
      let fall = sampleArr(fallArr, p, nrm, px, py, iceGain, 2.0, 2.0);
      let snow = sampleArr(snowArr, p, nrm, px, py, snowGain, 2.0, 2.0);
      let lip = smoothstep(0.35, 0.75, nrm.y);
      return mix(fall, snow, lip * 0.85);
    }
    if (m < 2.5) {
      let arch = sampleArr(archArr, p, nrm, px, py, iceGain, 2.0, 4.0);
      let snow = sampleArr(snowArr, p, nrm, px, py, snowGain, 2.0, 2.0);
      let cap = smoothstep(0.28, 0.62, nrm.y);
      return mix(arch, snow, cap);
    }
    let ice = sampleArr(iceArr, p, nrm, px, py, iceGain, 2.0, 2.0);
    return ice * vec3f(0.92, 0.96, 1.0);
  }
  let snowGain = vec4f(0.949, 1.005, 1.005, 1.355);
  let iceGain = vec4f(0.853, 1.040, 0.979, 1.0);
  let snow = sampleArr(snowArr, p, nrm, px, py, snowGain, 2.0, 2.0);
  let ice = sampleArr(iceArr, p, nrm, px, py, iceGain, 2.0, 2.0);
  if (m < 4.5) {
    let chunk = skyNoise(p * 0.17);
    return mix(snow, ice, smoothstep(0.58, 0.86, chunk));
  }
  if (m > 5.5 && m < 6.5) {
    let cap = smoothstep(0.42, 0.75, nrm.y);
    return mix(ice, snow, cap);
  }
  let face = smoothstep(0.22, 0.62, nrm.y);
  let serac = sampleArr(seracArr, p, nrm, px, py, iceGain, 2.0, 2.0);
  return mix(serac, snow, face);
}
fn litIce(alb: vec3f, n: vec3f, view: vec3f) -> vec3f {
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let graze = smoothstep(0.50, 0.08, ndv);
  let spec = pow(clamp(dot(n, normalize(sunN() + view)), 0.0, 1.0), ${C.specPower}.0);
  return alb * dawnIrr(n) + alb * spec * graze * ${C.sheen};
}
`;
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// CPU twin of litIce. Grazing sheen is zero once ndv is above 0.50.
export function litIce(alb, n, view, light) {
  const nn = norm3(n);
  const vv = norm3(view);
  const sun = norm3((light.sun || light.moon).direction);
  const ndl = Math.max(0, dot(nn, sun));
  const irr = shadeAt(light, ndl, Math.max(0, nn[1])).rgb;
  const ndv = Math.max(0, dot(nn, vv));
  const graze = smoothstep(0.50, 0.08, ndv);
  const half = norm3(add(sun, vv));
  const spec = Math.max(0, dot(nn, half)) ** ICE.specPower;
  return alb.map((a, i) => a * irr[i] + a * spec * graze * ICE.sheen);
}
