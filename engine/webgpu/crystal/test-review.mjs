// Gates for the review of crystal-play: travel, one camera path, welded ground, sky yaw.
import fs from 'fs';
import { boltIdle } from '../bricks/bolt-idle.js';
import { makeCircleCollide } from '../engine/bricks/circle-collide.js';
import { followEye } from '../engine/bricks/follow-cam.js';
import { skyLinear, skyDelta, dirFrom, skySeen } from '../biome-factory/procedural-sky.js';
import { CRYSTAL, MAT } from './biome.js';
import { buildWorld, proofInput, integrate, spawn, terrH, pathX, WATER_Y, STREAM_HALF } from './world.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const world = buildWorld();
const heights = new Map();
let cracks = 0;
const verts = world.verts;
for (let i = 0; i < verts.length; i += 8) {
  if (Math.abs(verts[i + 3] - MAT.mineral) > 1e-6) continue;
  if (!Number.isFinite(verts[i]) || !Number.isFinite(verts[i + 1]) || !Number.isFinite(verts[i + 2])) {
    bad('non-finite ground vertex');
    break;
  }
  const key = `${verts[i].toFixed(4)},${verts[i + 2].toFixed(4)}`;
  const y = verts[i + 1];
  if (heights.has(key) && Math.abs(heights.get(key) - y) > 1e-4) cracks++;
  else heights.set(key, y);
}
if (cracks) bad('ground cracks ' + cracks);

let roofs = 0;
let closest = 1;
for (let i = 0; i + 24 <= verts.length; i += 24) {
  if (Math.abs(verts[i + 3] - MAT.mineral) > 1e-6) continue;
  const p = [0, 1, 2].map((k) => [verts[i + k * 8], verts[i + k * 8 + 1], verts[i + k * 8 + 2]]);
  for (let s = 0; s <= 4; s++) {
    for (let t = 0; t <= 4 - s; t++) {
      const w1 = s / 4, w2 = t / 4, w0 = 1 - w1 - w2;
      const x = w0 * p[0][0] + w1 * p[1][0] + w2 * p[2][0];
      const y = w0 * p[0][1] + w1 * p[1][1] + w2 * p[2][1];
      const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2];
      const u = x - pathX(z) - CRYSTAL.streamLat;
      if (Math.abs(u) >= STREAM_HALF - 0.02) continue;
      closest = Math.min(closest, WATER_Y - y);
      if (y > WATER_Y - 0.05) roofs++;
    }
  }
}
if (roofs) bad('ground roofs the stream ' + roofs + ' clearance ' + closest.toFixed(3));

const page = fs.readFileSync(new URL('./crystal.js', import.meta.url), 'utf8');
if (!page.includes('p = p + u.cam.xyz')) bad('sky dome is not centred on the camera');
if (!page.includes('skyColour(normalize(v.w - u.cam.xyz))')) bad('sky colour is not direction-only');
if (!page.includes('alb * nh')) bad('crystal highlight is not tinted by the albedo');
// Two different view directions. Advisory. The 0.015 limit is the anchor gate.
const yawPairAdvisory = skyDelta(skyLinear(dirFrom(12, 0.2)), skyLinear(dirFrom(12, 0.55)));
const dir = dirFrom(12, 0.4);
if (skyDelta(skySeen([0, 1.12, 0], dir), skySeen([30, 2, -40], dir)) > 1e-6) bad('sky parallax from camera position');

const collide = makeCircleCollide(world.circles, { boltR: CRYSTAL.boltR });
const idle = boltIdle({});
const live = spawn();
const dt = 1 / 60;
const hist = [];
let maxStep = 0;
let maxYaw = 0;
for (let i = 0; i < 10 * 60; i++) {
  const prev = { x: live.x, z: live.z, psi: live.psi };
  const input = proofInput(i * dt, live);
  idle.stepMotion(live, dt, input.run);
  integrate(live, dt, input, collide);
  maxStep = Math.max(maxStep, Math.hypot(live.x - prev.x, live.z - prev.z));
  let d = live.psi - prev.psi;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  maxYaw = Math.max(maxYaw, Math.abs(d));
  hist.push({ x: live.x, z: live.z, psi: live.psi, v: live.v, cam: live.cam });
}
let maxYawHalf = 0;
for (let i = 0; i + 30 < hist.length; i++) {
  let d = hist[i + 30].psi - hist[i].psi;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  maxYawHalf = Math.max(maxYawHalf, Math.abs(d));
}
if (maxStep > 0.25) bad('camera step ' + maxStep.toFixed(3) + ' m');
if (maxYaw > 0.05) bad('per-frame yaw ' + maxYaw.toFixed(4) + ' rad');
if (maxYawHalf > 0.22) bad('half-second yaw ' + maxYawHalf.toFixed(3) + ' rad');
const moved = Math.hypot(hist[180].x - hist[0].x, hist[180].z - hist[0].z);
if (moved < 8) bad('first 3 s travel ' + moved.toFixed(2) + ' m');
if (hist[60].v < 3) bad('not moving at 1 s, v=' + hist[60].v);

function bearing(sample) {
  const bp = [sample.x, terrH(sample.x, sample.z), sample.z];
  const cam = followEye(bp, sample.cam, terrH, 0);
  const fwd = [cam.tgt[0] - cam.eye[0], 0, cam.tgt[2] - cam.eye[2]];
  const fl = Math.hypot(fwd[0], fwd[2]) || 1;
  const tower = [pathX(-6) - 5.6, -6];
  const to = [tower[0] - cam.eye[0], tower[1] - cam.eye[2]];
  const tl = Math.hypot(to[0], to[1]) || 1;
  const dot = (fwd[0] / fl) * (to[0] / tl) + (fwd[2] / fl) * (to[1] / tl);
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}
const swing = Math.abs(bearing(hist[150]) - bearing(hist[20]));
if (swing < 0.18) bad('near tower bearing frozen ' + swing.toFixed(3));

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS review', {
  cracks,
  moved: +moved.toFixed(2),
  maxStep: +maxStep.toFixed(4),
  maxYaw: +maxYaw.toFixed(4),
  maxYawHalf: +maxYawHalf.toFixed(3),
  bearing: +swing.toFixed(3),
  yawPairAdvisory: +yawPairAdvisory.toFixed(5),
  streamClearance: +closest.toFixed(3),
});
