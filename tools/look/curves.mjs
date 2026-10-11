// not a colour: tone-curve coefficients
// ACES and AgX match Three.js tonemapping_pars_fragment (Zone B three.module.js).
// Matrices are columns, so `mul(M, c)` matches GLSL `mat3(col0, col1, col2) * color`.

const ACES_IN = [
  [0.59719, 0.35458, 0.04823],
  [0.07600, 0.90834, 0.01566],
  [0.02840, 0.13383, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];
const SRGB_TO_REC2020 = [
  [0.6274, 0.3293, 0.0433],
  [0.0691, 0.9195, 0.0880],
  [0.0164, 0.0113, 0.8956],
];
const REC2020_TO_SRGB = [
  [1.6605, -0.5876, -0.0728],
  [-0.1246, 1.1329, -0.1006],
  [-0.0182, -0.0083, 1.1187],
];
const AGX_INSET = [
  [0.856627153315983, 0.0951212405381588, 0.0482516061458583],
  [0.137318972929847, 0.761241990602591, 0.101439036467562],
  [0.11189821299995, 0.0767994186031903, 0.811302368396859],
];
const AGX_OUTSET = [
  [1.1271005818144368, -0.11060664309660323, -0.016493938717834573],
  [-0.1413297634984383, 1.157823702216272, -0.016493938717834257],
  [-0.14132976349843826, -0.11060664309660294, 1.2519364065950405],
];
const AGX_MIN_EV = -12.47393;
const AGX_MAX_EV = 4.026069;

function mul(m, c) {
  return [
    m[0][0] * c[0] + m[0][1] * c[1] + m[0][2] * c[2],
    m[1][0] * c[0] + m[1][1] * c[1] + m[1][2] * c[2],
    m[2][0] * c[0] + m[2][1] * c[1] + m[2][2] * c[2],
  ];
}
const sat = (c) => c.map((v) => Math.min(1, Math.max(0, v)));

function rrtOdt(v) {
  const a = v.map((x) => x * (x + 0.0245786) - 0.000090537);
  const b = v.map((x) => x * (0.983729 * x + 0.4329510) + 0.238081);
  return a.map((x, i) => x / b[i]);
}

export function aces(color, exposure = 1) {
  let c = color.map((v) => v * (exposure / 0.6));
  c = rrtOdt(mul(ACES_IN, c));
  return sat(mul(ACES_OUT, c));
}

function agxContrast(x) {
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

export function agx(color, exposure = 1) {
  let c = mul(SRGB_TO_REC2020, color).map((v) => Math.max(0, v) * exposure);
  c = mul(AGX_INSET, c).map((v) => Math.max(v, 1e-10));
  c = c.map((v) => Math.log2(v));
  c = c.map((v) => Math.min(1, Math.max(0, (v - AGX_MIN_EV) / (AGX_MAX_EV - AGX_MIN_EV))));
  c = mul(AGX_OUTSET, c.map(agxContrast));
  c = c.map((v) => Math.pow(Math.max(0, v), 2.2));
  return mul(REC2020_TO_SRGB, c);
}

export function srgbEncode(lin) {
  return lin.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055));
}

// Fullscreen filmic pass. Samples a linear scene (sRGB render target), writes display values.
export const FILMIC_FRAG = `precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tLut;
uniform sampler2D tBloom;
uniform float uExposure;
uniform float uCurve;
uniform float uLut;
uniform float uBloom;
uniform float uBloomOn;
uniform float uLutN;

vec3 rrt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesFilmic(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = ACESInputMat * color;
  color = rrt(color);
  color = ACESOutputMat * color;
  color = clamp(color, 0.0, 1.0);
  return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, color));
}
vec3 agxContrast(vec3 x) {
  vec3 x2 = x * x;
  vec3 x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}
vec3 agxFilmic(vec3 color) {
  const mat3 toRec = mat3(
    vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
  const mat3 toSrgb = mat3(
    vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
  const mat3 inset = mat3(
    vec3(0.856627153315983, 0.137318972929847, 0.11189821299995),
    vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903),
    vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(
    vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826),
    vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294),
    vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  const float minEv = -12.47393;
  const float maxEv = 4.026069;
  color = toRec * color;
  color *= uExposure;
  color = max(inset * color, vec3(1e-10));
  color = log2(color);
  color = clamp((color - minEv) / (maxEv - minEv), 0.0, 1.0);
  color = outset * agxContrast(color);
  color = pow(max(color, vec3(0.0)), vec3(2.2));
  return clamp(toSrgb * color, 0.0, 1.0);
}
vec3 lutLookup(vec3 c) {
  float n = uLutN;
  c = clamp(c, 0.0, 1.0);
  float b = c.b * (n - 1.0);
  float b0 = floor(b);
  float f = b - b0;
  float x0 = (b0 * n + c.r * (n - 1.0) + 0.5) / (n * n);
  float x1 = (min(b0 + 1.0, n - 1.0) * n + c.r * (n - 1.0) + 0.5) / (n * n);
  float y = (c.g * (n - 1.0) + 0.5) / n;
  vec3 a = texture(tLut, vec2(x0, y)).rgb;
  vec3 d = texture(tLut, vec2(x1, y)).rgb;
  return mix(a, d, f);
}
void main() {
  vec3 lin = texture(tScene, vUv).rgb;
  vec3 disp = uCurve < 0.5 ? acesFilmic(lin) : agxFilmic(lin);
  vec3 graded = mix(disp, lutLookup(disp), uLut);
  vec3 bloom = uBloomOn > 0.5 ? texture(tBloom, vUv).rgb : vec3(0.0);
  outColor = vec4(clamp(graded + bloom * uBloom, 0.0, 1.0), 1.0);
}
`;

export const BLOOM_FRAG = `precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform float uThreshold;
uniform float uMode;
uniform vec2 uTexel;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); } // not a colour: Rec.709 luma weights
void main() {
  if (uMode < 0.5) {
    vec3 c = texture(tSrc, vUv).rgb;
    float y = luma(c);
    outColor = vec4(y > uThreshold ? c : vec3(0.0), 1.0);
  } else {
    vec3 s = vec3(0.0);
    float w = 0.0;
    for (int i = -2; i <= 2; i++) {
      float k = 1.0 - abs(float(i)) * 0.2;
      vec2 o = uMode < 1.5 ? vec2(uTexel.x * float(i), 0.0) : vec2(0.0, uTexel.y * float(i));
      s += texture(tSrc, vUv + o).rgb * k;
      w += k;
    }
    outColor = vec4(s / w, 1.0);
  }
}
`;

const isMain = typeof process !== "undefined" && process.argv[1] && process.argv[1].endsWith("curves.mjs");
if (isMain) {
  const a = srgbEncode(aces([0.18, 0.18, 0.18], 1));
  const g = agx([0.18, 0.18, 0.18], 1);
  if (a.some((v) => !Number.isFinite(v)) || g.some((v) => !Number.isFinite(v))) process.exit(1);
  process.stdout.write(JSON.stringify({ aces: a, agx: g }) + "\n");
}
