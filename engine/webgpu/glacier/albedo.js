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
fn layer4(arr: texture_2d_array<f32>, uv: vec2f, du: vec2f, dv: vec2f, layer: i32) -> vec3f {
  let s0 = textureSampleGrad(arr, samp, uv, 0, du, dv).rgb;
  let s1 = textureSampleGrad(arr, samp, uv, 1, du, dv).rgb;
  let s2 = textureSampleGrad(arr, samp, uv, 2, du, dv).rgb;
  let s3 = textureSampleGrad(arr, samp, uv, 3, du, dv).rgb;
  let w = vec4f(select(0.0, 1.0, layer == 0), select(0.0, 1.0, layer == 1), select(0.0, 1.0, layer == 2), select(0.0, 1.0, layer == 3));
  return s0 * w.x + s1 * w.y + s2 * w.z + s3 * w.w;
}
fn hexArr(arr: texture_2d_array<f32>, metres: vec2f, ddu: vec2f, ddv: vec2f) -> vec3f {
  let uv = metres * ${repeats};
  let du = ddu * ${repeats};
  let dv = ddv * ${repeats};
  let skew = vec2f(uv.x + uv.y * 0.5, uv.y * 0.8660254);
  let i = floor(skew);
  let f = fract(skew);
  let lower = f.x > f.y;
  let v1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), lower);
  let w0 = select(1.0 - f.y, 1.0 - f.x, lower);
  let w1 = select(f.y - f.x, f.x - f.y, lower);
  let wRaw = vec3f(w0, w1, select(f.x, f.y, lower));
  let wSoft = sqrt(max(wRaw, vec3f(0.0)));
  let w = wSoft / (wSoft.x + wSoft.y + wSoft.z + 1e-4);
  let id0 = i;
  let id1 = i + v1;
  let id2 = i + vec2f(1.0, 1.0);
  let phase = vec2f(hash21(id0 + vec2f(2.2, 5.1)), hash21(id0 + vec2f(8.4, 1.3)));
  let phase1 = vec2f(hash21(id1 + vec2f(2.2, 5.1)), hash21(id1 + vec2f(8.4, 1.3)));
  let phase2 = vec2f(hash21(id2 + vec2f(2.2, 5.1)), hash21(id2 + vec2f(8.4, 1.3)));
  let l0 = i32(floor(hash21(id0) * 4.0)) % 4;
  let l1 = i32(floor(hash21(id1) * 4.0)) % 4;
  let l2 = i32(floor(hash21(id2) * 4.0)) % 4;
  let c0 = layer4(arr, uv + phase, du, dv, l0);
  let c1 = layer4(arr, uv + phase1, du, dv, l1);
  let c2 = layer4(arr, uv + phase2, du, dv, l2);
  return c0 * w.x + c1 * w.y + c2 * w.z;
}
fn sampleArr(arr: texture_2d_array<f32>, p: vec3f, px: vec3f, py: vec3f) -> vec3f {
  var nGeo = cross(px, py);
  let glen = length(nGeo);
  if (glen < 1e-5) { nGeo = vec3f(0.0, 1.0, 0.0); } else { nGeo = nGeo / glen; }
  let helper = select(vec3f(1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), abs(nGeo.y) < 0.9);
  let tng = normalize(cross(helper, nGeo));
  let btg = normalize(cross(nGeo, tng));
  let metres = vec2f(dot(p, tng), dot(p, btg));
  let ddu = vec2f(dot(px, tng), dot(px, btg));
  let ddv = vec2f(dot(py, tng), dot(py, btg));
  return hexArr(arr, metres, ddu, ddv);
}
fn albedoOf(m: f32, p: vec3f, nrm: vec3f, px: vec3f, py: vec3f) -> vec3f {
  if (m < 0.5) {
    let snow = sampleArr(snowArr, p, px, py);
    let crev = smoothstep(1.1, -1.6, p.y - 0.3);
    let tone = skyNoise(vec3f(p.x * 0.018, 2.4, p.z * 0.007));
    var g = snow * (0.9 + 0.16 * tone);
    let spark = step(0.994, skyNoise(p * 11.0));
    g = g + ${v3([0.07, 0.1, 0.13])} * spark;
    return mix(g, g * ${v3(C.crevasse)} * 1.35, crev);
  }
  if (m < 3.5) {
    let ice = sampleArr(iceArr, p, px, py);
    if (m < 1.5) {
      let snow = sampleArr(snowArr, p, px, py);
      let lip = smoothstep(0.45, 0.8, nrm.y);
      return mix(ice, snow, lip * 0.85);
    }
    if (m < 2.5) {
      let snow = sampleArr(snowArr, p, px, py);
      let cap = smoothstep(0.28, 0.62, nrm.y);
      let under = smoothstep(0.05, -0.55, nrm.y);
      var arch = mix(ice, ice * vec3f(0.46, 0.58, 0.84), under);
      return mix(arch, snow, cap);
    }
    return ice * vec3f(0.92, 0.96, 1.0);
  }
  let snow = sampleArr(snowArr, p, px, py);
  let ice = sampleArr(iceArr, p, px, py);
  if (m < 4.5) {
    let chunk = skyNoise(p * 0.17);
    return mix(snow, ice, smoothstep(0.58, 0.86, chunk));
  }
  if (m > 5.5 && m < 6.5) {
    let cap = smoothstep(0.38, 0.72, nrm.y);
    let recess = smoothstep(0.12, -0.5, nrm.y);
    let band = skyNoise(vec3f(1.7, p.y * 0.028, 4.2));
    let dirty = skyNoise(vec3f(p.z * 0.004, p.y * 0.012, 8.0));
    var wall = ice;
    wall = mix(wall, wall * vec3f(0.9, 0.94, 1.0), smoothstep(0.28, 0.72, band) * 0.28);
    wall = mix(wall, wall * vec3f(0.72, 0.66, 0.58), smoothstep(0.78, 0.94, dirty) * 0.28);
    wall = mix(wall, wall * ${v3(C.wallBlue)}, clamp(recess, 0.0, 1.0) * 0.32);
    return mix(wall, snow, cap);
  }
  let face = smoothstep(0.22, 0.62, nrm.y);
  let alt = smoothstep(50.0, 280.0, p.y);
  let rock = ice * vec3f(0.62, 0.6, 0.58);
  return mix(rock, snow, clamp(max(face, alt), 0.0, 1.0));
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
