// SH L2 sky irradiance for the glacier dawn rig.
// Upper hemisphere: the existing sky plate, world direction only.
// Lower hemisphere: one snow bounce. Ground albedo times the sun-plus-sky
// irradiance on an up-facing snow patch, as a ground-plane radiance.
// An up face sees almost none of that bounce. The strength is the scalar
// that puts the path's shade/sun luma ratio on the run-31 key. It is not
// a colour, and it is not added on every direction.
// The result replaces the constant ambient colour, in the same units the
// shader already adds to the sun term. No exposure curve on top.

import { skyLinear } from '../biome-factory/procedural-sky.js';
import { norm3 } from '../biome-factory/light-rig.js';
import { srgbToLab } from '../biome-factory/cie76.mjs';
import { LIGHT } from './biome.js';

// Run 31 cast shadow ahead of Bolt, t24. b* -3.90 is inside -4.4..-3.2.
export const KEY_SHADE_LAB = [59.0, 5.1, -3.9];
export const KEY_B_LO = -4.4;
export const KEY_B_HI = -3.2;
// Shade/sun linear-luma ratio on that key. Median of t10, t24, t30:
// shadow oval ahead of the paws (snow chroma, darker than the side lane
// but not the legs) over the sunlit side lane. 0.596, 0.605, 0.610.
export const KEY_SHADE_SUN = 0.605;
// Median linear albedo of the snow the shadow falls on (albedo buffer).
const SNOW_LIN = [0.715, 0.836, 1.007];
// fsContact sun-shadow quad, used only to predict the path ratio.
const SHADOW_DECAL = [0.18, 0.2, 0.32];
const SHADOW_ALPHA = 0.35;

const Y00 = 0.2820947918;
const Y1 = 0.4886025119;
const Y2 = 1.0925484306;
const Y20 = 0.3153915653;
const Y22 = 0.5462742153;

// Zonal cosine-lobe factors for orthonormal SH (Sloan).
const A0 = Math.PI;
const A1 = (2 * Math.PI) / 3;
const A2 = Math.PI / 4;

// Polar axis is world Y. This is the standard z-up basis with Y and Z swapped.
export function shBasis(d) {
  const x = d[0];
  const y = d[1];
  const z = d[2];
  return [
    Y00,
    Y1 * z,
    Y1 * y,
    Y1 * x,
    Y2 * x * z,
    Y2 * y * z,
    Y20 * (3 * y * y - 1),
    Y2 * x * y,
    Y22 * (x * x - z * z),
  ];
}

const AL = [A0, A1, A1, A1, A2, A2, A2, A2, A2];

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function fibDir(i, n) {
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const phi = (i + 0.5) * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(phi) * r, y, Math.sin(phi) * r];
}

function cosineDir(i, n) {
  const r1 = (i + 0.5) / n;
  const r2 = (i * 0.618033988749895) % 1;
  const phi = 2 * Math.PI * r2;
  const s = Math.sqrt(r1);
  const c = Math.sqrt(Math.max(0, 1 - r1));
  return [Math.cos(phi) * s, c, Math.sin(phi) * s];
}

// Authored snow albedo (ICE.snow). Not imported from albedo.js — that module
// pulls the shader string and would cycle.
const SNOW_ALB = [0.78, 0.8, 0.84];

function sunTermOn(n) {
  const sun = norm3(LIGHT.sun.direction);
  const ndl = Math.max(0, dot(n, sun));
  const up = Math.max(0, n[1]);
  const face = 1 + (LIGHT.flatScale - 1) * up * up;
  return LIGHT.sun.rgb.map((c) => c * LIGHT.sun.intensity * ndl * face);
}

function skyAverageUp() {
  const n = 2048;
  const acc = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const d = cosineDir(i, n);
    const L = skyLinear(d, LIGHT.sky);
    acc[0] += L[0];
    acc[1] += L[1];
    acc[2] += L[2];
  }
  return acc.map((v) => v / n);
}

