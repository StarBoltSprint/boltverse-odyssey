// The 19:36 export has medians only. A median ratio of 1 does not mean every frame applied its wall time.
import assert from 'node:assert/strict';
import { classifyFrames } from '../../engine/bricks/frame-diag.js';
import { WALL_LIMIT_S } from '../../engine/bricks/sim-pace.js';

const phone = {
  n: 64, medianWallMs: 84.7, medianAppliedMs: 84.7, p95WallMs: 273,
  appliedOverWall: 1, metresPerSec: 5.43,
};
assert.equal(+(phone.medianAppliedMs / phone.medianWallMs).toFixed(3), phone.appliedOverWall);
assert.ok(phone.p95WallMs / 1000 < WALL_LIMIT_S);
assert.ok(phone.metresPerSec < 7);

const steady = classifyFrames(Array.from({ length: 64 }, () => ({ wall: 0.0847, applied: 0.0847, speed: 5.43 })));
assert.equal(steady.kind, 'slow-frames');
assert.equal(steady.appliedOverWall, 1);
assert.equal(steady.metresPerSec, 5.43);

const samples = Array.from({ length: 63 }, () => ({ wall: 0.0847, applied: 0.0847, speed: 7 }));
samples.push({ wall: 0.8, applied: 0.5, speed: 7 });
const skewed = classifyFrames(samples);
assert.equal(skewed.appliedOverWall, 1);
assert.ok(skewed.metresPerSec < 7, skewed.metresPerSec);
console.log('PASS phone-window-1936', { kind: steady.kind, skewedMps: skewed.metresPerSec, wallLimit: WALL_LIMIT_S });
