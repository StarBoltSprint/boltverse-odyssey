// SH L2 sky irradiance for the glacier dawn rig.
// The sky function is the existing procedural plate (world direction only).
// Lower hemisphere is one Lambertian snow bounce.
// The result replaces the constant ambient colour. It is the cosine-weighted
// average of that radiance, in the same units the shader already adds to the sun
// term. No exposure curve is applied on top.

import { skyLinear } from '../biome-factory/procedural-sky.js';
import { norm3 } from '../biome-factory/light-rig.js';
import { LIGHT } from './biome.js';

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
const snowRadiance = SNOW_ALB.map((a, i) => a * (skyAvg[i] + sunUp[i]));

function radiance(dir) {
  if (dir[1] >= 0) return skyLinear(dir, LIGHT.sky);
  return snowRadiance;
}

const COEFF = project(radiance, 6144);

export function shCoeff() {
  return COEFF;
}

export function ambientAt(n) {
  const b = shBasis(n);
  let r = 0;
  let g = 0;
  let bl = 0;
  for (let k = 0; k < 9; k++) {
    r += COEFF[k * 3] * b[k];
    g += COEFF[k * 3 + 1] * b[k];
    bl += COEFF[k * 3 + 2] * b[k];
  }
  return [r < 0 ? 0 : r, g < 0 ? 0 : g, bl < 0 ? 0 : bl];
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
  return max(c, vec3f(0.0));
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
  if (!(meta.upCool > meta.downCool)) errs.push('sign: up is not cooler than down ' + meta.upCool.toFixed(3) + ' vs ' + meta.downCool.toFixed(3));
  return { ok: errs.length === 0, errs, constant: [up, down, side], hemis: [hUp, hDown], meta };
}
