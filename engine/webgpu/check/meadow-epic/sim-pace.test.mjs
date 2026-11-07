// Phone export, 2026-11-06 11:44 Europe/Paris, Adreno 6xx, canvas 720×1348.
// Proves what that one window does and does not say, then checks catch-up.
import assert from 'node:assert/strict';
import { classifyFrames } from '../../engine/bricks/frame-diag.js';
import { paceFrame, paceSteps, STEP_CAP_S, WALL_LIMIT_S } from '../../engine/bricks/sim-pace.js';
import { boltIdle } from '../../bricks/bolt-idle.js';
import { makeMeadowCollide } from '../../engine/bricks/collide.js';

const PHONE = {
  n: 64, medianWallMs: 84.7, medianAppliedMs: 50, p95WallMs: 205.1,
  appliedOverWall: 0.59, metresPerSec: 2.74, capS: 0.05,
};

// appliedOverWall in the tool is median(applied) / median(wall), not the time average.
assert.ok(Math.abs(PHONE.medianAppliedMs / PHONE.medianWallMs - PHONE.appliedOverWall) < 0.002);

// A right-skewed 64-frame window with those median and p95 values, every frame ≥ 50 ms,
// and Bolt already at 7 m/s, produces about 2.74 m/s. The median ratio alone would say 4.13.
const walls = [];
for (let i = 0; i < 31; i++) walls.push(0.06);
walls.push(0.0847, 0.0847);
for (let i = 0; i < 27; i++) walls.push(0.12);
walls.push(0.2051);
const used = walls.reduce((a, b) => a + b, 0);
const targetSum = 64 * 7 * 0.05 / PHONE.metresPerSec;
const extra = (targetSum - used) / 3;
walls.push(extra, extra, extra);
assert.equal(walls.length, 64);
const samples = walls.map((wall) => ({ wall, applied: Math.min(0.05, wall), speed: 7 }));
const report = classifyFrames(samples);
assert.ok(Math.abs(report.medianWallMs - 84.7) < 0.05, report.medianWallMs);
assert.ok(Math.abs(report.p95WallMs - 205.1) < 0.05, report.p95WallMs);
assert.equal(report.medianAppliedMs, 50);
assert.ok(Math.abs(report.appliedOverWall - 0.59) < 0.01, report.appliedOverWall);
assert.ok(Math.abs(report.metresPerSec - 2.74) < 0.03, report.metresPerSec);
const medianOnly = 7 * (0.05 / 0.0847);
assert.ok(medianOnly > 4.1 && medianOnly < 4.2, medianOnly);
assert.ok(report.metresPerSec < medianOnly - 1, 'skew must pull the time average below the median ratio');

// The export multiplies commanded live.v by applied dt. A collision that shortens the
// actual step does not lower this number. 2.74 does not prove a hit.

function makeRunner({ run, turn = 0, rock = null, v0 = 0 }) {
  const flag = { run };
  const idle = boltIdle();
  const ROCKS = new Float32Array(64 * 64 * 4);
  ROCKS.fill(-1);
  const treeGrid = new Map();
  if (rock) {
    const gx = Math.floor(rock.x / 16), gz = Math.floor(rock.z / 16);
    treeGrid.set(gx + ',' + gz, [[rock.x, rock.z, rock.r]]);
  }
  const rockCell = (cx, cz) => (((cz % 64) + 64) % 64) * 64 + (((cx % 64) + 64) % 64);
  const HC = makeMeadowCollide({
    ROCKS, rockCell, RCELL: 9, treeGrid, TREE_GRID: 16,
    boltR: 0.42, rockRadScale: 0.95, maxStep: 0.12, iters: 2,
  });
  const live = { psi: 0, x: 0, z: 0, cam: 0, w: 0, turn: 0, v: v0, phase: 0, run: 0 };
  const D2R = Math.PI / 180;
  const CAM_TAU = 0.11;
  const MAX_REL = 10 * D2R;
  function stepLive(dt) {
    const target = turn * 75 * D2R;
    live.w += (target - live.w) * (1 - Math.exp(-dt / (target === 0 ? 0.10 : 0.25)));
    if (target === 0 && Math.abs(live.w) < 0.05) live.w = 0;
    idle.stepMotion(live, dt, flag.run);
    live.psi += live.w * dt;
    const vx = -Math.sin(live.psi) * live.v;
    const vz = -Math.cos(live.psi) * live.v;
    const m = HC.move(live.x, live.z, live.psi, vx, vz, dt);
    live.x = m.x; live.z = m.z;
    live.cam += (live.psi - live.cam) * (1 - Math.exp(-dt / CAM_TAU));
    if (live.psi - live.cam > MAX_REL) live.cam = live.psi - MAX_REL;
    if (live.cam - live.psi > MAX_REL) live.cam = live.psi + MAX_REL;
    return live;
  }
  return { live, stepLive, flag };
}

