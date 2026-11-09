import { classifyFrames, diagOn, diagText } from '../../engine/bricks/frame-diag.js';
import assert from 'node:assert/strict';

const fill = (n, wall, applied, speed) => Array.from({ length: n }, () => ({ wall, applied, speed }));

const steady = classifyFrames(fill(12, 1 / 60, 1 / 60, 7));
assert.equal(steady.kind, 'steady');
assert.ok(Math.abs(steady.metresPerSec - 7) < 0.05, steady.metresPerSec);

// 80 ms frames, simulation capped at 50 ms: the dog is actually slower.
const capped = classifyFrames(fill(12, 0.08, 0.05, 7));
assert.equal(capped.kind, 'slow-frames-capped-sim');
assert.ok(Math.abs(capped.metresPerSec - 7 * 0.05 / 0.08) < 0.05, capped.metresPerSec);

// 40 ms frames stay under the cap, so the dog still covers 7 m/s. The frames are slow.
const slow = classifyFrames(fill(12, 0.04, 0.04, 7));
assert.equal(slow.kind, 'slow-frames');
assert.ok(Math.abs(slow.metresPerSec - 7) < 0.05, slow.metresPerSec);

// Mostly 60 fps, two long hitches. Median stays short; the tail is the stutter.
const hitch = fill(18, 1 / 60, 1 / 60, 7);
hitch[3] = { wall: 0.2, applied: 0.05, speed: 7 };
hitch[11] = { wall: 0.18, applied: 0.05, speed: 7 };
const h = classifyFrames(hitch);
assert.equal(h.kind, 'hitch');
assert.ok(h.medianWallMs < 30, h.medianWallMs);

assert.equal(classifyFrames(fill(4, 0.016, 0.016, 7)).kind, 'warming');

assert.equal(diagOn(''), false);
assert.equal(diagOn('?v=9collide'), false);
assert.equal(diagOn('?diag=0'), false);
assert.equal(diagOn('diag=1'), true);
assert.equal(diagOn('?diag=1'), true);

const warm = diagText(classifyFrames(fill(3, 0.016, 0.016, 7)), null);
assert.match(warm, /warming 3\/8/);
assert.match(warm, /gpu time not measured/);
assert.doesNotMatch(warm, /gpu time \d/);

const shown = diagText(steady, { vendor: 'Qualcomm', architecture: 'adreno-650', device: '', description: '', isFallback: false });
assert.match(shown, /wall med /);
assert.match(shown, /p95 /);
assert.match(shown, /sim /);
assert.match(shown, /m\/s/);
assert.match(shown, /adapter Qualcomm adreno-650/);
assert.match(shown, /n=12/);
assert.doesNotMatch(shown, /idle/);
assert.match(diagText({ ...capped, metresPerSec: 0 }, null), /idle/);
console.log('PASS frame-diag');
