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

// CPU twin of planetShade. No output clamp.
// The sun-facing silhouette is darkened and tinted so crater highlights stay
// under the lit-disc p99. That factor is zero on the N·L ≈ 0 band.
// A blue lift runs across that band only, then dies before the deep night limb.
// The shell is a few percent of the radius and is gone on deep night.
export function planetLinear(alb, ndl, ndv) {
  const day = Math.min(1, Math.max(0, ndl));
  const irr = AMB.map((a, i) => a * 0.28 + SUN_RGB[i] * SUN_I * 1.55 * day);
  const mu = Math.pow(Math.max(0, ndv), 0.45);
  const body0 = alb.map((a, i) => a * irr[i] * (0.78 + 0.22 * mu));
  const fall = smoothstep(0.84, 0.62, ndv);
  const sunSide = smoothstep(0.40, 0.62, ndl);
  const limbDim = fall * sunSide;
  const tint = [0.84, 0.92, 1];
  const body = body0.map((b, i) => (b * (1 - limbDim) + b * tint[i] * limbDim) * (1 - 0.62 * limbDim));
  const along = smoothstep(-0.18, 0.16, ndl) * Math.exp(-Math.max(ndl - 0.12, 0) * 10);
  const lift = [0.26, 0.38, 0.58].map((c) => c * along);
  const shell = Math.pow(1 - Math.max(0, Math.min(1, ndv)), 12);
  const rimW = smoothstep(-0.15, 0.08, ndl) * Math.exp(-Math.max(ndl - 0.2, 0) * 5);
  const rim = [0.12, 0.28, 0.62].map((c) => c * shell * rimW);
  return body.map((b, i) => b + lift[i] + rim[i]);
}

export function sceneSunWgsl() {
  const s = SCENE_SUN;
  return `
fn sceneSun() -> vec3f { return vec3f(${s[0]}, ${s[1]}, ${s[2]}); }
fn planetShade(alb: vec3f, n: vec3f, view: vec3f) -> vec3f {
  let ndv = clamp(dot(n, view), 0.0, 1.0);
  let ndl = dot(n, sceneSun());
  let irr = vec3f(${AMB[0]}, ${AMB[1]}, ${AMB[2]}) * 0.28 + vec3f(${SUN_RGB[0]}, ${SUN_RGB[1]}, ${SUN_RGB[2]}) * (${SUN_I} * 1.55 * clamp(ndl, 0.0, 1.0));
  let mu = pow(max(ndv, 0.0), 0.45);
  let body0 = alb * irr * mix(0.78, 1.0, mu);
  let fall = smoothstep(0.84, 0.62, ndv);
  let sunSide = smoothstep(0.40, 0.62, ndl);
  let limbDim = fall * sunSide;
  let tinted = body0 * vec3f(0.84, 0.92, 1.0);
  let body = mix(body0, tinted, limbDim) * (1.0 - 0.62 * limbDim);
  let along = smoothstep(-0.18, 0.16, ndl) * exp(-max(ndl - 0.12, 0.0) * 10.0);
  let lift = vec3f(0.26, 0.38, 0.58) * along;
  let shell = pow(1.0 - ndv, 12.0);
  let rimW = smoothstep(-0.15, 0.08, ndl) * exp(-max(ndl - 0.2, 0.0) * 5.0);
  let rim = vec3f(0.12, 0.28, 0.62) * shell * rimW;
  return body + lift + rim;
}
`;
}
