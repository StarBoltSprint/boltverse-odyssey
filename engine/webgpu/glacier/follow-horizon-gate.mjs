// Follow-camera horizon and crest staircase. The level mcam row is snow in
// these stills. This gate reads the 720×1280 follow picture.
//   node follow-horizon-gate.mjs <frame.jpg> ...
// A sibling <frame>-mat.png is the sky label (material 5). Without it, peach
// sky is read from the colour.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const SKY_WINDOW_MAX = 0.12;
export const STAIR_RUN = 8;
export const STAIR_JUMP = 6;
export const STAIR_COUNT = 2;

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { w, h, raw };
}

function matId(im, x, y) {
  const i = (y * im.w + x) * 3;
  return Math.round(im.raw[i] / 255 * 8 - 0.5);
}

function peachSky(im, x, y) {
  const i = (y * im.w + x) * 3;
  const r = im.raw[i];
  const g = im.raw[i + 1];
  const b = im.raw[i + 2];
  if (r > 230 && g > 230 && b > 230) return false;
  if (r + g + b < 400) return false;
  if (b > r + 8) return false;
  return r >= 155 && g >= 135 && r + 6 >= g;
}

function skylineOf(im, skyFn) {
  const { w, h } = im;
  const line = new Array(w);
  for (let x = 0; x < w; x++) {
    let y = h - 4;
    while (y > 40 && skyFn(x, y)) y--;
    let top = y;
    while (y > 30) {
      if (!skyFn(x, y)) { top = y; y--; continue; }
      let gap = 0;
      let y2 = y;
      while (y2 > 30 && skyFn(x, y2) && gap < 10) { y2--; gap++; }
      if (gap >= 10) break;
      y = y2;
    }
    line[x] = top;
  }
  return line;
}

function median(vals) {
  const s = vals.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function followHorizon(file) {
  const colour = load(file);
  const matPath = file.replace(/\.(jpg|jpeg|png)$/i, '-mat.png');
  const mat = fs.existsSync(matPath) ? load(matPath) : null;
  const skyFn = mat
    ? (x, y) => matId(mat, x, y) === 5
    : (x, y) => peachSky(colour, x, y);
  const line = skylineOf(colour.w ? colour : mat, skyFn);
  const w = colour.w;
  const h = colour.h;
  const side = (x0, x1) => median(line.slice(x0, x1).filter((y) => y > 100 && y < h * 0.72));
  const left = side(Math.floor(w * 0.08), Math.floor(w * 0.28));
  const right = side(Math.floor(w * 0.72), Math.floor(w * 0.92));
  const rims = [left, right].filter((y) => Number.isFinite(y));
  const rim = rims.length ? Math.min(...rims) : Math.floor(h * 0.35);
  const centre = median(line.slice(Math.floor(w * 0.40), Math.floor(w * 0.60)));
  const lo = Math.max(centre, rim + 1);
  let sky = 0;
  let tot = 0;
  const x0 = Math.floor(w * 0.38);
  const x1 = Math.floor(w * 0.62);
  for (let x = x0; x < x1; x += 2) {
    for (let y = rim; y < lo; y += 2) {
      tot++;
      if (skyFn(x, y)) sky++;
    }
  }
  const frac = tot ? sky / tot : 0;
  return { frac: +frac.toFixed(4), rim, centre, left, right, w, h };
}

function staircases(line) {
  const found = [];
  let x = 0;
  const plateaus = [];
  while (x < line.length) {
    const y0 = line[x];
    let x2 = x;
    while (x2 < line.length && Math.abs(line[x2] - y0) <= 2) x2++;
    const run = x2 - x;
    if (run >= STAIR_RUN && y0 > 80 && y0 < 1100) plateaus.push({ x, run, y: y0 });
    x = Math.max(x2, x + 1);
  }
  let runUp = 0;
  let runDn = 0;
  let best = 0;
  for (let i = 1; i < plateaus.length; i++) {
    const dy = plateaus[i].y - plateaus[i - 1].y;
    if (dy >= STAIR_JUMP) runUp++;
    else runUp = 0;
    if (-dy >= STAIR_JUMP) runDn++;
    else runDn = 0;
    best = Math.max(best, runUp, runDn);
    if (runUp >= STAIR_COUNT || runDn >= STAIR_COUNT) {
      found.push({ x: plateaus[i].x, y: plateaus[i].y, steps: Math.max(runUp, runDn) });
    }
  }
  return { steps: best, hits: found.length };
}

export function crestStairs(file) {
  const colour = load(file);
  const matPath = file.replace(/\.(jpg|jpeg|png)$/i, '-mat.png');
  const mat = fs.existsSync(matPath) ? load(matPath) : null;
  const skyFn = mat
    ? (x, y) => matId(mat, x, y) === 5
    : (x, y) => peachSky(colour, x, y);
  const line = skylineOf(colour, skyFn);
  const w = line.length;
  const left = staircases(line.slice(0, Math.floor(w * 0.42)));
  const right = staircases(line.slice(Math.floor(w * 0.58)));
  const steps = Math.max(left.steps, right.steps);
  return { steps, left: left.steps, right: right.steps };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node follow-horizon-gate.mjs <frame> ...');
  process.exit(2);
}
let fail = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.error('FAIL missing', file); fail++; continue; }
  const win = followHorizon(file);
  const stair = crestStairs(file);
  const badWin = win.frac > SKY_WINDOW_MAX;
  const badStair = stair.steps >= STAIR_COUNT;
  if (badWin || badStair) {
    console.error('FAIL', path.basename(file), JSON.stringify({ ...win, ...stair, skyMax: SKY_WINDOW_MAX, stairMin: STAIR_COUNT }));
    fail++;
  } else {
    console.log('PASS', path.basename(file), JSON.stringify({ frac: win.frac, steps: stair.steps }));
  }
}
if (fail) process.exit(1);
console.log('PASS follow-horizon', files.length);