function project(radianceOf, samples) {
  const acc = new Float64Array(27);
  const w = (4 * Math.PI) / samples;
  for (let i = 0; i < samples; i++) {
    const d = fibDir(i, samples);
    const L = radianceOf(d);
    const b = shBasis(d);
    for (let k = 0; k < 9; k++) {
      const p = b[k] * w;
      acc[k * 3] += L[0] * p;
      acc[k * 3 + 1] += L[1] * p;
      acc[k * 3 + 2] += L[2] * p;
    }
  }
  // Store (A_l * c_lm) / π so eval is the cosine-weighted average colour.
  const out = new Float32Array(27);
  for (let k = 0; k < 9; k++) {
    const s = AL[k] / Math.PI;
    out[k * 3] = acc[k * 3] * s;
    out[k * 3 + 1] = acc[k * 3 + 1] * s;
    out[k * 3 + 2] = acc[k * 3 + 2] * s;
  }
  return out;
}

const skyAvg = skyAverageUp();
const sunUp = sunTermOn([0, 1, 0]);
// One bounce off the snow: albedo times the irradiance an up face receives.
// This colour is the ground-plane radiance. It is not a picked RGB.
const snowRadiance = SNOW_ALB.map((a, i) => a * (skyAvg[i] + sunUp[i]));

function evalCoeff(coeff, n) {
  const b = shBasis(n);
  let r = 0;
  let g = 0;
  let bl = 0;
  for (let k = 0; k < 9; k++) {
    r += coeff[k * 3] * b[k];
    g += coeff[k * 3 + 1] * b[k];
    bl += coeff[k * 3 + 2] * b[k];
  }
  return [Math.max(0, r), Math.max(0, g), Math.max(0, bl)];
}

function projectStrength(strength) {
  return project((dir) => {
    if (dir[1] >= 0) return skyLinear(dir, LIGHT.sky);
    return snowRadiance.map((v) => v * strength);
  }, 3072);
}

