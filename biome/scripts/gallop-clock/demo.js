'use strict';
const {
  frameAtPlateTime,
  stridePhase,
  roadSpeedForCadence,
  dsPerFrame,
  assertGallopClock,
  assertCanonCycle,
  videoClockSnippet,
} = require('./gallopClock');

assertCanonCycle();
console.log('assertCanonCycle PASS (534/96/22)');

// 0.5s into plate @ 4Hz, 22 strides/cycle
const a = frameAtPlateTime(0.5);
console.log('frame@0.5s', a);
console.log('phase@0', stridePhase(0), 'phase@0.25', stridePhase(0.25));

try {
  assertCanonCycle({ cycleFrames: 89, cycleDuration: 89 / 96 });
} catch (e) {
  console.log('assertCanonCycle 89-frame FAIL (expected):', e.message.slice(0, 72) + '…');
}

const speed = roadSpeedForCadence(80); // 80px along s per stride
console.log('roadSpeed px/s', speed);
console.log('dsPerFrame@48', dsPerFrame(80, 48).toFixed(3));

// PASS: showing ~48 dog frames in 1s on 48fps plate
assertGallopClock({ dogFramesShown: 48, windowSec: 1, plateFps: 48 });
console.log('assert dense PASS');

// FAIL: stepped ~8 fps dog
try {
  assertGallopClock({ dogFramesShown: 8, windowSec: 1, plateFps: 48 });
} catch (e) {
  console.log('assert stepped FAIL (expected):', e.message.slice(0, 80) + '…');
}

console.log('--- snippet ---');
console.log(videoClockSnippet());
console.log('demo OK');
