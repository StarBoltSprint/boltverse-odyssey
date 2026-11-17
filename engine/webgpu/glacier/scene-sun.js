// Scene sun for the planet only. E's fixed direction, elevation 34 deg.
// The dawn rig in dawn-light.json is not this vector and is not edited here.
import light from './dawn-light.json' with { type: 'json' };

export const SCENE_SUN = Object.freeze([0.6161, 0.5592, 0.5547]);

const AMB = light.ambient.rgb;
const SUN_RGB = light.sun.rgb;
const SUN_I = light.sun.intensity;

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// CPU twin of planetShade in the shader. Linear light, before present().
export function planetLinear(alb, ndl, ndv) {
  const day = Math.min(1, Math.max(0, ndl));
  const irr = AMB.map((a, i) => a * 0.28 + SUN_RGB[i] * SUN_I * 1.55 * day);
  const mu = Math.pow(Math.max(0, ndv), 0.45);
  const body = alb.map((a, i) => a * irr[i] * (0.78 + 0.22 * mu));
  const rim = Math.pow(1 - Math.max(0, Math.min(1, ndv)), 1.6);
  const lit = Math.min(1, Math.max(0, day * 0.6 + 0.55));
  const atmo = [0.62, 0.78, 0.98].map((c) => c * rim * lit * 0.8);
  return body.map((b, i) => Math.min(0.92, b + atmo[i]));
}

export function sceneSunWgsl() {
  const s = SCENE_SUN;
  return `
fn sceneSun() -> vec3f { return vec3f(${s[0]}, ${s[1]}, ${s[2]}); }
fn planetShade(alb: vec3f, n: vec3f, view: vec3f) -> vec3f {
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let ndl = dot(n, sceneSun());
  let day = clamp(ndl, 0.0, 1.0);
  let irr = vec3f(${AMB[0]}, ${AMB[1]}, ${AMB[2]}) * 0.28 + vec3f(${SUN_RGB[0]}, ${SUN_RGB[1]}, ${SUN_RGB[2]}) * (${SUN_I} * 1.55 * day);
  let mu = pow(max(ndv, 0.0), 0.45);
  let body = alb * irr * mix(0.78, 1.0, mu);
  let rim = pow(1.0 - ndv, 1.6);
  let lit = clamp(day * 0.6 + 0.55, 0.0, 1.0);
  let atmo = vec3f(0.62, 0.78, 0.98) * rim * lit * 0.8;
  return min(body + atmo, vec3f(0.92));
}
`;
}