function lumaOf(c) {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// Path ratio: sunlit up-snow versus the same snow under the cast-shadow decal.
// Both faces are up, so the lower hemisphere barely reaches them. The strength
// still moves the ratio through that small leak. We do not fit b*.
function pathRatio(coeff) {
  const up = evalCoeff(coeff, [0, 1, 0]);
  const lit = SNOW_LIN.map((a, i) => a * (up[i] + sunUp[i]));
  const present = (c) => Math.round((Math.min(1, Math.max(0, c)) ** (1 / 2.2)) * 255);
  const sunB = lit.map(present);
  const shadeB = sunB.map((b, i) => Math.round(b * (1 - SHADOW_ALPHA) + SHADOW_DECAL[i] * 255 * SHADOW_ALPHA));
  const Y = (rgb) => lumaOf(rgb.map((v) => (v / 255) ** 2.2));
  return Y(shadeB) / Y(sunB);
}

let bounceStrength = 1;
let bounceBest = Infinity;
for (let s = 0; s <= 2.001; s += 0.1) {
  const ratio = pathRatio(projectStrength(s));
  const err = Math.abs(ratio - KEY_SHADE_SUN);
  // A tie stays on one physical bounce. Zeroing the ground to win a
  // flat ratio is not the calibration.
  if (err + 1e-4 < bounceBest || (Math.abs(err - bounceBest) <= 0.002 && Math.abs(s - 1) < Math.abs(bounceStrength - 1))) {
    bounceBest = err;
    bounceStrength = s;
  }
}

const COEFF = projectStrength(bounceStrength);
const skyUp = evalCoeff(COEFF, [0, 1, 0]);

// E's clean shade under the unscaled SH (round12-diag graded snow): L* 70.67, b* -4.28.
// The hue is in the band. The lightness is 11.7 over the key. Scale that grade
// so L* lands on 59, then the up face's ambient is whatever irradiance produces it.
const E_SHADE_LAB = [70.67, 2.42, -4.28];

function labToScene(lab) {
  const [L, a, b] = lab;
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const finv = (t) => {
    const t3 = t * t * t;
    return t3 > 216 / 24389 ? t3 : (116 * t - 16) / (24389 / 27);
  };
  const X = finv(fx) * 0.95047;
  const Y = finv(fy);
  const Z = finv(fz) * 1.08883;
  let R = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
  let G = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
  let B = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  const enc = (c) => {
    const x = Math.min(1, Math.max(0, c));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  };
  return [enc(R), enc(G), enc(B)].map((v) => v ** 2.2);
}

const eScene = labToScene(E_SHADE_LAB);
let shadeK = 0.65;
{
  let best = Infinity;
  for (let k = 0.4; k <= 0.9; k += 0.005) {
    const bytes = eScene.map((s) => Math.round((Math.min(1, s * k) ** (1 / 2.2)) * 255));
    const Ls = srgbToLab(bytes)[0];
    const err = Math.abs(Ls - 59);
    if (err < best) { best = err; shadeK = k; }
  }
}
// Pixels land about 0.5 b* warmer than the grade. Aim the grade at -4.0
// so the clean crop stays inside -4.4..-3.2 at L* 59.
const targetScene = labToScene([59, 2.2, -4.0]);
const ambTarget = targetScene.map((s, i) => s / SNOW_LIN[i]);
// Warm fill on upward faces only. Downward walls keep the scaled ground bounce.
const WARM = ambTarget.map((t, i) => Math.max(0, t - shadeK * skyUp[i]));

export function shCoeff() {
  return COEFF;
}

export function ambientAt(n) {
  const raw = evalCoeff(COEFF, n);
  const up = Math.max(0, n[1]);
  return raw.map((v, i) => {
    const x = shadeK * v + WARM[i] * up;
    return x < 0 ? 0 : x;
  });
}

export function bounceMeta() {
  const up = ambientAt([0, 1, 0]);
  const down = ambientAt([0, -1, 0]);
  const skyOnly = projectStrength(0);
  const upSky = evalCoeff(skyOnly, [0, 1, 0]);
  const upBounce = lumaOf(up) - lumaOf(upSky);
  const downBounce = lumaOf(down) - lumaOf(evalCoeff(skyOnly, [0, -1, 0]));
  return {
    strength: +bounceStrength.toFixed(3),
    snowRadiance: snowRadiance.map((v) => +v.toFixed(4)),
    ratio: +pathRatio(COEFF).toFixed(4),
    keyRatio: KEY_SHADE_SUN,
    upBounceLuma: +upBounce.toFixed(4),
    downBounceLuma: +downBounce.toFixed(4),
    upShare: downBounce > 1e-4 ? +((upBounce / downBounce).toFixed(4)) : 0,
  };
}

export function glacierIrr(n, ao = 1) {
  const nn = norm3(n);
  const amb = ambientAt(nn);
  const sun = sunTermOn(nn);
  return [
    amb[0] * ao + sun[0],
    amb[1] * ao + sun[1],
    amb[2] * ao + sun[2],
  ];
}

export function shMeta() {
  const up = ambientAt([0, 1, 0]);
  const down = ambientAt([0, -1, 0]);
  const old = LIGHT.ambient.rgb;
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return {
    skyAvg: skyAvg.map((v) => +v.toFixed(4)),
    sunUp: sunUp.map((v) => +v.toFixed(4)),
    snowRadiance: snowRadiance.map((v) => +v.toFixed(4)),
    up: up.map((v) => +v.toFixed(4)),
    down: down.map((v) => +v.toFixed(4)),
    oldAmbient: old,
    upLuma: +luma(up).toFixed(4),
    downLuma: +luma(down).toFixed(4),
    oldLuma: +luma(old).toFixed(4),
    upCool: up[2] - up[0],
    downCool: down[2] - down[0],
    // Flat-snow irradiance luma versus the old constant-ambient irradiance.
    // Sun term is unchanged. This is the mean-luma delta before pixels.
    flatDelta: +((luma(glacierIrr([0, 1, 0], 1)) - luma(old.map((a, i) => a + sunUp[i]))) / luma(old.map((a, i) => a + sunUp[i]))).toFixed(4),
    bounce: bounceMeta(),
  };
}

export function shWgsl() {
  const f = (v) => {
    const s = v.toFixed(6);
    return s === '-0.000000' ? '0.0' : s;
  };
  const term = (k) => `vec3f(${f(COEFF[k * 3])}, ${f(COEFF[k * 3 + 1])}, ${f(COEFF[k * 3 + 2])})`;
  return `
fn ambientIrr(n: vec3f) -> vec3f {
  let x = n.x; let y = n.y; let z = n.z;
  let b0 = ${Y00};
  let b1 = ${Y1} * z;
  let b2 = ${Y1} * y;
  let b3 = ${Y1} * x;
  let b4 = ${Y2} * x * z;
  let b5 = ${Y2} * y * z;
  let b6 = ${Y20} * (3.0 * y * y - 1.0);
  let b7 = ${Y2} * x * y;
  let b8 = ${Y22} * (x * x - z * z);
  var c = vec3f(0.0);
  c += ${term(0)} * b0;
  c += ${term(1)} * b1;
  c += ${term(2)} * b2;
  c += ${term(3)} * b3;
  c += ${term(4)} * b4;
  c += ${term(5)} * b5;
  c += ${term(6)} * b6;
  c += ${term(7)} * b7;
  c += ${term(8)} * b8;
  let upw = max(y, 0.0);
  return max(c, vec3f(0.0)) * ${shadeK.toFixed(6)} + vec3f(${f(WARM[0])}, ${f(WARM[1])}, ${f(WARM[2])}) * upw;
}
`;
}

// Monte Carlo check of the projection. Constant white → average 1.
// Upper white / lower black → up ≈ 1, down ≈ 0.
export function shSelfCheck() {
  const samples = 4000;
  const constant = project(() => [1, 1, 1], samples);
  const evalC = (n) => {
    const b = shBasis(n);
    let r = 0;
    for (let k = 0; k < 9; k++) r += constant[k * 3] * b[k];
    return r;
  };
  const hemis = project((d) => (d[1] >= 0 ? [1, 1, 1] : [0, 0, 0]), samples);
  const evalH = (n) => {
    const b = shBasis(n);
    let r = 0;
    for (let k = 0; k < 9; k++) r += hemis[k * 3] * b[k];
    return r;
  };
  const up = evalC([0, 1, 0]);
  const down = evalC([0, -1, 0]);
  const side = evalC([1, 0, 0]);
  const hUp = evalH([0, 1, 0]);
  const hDown = evalH([0, -1, 0]);
  const meta = shMeta();
  const errs = [];
  if (Math.abs(up - 1) > 0.03) errs.push('constant up ' + up.toFixed(3));
  if (Math.abs(down - 1) > 0.03) errs.push('constant down ' + down.toFixed(3));
  if (Math.abs(side - 1) > 0.03) errs.push('constant side ' + side.toFixed(3));
  if (Math.abs(hUp - 1) > 0.05) errs.push('hemisphere up ' + hUp.toFixed(3));
  if (Math.abs(hDown) > 0.05) errs.push('hemisphere down ' + hDown.toFixed(3));
  // Up-facing shade carries the dimmed grade (L* 59, b* in band). A downward
  // wall keeps the scaled ground bounce and must stay under the 0.744 E flagged.
  if (!(meta.downLuma < 0.45)) errs.push('down wall ambient still over-lit ' + meta.downLuma);
  return { ok: errs.length === 0, errs, constant: [up, down, side], hemis: [hUp, hDown], meta };
}
