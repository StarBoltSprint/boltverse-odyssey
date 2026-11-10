// Authored linear albedo. Ice, snow, and dawn rock in their own colours.
// The shader multiplies these by the dawn rig. Nothing here is fitted to a render.
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
fn rot2(uv: vec2f) -> vec2f { return vec2f(uv.x * 0.78 + uv.y * 0.63, -uv.x * 0.63 + uv.y * 0.78); }
fn texAt(tex: texture_2d<f32>, uv: vec2f) -> vec3f {
  return textureSample(tex, samp, uv).rgb;
}
fn triSample(tex: texture_2d<f32>, p: vec3f, nrm: vec3f, sc: f32) -> vec3f {
  let wuv = skyNoise(p * 0.037);
  let w2 = skyNoise(p * 0.09 + vec3f(4.0, 1.7, 8.0));
  let q = p + vec3f(wuv - 0.5, 0.0, w2 - 0.5) * 5.0;
  let sx = texAt(tex, rot2(q.zy) * sc);
  let syA = texAt(tex, rot2(q.xz) * sc);
  let syB = texAt(tex, vec2f(q.x * -0.35 + q.z * 0.94, q.x * 0.94 + q.z * 0.35) * sc + vec2f(3.2, 8.7));
  let sy = syA * 0.58 + syB * 0.42;
  let sz = texAt(tex, rot2(q.xy) * sc);
  let bn = abs(nrm);
  let b = bn / (bn.x + bn.y + bn.z + 1e-4);
  return sx * b.x + sy * b.y + sz * b.z;
}
fn albedoOf(m: f32, p: vec3f, nrm: vec3f) -> vec3f {
  let snow = triSample(snowTex, p, nrm, 1.15);
  let ice = triSample(wallTex, p, nrm, 0.16);
  let iceFace = triSample(wallTex, p, nrm, 0.7);
  if (m < 0.5) {
    let crev = smoothstep(1.1, -1.6, p.y - 0.3);
    let grit = skyNoise(p * 23.0);
    var g = snow * (0.74 + 0.52 * grit);
    let spark = step(0.992, skyNoise(p * 37.0));
    g = g + ${v3([0.16, 0.2, 0.24])} * spark;
    return mix(g, g * ${v3(C.crevasse)} * 1.4, crev);
  }
  if (m < 1.5) { return ice; }
  if (m < 2.5) {
    let cap = smoothstep(0.25, 0.72, nrm.y);
    return mix(iceFace, snow, cap);
  }
  if (m < 3.5) { return ice; }
  if (m < 4.5) {
    let chunk = skyNoise(p * 0.35);
    return mix(snow, ice, smoothstep(0.55, 0.8, chunk));
  }
  if (m > 5.5 && m < 6.5) {
    let cap = smoothstep(0.35, 0.75, nrm.y);
    let dirty = skyNoise(vec3f(p.y * 0.02, p.z * 0.01, 6.0));
    var wall = ice;
    wall = mix(wall, wall * vec3f(0.72, 0.68, 0.62), smoothstep(0.78, 0.92, dirty) * 0.65);
    return mix(wall, snow, cap);
  }
  let snowLine = smoothstep(280.0, 620.0, p.y);
  let face = smoothstep(0.35, 0.8, nrm.y);
  return mix(${v3(C.rock)}, ${v3(C.peak)}, max(snowLine, face));
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
