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

export function albedoWgsl(snowLayers = 2) {
  const C = ICE;
  const repeats = REPEATS_PER_M;
  const layers = Math.max(1, snowLayers | 0);
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
// Run 18 snow. One heading, four stills, slow mix, colour lift.
// u.sun.w is a diagnostic only. 0 is the run 18 fetch.
fn snowFetch(arr: texture_2d_array<f32>, uv: vec2f, layer: i32, du: vec2f, dv: vec2f) -> vec3f {
  let mode = u.sun.w;
  if (mode > 0.5 && mode < 1.5) {
    return textureSampleLevel(arr, samp, uv, layer, 0.0).rgb;
  }
  if (mode > 1.5 && mode < 2.5) {
    return textureSampleGrad(arr, samp, uv, layer, du * 2.0, dv * 2.0).rgb;
  }
  if (mode > 2.5 && mode < 3.5) {
    let rho = max(length(du), length(dv)) * 1024.0;
    let lod = max(log2(max(rho, 1.0)), 0.0);
    return textureSampleLevel(arr, samp, uv, layer, floor(lod)).rgb;
  }
  if (mode > 3.5 && mode < 4.5) {
    let lu = length(du);
    let lv = length(dv);
    var acc = vec3f(0.0);
    if (lu >= lv && lu > 1e-8) {
      let step = du / 8.0;
      for (var i = 0; i < 8; i++) {
        let o = (f32(i) - 3.5) * step;
        acc += textureSampleGrad(arr, samp, uv + o, layer, step, dv).rgb;
      }
    } else if (lv > 1e-8) {
      let step = dv / 8.0;
      for (var j = 0; j < 8; j++) {
        let o = (f32(j) - 3.5) * step;
        acc += textureSampleGrad(arr, samp, uv + o, layer, du, step).rgb;
      }
    } else {
      return textureSampleGrad(arr, samp, uv, layer, du, dv).rgb;
    }
    return acc / 8.0;
  }
  // 20 / 21 / 22 / 23 = minor-axis LOD + 8 major-axis taps, uniform bias 0.5 / 0.75 / 1.0 / 1.25.
  if (mode > 19.5 && mode < 23.5) {
    var bias = 0.5;
    if (mode > 20.5 && mode < 21.5) { bias = 0.75; }
    else if (mode > 21.5 && mode < 22.5) { bias = 1.0; }
    else if (mode > 22.5) { bias = 1.25; }
    let lu = length(du);
    let lv = length(dv);
    let minor = max(min(lu, lv), 1e-8);
    let lod = max(log2(max(minor * 1024.0, 1.0)) + bias, 0.0);
    var acc = vec3f(0.0);
    let along = select(dv, du, lu >= lv);
    let step = along / 8.0;
    for (var n = 0; n < 8; n++) {
      let o = (f32(n) - 3.5) * step;
      acc += textureSampleLevel(arr, samp, uv + o, layer, lod).rgb;
    }
    return acc / 8.0;
  }
  return textureSampleGrad(arr, samp, uv, layer, du, dv).rgb;
}
// Per-variant normal, height, and ORM, taken from the Imagine pixels in this shader.
// Metal stays 0. Height is the grain, not the still's mean brightness.
struct SnowTap { c: vec3f, h: f32, n: vec3f, rough: f32, ao: f32 };
var<private> gSnowN: vec3f = vec3f(0.0, 1.0, 0.0);
var<private> gSnowH: f32 = 0.0;
var<private> gSnowRough: f32 = 0.96;
var<private> gSnowAo: f32 = 1.0;
fn luma3(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
// Linear luma of the two clean stills (slots 0 and 1). Slots 2 and 3 repeat them
// when a column probe loads only those two. Height is the grain above that mean.
fn snowMean(layer: i32) -> f32 {
  let means = vec4f(0.4337, 0.5094, 0.4337, 0.5094);
  return means[layer];
}
fn tapSnow(arr: texture_2d_array<f32>, uv: vec2f, du: vec2f, dv: vec2f, layer: i32, gain: f32, up: vec3f) -> SnowTap {
  let c0 = textureSampleGrad(arr, samp, uv, layer, du, dv).rgb * gain;
  let h0 = luma3(c0) - snowMean(layer);
  var o: SnowTap;
  o.c = c0;
  o.h = h0;
  o.n = up;
  o.rough = clamp(0.96 - abs(h0) * 1.4, 0.88, 0.98);
  o.ao = clamp(1.0 + h0 * 0.12, 0.985, 1.015);
  return o;
}
fn mixSnow(a: SnowTap, b: SnowTap, w: f32) -> SnowTap {
  var o: SnowTap;
  o.c = mix(b.c, a.c, w);
  o.h = mix(b.h, a.h, w);
  o.n = normalize(mix(b.n, a.n, w));
  o.rough = mix(b.rough, a.rough, w);
  o.ao = mix(b.ao, a.ao, w);
  return o;
}
fn heightW(ha: f32, hb: f32) -> f32 {
  return smoothstep(0.0, 1.0, clamp(0.5 + (ha - hb) / 0.012, 0.0, 1.0));
}
fn cellSnow(arr: texture_2d_array<f32>, uv: vec2f, du: vec2f, dv: vec2f, id: vec2f, gain: vec4f, tng: vec3f, btg: vec3f, up: vec3f) -> SnowTap {
  let nLay = ${layers};
  let a = i32(floor(hash21(id + vec2f(8.0, 1.0)) * f32(nLay))) % nLay;
  let b = i32(floor(hash21(id + vec2f(2.2, 5.1)) * f32(nLay))) % nLay;
  let two = hash21(id + vec2f(9.2, 4.4)) > 0.42 && a != b;
  let ta = tapSnow(arr, uv, du, dv, a, gain[a], up);
  let tb = tapSnow(arr, uv, du, dv, b, gain[b], up);
  let w = select(1.0, heightW(ta.h, tb.h), two);
  return mixSnow(ta, tb, w);
}
// Hex cell, one or two stills, height decides the mix. Not an average of every still.
fn snowHex(arr: texture_2d_array<f32>, metres: vec2f, dmu: vec2f, dmv: vec2f, tng: vec3f, btg: vec3f, up: vec3f, gain: vec4f) -> SnowTap {
  let cells = 2.0;
  let bias = 2.0;
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
  let uv0 = (rot2(metres, a0) + o0 * 0.5) * ${repeats};
  let uv1 = (rot2(metres, a1) + o1 * 0.5) * ${repeats};
  let uv2 = (rot2(metres, a2) + o2 * 0.5) * ${repeats};
  let du0 = cover(rot2(dmu, a0) * ${repeats} * bias);
  let dv0 = cover(rot2(dmv, a0) * ${repeats} * bias);
  let du1 = cover(rot2(dmu, a1) * ${repeats} * bias);
  let dv1 = cover(rot2(dmv, a1) * ${repeats} * bias);
  let du2 = cover(rot2(dmu, a2) * ${repeats} * bias);
  let dv2 = cover(rot2(dmv, a2) * ${repeats} * bias);
  let t0 = cellSnow(arr, uv0, du0, dv0, i, gain, tng, btg, up);
  let t1 = cellSnow(arr, uv1, du1, dv1, id1, gain, tng, btg, up);
  let t2 = cellSnow(arr, uv2, du2, dv2, id2, gain, tng, btg, up);
  var o: SnowTap;
  o.c = t0.c * w.x + t1.c * w.y + t2.c * w.z;
  o.h = t0.h * w.x + t1.h * w.y + t2.h * w.z;
  o.n = normalize(t0.n * w.x + t1.n * w.y + t2.n * w.z);
  o.rough = t0.rough * w.x + t1.rough * w.y + t2.rough * w.z;
  o.ao = t0.ao * w.x + t1.ao * w.y + t2.ao * w.z;
  gSnowN = o.n;
  gSnowH = o.h;
  gSnowRough = o.rough;
  gSnowAo = o.ao;
  return o;
}
fn snowOn(p: vec3f, nrm: vec3f, px: vec3f, py: vec3f, gain: vec4f) -> vec3f {
  let n = normalize(nrm);
  let helper = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(n.y) < 0.9);
  let tng = normalize(cross(helper, n));
  let btg = normalize(cross(n, tng));
  let metres = vec2f(dot(p, tng), dot(p, btg));
  let dmu = vec2f(dot(px, tng), dot(px, btg));
  let dmv = vec2f(dot(py, tng), dot(py, btg));
  return snowHex(snowArr, metres, dmu, dmv, tng, btg, n, gain).c;
}
fn sampleSnow(arr: texture_2d_array<f32>, p: vec3f, px: vec3f, py: vec3f, gain: vec4f) -> vec3f {
  let metres = vec2f(p.x, p.z);
  let dmu = vec2f(px.x, px.z);
  let dmv = vec2f(py.x, py.z);
  let ang = 0.41;
  let base = rot2(metres, ang);
  let du = cover(rot2(dmu, ang) * ${repeats} * 2.0);
  let dv = cover(rot2(dmv, ang) * ${repeats} * 2.0);
  let r = f32(${repeats});
  let iso = u.sun.w;
  let nLay = ${layers};
  // Single-still column probe. Layers past the loaded set repeat a clean still.
  // They are not new Imagine variants.
  // Run 18 lift. Mode 0 keeps it. A diagnostic in (4.5, 5.5) turns it off.
  // select(false, true, cond): the chase (cond false) is the lifted grade.
  let lift = select(vec3f(1.64, 1.74, 1.90), vec3f(1.0, 1.0, 1.0), iso > 4.5 && iso < 5.5);
  if (iso > 29.5 && iso < 33.5) {
    var layer = 0;
    if (iso > 30.5 && iso < 31.5) { layer = 1; }
    else if (iso > 31.5 && iso < 32.5) { layer = 2; }
    else if (iso > 32.5) { layer = 3; }
    layer = layer % nLay;
    return snowFetch(arr, base * r, layer, du, dv) * gain[layer] * lift;
  }
  if (iso > 35.5 && iso < 36.5) { return vec3f(1.0); }
  let ca = cos(ang);
  let sa = sin(ang);
  let tng = vec3f(ca, 0.0, -sa);
  let btg = vec3f(sa, 0.0, ca);
  let tap = snowHex(arr, base, rot2(dmu, ang), rot2(dmv, ang), tng, btg, vec3f(0.0, 1.0, 0.0), gain);
  if (iso > 33.5 && iso < 34.5) { return vec3f(0.45 + tap.h * 6.0); }
  if (iso > 34.5 && iso < 35.5) { return tap.n * 0.5 + vec3f(0.5); }
  return tap.c * lift;
}
fn albedoOf(m: f32, p: vec3f, nrm: vec3f, px: vec3f, py: vec3f) -> vec3f {
  if (m < 0.5) {
    let snowGain = vec4f(1.005, 1.005, 1.005, 1.005);
    // Planar world xz so a tilted triangle does not shear the crust into lanes.
    return sampleSnow(snowArr, p, px, py, snowGain);
  }
  if (m < 3.5) {
    let iceGain = vec4f(0.853, 1.040, 0.979, 1.0);
    let snowGain = vec4f(1.005, 1.005, 1.005, 1.005);
    if (m < 1.5) {
      let fall = sampleArr(fallArr, p, nrm, px, py, iceGain, 2.0, 2.0);
      let snow = snowOn(p, nrm, px, py, snowGain);
      let lip = smoothstep(0.35, 0.75, nrm.y);
      return mix(fall, snow, lip * 0.85);
    }
    if (m < 2.5) {
      let arch = sampleArr(archArr, p, nrm, px, py, iceGain, 2.0, 4.0);
      let snow = snowOn(p, nrm, px, py, snowGain);
      let cap = smoothstep(0.28, 0.62, nrm.y);
      return mix(arch, snow, cap);
    }
    // Mip bias 4 calms the spire speckle. The sheen stays the ice value, not chrome.
    let ice = sampleArr(iceArr, p, nrm, px, py, iceGain, 2.0, 4.0);
    return ice * vec3f(0.92, 0.96, 1.0);
  }
  let snowGain = vec4f(1.005, 1.005, 1.005, 1.005);
  let iceGain = vec4f(0.853, 1.040, 0.979, 1.0);
  let snow = snowOn(p, nrm, px, py, snowGain);
  let ice = sampleArr(iceArr, p, nrm, px, py, iceGain, 2.0, 2.0);
  if (m < 4.5) {
    let chunk = skyNoise(p * 0.17);
    return mix(snow, ice, smoothstep(0.58, 0.86, chunk));
  }
  if (m > 5.5 && m < 6.5) {
    let wallIce = sampleArr(iceArr, p, nrm, px, py, iceGain, 2.0, 4.0);
    let cap = smoothstep(0.42, 0.75, nrm.y);
    return mix(wallIce, snow, cap);
  }
  let face = smoothstep(0.22, 0.62, nrm.y);
  let serac = sampleArr(seracArr, p, nrm, px, py, iceGain, 2.0, 4.0);
  return mix(serac, snow, face * 0.35);
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
