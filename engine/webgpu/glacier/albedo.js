// Authored linear albedo. Ice, snow, and dawn rock in their own colours.
// Photographs are sampled in real colour. The shader multiplies by the dawn rig.
// Nothing here is fitted to a render.
import { shadeAt, norm3 } from '../biome-factory/light-rig.js';

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
  return `
fn hash22(p: vec2f) -> vec2f {
  let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}
fn hexSample(tex: texture_2d<f32>, uv: vec2f, du: vec2f, dv: vec2f, repeats: f32, cellM: f32, bias: f32) -> vec3f {
  let p = uv / cellM;
  let skew = vec2f(p.x + p.y * 0.5, p.y * 0.8660254);
  let i = floor(skew);
  let f = fract(skew);
  let lower = f.x > f.y;
  let v1 = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), lower);
  let w0 = select(1.0 - f.y, 1.0 - f.x, lower);
  let w1 = select(f.y - f.x, f.x - f.y, lower);
  let wRaw = vec3f(w0, w1, select(f.x, f.y, lower));
  let wSoft = sqrt(max(wRaw, vec3f(0.0)));
  let w = wSoft / (wSoft.x + wSoft.y + wSoft.z + 1e-4);
  let uvS = uv * repeats;
  let duS = du * repeats * bias;
  let dvS = dv * repeats * bias;
  let c0 = textureSampleGrad(tex, samp, uvS + hash22(i) * 4.7, duS, dvS).rgb;
  let c1 = textureSampleGrad(tex, samp, uvS + hash22(i + v1) * 4.7, duS, dvS).rgb;
  let c2 = textureSampleGrad(tex, samp, uvS + hash22(i + vec2f(1.0, 1.0)) * 4.7, duS, dvS).rgb;
  return c0 * w.x + c1 * w.y + c2 * w.z;
}
fn twoScale(tex: texture_2d<f32>, uv: vec2f, du: vec2f, dv: vec2f, broadSc: f32, fineSc: f32, cellM: f32, dist: f32) -> vec3f {
  let far = smoothstep(22.0, 140.0, dist);
  let broad = hexSample(tex, uv, du, dv, broadSc, cellM * 2.6, 1.0);
  let fine = hexSample(tex, uv, du, dv, fineSc, cellM, mix(1.05, 3.2, far));
  return mix(broad, fine, mix(0.7, 0.08, far));
}
fn sampleTex(tex: texture_2d<f32>, p: vec3f, nrm: vec3f, gx: vec3f, gy: vec3f, broadSc: f32, fineSc: f32, cellM: f32) -> vec3f {
  let ax = abs(nrm.x);
  let ay = abs(nrm.y);
  let az = abs(nrm.z);
  var uv: vec2f;
  var du: vec2f;
  var dv: vec2f;
  if (ay >= ax && ay >= az) {
    uv = p.xz; du = vec2f(gx.x, gx.z); dv = vec2f(gy.x, gy.z);
  } else if (ax >= az) {
    uv = vec2f(p.z, p.y); du = vec2f(gx.z, gx.y); dv = vec2f(gy.z, gy.y);
  } else {
    uv = p.xy; du = vec2f(gx.x, gx.y); dv = vec2f(gy.x, gy.y);
  }
  return twoScale(tex, uv, du, dv, broadSc, fineSc, cellM, length(p - u.cam.xyz));
}
fn albedoOf(m: f32, p: vec3f, nrm: vec3f, gx: vec3f, gy: vec3f) -> vec3f {
  let snow = sampleTex(snowTex, p, nrm, gx, gy, 0.02, 0.16, 26.0);
  let ice = sampleTex(wallTex, p, nrm, gx, gy, 0.014, 0.06, 34.0);
  if (m < 0.5) {
    let crev = smoothstep(1.1, -1.6, p.y - 0.3);
    let grit = skyNoise(p * 0.31);
    var g = snow * (0.9 + 0.16 * grit);
    let icePatch = skyNoise(vec3f(p.x * 0.07, 1.6, p.z * 0.011));
    g = mix(g, g * vec3f(0.58, 0.72, 0.98), smoothstep(0.64, 0.86, icePatch) * 0.75);
    let spark = step(0.997, skyNoise(p * 11.0));
    g = g + ${v3([0.08, 0.11, 0.14])} * spark;
    return mix(g, g * ${v3(C.crevasse)} * 1.35, crev);
  }
  if (m < 1.5) {
    let lip = smoothstep(0.45, 0.8, nrm.y);
    return mix(ice, snow, lip * 0.85);
  }
  if (m < 2.5) {
    let cap = smoothstep(0.28, 0.62, nrm.y);
    let under = smoothstep(0.05, -0.55, nrm.y);
    var arch = mix(ice, ice * vec3f(0.46, 0.58, 0.84), under);
    return mix(arch, snow, cap);
  }
  if (m < 3.5) { return ice * vec3f(0.92, 0.96, 1.0); }
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
