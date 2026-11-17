// Horizon step. The run-31 bar at 24 s is 3.29 and is not a knob.
// For each row from 420 to 679, skip the centre columns 281–439, take the
// median absolute rec.709 luma change into the next row, then keep the worst
// row. The round-7 t=24 frame is the fixture and must fail before a fix.
//   node horizon-step-gate.mjs <frame> ...
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const STEP_BAR = 3.29;
const Y0 = 420;
const Y1 = 680;
const SKIP_X0 = 281;
const SKIP_X1 = 439;

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { w, h, raw };
}

function luma(raw, i) {
  return raw[i] * 0.2126 + raw[i + 1] * 0.7152 + raw[i + 2] * 0.0722;
}

export function horizonStep(file) {
  const im = load(file);
  let best = 0;
  let row = Y0;
  const y1 = Math.min(Y1, im.h - 1);
  for (let y = Y0; y < y1; y++) {
    const diffs = [];
    for (let x = 0; x < im.w; x++) {
      if (x >= SKIP_X0 && x <= SKIP_X1) continue;
      const a = luma(im.raw, (y * im.w + x) * 3);
      const b = luma(im.raw, ((y + 1) * im.w + x) * 3);
      diffs.push(Math.abs(a - b));
    }
    diffs.sort((p, q) => p - q);
    const med = diffs[diffs.length >> 1] || 0;
    if (med > best) { best = med; row = y; }
  }
  return { step: +best.toFixed(3), row, bar: STEP_BAR };
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node horizon-step-gate.mjs <frame> ...');
  process.exit(2);
}
let fail = 0;
for (const file of files) {
  if (!fs.existsSync(file)) { console.error('FAIL missing', file); fail++; continue; }
  const r = horizonStep(file);
  const line = `${r.step > STEP_BAR ? 'FAIL' : 'PASS'} ${path.basename(file)} step ${r.step} row ${r.row} bar ${STEP_BAR}`;
  if (r.step > STEP_BAR) { console.error(line); fail++; }
  else console.log(line);
}
if (fail) process.exit(1);
console.log('PASS horizon-step', files.length);
