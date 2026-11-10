// Shared material shade. The canyon page and the swatch import this.
// The NIGHT rig is one set of values for every material. Crystal spec stays dielectric.
import { TILE_M } from '../crystal/materials.js';
import { NIGHT, nightWgsl } from './night-rig.js';

export const SHADE = {
  ambient: NIGHT.ambient.rgb,
  sun: NIGHT.moon.intensity,
  moon: NIGHT.moon.rgb,
  flatScale: NIGHT.flatScale,
  specPower: 56,
  crystalSpec: 0.06,
  waterSpec: 0.45,
  waterFresnelDark: 0.55,
  waterFresnelMix: 0.4,
};

export const WATER_WAVE = {
  ax: 0.05,
  fx: 2.2,
  ox: 0.9,
  az: 0.11,
  fz: 1.35,
  oz: 1.25,
};

export function scaleLiteral(metres) {
  return (1 / metres).toFixed(8);
}

export function tileScales() {
  const out = {};
  for (const [key, metres] of Object.entries(TILE_M)) out[key] = scaleLiteral(metres);
  return out;
}

export function shadeFns() {
  return `
fn sunN() -> vec3f { return normalize(u.sun.xyz); }
${nightWgsl()}
fn triMix(sx: vec3f, sy: vec3f, sz: vec3f, n: vec3f) -> vec3f {
  // One projection. A blended second axis is edge-on and smears the photo into streaks.
  let an = abs(n);
  if (an.x >= an.y && an.x >= an.z) { return sx; }
  if (an.y >= an.z) { return sy; }
  return sz;
}
fn present(c: vec3f) -> vec4f {
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
fn shadeAlb(alb: vec3f, n: vec3f, view: vec3f, specW: f32) -> vec3f {
  let spec = pow(clamp(dot(n, normalize(sunN() + view)), 0.0, 1.0), ${SHADE.specPower}.0);
  return alb * nightIrr(n) + alb * spec * specW;
}
fn waterN(p: vec3f, t: f32) -> vec3f {
  let dydx = ${WATER_WAVE.ax} * ${WATER_WAVE.fx} * cos(p.x * ${WATER_WAVE.fx} - t * ${WATER_WAVE.ox});
  let dydz = ${WATER_WAVE.az} * ${WATER_WAVE.fz} * cos(p.z * ${WATER_WAVE.fz} + t * ${WATER_WAVE.oz});
  return normalize(vec3f(-dydx, 1.0, -dydz));
}
`;
}
