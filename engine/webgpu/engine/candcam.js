// Cameras for the crystal candidate page only. The meadow chase is not here.
import { CRYSTAL_CANDIDATE, probes } from './biomes/crystal-candidate.js';

const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function lookAt(e, c, up = [0, 1, 0]) {
  const f = norm(sub(c, e)), s = norm(cross(f, up)), u = cross(s, f);
  return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, e), -dot(u, e), dot(f, e), 1];
}
export function persp(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, f / (n - f), -1, 0, 0, n * f / (n - f), 0];
}
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function inv(m) {
  const a = m, o = new Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d; o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d; o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d; o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}
export function mulPoint(m, v) {
  const o = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[r] += m[c * 4 + r] * v[c];
  return o;
}
export function project(vp, p, w, h) {
  const c = mulPoint(vp, [p[0], p[1], p[2], 1]);
  const iw = 1 / c[3];
  return { x: (c[0] * iw * 0.5 + 0.5) * w, y: (0.5 - c[1] * iw * 0.5) * h, clipW: c[3] };
}

const P = probes();

function pack(eye, target, fovDeg, bolt, boltPrev, atlasFrame, w, h) {
  const fwd = norm(sub(target, eye));
  const view = lookAt(eye, target);
  const proj = persp(fovDeg * D2R, w / h, 0.05, 40);
  const vp = mul(proj, view);
  return { eye, target, fwd, view, proj, vp, bolt, boltPrev, atlasFrame, fov: fovDeg, near: 0.05, far: 40, w, h, showBolt: false };
}

// Bolt's card is 0.85 m tall and stays on x = 0 in the chase, so the play
// frame keeps him centred. Ghost is a crossing shot used only for the trail test.
export function frame(shot, i, w = 720, h = 1280) {
  const k = Math.max(0, i | 0);
  if (shot === 'joints') {
    const pan = k * 0.0011;
    // Look at a mortar joint, not the middle of a stone, so the crop contains the line.
    const t = [P.wall[0] + 0.081 + pan, P.wall[1] + 0.061, P.wall[2]];
    const eye = [t[0], t[1], t[2] - 1.15];
    const bolt = [0, 0.425, 2.2];
    return pack(eye, t, 56, bolt, bolt, 0, w, h);
  }
  if (shot === 'close') {
    const pan = k * 0.0006;
    // The nose edge, so the close crop is a silhouette rather than a flat face.
    const t = [P.nose[0] + 0.055 + pan, P.nose[1], P.nose[2]];
    const eye = [t[0], t[1], t[2] - 0.52];
    const bolt = [0, 0.425, 2.2];
    return pack(eye, t, 56, bolt, bolt, 0, w, h);
  }
  if (shot === 'indoor') {
    const bolt = [0, 0.425, 2.4];
    return pack([0.85, 0.95, 1.55], [0.45, 0.72, 4.40], 68, bolt, bolt, 0, w, h);
  }
  if (shot === 'ghost') {
    const x = -1.05 + k * 0.15;
    const prevX = -1.05 + Math.max(0, k - 1) * 0.15;
    const bolt = [x, 0.425, 3.55];
    const boltPrev = [prevX, 0.425, 3.55];
    const g = pack([0, 0.95, 2.05], [0, 0.55, 3.55], 52, bolt, boltPrev, 0, w, h);
    g.showBolt = true;
    return g;
  }
  const z = 1.50 + k * 0.035;
  const zp = 1.50 + Math.max(0, k - 1) * 0.035;
  const bolt = [0, 0.425, z];
  const boltPrev = [0, 0.425, zp];
  const play = pack([0, 1.12, z - 2.35], [0, 0.62, z + 0.45], 56, bolt, boltPrev, Math.floor(k * 0.75) % 32, w, h);
  play.showBolt = true;
  return play;
}

export const CANDIDATE = CRYSTAL_CANDIDATE;
