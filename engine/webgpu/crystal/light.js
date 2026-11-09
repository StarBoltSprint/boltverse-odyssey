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
fn gemStreak(q: vec3f, dir: vec3f, freq: f32, width: f32) -> f32 {
  let s = abs(fract(dot(q, dir) * freq) - 0.5);
  return 1.0 - smoothstep(0.0, width, s);
}
`;
}
