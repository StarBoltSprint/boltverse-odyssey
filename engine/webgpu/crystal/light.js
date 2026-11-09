// One block for the crystal candidate light. A night rig swaps this object.
// Albedo stays the Imagine JPEG. Sheen is dielectric. Crystals are never chrome.
export const LIGHT = {
  sun: [0.48, 0.74, -0.42],
  f0: 0.045,
  roughness: 0.25,
  fillGain: 26,
  fillMin: 0.22,
  fillMax: 1.2,
  sunCoeff: 2,
  rimGain: 2.05,
  rimMix: 0.55,
  hazeNear: 70,
  hazeFar: 190,
  hazeAmt: 0.55,
  relief: 4,
  scallopAmp: 0.35,
  flowAmp: 0.02,
  gemEdge: 0.62,
  sparkle: 0.2,
  sparkPow: 160,
  fractureGain: 0.18,
};

function hash2(ix, iy, k) {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function conchoid(uv) {
  const period = 3.2;
  const cx = Math.floor(uv[0] / period);
  const cy = Math.floor(uv[1] / period);
  const base = [cx * period, cy * period];
  let d1 = 1e9;
  let d2 = 1e9;
  let r1 = 1;
  let h = 0;
  for (let i = 0; i < 4; i++) {
    const c = [base[0] + hash2(cx, cy, i) * period, base[1] + hash2(cx, cy, i + 9) * period];
    const r = 0.55 + hash2(cx, cy, i + 3) * 1.4;
    const d = Math.hypot(uv[0] - c[0], uv[1] - c[1]);
    if (d < r * 0.92) h += -Math.sqrt(Math.max(0, 1 - (d / r) * (d / r))) * LIGHT.scallopAmp;
    if (d < d1) { d2 = d1; d1 = d; r1 = r; }
    else if (d < d2) d2 = d;
  }
  h += Math.sin((uv[0] * 0.12 + uv[1] * 0.99) * 2.2) * LIGHT.flowAmp;
  return { h, gap: d2 - d1, inner: d1 < 0.28 * r1, radius: r1 };
}

export function conchoidMetrics() {
  const e = 0.025;
  const grad = (uv) => {
    const h0 = conchoid(uv).h;
    const hx = conchoid([uv[0] + e, uv[1]]).h;
    const hy = conchoid([uv[0], uv[1] + e]).h;
    return [(h0 - hx) / e, (h0 - hy) / e];
  };
  let n = 0;
  let ridge = 0;
  let gR = 0;
  let nR = 0;
  let gI = 0;
  let nI = 0;
  const radii = [];
  for (let y = 0; y < 3.2; y += 0.04) {
    for (let x = 0; x < 3.2; x += 0.04) {
      const f = conchoid([x, y]);
      const g = grad([x, y]);
      const mag = Math.hypot(g[0], g[1]);
      n++;
      if (f.gap < 0.06) { ridge++; gR += mag; nR++; }
      if (f.inner) { gI += mag; nI++; }
      if (y < 0.04 && x < 0.04) radii.push(f.radius);
    }
  }
  for (let cy = 0; cy < 3; cy++) {
    for (let cx = 0; cx < 3; cx++) {
      for (let i = 0; i < 4; i++) radii.push(0.55 + hash2(cx, cy, i + 3) * 1.4);
    }
  }
  return {
    ridgeCoverage: ridge / n,
    sharpness: (gR / Math.max(nR, 1)) / Math.max(gI / Math.max(nI, 1), 1e-6),
    radiusMin: Math.min(...radii),
    radiusMax: Math.max(...radii),
  };
}

function hash4(a, b, c, k) {
  const s = Math.sin(a * 12.91 + b * 47.3 + c * 91.7 + k * 17.1) * 43758.5453;
  return s - Math.floor(s);
}

function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function cracksInCell(cx, cy, cz) {
  const cell = 0.62;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const origin = [
      (cx + 0.18 + hash4(cx, cy, cz, i) * 0.64) * cell,
      (cy + 0.22 + hash4(cx, cy, cz, i + 4) * 0.55) * cell,
      (cz + 0.12 + hash4(cx, cy, cz, i + 8) * 0.7) * cell,
    ];
    const dir = norm3([
      hash4(cx, cy, cz, i + 12) - 0.5,
      0.35 + hash4(cx, cy, cz, i + 16) * 0.9,
      hash4(cx, cy, cz, i + 20) - 0.5,
    ]);
    const nrm = norm3(cross3(dir, [0.2, 0.9, hash4(cx, cy, cz, i + 24) - 0.4]));
    const len = 0.05 + hash4(cx, cy, cz, i + 28) * 0.06;
    out.push({ origin, dir, nrm, len });
  }
  return out;
}

