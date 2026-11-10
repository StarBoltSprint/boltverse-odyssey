// Proves the grass wedge never rejects a blade that can meet the phone frustum.
import assert from 'node:assert/strict';
import { grassHorizReachM, grassRootOffscreen, grassTanHalfH, grassOffscreen, GRASS_REACH_M, grassWedgeM } from '../../engine/bricks/grass-offscreen.js';
import { makeGrassGPU } from '../../engine/grass.js';

const reach = grassHorizReachM();
assert.ok(reach < GRASS_REACH_M, reach);
assert.ok(reach > 2, reach);

const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function lookAt(e, c, up) {
  const f = norm(sub(c, e)), s = norm(cross(f, up)), u = cross(s, f);
  return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot3(s, e), -dot3(u, e), dot3(f, e), 1];
}
function persp(fovy, asp, n, f) {
  const t = 1 / Math.tan(fovy / 2);
  return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, f / (n - f), -1, 0, 0, (n * f) / (n - f), 0];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function xform(m, p) {
  const o = [0, 0, 0, 0];
  const v = [p[0], p[1], p[2], 1];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[r] += m[c * 4 + r] * v[c];
  return o;
}
function boxOutside(vp, corners) {
  const n = corners.length;
  const hit = { left: 0, right: 0, bottom: 0, top: 0, near: 0, far: 0, behind: 0 };
  for (const p of corners) {
    const c = xform(vp, p);
    const w = c[3];
    if (w <= 0) hit.behind += 1;
    if (c[0] < -w) hit.left += 1;
    if (c[0] > w) hit.right += 1;
    if (c[1] < -w) hit.bottom += 1;
    if (c[1] > w) hit.top += 1;
    if (c[2] < 0) hit.near += 1;
    if (c[2] > w) hit.far += 1;
  }
  return Object.values(hit).some((v) => v === n);
}
function corners(x, z) {
  const out = [];
  for (const dx of [-GRASS_REACH_M, GRASS_REACH_M]) {
    for (const dz of [-GRASS_REACH_M, GRASS_REACH_M]) {
      for (const y of [-3, 2.8]) out.push([x + dx, y, z + dz]);
    }
  }
  return out;
}

const aspect = 720 / 1348;
const tanH = grassTanHalfH(aspect);
const vpFor = (eye, tgt) => mul(persp(62 * D2R, aspect, 0.05, 2000), lookAt(eye, tgt, [0, 1, 0]));

let checked = 0;
let rejected = 0;
let falseReject = 0;
let vertChecked = 0;
let vertRejected = 0;
const poses = [];
for (const psi of [0, 0.4, -0.7, 1.2, 2.4]) {
  for (const z of [0, -12, -30, 40]) {
    for (const drop of [0.2, 0.46, 1.1, -0.4]) {
      const cf = [-Math.sin(psi), -Math.cos(psi)];
      const eye = [-cf[0] * 2.35, 1.4, -cf[1] * 2.35 + z];
      const tgt = [cf[0] * 2.2, 1.4 - drop, cf[1] * 2.2 + z];
      poses.push({ eye, tgt, fwd: cf, cam: [eye[0], eye[2]] });
    }
  }
}
const rings = [
  { ahead: 6, half: 7.1, step: 0.7, verts: 15 },
  { ahead: 14, half: 15.8, step: 1.1, verts: 15 },
  { ahead: 40, half: 39.1, step: 1.6, verts: 3 },
];
for (const pose of poses) {
  const vp = vpFor(pose.eye, pose.tgt);
  for (const ring of rings) {
    const cx = pose.cam[0] + pose.fwd[0] * ring.ahead;
    const cz = pose.cam[1] + pose.fwd[1] * ring.ahead;
    for (let ix = -ring.half; ix <= ring.half; ix += ring.step) {
      for (let iz = -ring.half; iz <= ring.half; iz += ring.step) {
        const x = cx + pose.fwd[0] * iz + -pose.fwd[1] * ix;
        const z = cz + pose.fwd[1] * iz + pose.fwd[0] * ix;
        checked += 1;
        vertChecked += ring.verts;
        const off = grassRootOffscreen(x, z, pose.cam[0], pose.cam[1], pose.fwd[0], pose.fwd[1], tanH);
        if (!off) continue;
        rejected += 1;
        vertRejected += ring.verts;
        const outside = boxOutside(vp, corners(x, z));
        if (!outside) falseReject += 1;
      }
    }
  }
}
assert.equal(falseReject, 0, falseReject);
assert.ok(vertRejected / vertChecked > 0.35, vertRejected / vertChecked);
assert.equal(grassWedgeM(), 4.5);

const src = makeGrassGPU();
const wrapped = grassOffscreen(src, tanH);
assert.equal(wrapped.includes('grassHidden(root, fwd)'), true);
assert.equal(wrapped.includes('4.50'), true);
assert.equal(wrapped.split('let root = (cell + vec2f(r1, r2)) * s;').length, 2);
const verts = 15 * (200 * 200 + 150 * 150) + 3 * 130 * 130;
console.log('PASS grass-offscreen', {
  reach: +reach.toFixed(3),
  wedge: grassWedgeM(),
  tanHalfH: +tanH.toFixed(4),
  samples: checked,
  rejectedFrac: +(rejected / checked).toFixed(3),
  vertFrac: +(vertRejected / vertChecked).toFixed(3),
  falseReject,
  grassVerts: verts,
});
