// D8 blocking checks.
// Thresholds, fixed before the render trial:
//   no distance-to-sky mix in the world shader
//   the run 31 fixture must fail that check
//   far/near spire contrast >= 1.5 on solid, similarly lit faces
//   far ice chroma stays with the ice, not the sky (normalized linear RGB)
//   horizon row-step <= the run 31 step at that time + 0.5
//   flicker index on spires 100-300 m <= half the run 31 index
//   tris <= 200000, draws <= 12
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LIMITS } from './biome.js';
import { fogHits } from './fog-gate.js';
import { lodCover, valueAt } from './lod.js';
import { buildWorld } from './world.js';

const here = path.dirname(fileURLToPath(import.meta.url));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const shader = fs.readFileSync(path.join(here, 'glacier.js'), 'utf8');
const fixture = fs.readFileSync(path.join(here, 'fixtures/run31-fs-fog.wgsl'), 'utf8');
const liveHits = fogHits(shader);
const oldHits = fogHits(fixture);
if (liveHits.length) bad('live shader mixes distance into the sky: ' + liveHits.join(' | '));
if (!oldHits.length) bad('run 31 fixture did not fail the no-fog check');
if (/fract\(sin\(dot\(v\.p\.xy/.test(shader)) bad('screen-space hash discard is still in the shader');
if (!/alphaToCoverageEnabled: true/.test(shader)) bad('world pipeline has no alpha-to-coverage');
if (!/errPx/.test(shader)) bad('screen-error term missing');

const world = buildWorld();
if (world.budget.totalTris > LIMITS.tris) bad('tris ' + world.budget.totalTris);
if (world.budget.draws > LIMITS.draws) bad('draws ' + world.budget.draws);
const ratio = valueAt(80) / valueAt(500);
if (!(ratio >= 1.5)) bad('value layer ratio ' + ratio.toFixed(3));
const sag = 1.35;
for (const dist of [400, 900, 1600, 4000]) {
  const sum = lodCover(sag, dist) + lodCover(-sag, dist);
  if (Math.abs(sum - 1) > 1e-6) bad('LOD covers do not add to 1 at ' + dist);
}
if (lodCover(0, 200) !== 1) bad('terminal LOD is not opaque');

// Run 31 raw flicker at the six times (same route, flakes hidden). The bar is half.
const RUN31 = {
  5.1: { flicker: 5.262, horizon: 5.470 },
  5.567: { flicker: 5.274, horizon: 4.140 },
  7.9: { flicker: 5.641, horizon: 5.144 },
  11.7: { flicker: 4.367, horizon: 3.140 },
  24: { flicker: 4.850, horizon: 2.787 },
  30: { flicker: 5.563, horizon: 3.425 },
};

const report = process.argv[2];
if (report) {
  const rows = JSON.parse(fs.readFileSync(report, 'utf8')).rows;
  for (const row of rows) {
    const base = RUN31[row.t] || RUN31[Number(row.t)];
    if (!(row.contrast >= 1.5)) bad('contrast ' + row.t + ' ' + row.contrast);
    if (!row.chromaPass) bad('chroma ' + row.t + ' dIce ' + row.dIce + ' dSky ' + row.dSky);
    if (base && !(row.horizon <= base.horizon + 0.5)) bad('horizon ' + row.t + ' ' + row.horizon + ' base ' + base.horizon);
    if (base && !(row.flicker <= base.flicker * 0.5)) bad('flicker ' + row.t + ' ' + row.flicker + ' bar ' + (base.flicker * 0.5).toFixed(3));
    console.log(JSON.stringify({
      t: row.t, contrast: row.contrast, chromaPass: row.chromaPass,
      horizon: row.horizon, flicker: row.flicker, shimmer: row.shimmer,
      tris: row.tris, draws: row.draws,
    }));
  }
}

if (fail) {
  console.error('FAIL no-fog', fail);
  process.exit(1);
}
console.log('PASS no-fog', JSON.stringify({
  tris: world.budget.totalTris,
  draws: world.budget.draws,
  lodTris: world.budget.lodTris,
  valueRatio: +ratio.toFixed(3),
  fixtureHits: oldHits.length,
}));
