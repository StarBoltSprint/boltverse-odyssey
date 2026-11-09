// Scale: live Bolt card, 1.45 m stone, magnification ≤ 1, walkable slope, centred chase.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TILE_M, HEIGHT_SPEC, LIBRARY } from './biome.js';
import { makeHeight, maxSlope } from '../engine/bricks/heightfield.js';
import { LIVE_BOLT, cameraPose, cardScreen, smoothEye, lookAt, persp, mul } from '../engine/bricks/follow-bolt.js';
import { scaleLiteral } from '../biome-factory/shade.js';
import { DE76_MAX } from '../biome-factory/colour-same-light.mjs';
import { startState, simulate } from './run.js';
import { footprint, clearance } from '../engine/bricks/huge-structure.js';
import { STRUCTURES } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const heightOf = makeHeight(HEIGHT_SPEC);

if (DE76_MAX !== 10) bad('colour threshold moved ' + DE76_MAX);
if (TILE_M !== 1.45) bad('tile');
const lit = scaleLiteral(TILE_M);
if (Math.abs(1 / Number(lit) - 1.45) > 1e-6) bad('uv scale ' + lit);

const meadow = fs.readFileSync(path.join(webgpu, 'm448aaa2.js'), 'utf8');
if (!meadow.includes('const CARD_H = 1.15')) bad('meadow card changed');
if (!meadow.includes('cf[0] * 2.35')) bad('meadow boom changed');
if (LIVE_BOLT.cardH !== 1.15 || LIVE_BOLT.boom !== 2.35 || LIVE_BOLT.eye !== 1.12) bad('bolt size drifted');
if (LIVE_BOLT.lat !== 0) bad('bolt not centred');
if (LIVE_BOLT.fovDeg !== 62) bad('fov');

const slope = maxSlope(heightOf, -1800, 1800, -1800, 1800, 50);
const slopeDeg = Math.atan(slope) * 180 / Math.PI;
if (slopeDeg > 15) bad('slope ' + slopeDeg.toFixed(2));

const st = startState(heightOf);
st.cam = 0; st.psi = 0;
const pose = cameraPose(st, heightOf);
const aspect = 720 / 1280;
const screen = cardScreen(pose, aspect, 1280);
if (Math.abs(screen.ndcX) > 0.02) bad('ndc x ' + screen.ndcX);
const meadowPose = cameraPose({ ...st, cam: 0 }, heightOf);
const meadowScreen = cardScreen(meadowPose, aspect, 1280);
if (Math.abs(screen.pxH - meadowScreen.pxH) > 0.5) bad('card px ' + screen.pxH);

function upperMag(dist, viewH) {
  const pxPerM = viewH / (2 * dist * Math.tan(LIVE_BOLT.fovDeg * Math.PI / 360));
  return pxPerM / (1024 / TILE_M);
}
let mag = 0;
const view = lookAt(pose.eye, pose.tgt, [0, 1, 0]);
const proj = persp(LIVE_BOLT.fovDeg * Math.PI / 180, aspect, LIVE_BOLT.near, LIVE_BOLT.far);
const vp = mul(proj, view);
for (const ny of [-0.92, -0.5, 0]) {
  const dir = ray(vp, 0, ny);
  const hit = march(pose.eye, dir, heightOf);
  if (!hit) { bad('ray missed ' + ny); continue; }
  mag = Math.max(mag, upperMag(hit, 1280));
}
if (!(mag > 0) || mag > 1) bad('magnification ' + mag);

for (const row of LIBRARY) {
  const buf = fs.readFileSync(path.resolve(webgpu, '../..', row.source));
  if (buf.readUInt32BE(16) !== 1024 || buf.readUInt32BE(20) !== 1024) bad('px ' + row.id);
}

const frames = simulate(8, 1 / 60, heightOf);
const moved = Math.hypot(frames.at(-1).x - frames[0].x, frames.at(-1).z - frames[0].z);
if (moved < 40) bad('moved ' + moved);
let minClear = Infinity;
for (const fr of frames) {
  for (const spec of STRUCTURES) minClear = Math.min(minClear, clearance(footprint(spec), fr.x, fr.z, LIVE_BOLT.boltR));
}
if (minClear < 0) bad('ran through a solid ' + minClear);

let prev = st.eyeY, prevD = 0, maxStep = 0;
let eye = heightOf(0, 0);
for (let i = 0; i < 90; i++) {
  const target = i === 40 ? eye + 2 : eye;
  const n = smoothEye(prev, target, 1 / 60);
  maxStep = Math.max(maxStep, Math.abs(n - prev));
  prevD = n - prev;
  prev = n;
  void prevD;
}
if (maxStep > 0.45) bad('eye snapped ' + maxStep);

const page = fs.readFileSync(path.join(here, 'reach.js'), 'utf8');
if (/KEY\.file|environment\.jpg|cropUV\(/.test(page)) bad('page uses a reference as a texture');
if (page.includes('sky-panorama') || page.includes('tiling-inspection')) bad('page uses a rejected plate');
if (page.includes('fog.js')) bad('page imports fog');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log(JSON.stringify({
  pass: 'scale',
  tileM: TILE_M,
  uv: lit,
  slopeDeg: +slopeDeg.toFixed(3),
  boltPx: +screen.pxH.toFixed(1),
  ndcX: +screen.ndcX.toFixed(4),
  mag: +mag.toFixed(3),
  movedM: +moved.toFixed(2),
  minClearM: +minClear.toFixed(2),
  eyeStepM: +maxStep.toFixed(3),
  de76: DE76_MAX,
}));

function ray(vp, nx, ny) {
  const inv = invert(vp);
  const a = transform(inv, [nx, ny, 0.2, 1]);
  const b = transform(inv, [nx, ny, 0.8, 1]);
  const p = a.map((v, i) => v / a[3]);
  const q = b.map((v, i) => v / b[3]);
  return norm([q[0] - p[0], q[1] - p[1], q[2] - p[2]]);
}
function transform(m, v) {
  const o = [0, 0, 0, 0];
  for (let r = 0; r < 4; r++) o[r] = m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3];
  return o;
}
function invert(m) {
  const a = m, o = new Array(16);
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = a;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (-a01 * b11 + a02 * b10 - a03 * b09) * d; o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (-a21 * b05 + a22 * b04 - a23 * b03) * d;
  o[4] = (-a10 * b11 + a12 * b08 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d; o[6] = (-a30 * b05 + a32 * b02 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (-a00 * b10 + a01 * b08 - a03 * b06) * d; o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (-a20 * b04 + a21 * b02 - a23 * b00) * d;
  o[12] = (-a10 * b09 + a11 * b07 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d; o[14] = (-a30 * b03 + a31 * b01 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}
function norm(a) { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }
function march(eye, dir, h) {
  let t = 0.2;
  for (let i = 0; i < 80; i++) {
    const x = eye[0] + dir[0] * t, y = eye[1] + dir[1] * t, z = eye[2] + dir[2] * t;
    const g = h(x, z);
    if (y < g) return t;
    t += Math.max(0.15, (y - g) * 0.5);
    if (t > 80) break;
  }
  return 0;
}
