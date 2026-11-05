// engine/postfx.js — reusable screen-space post (house WebGPU): sun god rays + cinematic grade.
// cfg: { rays (strength), raySteps, rayDecay, rayTint, sat, contrast, lift, shadowTint, highTint, vignette }
export const POST_DEFAULT = { rays: 0.32, raySteps: 14, rayDecay: 0.93, rayTint: [1.0, 0.90, 0.70], sat: 1.07, contrast: 1.04, lift: 0.006,
  shadowTint: [0.96, 1.0, 1.05], highTint: [1.04, 1.0, 0.94], vignette: 0.86 };
const f = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const v3 = (a) => `vec3f(${a.map(f).join(', ')})`;
export function makePost(user) {
  const c = { ...POST_DEFAULT, ...user };
  const wgsl = /* wgsl */`
// ---- engine/postfx.js
fn sunUV() -> vec3f { let s = u.vp * vec4f(u.cam.xyz + u.sun.xyz * 1000.0, 1.0); if (s.w <= 0.0) { return vec3f(0.0, 0.0, -1.0); }
  let n = s.xy / s.w; return vec3f(n.x * 0.5 + 0.5, 0.5 - n.y * 0.5, 1.0); }
fn godRays(uv: vec2f, tB: texture_2d<f32>, tD: texture_depth_multisampled_2d, dim: vec2f) -> vec3f { // radial march toward the sun over sky-only bright pixels
  let s = sunUV(); if (s.z < 0.0) { return vec3f(0.0); }
  let d = (s.xy - uv) / f32(${c.raySteps}); var p = uv; var w = 1.0; var acc = vec3f(0.0);
  for (var i = 0; i < ${c.raySteps}; i++) { p += d; if (any(p < vec2f(0.0)) || any(p > vec2f(1.0))) { break; }
    let sky = select(0.0, 1.0, textureLoad(tD, vec2i(p * dim), 0) >= 0.99999);
    acc += textureSampleLevel(tB, ls, p, 0.0).rgb * sky * w; w *= ${f(c.rayDecay)}; }
  let fall = 1.0 - smoothstep(0.0, 0.9, length((s.xy - uv) * vec2f(1.0, dim.y / dim.x)));
  return acc / f32(${c.raySteps}) * ${v3(c.rayTint)} * ${f(c.rays)} * 4.0 * fall; }
fn gradeAAA(x0: vec3f, uv: vec2f, dim: vec2f) -> vec3f { var x = x0;
  let l = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  x = mix(vec3f(l), x, ${f(c.sat)});
  x = (x - 0.18) * ${f(c.contrast)} + 0.18; x = max(x, vec3f(0.0)) + ${f(c.lift)};
  x = x * mix(${v3(c.shadowTint)}, ${v3(c.highTint)}, smoothstep(0.05, 0.6, l));
  let vg = length((uv - 0.5) * vec2f(1.0, dim.y / dim.x * 0.6)); x *= mix(1.0, ${f(c.vignette)}, smoothstep(0.35, 0.95, vg));
  return x; }
`;
  return { cfg: c, wgsl };
}
