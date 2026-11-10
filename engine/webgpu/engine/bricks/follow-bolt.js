// Third person behind the live meadow Bolt. Card size and boom match m448aaa2.
// Lateral offset is 0 so the card sits on the portrait centre. Eye height is sprung.

export const LIVE_BOLT = {
  cardH: 1.15,
  cardW: 1.15 * 224 / 652,
  cardFoot: 6 / 652,
  pawSink: 0.095,
  boom: 2.35,
  eye: 1.12,
  aimAhead: 2.2,
  aimY: 0.66,
  lat: 0,
  tau: 0.11,
  maxRel: 10 * Math.PI / 180,
  fovDeg: 62,
  speed: 7,
  strideHz: 1.95,
  accel: 9,
  brake: 5.5,
  near: 0.15,
  far: 16000,
  boltR: 0.42,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function lookAt(e, c, up) {
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

export function basis(yaw) {
  const cf = [-Math.sin(yaw), 0, -Math.cos(yaw)];
  const cr = [-cf[2], 0, cf[0]];
  return { cf, cr };
}

export function smoothEye(prev, target, dt) {
  const k = 1 - Math.exp(-dt / LIVE_BOLT.tau);
  return prev + (target - prev) * k;
}

export function cameraPose(st, heightOf) {
  const { cf, cr } = basis(st.cam);
  const ground = heightOf(st.x, st.z);
  const bp = [st.x, ground, st.z];
  const ex = bp[0] - cf[0] * LIVE_BOLT.boom + cr[0] * LIVE_BOLT.lat;
  const ez = bp[2] - cf[2] * LIVE_BOLT.boom + cr[2] * LIVE_BOLT.lat;
  const rawEye = heightOf(ex, ez) + LIVE_BOLT.eye;
  const eyeY = st.eyeY === undefined ? rawEye : st.eyeY;
  const eye = [ex, eyeY, ez];
  const tgt = [
    bp[0] + cf[0] * LIVE_BOLT.aimAhead + cr[0] * LIVE_BOLT.lat,
    ground + LIVE_BOLT.aimY,
    bp[2] + cf[2] * LIVE_BOLT.aimAhead + cr[2] * LIVE_BOLT.lat,
  ];
  const fwd = norm(sub(tgt, eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { eye, tgt, bp, cf, cr, fwd, right, up, rawEye };
}

export function project(vp, p) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return [x / w, y / w];
}

export function cardScreen(pose, aspect, viewH) {
  const { bp } = pose;
  const foot = LIVE_BOLT.cardFoot;
  const y0 = -LIVE_BOLT.pawSink;
  const y1 = (1 - foot) * LIVE_BOLT.cardH - LIVE_BOLT.pawSink;
  const view = lookAt(pose.eye, pose.tgt, [0, 1, 0]);
  const proj = persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far);
  const vp = mul(proj, view);
  const a = project(vp, [bp[0], bp[1] + y0, bp[2]]);
  const b = project(vp, [bp[0], bp[1] + y1, bp[2]]);
  const mid = project(vp, [bp[0], bp[1] + (y0 + y1) * 0.5, bp[2]]);
  return { ndcX: mid[0], pxH: Math.abs(b[1] - a[1]) * 0.5 * viewH, vp, view, proj };
}
