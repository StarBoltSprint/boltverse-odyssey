// Movement, ground contact, and collision. No GPU.
import { boltIdle } from '../bricks/bolt-idle.js';
import { makeCircleCollide } from '../engine/bricks/circle-collide.js';
import { followEye } from '../engine/bricks/follow-cam.js';
import { CRYSTAL } from './biome.js';
import { buildWorld, demoSteer, integrate, pathX, spawn, terrH } from './world.js';

const world = buildWorld();
const collide = makeCircleCollide(world.circles, { boltR: CRYSTAL.boltR });
const idle = boltIdle({});
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

if (world.verts.length < 1000 || world.verts.length % 8 !== 0) bad('mesh stride');
if (![...world.verts].every(Number.isFinite)) bad('non-finite vertex');
if (Math.abs(pathX(0)) > 1e-6) bad('spawn path not centred');
if (Math.abs(terrH(0, 0)) > 0.25) bad('spawn height ' + terrH(0, 0));

for (let z = 6; z >= -150; z -= 0.5) {
  const x = pathX(z);
  for (const c of world.circles) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + CRYSTAL.boltR + 0.2) bad(`corridor z=${z.toFixed(1)} d=${d.toFixed(2)} r=${c.r.toFixed(2)}`);
  }
  if (fail > 8) break;
}

const live = spawn();
const dt = 1 / 60;
let turned = false;
for (let i = 0; i < 20 * 60; i++) {
  const input = demoSteer(live);
  idle.stepMotion(live, dt, input.run);
  const prev = live.psi;
  integrate(live, dt, input, collide);
  if (Math.abs(live.psi - prev) > 1e-4) turned = true;
  const y = terrH(live.x, live.z);
  if (!Number.isFinite(y)) bad('height');
  for (const c of collide.circlesAt(live.x, live.z)) {
    if (Math.hypot(live.x - c.x, live.z - c.z) < c.r + CRYSTAL.boltR - 0.02) bad('penetrate');
  }
}
if (live.z > -80) bad('did not run forward, z=' + live.z.toFixed(1));
if (live.v < 6) bad('speed ' + live.v);
if (!turned) bad('no turn');
const y = terrH(live.x, live.z);
if (y < -0.4 || y > 1.2) bad('left the floor y=' + y);

const blocked = spawn();
const rock = world.circles.find(c => c.r > 0.4 && c.z < -2 && c.z > -30);
if (!rock) bad('no near collider');
else {
  blocked.x = rock.x; blocked.z = rock.z; blocked.v = 0; blocked.psi = 0;
  const slid = collide.slide(blocked.x, blocked.z, 0);
  const d = Math.hypot(slid.x - rock.x, slid.z - rock.z);
  if (d < rock.r + CRYSTAL.boltR - 0.01) bad('slide stayed inside');
  if (!slid.hit) bad('slide missed');
}

const stopped = spawn();
idle.stepMotion(stopped, 0.5, false);
if (stopped.v !== 0) bad('stop did not hold');
idle.stepMotion(stopped, 0.2, true);
if (stopped.v <= 0) bad('run did not start');

const bp = [live.x, terrH(live.x, live.z), live.z];
const cam = followEye(bp, live.cam, terrH, 0);
const back = Math.hypot(cam.eye[0] - bp[0], cam.eye[2] - bp[2]);
if (Math.abs(back - 2.35) > 0.08) bad('camera distance ' + back);
if (Math.abs(cam.eye[0] - bp[0]) > 1.4 && Math.abs(live.cam) < 0.2) bad('camera not centred');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS world', { z: +live.z.toFixed(2), v: +live.v.toFixed(2), tris: world.verts.length / 27, circles: world.circles.length, y: +y.toFixed(3) });
