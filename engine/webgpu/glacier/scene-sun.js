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
  const day = smoothstep(-0.05, 0.12, ndl);
  const irr = AMB.map((a, i) => a + SUN_RGB[i] * SUN_I * day);
  const mu = Math.pow(Math.max(0, ndv), 0.6);
  const body = alb.map((a, i) => a * irr[i] * (0.42 + 0.58 * mu));
  const rim = Math.pow(1 - Math.max(0, Math.min(1, ndv)), 3.6);
  const lit = Math.min(1, Math.max(0, ndl * 0.65 + 0.35));
  const atmo = [0.42, 0.58, 0.82].map((c) => c * rim * lit * 0.48);
  return body.map((b, i) => Math.min(0.92, b + atmo[i]));
}

export function sceneSunWgsl() {
  const s = SCENE_SUN;
  return `
fn sceneSun() -> vec3f { return vec3f(${s[0]}, ${s[1]}, ${s[2]}); }
fn planetShade(alb: vec3f, n: vec3f, view: vec3f) -> vec3f {
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let ndl = dot(n, sceneSun());
  let day = smoothstep(-0.05, 0.12, ndl);
  let irr = vec3f(${AMB[0]}, ${AMB[1]}, ${AMB[2]}) + vec3f(${SUN_RGB[0]}, ${SUN_RGB[1]}, ${SUN_RGB[2]}) * (${SUN_I} * day);
  let mu = pow(max(ndv, 0.0), 0.6);
  let body = alb * irr * mix(0.42, 1.0, mu);
  let rim = pow(1.0 - ndv, 3.6);
  let lit = clamp(ndl * 0.65 + 0.35, 0.0, 1.0);
  let atmo = vec3f(0.42, 0.58, 0.82) * rim * lit * 0.48;
  return min(body + atmo, vec3f(0.92));
}
`;
}
