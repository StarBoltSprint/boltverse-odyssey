'use strict';
const {
  computeScale,
  scaleAtS,
  assertScale,
  laneWidthAt,
} = require('./boltScale');

// Synthetic Frost FAIL: native paste fills ~71% of lane (dog≈truck)
const frost = {
  boltWidthPx: 400,
  boltWithersPx: 480,
  laneWidthPx: 560,
  frameH: 1168,
};
console.log('FAIL-ish native paste (before computeScale):', {
  scale: 1,
  withersFrac: frost.boltWithersPx / frost.frameH,
  laneFrac: frost.boltWidthPx / frost.laneWidthPx,
});

const ok = computeScale(frost);
// computeScale sets k≈0.40 + withers clamp — assert should PASS
assertScale(ok);
console.log('PASS after computeScale:', ok);

// Perspective: road narrows ahead
const spawn = ok.scale;
console.log('scaleAtS mid:', scaleAtS(spawn, 0.85, 1.0).toFixed(4));
console.log('scaleAtS far:', scaleAtS(spawn, 0.55, 1.0).toFixed(4));

const table = [
  { s: 0, w: 0.12 },
  { s: 0.5, w: 0.09 },
  { s: 1, w: 0.06 },
];
console.log('laneWidthAt s=0 (UV*768):', laneWidthAt(table, 0, 768).toFixed(1));
console.log('laneWidthAt s=0.5:', laneWidthAt(table, 0.5, 768).toFixed(1));

console.log('demo OK');