function drive(walls, mode, opts) {
  const r = makeRunner({ ...opts, run: opts.warmupRun ?? opts.run });
  const warmN = opts.warmup === false ? 0 : 80;
  for (let i = 0; i < warmN; i++) r.stepLive(1 / 60);
  r.flag.run = opts.run;
  const x0 = r.live.x, z0 = r.live.z, p0 = r.live.phase;
  let wallSum = 0;
  const seen = [];
  for (const w of walls) {
    wallSum += w;
    if (mode === 'capped') r.stepLive(Math.min(0.05, w));
    else {
      const steps = paceSteps(w);
      for (const dt of steps) {
        assert.ok(dt <= STEP_CAP_S + 1e-12);
        seen.push(dt);
        r.stepLive(dt);
      }
    }
  }
  const dist = Math.hypot(r.live.x - x0, r.live.z - z0);
  return { dist, mps: dist / wallSum, live: r.live, p0, seen, wallSum };
}

const phoneWalls = [];
for (let i = 0; i < 20; i++) phoneWalls.push(0.0847, 0.2051);
const capped = drive(phoneWalls, 'capped', { run: true, v0: 7 });
const paced = drive(phoneWalls, 'pace', { run: true, v0: 7 });
assert.ok(capped.mps < 3.2, capped.mps);
assert.ok(paced.mps > 6.9 && paced.mps < 7.05, paced.mps);
const phaseExpect = ((paced.p0 + 1.95 * paced.wallSum) % 1 + 1) % 1;
let phaseErr = Math.abs(((paced.live.phase % 1) + 1) % 1 - phaseExpect);
if (phaseErr > 0.5) phaseErr = 1 - phaseErr;
assert.ok(phaseErr < 0.02, phaseErr);

// Same total sim time, fine steps vs paced chunks: same place once speed is full.
const fine = makeRunner({ run: true, v0: 7 });
const chunk = makeRunner({ run: true, v0: 7 });
let acc = 0;
for (let i = 0; i < 30; i++) {
  fine.stepLive(1 / 60);
  acc += 1 / 60;
}
paceFrame(acc, chunk.stepLive);
assert.ok(Math.hypot(fine.live.x - chunk.live.x, fine.live.z - chunk.live.z) < 1e-6);
assert.ok(Math.abs(fine.live.phase - chunk.live.phase) < 1e-9);
assert.ok(Math.abs(fine.live.cam - chunk.live.cam) < 1e-6);

// Brake still reaches a stop on wall time. The cap would leave speed behind.
const slowFrames = Array.from({ length: 8 }, () => 0.2051);
const braking = drive(slowFrames, 'pace', { run: false, warmupRun: true, v0: 7 });
const brakingOld = drive(slowFrames, 'capped', { run: false, warmupRun: true, v0: 7 });
assert.equal(braking.live.v, 0);
assert.equal(braking.live.phase, 0);
assert.ok(brakingOld.live.v > 4, brakingOld.live.v);

// From a standstill, 84.7 ms frames must not stall the accel at the 50 ms slice.
const accelWalls = Array.from({ length: 6 }, () => 0.0847);
const accelPace = drive(accelWalls, 'pace', { run: true, v0: 0, warmup: false });
const accelOld = drive(accelWalls, 'capped', { run: true, v0: 0, warmup: false });
assert.ok(Math.abs(accelPace.live.v - Math.min(7, 9 * accelPace.wallSum)) < 1e-6, accelPace.live.v);
assert.ok(accelOld.live.v < accelPace.live.v - 1, accelOld.live.v);

// Held turn stays inside the camera clamp, and heading agrees with 60 fps.
function turnFor(mode) {
  const r = makeRunner({ run: true, turn: 1, v0: 7 });
  const walls = Array.from({ length: 12 }, () => 0.0847);
  for (const w of walls) {
    if (mode === 'fine') {
      let left = w;
      while (left > 1e-9) { const dt = Math.min(1 / 60, left); r.stepLive(dt); left -= dt; }
    } else paceFrame(w, r.stepLive);
  }
  return r.live;
}
const turned = turnFor('pace');
const turnedFine = turnFor('fine');
assert.ok(Math.abs(turned.psi - turned.cam) <= 10 * Math.PI / 180 + 1e-9);
assert.ok(Math.abs(turned.psi - turnedFine.psi) < 0.02, turned.psi - turnedFine.psi);

// A 205 ms frame must not walk through a trunk. Contact radius is 0.55+0.42.
const blocked = makeRunner({ run: true, v0: 7, rock: { x: 0, z: -0.9, r: 0.55 } });
blocked.live.z = 0.4;
paceFrame(0.2051, blocked.stepLive);
const gap = Math.hypot(blocked.live.x - 0, blocked.live.z - (-0.9));
assert.ok(gap >= 0.55 + 0.42 - 0.02, gap);
assert.ok(blocked.live.z > -0.9, blocked.live.z);

// Measured phone frames are fully consumed. A 2 s pause is not.
assert.ok(Math.abs(paceSteps(0.0847).reduce((a, b) => a + b, 0) - 0.0847) < 1e-9);
assert.ok(Math.abs(paceSteps(0.2051).reduce((a, b) => a + b, 0) - 0.2051) < 1e-9);
assert.ok(Math.abs(paceSteps(2).reduce((a, b) => a + b, 0) - WALL_LIMIT_S) < 1e-9);
for (const dt of paceSteps(0.2051)) assert.ok(dt <= 0.05 + 1e-12);

console.log('PASS sim-pace', { capped: +capped.mps.toFixed(2), paced: +paced.mps.toFixed(2), medianOnly: +medianOnly.toFixed(2), reported: report.metresPerSec });
