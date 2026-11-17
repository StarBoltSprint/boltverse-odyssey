// Blocking dark-row gate. A 1–3 px band around the horizon that is darker
// than both neighbours is the t=30 crease. X is the round-2 t=30 run:
// that still fails at 32 (run of 14, mean dip 39.7). Each row of the band
// has to clear the bar, so a dark drift that is only dark in its middle
// does not count.
//   node dark-row-gate.mjs <frame.jpg> [more frames...]
import { spawnSync } from 'child_process';
import fs from 'fs';

export const DARK_ROW_X = 32;
export const DARK_ROW_RUN = 8;
const Y0 = 0.30;
const Y1 = 0.55;

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { w, h, raw };
}

function luma(im, x, y) {
  const i = (y * im.w + x) * 3;
  return 0.2126 * im.raw[i] + 0.7152 * im.raw[i + 1] + 0.0722 * im.raw[i + 2];
}

function runOf(flags) {
  let best = 0;
  let cur = 0;
  let gap = 0;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i]) {
      cur += 1 + gap;
      gap = 0;
      if (cur > best) best = cur;
    } else if (cur > 0 && gap === 0) {
      gap = 1;
    } else {
      cur = 0;
      gap = 0;
    }
  }
  return best;
}

export function darkRow(file) {
  const im = load(file);
  const yA = Math.floor(im.h * Y0);
  const yB = Math.floor(im.h * Y1);
  let worst = null;
  for (let thick = 1; thick <= 3; thick++) {
    for (let y = yA; y + thick < yB; y++) {
      const flags = [];
      const dips = [];
      for (let x = 2; x < im.w - 2; x++) {
        const up = luma(im, x, y - 1);
        const dn = luma(im, x, y + thick);
        const edge = Math.min(up, dn);
        let dip = Infinity;
        for (let k = 0; k < thick; k++) dip = Math.min(dip, edge - luma(im, x, y + k));
        const hit = dip > DARK_ROW_X;
        flags.push(hit);
        if (hit) dips.push(dip);
      }
      const run = runOf(flags);
      if (run < DARK_ROW_RUN) continue;
      const mean = dips.reduce((s, v) => s + v, 0) / dips.length;
      if (!worst || run > worst.run || (run === worst.run && mean > worst.mean)) {
        worst = { y, thick, run, mean: +mean.toFixed(1), n: dips.length };
      }
    }
  }
  return worst;
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node dark-row-gate.mjs <frame> ...');
  process.exit(2);
}
let fail = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.error('FAIL missing', file); fail++; continue; }
  const hit = darkRow(file);
  if (hit) {
    console.error('FAIL', file, JSON.stringify(hit), 'X', DARK_ROW_X);
    fail++;
  } else {
    console.log('PASS', file);
  }
}
if (fail) process.exit(1);
console.log('PASS dark-row', files.length);
