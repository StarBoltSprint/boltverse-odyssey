// Shared material shade. Numbers stay the canyon shade. A page imports this string.
// Tile scale is per biome. This file does not import a biome.

export const SHADE = {
  ambient: 0.10,
  sun: 0.90,
  specPower: 56,
  crystalSpec: 0.06,
  waterSpec: 0.45,
  waterFresnelDark: 0.55,
  waterFresnelMix: 0.4,
};

export function scaleLiteral(metres) {
  if (!(metres > 0)) throw new Error('missing scale');
  return (1 / metres).toFixed(8);
}

export function shadeFns() {
  return `
fn sunN() -> vec3f { return normalize(u.sun.xyz); }
fn triMix(sx: vec3f, sy: vec3f, sz: vec3f, n: vec3f) -> vec3f {
  let bn = abs(n); let b = bn / (bn.x + bn.y + bn.z + 1e-4);
  return sx * b.x + sy * b.y + sz * b.z;
}
fn present(c: vec3f) -> vec4f {
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
fn shadeAlb(alb: vec3f, n: vec3f, view: vec3f, specW: f32) -> vec3f {
  let ndl = clamp(dot(n, sunN()), 0.0, 1.0);
  let spec = pow(clamp(dot(n, normalize(sunN() + view)), 0.0, 1.0), ${SHADE.specPower}.0);
  return alb * (${SHADE.ambient} + ${SHADE.sun} * ndl) + alb * spec * specW;
}
`;
}
