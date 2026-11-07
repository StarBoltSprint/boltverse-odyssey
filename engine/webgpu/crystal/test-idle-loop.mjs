// Crystal must use the filmed gen4b breath, not the bolt-idle sine warp.
import assert from 'node:assert/strict';
import fs from 'fs';
import { boltIdle } from '../bricks/bolt-idle.js';
import { stepBreath, breathFrame, rgbaName, BREATH_MEADOW, BREATH_BUILD } from '../bricks/bolt-breath.js';
import { proofInput, integrate, spawn, terrH } from './world.js';
import { makeCircleCollide } from '../engine/bricks/circle-collide.js';
import { buildWorld } from './world.js';

const src = fs.readFileSync(new URL('./crystal.js', import.meta.url), 'utf8');
assert.equal(src.includes("from '../bricks/bolt-breath.js'"), true);
assert.equal(src.includes('makeBreathClip'), true);
assert.equal(src.includes('stepBreath'), true);
assert.equal(src.includes('U[52] = 0'), true);
assert.equal(src.includes('U[53] = live.idleMix'), true);
assert.equal(src.includes('breathMix('), true);
assert.equal(src.includes('breathClip.sync'), true);
assert.equal(src.includes('bolt_idle'), false, 'crystal must not name a substitute clip');

const idle = boltIdle();
const cfg = { ...BREATH_MEADOW, speed: idle.cfg.speed, blendV: idle.cfg.blendV };
const world = buildWorld();
const collide = makeCircleCollide(world.circles, { boltR: 0.42 });
const live = spawn();
const dt = 1 / 60;
const frames = new Set();
let stopped = 0;
let maxPsi = 0;
let minPsi = 0;
let resumed = false;
for (let i = 0; i < 20 * 60; i++) {
  const t = i * dt;
  const input = proofInput(t);
  idle.stepMotion(live, dt, input.run);
  stepBreath(live, dt, input.run, cfg);
  integrate(live, dt, input, collide);
  maxPsi = Math.max(maxPsi, live.psi);
  minPsi = Math.min(minPsi, live.psi);
  if (live.breathState === 'idle' && live.v === 0) {
    stopped += dt;
    frames.add(live.breathFrame);
  }
  if (t > 14 && live.v > 6) resumed = true;
}
assert.ok(maxPsi - minPsi > 0.7, 'yaw swing ' + (maxPsi - minPsi));
assert.ok(stopped > 3, 'idle seconds ' + stopped);
assert.ok(frames.size >= 24, 'gen4b frames during idle ' + frames.size);
assert.equal(resumed, true);
assert.equal(breathFrame(0, cfg), 0);
assert.equal(rgbaName(0, cfg), 'bolt_idle4b5_rgba/f0000.png');
assert.equal(rgbaName(143, cfg), 'bolt_idle4b5_rgba/f0143.png');
const y = terrH(live.x, live.z);
assert.ok(Number.isFinite(y));
console.log('PASS crystal-breath', { build: BREATH_BUILD, idleS: +stopped.toFixed(2), frames: frames.size, yawDeg: +((maxPsi - minPsi) * 180 / Math.PI).toFixed(1) });
