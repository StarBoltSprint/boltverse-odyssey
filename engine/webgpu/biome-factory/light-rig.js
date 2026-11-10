// One light record for every material in a biome. Same shape as night-light.json.
// Numbers come from the biome file. They are not fitted per texture.

export function luma(rgb) {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

export function sunOf(light) {
  return light.sun || light.moon;
}

export function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Linear irradiance. ny = 1 is a flat face. ny = 0 is a vertical face.
export function shadeAt(light, ndl, ny = 0) {
  const n = clamp01(ndl);
  const up = clamp01(ny);
  const face = 1 + (light.flatScale - 1) * up * up;
  const sun = sunOf(light);
  const rgb = light.ambient.rgb.map((a, i) => a + sun.rgb[i] * sun.intensity * n * face);
  return { rgb, luma: luma(rgb) };
}

function v3(a) {
  return `vec3f(${a[0]}, ${a[1]}, ${a[2]})`;
}

export function lightWgsl(light) {
  const sun = sunOf(light);
  const dir = norm3(sun.direction);
  return `
fn sunN() -> vec3f { return normalize(vec3f(${dir[0]}, ${dir[1]}, ${dir[2]})); }
fn dawnIrr(n: vec3f) -> vec3f {
  let ndl = clamp(dot(n, sunN()), 0.0, 1.0);
  let up = clamp(n.y, 0.0, 1.0);
  let face = mix(1.0, ${light.flatScale}, up * up);
  return ${v3(light.ambient.rgb)} + ${v3(sun.rgb)} * (${sun.intensity} * ndl * face);
}
fn present(c: vec3f) -> vec4f {
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)), 1.0);
}
`;
}
