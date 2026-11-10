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
fn albedoOf(m: f32, p: vec3f) -> vec3f {
  let nA = skyNoise(vec3f(p.x * 0.47, p.z * 0.41, 2.2));
  let nB = skyNoise(vec3f(p.x * 2.3, p.y * 1.7, p.z * 2.1));
  let grain = 0.82 + 0.18 * nB;
  if (m < 0.5) {
    var snow = mix(${v3(C.snow)}, ${v3(C.snowShade)}, nA);
    let low = smoothstep(0.6, -3.4, p.y);
    snow = mix(snow, ${v3(C.crevasse)}, low);
    return snow * grain;
  }
  if (m < 1.5) {
    let streak = skyNoise(vec3f(p.x * 0.85, p.y * 0.22, 4.0));
    return mix(${v3(C.fallClear)}, ${v3(C.fallPale)}, streak) * grain;
  }
  if (m < 2.5) {
    let band = smoothstep(0.32, 0.68, fract(p.y * 0.09 + skyNoise(p * 0.15) * 1.6));
    return mix(${v3(C.archBlue)}, ${v3(C.archPale)}, band) * grain;
  }
  if (m < 3.5) {
    let core = smoothstep(0.15, 0.9, abs(p.y));
    return mix(${v3(C.icicle)}, ${v3(C.fallClear)}, core * 0.35) * grain;
  }
  if (m < 4.5) {
    return ${v3(C.drift)} * (0.94 + 0.06 * nA);
  }
  if (m > 5.5 && m < 6.5) {
    let warp = skyNoise(vec3f(p.y * 0.08, p.z * 0.012, p.x * 0.012));
    let band = smoothstep(0.28, 0.72, fract(p.y * 0.075 + warp * 1.8));
    let strata = mix(${v3(C.wallBlue)}, ${v3(C.wallPale)}, band);
    let grit = skyNoise(p * 1.35);
    return strata * (0.90 + 0.10 * grit);
  }
  if (length(p - u.planet.xyz) < u.planet.w * 1.08) {
    let maria = skyNoise(p * 0.0016);
    return mix(${v3(C.planetShade)}, ${v3(C.planetPale)}, 0.35 + 0.65 * maria);
  }
  let snowLine = smoothstep(0.35, 0.82, p.y / 780.0);
  return mix(${v3(C.rock)}, ${v3(C.peak)}, snowLine) * (0.92 + 0.08 * nA);
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
