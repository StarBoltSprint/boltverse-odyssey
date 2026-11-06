// CPU work inside one meadow frame. Not a phone frame time and not an Adreno result.
// The phone export is 84.7 ms median / 205.1 ms p95. This file checks whether the
// JavaScript that builds the frame (matrices, tree select, collision lists) can be that.
import assert from 'node:assert/strict';
import { makeCuller } from '../../engine/bricks/perf-cull.js';
import { makeMeadowCollide } from '../../engine/bricks/collide.js';

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
function inv(m) {
  const a = m, o = new Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}

const N = 1941;
const TRD = new Float32Array(N * 4);
for (let i = 0; i < N; i++) {
  TRD[i * 4] = (i % 47) * 7 - 160;
  TRD[i * 4 + 1] = ((i * 13) % 53) * 7 - 180;
  TRD[i * 4 + 2] = 11 + (i % 12);
  TRD[i * 4 + 3] = (i * 17 % 100) / 100;
}
const TRS = new Float32Array(TRD.length);
function cullAlloc(ex, ez, fx, fz, aspect) {
  const tanH = Math.tan(31 * D2R) * aspect * 1.12;
  let nN = 0;
  const far = [];
  for (let i = 0; i < N; i++) {
    const dx = TRD[i * 4] - ex, dz = TRD[i * 4 + 1] - ez, H = TRD[i * 4 + 2];
    const fd = dx * fx + dz * fz;
    if (fd < -H) continue;
    if (Math.abs(dx * fz - dz * fx) > Math.max(fd, 0) * tanH + H * 0.7 + 2) continue;
    const d2 = dx * dx + dz * dz;
    if (d2 > 225 * 225) continue;
    if (d2 > 150 * 150 && (TRD[i * 4 + 3] * 13.7 % 1) < 0.35) continue;
    if (d2 < 150 * 150) { TRS.set(TRD.subarray(i * 4, i * 4 + 4), nN * 4); nN++; }
    else far.push(i);
  }
  let nF = 0;
  for (const i of far) { TRS.set(TRD.subarray(i * 4, i * 4 + 4), (nN + nF) * 4); nF++; }
  return nN + nF;
}
const culler = makeCuller({ src: TRD });
const aspect = 720 / 1348;
const counted = cullAlloc(0, 0, 0, -1, aspect);
const reused = culler.select(0, 0, 0, -1, aspect);
assert.equal(reused.nNear + reused.nFar, counted);
for (let i = 0; i < counted * 4; i++) assert.equal(reused.out[i], TRS[i]);

const eye = [1.2, 1.12, 4.4], tgt = [0.2, 0.66, -2];
const view = lookAt(eye, tgt, [0, 1, 0]);
const proj = persp(62 * D2R, aspect, 0.05, 2000);
const vp = mul(proj, view);
const ivp = inv(vp);
const U = new Float32Array(128);
U.set(vp, 0);
U.set(ivp, 16);
const back = new Float32Array(32);
back.set(U.subarray(0, 32));
const again = new Float32Array(128);
again.set(mul(proj, view), 0);
again.set(inv(mul(persp(62 * D2R, aspect, 0.05, 2000), lookAt(eye, tgt, [0, 1, 0]))), 16);
for (let i = 0; i < 32; i++) assert.equal(again[i], back[i]);

const ROCKS = new Float32Array(64 * 64 * 4).fill(-1);
const treeGrid = new Map();
for (let i = 0; i < 40; i++) {
  const x = (i % 8) * 3, z = Math.floor(i / 8) * 3;
  const k = Math.floor(x / 16) + ',' + Math.floor(z / 16);
  if (!treeGrid.has(k)) treeGrid.set(k, []);
  treeGrid.get(k).push([x, z, 0.5]);
}
const HC = makeMeadowCollide({
  ROCKS, rockCell: (cx, cz) => (((cz % 64) + 64) % 64) * 64 + (((cx % 64) + 64) % 64),
  RCELL: 9, treeGrid, TREE_GRID: 16, boltR: 0.42, rockRadScale: 0.95, maxStep: 0.12, iters: 2,
});
function collideFrame() {
  let x = 1, z = 2;
  for (let s = 0; s < 5; s++) {
    const m = HC.move(x, z, 0, 0, -7, 0.05);
    x = m.x; z = m.z;
  }
  return z;
}
const z0 = collideFrame();
assert.ok(z0 < 2);

function summarize(name, xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const at = (p) => s[Math.round((s.length - 1) * p)];
  return { n: xs.length, medianMs: at(0.5), p95Ms: at(0.95), maxMs: s[s.length - 1] };
}
function time(fn, n) {
  for (let i = 0; i < 50; i++) fn(i);
  const xs = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    fn(i);
    xs.push(performance.now() - a);
  }
  return xs;
}
const NRUN = 2000;
const prep = summarize('prep', time((i) => {
  const e = [Math.sin(i), 1.12, Math.cos(i)];
  const viewM = lookAt(e, tgt, [0, 1, 0]);
  const projM = persp(62 * D2R, aspect, 0.05, 2000);
  const vpM = mul(projM, viewM);
  U.set(vpM, 0);
  U.set(inv(vpM), 16);
  cullAlloc(e[0], e[2], 0, -1, aspect);
  collideFrame();
}, NRUN));
assert.ok(prep.medianMs < 5, prep);
assert.ok(prep.p95Ms < 20, prep);
console.log('PASS render-stutter-prep', prep, { trees: N, cull: counted, uniformDiff: 0 });
