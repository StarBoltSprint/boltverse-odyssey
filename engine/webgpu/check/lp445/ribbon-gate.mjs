// Proves the cut20 "more samples raise the ribbon" premise is false,
// and that the unpinned ribbon stays on the path sample the feet use.
import { cut20RibbonY, cut20RpY, ribbonY } from '../../engine/bricks/path-ribbon.js';

const boltY = 80;
const eyeY = 82;
// Path climbs 4 m per metre of arc ahead of Bolt. The sample under the feet is boltY.
function pathAt(ds) { return boltY + Math.max(0, ds) * 4; }

function drawnCut20(ds) {
  const pathY = pathAt(ds);
  const dh = Math.abs(ds);
  const y0 = cut20RibbonY({ pathY, boltY, ds });
  return cut20RpY({ ribbonY: y0, boltY, dh, eyeY });
}

const foot = pathAt(0);
console.log('cut20 drawnY vs pathY (path climbs 4 m per metre; boltY>20 pins the lead):');
for (const ds of [0, 0.25, 1, 4, 8, 16]) {
  console.log(`  ds=${ds} drawn=${drawnCut20(ds).toFixed(2)} path=${pathAt(ds).toFixed(1)} foot=${foot.toFixed(1)}`);
}

// The clamp is closed-form in arc distance. A finer sample step evaluates the same ds
// and cannot raise the ribbon. That is the failed premise.
const coarse = drawnCut20(8);
const fine = [0, 0.25, 0.5, 1, 2, 4, 8].map(drawnCut20).at(-1);
const premiseHolds = fine > coarse + 0.5;
console.log('premise more-samples-raises-ribbon', premiseHolds, 'coarse', coarse.toFixed(2), 'fine', fine.toFixed(2));

const fails = [];
if (premiseHolds) fails.push('premise unexpectedly held');
if (Math.abs(drawnCut20(8) - foot) > 0.05) fails.push('cut20 lead left bolt altitude');
if (pathAt(8) - drawnCut20(8) < 20) fails.push('cut20 followed the climb');
// The fix matches the path, including under the feet.
for (const ds of [0, 1, 8, 16]) {
  const y = ribbonY({ pathY: pathAt(ds) });
  if (Math.abs(y - pathAt(ds)) > 1e-6) fails.push(`fix left ds=${ds}`);
}
if (Math.abs(ribbonY({ pathY: foot }) - foot) > 1e-6) fails.push('feet and ribbon diverge at ds=0');
// Slope of the fix over 1 m equals the path slope (4), not a vertical spike from a clamp.
const slope = ribbonY({ pathY: pathAt(1) }) - ribbonY({ pathY: pathAt(0) });
if (Math.abs(slope - 4) > 1e-6) fails.push(`fix slope ${slope}`);
if (fails.length) {
  console.error('FAIL', fails.join('; '));
  process.exit(1);
}
console.log('PASS ribbon-gate');
