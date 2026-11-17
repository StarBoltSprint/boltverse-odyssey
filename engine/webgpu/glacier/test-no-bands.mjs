// Blocking no-bands gate. Torso/back crops at the six chase times.
// A vertical scanline counts a step when the blurred (B-R) trace has a peak
// stronger than STEP_DELTA. The pre-D card has none. The blue-band fixture
// has several. The limit sits between them and is not a knob.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const NAMES = ['t5_1.jpg', 't5_567.jpg', 't7_9.jpg', 't11_7.jpg', 't24.jpg', 't30.jpg'];
export const CROP = { x0: 330, x1: 400, y0: 780, y1: 980 };
export const STEP_DELTA = 14;
export const STEP_LIMIT = 0.5;

function loadRgb(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 20 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('ffmpeg ' + file);
  return raw.stdout;
}

function blur(src) {
  const out = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) {
    let s = 0;
    let n = 0;
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j >= 0 && j < src.length) { s += src[j]; n++; }
    }
    out[i] = s / n;
  }
  return out;
}

export function stepsOn(rgb, w, crop = CROP) {
  const lines = [];
  for (let x = crop.x0; x < crop.x1; x += 2) {
    const br = [];
    for (let y = crop.y0; y < crop.y1; y++) {
      const i = (y * w + x) * 3;
      br.push(rgb[i + 2] - rgb[i]);
    }
    const smooth = blur(br);
    const d = [];
    for (let i = 0; i < smooth.length - 2; i++) d.push(smooth[i + 2] - smooth[i]);
    let steps = 0;
    const spikes = [];
    for (let i = 1; i < d.length - 1; i++) {
      const a = Math.abs(d[i]);
      if (a > STEP_DELTA && a >= Math.abs(d[i - 1]) && a >= Math.abs(d[i + 1])) {
        steps++;
        spikes.push(a);
      }
    }
    lines.push({ steps, spikes });
  }
  const mean = lines.reduce((s, l) => s + l.steps, 0) / (lines.length || 1);
  return { mean: +mean.toFixed(3), columns: lines.length };
}

export function scoreDir(dir) {
  const rows = [];
  for (const name of NAMES) {
    const file = path.join(dir, name);
    const rgb = loadRgb(file);
    const row = stepsOn(rgb, 720);
    rows.push({ name, ...row, verdict: row.mean > STEP_LIMIT ? 'FAIL' : 'PASS' });
  }
  const worst = rows.reduce((a, b) => (a.mean > b.mean ? a : b));
  return {
    dir,
    crop: CROP,
    stepDelta: STEP_DELTA,
    stepLimit: STEP_LIMIT,
    worst: worst.mean,
    verdict: worst.mean > STEP_LIMIT ? 'FAIL' : 'PASS',
    rows,
  };
}

const mode = process.argv[2] || 'controls';
const fixtureDir = path.join(here, 'artifacts/run32/band-fixture');
const preDir = path.join(here, 'artifacts/run32/pre-d');

if (mode === 'controls') {
  const fixture = scoreDir(fixtureDir);
  const pred = scoreDir(preDir);
  const report = { fixture, preD: pred };
  const out = path.join(here, 'artifacts/run32/no-bands-controls.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (fixture.verdict !== 'FAIL') {
    console.error('FAIL negative control: blue-band fixture did not fail');
    process.exit(1);
  }
  if (pred.verdict !== 'PASS') {
    console.error('FAIL pre-D card is over the band limit');
    process.exit(1);
  }
  console.log('PASS no-bands controls (fixture FAIL, pre-D PASS)');
} else if (mode === 'dir') {
  const report = scoreDir(process.argv[3]);
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== 'PASS') process.exit(1);
  console.log('PASS no-bands');
} else {
  console.error('usage: test-no-bands.mjs [controls|dir <path>]');
  process.exit(2);
}
