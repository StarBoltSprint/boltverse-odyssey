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
// Linear scene colour into the rgba16float target. The grade pass owns exposure,
// the tone map, and the sRGB OETF. Nothing here clamps highlights to 1.
fn present(c: vec3f) -> vec4f {
  return vec4f(max(c, vec3f(0.0)), 1.0);
}
`;
}

// Exact IEC 61966-2-1 piecewise sRGB. The grade pass is the only OETF.
export function srgbEotf(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function srgbOetf(c) {
  const x = Math.max(0, c);
  return x <= 0.0031308 ? 12.92 * x : 1.055 * (x ** (1 / 2.4)) - 0.055;
}

const MIN_EV = -12.47393;
const MAX_EV = 4.026069;

function mulCols(cols, v) {
  return [
    cols[0][0] * v[0] + cols[1][0] * v[1] + cols[2][0] * v[2],
    cols[0][1] * v[0] + cols[1][1] * v[1] + cols[2][1] * v[2],
    cols[0][2] * v[0] + cols[1][2] * v[1] + cols[2][2] * v[2],
  ];
}

const SRGB_TO_2020 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const R2020_TO_SRGB = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const AGX_INSET = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const AGX_OUTSET = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];

function agxContrast(x) {
  const x2 = x * x;
  const x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

// AgX base (inset, log, sigmoid, outset, 2.2 back to linear). No look transform.
// Returns display-linear in 0..1. The caller applies the sRGB OETF.
export function tonemapAgx(color, exposure) {
  let c = color.map((v) => Math.max(0, v) * exposure);
  c = mulCols(SRGB_TO_2020, c);
  c = mulCols(AGX_INSET, c);
  c = c.map((v) => Math.log2(Math.max(v, 1e-10)));
  c = c.map((v) => Math.min(1, Math.max(0, (v - MIN_EV) / (MAX_EV - MIN_EV))));
  c = c.map(agxContrast);
  c = mulCols(AGX_OUTSET, c);
  c = c.map((v) => Math.max(0, v) ** 2.2);
  c = mulCols(R2020_TO_SRGB, c);
  return c.map((v) => Math.min(1, Math.max(0, v)));
}

// Krzysztof Narkowicz's rational fit of the ACES filmic curve, per channel.
// Output is display-linear. The sRGB OETF is separate.
export function tonemapAces(color, exposure) {
  return color.map((x0) => {
    const x = Math.max(0, x0) * exposure;
    const t = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
    return Math.min(1, Math.max(0, t));
  });
}

// Khronos PBR Neutral. Hue stays until the peak compresses. Output is display-linear.
export function tonemapNeutral(color, exposure) {
  let c = color.map((v) => Math.max(0, v) * exposure);
  const x = Math.min(c[0], c[1], c[2]);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c = c.map((v) => v - offset);
  const peak = Math.max(c[0], c[1], c[2]);
  const start = 0.76;
  if (peak < start) return c.map((v) => Math.max(0, v));
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  const g = 1 - 1 / (0.15 * (peak - newPeak) + 1);
  return c.map((v) => Math.max(0, (v * newPeak) / peak * (1 - g) + newPeak * g));
}

export const TONEMAPS = {
  agx: tonemapAgx,
  aces: tonemapAces,
  neutral: tonemapNeutral,
};

export function exposureOf(light) {
  return 2 ** (light.exposureEv || 0);
}

export function gradeLinear(rgb, light) {
  const op = TONEMAPS[light.tonemap] || tonemapNeutral;
  return op(rgb, exposureOf(light)).map(srgbOetf);
}

function mat3(cols) {
  return `mat3x3f(vec3f(${cols[0].join(', ')}), vec3f(${cols[1].join(', ')}), vec3f(${cols[2].join(', ')}))`;
}

// Fullscreen grade. One present pass, not a world draw. Reads the rgba16float
// scene and writes exact sRGB. Diagnostic modes skip the filmic curve:
// material ids pass through, albedo probes are sRGB of the linear sample.
export function gradeWgsl(light) {
  const ev = light.exposureEv || 0;
  const which = light.tonemap === 'agx' ? 0 : light.tonemap === 'aces' ? 1 : 2;
  return `
struct U {
  vp: mat4x4f, ivp: mat4x4f, cam: vec4f, bolt: vec4f, bp: vec4f, grid: vec4f, sun: vec4f, misc: vec4f, spin: vec4f, planet: vec4f,
  prints: array<vec4f, 12>,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var hdrTex: texture_2d<f32>;

fn srgbOetf1(c: f32) -> f32 {
  let x = max(c, 0.0);
  if (x <= 0.0031308) { return x * 12.92; }
  return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}
fn srgbOetf(c: vec3f) -> vec3f {
  return vec3f(srgbOetf1(c.r), srgbOetf1(c.g), srgbOetf1(c.b));
}
fn agxContrast(x: vec3f) -> vec3f {
  let x2 = x * x;
  let x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
fn tonemapAgx(color: vec3f) -> vec3f {
  var c = color;
  c = ${mat3(SRGB_TO_2020)} * c;
  c = ${mat3(AGX_INSET)} * c;
  c = log2(max(c, vec3f(1e-10)));
  c = clamp((c - vec3f(${MIN_EV})) / vec3f(${MAX_EV - MIN_EV}), vec3f(0.0), vec3f(1.0));
  c = agxContrast(c);
  c = ${mat3(AGX_OUTSET)} * c;
  c = pow(max(c, vec3f(0.0)), vec3f(2.2));
  c = ${mat3(R2020_TO_SRGB)} * c;
  return clamp(c, vec3f(0.0), vec3f(1.0));
}
fn tonemapAces(color: vec3f) -> vec3f {
  let x = max(color, vec3f(0.0));
  let t = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return clamp(t, vec3f(0.0), vec3f(1.0));
}
fn tonemapNeutral(color: vec3f) -> vec3f {
  var c = max(color, vec3f(0.0));
  let x = min(c.r, min(c.g, c.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  c = c - vec3f(offset);
  let peak = max(c.r, max(c.g, c.b));
  if (peak < 0.76) { return max(c, vec3f(0.0)); }
  let d = 0.24;
  let newPeak = 1.0 - d * d / (peak + d - 0.76);
  c = c * (newPeak / peak);
  let g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return max(mix(c, vec3f(newPeak), g), vec3f(0.0));
}
fn tonemap(color: vec3f) -> vec3f {
  if (${which} == 0) { return tonemapAgx(color); }
  if (${which} == 1) { return tonemapAces(color); }
  return tonemapNeutral(color);
}

@vertex fn vsGrade(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var q = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(q[vi], 0.0, 1.0);
}
@fragment fn fsGrade(@builtin(position) p: vec4f) -> @location(0) vec4f {
  let c = max(textureLoad(hdrTex, vec2i(p.xy), 0).rgb, vec3f(0.0));
  let mode = u.misc.z;
  let iso = u.sun.w;
  if (mode > 0.5 && mode < 1.5) {
    return vec4f(clamp(c, vec3f(0.0), vec3f(1.0)), 1.0);
  }
  if (mode > 1.5 || (iso > 29.5 && iso < 37.5)) {
    return vec4f(srgbOetf(clamp(c, vec3f(0.0), vec3f(1.0))), 1.0);
  }
  return vec4f(srgbOetf(tonemap(c * ${exposureOf({ exposureEv: ev })})), 1.0);
}
`;
}
