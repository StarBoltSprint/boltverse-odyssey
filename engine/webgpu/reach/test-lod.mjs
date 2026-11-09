// LOD seams and streaming. Shared edge under 1 mm. The window moves with the camera.
import { makeHeight } from '../engine/bricks/heightfield.js';
import { HEIGHT_SPEC } from './biome.js';
import { buildWindow, seamError, pointInMesh, residentChunks, outerRadius, LEVELS } from '../engine/bricks/terrain-clipmap.js';
import { buildSolid } from '../engine/bricks/huge-structure.js';
import { STRUCTURES } from './biome.js';

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const heightOf = makeHeight(HEIGHT_SPEC);
const cam = [12.4, -30.2];
const win = buildWindow(cam[0], cam[1], heightOf);
if (win.levels.length !== LEVELS) bad('levels ' + win.levels.length);
if (outerRadius() < 8000) bad('extent ' + outerRadius());

let worst = 0, missing = 0;
for (let L = 0; L < LEVELS - 1; L++) {
  const e = seamError(win.levels[L], win.levels[L + 1]);
  worst = Math.max(worst, e.maxDy);
  missing += e.missing;
  if (e.missing) bad('missing seam verts L' + L + ' ' + e.missing);
  if (e.maxDy > 0.001) bad('seam L' + L + ' ' + e.maxDy);
}

const samples = [[0, 2], [0, 20], [0, 31.2], [0, 33], [80, -10], [400, 200], [1500, -800], [6000, 1000], [12000, -2000]];
for (const [x, z] of samples) {
  let hit = false;
  for (const level of win.levels) if (pointInMesh(level, cam[0] + x, cam[1] + z)) hit = true;
  if (!hit) bad('hole at ' + x + ',' + z);
}
let outside = false;
for (const level of win.levels) if (pointInMesh(level, cam[0] + 20000, cam[1])) outside = true;
if (outside) bad('mesh past the window');

const a = residentChunks(0, 0);
const b = residentChunks(2000, -1500);
let same = a.size === b.size;
if (same) {
  same = [...a].every(k => b.has(k));
}
if (same) bad('stream did not move');
if (a.size < 10) bad('chunks ' + a.size);

for (const spec of STRUCTURES) {
  const near = buildSolid(spec, 0, heightOf);
  const far = buildSolid(spec, 2, heightOf);
  if (Math.abs(near.crest - far.crest) > 1e-4) bad('crest pop ' + spec.id + ' ' + near.crest + ' ' + far.crest);
  if (Math.abs(near.y0 - far.y0) > 1e-4) bad('seat pop ' + spec.id);
  if (near.y0 > heightOf(spec.x, spec.z) + 0.01) bad('float ' + spec.id);
}

const moved = buildWindow(cam[0] + 0.01, cam[1], heightOf);
let jump = 0;
const n = win.levels[0].pos.length;
for (let i = 1; i < n; i += 3) jump = Math.max(jump, Math.abs(moved.levels[0].pos[i] - win.levels[0].pos[i] - 0));
const dy = maxAbsDelta(win.levels[0].pos, moved.levels[0].pos);
if (dy > 0.02) bad('near pop ' + dy);

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log(JSON.stringify({
  pass: 'lod',
  levels: LEVELS,
  radiusM: outerRadius(),
  seamMm: +(worst * 1000).toFixed(4),
  missing,
  chunks: a.size,
  chunksMoved: !same,
  nearStepM: +dy.toFixed(5),
  jump,
}));

function maxAbsDelta(a, b) {
  let m = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 1; i < n; i += 3) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}
