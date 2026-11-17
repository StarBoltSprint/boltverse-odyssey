// Far-detail gate. Distant ice must keep the run 31 grain.
// The round-2 stills (forced mip 10) are the fixture that must fail.
// A candidate directory must clear the run 31 floor at every standard time.
// Flicker, when a D8 report is passed, stays under half of run 31.
// The page triangle count must match the mesh this file builds.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { buildWorld } from './world.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const W = 720;
const CROP = [180, 240, 540, 520];
const TIMES = ['t5.1', 't5.567', 't7.9', 't11.7', 't24', 't30'];
const RUN31_FLICKER = {
  5.1: 5.262, 5.567: 5.274, 7.9: 5.641, 11.7: 4.367, 24: 4.850, 30: 5.563,
};

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function load(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], {
    encoding: 'buffer', maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout || r.stdout.length < W * 1280 * 3) {
    throw new Error('decode ' + file);
  }
  return r.stdout;
}

// High-pass energy. Mean absolute deviation from the 4-neighbour mean, radius 2.
export function detailOf(file) {
  const rgb = load(file);
  const [x0, y0, x1, y1] = CROP;
  const luma = (x, y) => {
    const i = (y * W + x) * 3;
    return rgb[i] * 0.2126 + rgb[i + 1] * 0.7152 + rgb[i + 2] * 0.0722;
  };
  let s = 0;
  let n = 0;
  for (let y = y0 + 2; y < y1 - 2; y++) {
    for (let x = x0 + 2; x < x1 - 2; x++) {
      const c = luma(x, y);
      const m = (luma(x - 2, y) + luma(x + 2, y) + luma(x, y - 2) + luma(x, y + 2)) * 0.25;
      s += Math.abs(c - m);
      n++;
    }
  }
  return s / n;
}

function setOf(dir) {
  const row = {};
  for (const t of TIMES) row[t] = +detailOf(path.join(dir, t + '.jpg')).toFixed(3);
  return row;
}

const beforeDir = path.join(here, 'artifacts/run32/before');
const round2Dir = path.join(here, 'fixtures/round2-flat');
const floor = setOf(beforeDir);
const round2 = setOf(round2Dir);
for (const t of TIMES) {
  if (!(round2[t] < floor[t])) bad('round-2 fixture did not fail ' + t + ' detail ' + round2[t] + ' floor ' + floor[t]);
}

const albedo = fs.readFileSync(path.join(here, 'albedo.js'), 'utf8');
if (/fn farLevel/.test(albedo)) bad('forced mip-10 farLevel is still in the ice sampler');
if (/fn farAniso/.test(albedo)) bad('manual grazing mip clamp is back');
if (/clamp\(natMinor, 3\.0, 5\.0\)/.test(albedo)) bad('short-axis mip is still clamped to 3-5');
if (!/textureSampleGrad\(arr, samp/.test(albedo)) bad('far ice is not on hardware gradients');

const world = buildWorld();
const candidate = process.argv[2];
let candidateDetail = null;
if (candidate) {
  candidateDetail = setOf(candidate);
  for (const t of TIMES) {
    if (!(candidateDetail[t] >= floor[t])) {
      bad('detail ' + t + ' ' + candidateDetail[t] + ' floor ' + floor[t]);
    }
  }
}

const report = process.argv[3];
if (report) {
  const rows = JSON.parse(fs.readFileSync(report, 'utf8')).rows;
  for (const row of rows) {
    const base = RUN31_FLICKER[row.t] || RUN31_FLICKER[Number(row.t)];
    if (base && !(row.flicker <= base * 0.5)) {
      bad('flicker ' + row.t + ' ' + row.flicker + ' bar ' + (base * 0.5).toFixed(3));
    }
    if (row.worldTris !== world.budget.worldTris) {
      bad('page worldTris ' + row.worldTris + ' node ' + world.budget.worldTris);
    }
    if (row.tris !== world.budget.totalTris) {
      bad('page tris ' + row.tris + ' node ' + world.budget.totalTris);
    }
  }
}

const out = {
  crop: { x0: CROP[0], y0: CROP[1], x1: CROP[2], y1: CROP[3], metric: 'highpass-r2' },
  floor,
  round2,
  round2Fails: true,
  candidate: candidateDetail,
  faces: {
    greySlabs: 'addWall MAT.wall glacier-ice v1-v4',
    rightShard: 'addChaseFall(-210) right stream MAT.fall fall-ice v1-v4',
    farCones: 'addRange MAT.mountain serac v1-v4',
  },
  budget: { worldTris: world.budget.worldTris, tris: world.budget.totalTris, draws: world.budget.draws },
};
console.log(JSON.stringify(out));
if (fail) {
  console.error('FAIL far-detail', fail);
  process.exit(1);
}
console.log('PASS far-detail');
