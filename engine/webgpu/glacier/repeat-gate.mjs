// Tile-period repeat gate.
// The previous bar (any autocorrelation peak outside 20 px, max 0.31) scored
// the native glacier-ice still at 0.44, so it was measuring the photograph.
// This gate looks only at lags of the on-screen tile period and its second
// harmonic, and compares each to the same lag on the native still.
//
// Fail when the crop's peak at the tile period exceeds the native still's
// peak at that lag by more than 0.10, or when two harmonics both clear that
// margin (a lattice, not one bump).
//
// Period is the on-screen tile, from the camera: focal * 0.5 m / distance,
// times the crop scale. The plain-tile fixture passes --period directly.
//   node repeat-gate.mjs --period 64 --native tex/glacier-ice/v1.jpg crop.jpg
//   node repeat-gate.mjs --distance 86 --scale 3 --native tex/glacier-ice/v1.jpg crop.jpg
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const REPEAT_MARGIN = 0.10;
const FOCAL = (1280 / 2) / Math.tan(31 * Math.PI / 180);
const TILE_M = 0.5;

export function tilePeriodPx(distance, scale = 1) {
  return FOCAL * TILE_M / distance * scale;
}

function parseArgs(argv) {
  const out = { files: [], period: 0, distance: 0, scale: 1, native: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--period') out.period = Number(argv[++i]);
    else if (a === '--distance') out.distance = Number(argv[++i]);
    else if (a === '--scale') out.scale = Number(argv[++i]);
    else if (a === '--native') out.native = argv[++i];
    else out.files.push(a);
  }
  return out;
}

export function measureRepeat(file, native, period) {
  const py = path.join(path.dirname(fileURLToPath(import.meta.url)), 'repeat-measure.py');
  const r = spawnSync('python3', [py, file, native, String(period)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'repeat measure failed').slice(-400));
  return JSON.parse(r.stdout.trim());
}

function judge(row) {
  const over = row.crop1 - row.native1;
  const h1 = over > REPEAT_MARGIN;
  const h2 = row.crop2 - row.native2 > REPEAT_MARGIN;
  const lattice = h1 && h2;
  return { pass: !h1 && !lattice, over: +over.toFixed(4), h1, h2, lattice };
}

const args = parseArgs(process.argv.slice(2));
const period = args.period || (args.distance ? tilePeriodPx(args.distance, args.scale) : 0);
if (!args.files.length || !args.native || !(period > 4)) {
  console.error('usage: node repeat-gate.mjs --native <still.jpg> (--period N | --distance M --scale S) <crop> ...');
  process.exit(2);
}
let fail = 0;
const rows = [];
for (const file of args.files) {
  if (!fs.existsSync(file)) {
    console.error('FAIL missing', file);
    fail++;
    continue;
  }
  const m = measureRepeat(file, args.native, period);
  const j = judge(m);
  const row = { file: path.basename(file), period: +period.toFixed(2), ...m, ...j };
  rows.push(row);
  const line = `${j.pass ? 'PASS' : 'FAIL'} ${row.file} period ${row.period} crop1 ${m.crop1} native1 ${m.native1} over ${j.over} crop2 ${m.crop2} native2 ${m.native2}${j.lattice ? ' lattice' : ''}`;
  if (j.pass) console.log(line);
  else { console.error(line); fail++; }
}
const outPath = process.env.REPEAT_JSON;
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ margin: REPEAT_MARGIN, period, native: args.native, rows }, null, 2));
if (fail) process.exit(1);
console.log('PASS repeat', args.files.length);