// Short internal crack. Bright only when the view lies in the plane.
export function fractureAt(p, view) {
  const cell = 0.62;
  const cx = Math.floor(p[0] / cell);
  const cy = Math.floor(p[1] / cell);
  const cz = Math.floor(p[2] / cell);
  let sum = 0;
  for (const crack of cracksInCell(cx, cy, cz)) {
    const bin = norm3(cross3(crack.dir, crack.nrm));
    const rel = [p[0] - crack.origin[0], p[1] - crack.origin[1], p[2] - crack.origin[2]];
    const along = dot3(rel, crack.dir);
    const side = dot3(rel, crack.nrm);
    const across = dot3(rel, bin);
    const seg = Math.max(0, 1 - Math.abs(along) / crack.len);
    const thin = Math.max(0, 1 - Math.abs(side) / 0.01);
    const band = Math.max(0, 1 - Math.abs(across) / 0.045);
    const catchPlane = (1 - Math.abs(dot3(view, crack.nrm))) ** 4;
    sum += seg * thin * band * catchPlane;
  }
  return Math.min(1, sum);
}

export function lightWgsl() {
  const L = LIGHT;
  return `
fn conchHash(ix: f32, iy: f32, k: f32) -> f32 {
  return fract(sin(ix * 127.1 + iy * 311.7 + k * 74.7) * 43758.5453);
}
fn conchH(uv: vec2f) -> f32 {
  let period = 3.2;
  let cell = floor(uv / period);
  let base = cell * period;
  var h = 0.0;
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let c = base + vec2f(conchHash(cell.x, cell.y, fi), conchHash(cell.x, cell.y, fi + 9.0)) * period;
    let r = 0.55 + conchHash(cell.x, cell.y, fi + 3.0) * 1.4;
    let d = length(uv - c);
    let u = d / r;
    if (u < 0.92) {
      h = h + (-sqrt(max(0.0, 1.0 - u * u))) * ${L.scallopAmp};
    }
  }
  h = h + sin((uv.x * 0.12 + uv.y * 0.99) * 2.2) * ${L.flowAmp};
  return h;
}
fn conchGap(uv: vec2f) -> f32 {
  let period = 3.2;
  let cell = floor(uv / period);
  let base = cell * period;
  var d1 = 1e9;
  var d2 = 1e9;
  for (var i = 0; i < 4; i++) {
    let fi = f32(i);
    let c = base + vec2f(conchHash(cell.x, cell.y, fi), conchHash(cell.x, cell.y, fi + 9.0)) * period;
    let d = length(uv - c);
    if (d < d1) { d2 = d1; d1 = d; }
    else if (d < d2) { d2 = d; }
  }
  return d2 - d1;
}
fn faceUV(p: vec3f, nrm: vec3f) -> vec2f {
  let refv = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(nrm.y) > 0.9);
  let t1 = normalize(cross(nrm, refv));
  let t2 = cross(nrm, t1);
  return vec2f(dot(p, t1), dot(p, t2));
}
fn conchGrad(p: vec3f, nrm: vec3f) -> vec3f {
  let refv = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(nrm.y) > 0.9);
  let t1 = normalize(cross(nrm, refv));
  let t2 = cross(nrm, t1);
  let uv = vec2f(dot(p, t1), dot(p, t2));
  let e = 0.03;
  let h0 = conchH(uv);
  let hx = conchH(uv + vec2f(e, 0.0));
  let hy = conchH(uv + vec2f(0.0, e));
  return t1 * ((h0 - hx) / e) + t2 * ((h0 - hy) / e);
}
fn crackHash(a: f32, b: f32, c: f32, k: f32) -> f32 {
  return fract(sin(a * 12.91 + b * 47.3 + c * 91.7 + k * 17.1) * 43758.5453);
}
fn fractureAmt(p: vec3f, view: vec3f) -> f32 {
  let cell = 0.62;
  let ix = floor(p.x / cell);
  let iy = floor(p.y / cell);
  let iz = floor(p.z / cell);
  var sum = 0.0;
  for (var i = 0; i < 3; i++) {
    let fi = f32(i);
    let origin = vec3f(
      (ix + 0.18 + crackHash(ix, iy, iz, fi) * 0.64) * cell,
      (iy + 0.22 + crackHash(ix, iy, iz, fi + 4.0) * 0.55) * cell,
      (iz + 0.12 + crackHash(ix, iy, iz, fi + 8.0) * 0.7) * cell);
    let dir = normalize(vec3f(
      crackHash(ix, iy, iz, fi + 12.0) - 0.5,
      0.35 + crackHash(ix, iy, iz, fi + 16.0) * 0.9,
      crackHash(ix, iy, iz, fi + 20.0) - 0.5));
    let nrm = normalize(cross(dir, vec3f(0.2, 0.9, crackHash(ix, iy, iz, fi + 24.0) - 0.4)));
    let bin = normalize(cross(dir, nrm));
    let rel = p - origin;
    let along = dot(rel, dir);
    let side = dot(rel, nrm);
    let across = dot(rel, bin);
    let len = 0.05 + crackHash(ix, iy, iz, fi + 28.0) * 0.06;
    let seg = max(0.0, 1.0 - abs(along) / len);
    let thin = max(0.0, 1.0 - abs(side) / 0.01);
    let band = max(0.0, 1.0 - abs(across) / 0.045);
    let catchPlane = pow(1.0 - abs(dot(view, nrm)), 4.0);
    sum = sum + seg * thin * band * catchPlane;
  }
  return min(1.0, sum);
}
`;
}
