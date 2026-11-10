// engine/bricks/follow-cam.js — meadow follow camera, reusable.
// Same distances and vertical field as m448aaa3. Lateral offset defaults to 0 (Bolt centred).
export const CAM_BACK = 2.35;
export const CAM_AHEAD = 2.2;
export const CAM_EYE_Y = 1.12;
export const CAM_TGT_Y = 0.66;
export const CAM_TAU = 0.11;
export const MAX_REL = 10 * Math.PI / 180;
export const FOV_Y = 62 * Math.PI / 180;

export function followEye(bp, camYaw, terrH, lat = 0) {
  const cf = [-Math.sin(camYaw), 0, -Math.cos(camYaw)];
  const cr = [-cf[2], 0, cf[0]];
  const eye = [bp[0] - cf[0] * CAM_BACK + cr[0] * lat, CAM_EYE_Y, bp[2] - cf[2] * CAM_BACK + cr[2] * lat];
  const tgt = [bp[0] + cf[0] * CAM_AHEAD + cr[0] * lat, CAM_TGT_Y, bp[2] + cf[2] * CAM_AHEAD + cr[2] * lat];
  const he = terrH(eye[0], eye[2]);
  const ht = terrH(tgt[0], tgt[2]);
  eye[1] += Math.max((he + 2 * bp[1] + ht) / 4, he + 0.45 - CAM_EYE_Y + 0.6);
  tgt[1] += (bp[1] * 2 + ht) / 3;
  return { eye, tgt, cf, cr };
}

export function lookAt(e, c, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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
