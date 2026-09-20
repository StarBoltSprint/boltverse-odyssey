'use strict';
const { computeScale, scaleAtS, assertScale, laneWidthAt } = require('./boltScale');

// Frost FAIL geometry: huge dog vs narrow lane — after scale, lane HARD in band
const frost = computeScale({
  boltWidthPx: 520,
  boltWithersPx: 480, // shoulders, not ears
  laneWidthPx: 400, // center lane px at plant
  frameH: 1168,
});
console.log('frost:', frost);
assertScale(frost);

// Truck case: lane too narrow for tall cutout aspect → may FAIL assert
try {
  const truck = computeScale({
    boltWidthPx: 700,
    boltWithersPx: 900,
    laneWidthPx: 200,
    frameH: 1168,
  });
  console.log('truck attempt:', truck);
  assertScale(truck);
  console.log('truck unexpectedly PASS');
} catch (e) {
  console.log('truck FAIL (expected possible):', e.message);
}

console.log('scaleAtS mid', scaleAtS(frost.scale, 0.9, 1).toFixed(4));
const table = [{ s: 0, w: 0.14 }, { s: 0.5, w: 0.10 }];
console.log('laneWidthAt', laneWidthAt(table, 0, 768).toFixed(1));
console.log('demo OK');
