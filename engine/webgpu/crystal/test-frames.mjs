// Pixel gates on a 30 fps capture. Pass the frame directory.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const dir = process.argv[2];
if (!dir) { console.error('FAIL need a frame directory'); process.exit(1); }

function load(i) {
  const file = path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
  return { raw, w: 720, h: 1280 };
}
function mae(a, b, y0, y1, maskBolt) {
  let s = 0, n = 0;
  const w = a.w;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      if (maskBolt && x > w * 0.34 && x < w * 0.66) continue;
      const i = (y * w + x) * 3;
      s += Math.abs(a.raw[i] - b.raw[i]) + Math.abs(a.raw[i + 1] - b.raw[i + 1]) + Math.abs(a.raw[i + 2] - b.raw[i + 2]);
      n += 3;
    }
  }
  return s / n;
}
function ratios(im) {
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let black = 0, blue = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < im.w; x++) {
      if (x > im.w * 0.34 && x < im.w * 0.66) continue;
      const i = (y * im.w + x) * 3;
      const r = im.raw[i], g = im.raw[i + 1], b = im.raw[i + 2];
      n++;
      if (r < 6 && g < 6 && b < 6) black++;
      if (b > r + 6 && b > g + 4 && r < 90 && g < 95 && b > 18) blue++;
    }
  }
  return { black: black / n, blue: blue / n };
}

const names = fs.readdirSync(dir).filter(f => /^f_\d+\.jpg$/.test(f)).sort();
if (names.length < 300) { console.error('FAIL frames ' + names.length); process.exit(1); }

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
let minBg = Infinity;
let maxJump = 0;
let maxBlack = 0;
let maxBlue = 0;
for (const t of [0.5, 1, 1.5, 2, 2.5]) {
  const a = load(Math.round(t * 30));
  const b = load(Math.round((t + 0.5) * 30));
  const d = mae(a, b, Math.floor(a.h * 0.62), Math.floor(a.h * 0.92), true);
  minBg = Math.min(minBg, d);
}
if (minBg <= 1) bad('background frozen while moving, MAE ' + minBg.toFixed(2));
for (let i = 0; i < 299; i += 5) {
  const d = mae(load(i), load(i + 1), 0, 1280, false);
  maxJump = Math.max(maxJump, d);
}
if (maxJump > 22) bad('per-frame image jump ' + maxJump.toFixed(2));
for (const t of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const r = ratios(load(t * 30));
  maxBlack = Math.max(maxBlack, r.black);
  maxBlue = Math.max(maxBlue, r.blue);
}
const dayBlack = maxBlack > 0.0003;
const dayBlue = maxBlue > 0.004;
if (fail) process.exit(1);
console.log('PASS frames', {
  minBg: +minBg.toFixed(2),
  maxJump: +maxJump.toFixed(2),
  advisoryDayBlack: +maxBlack.toFixed(5),
  advisoryDayBlue: +maxBlue.toFixed(5),
  advisoryNote: 'Day detectors stay at 0.0003 and 0.004. Under the night rig they are not blocking. Night gates are test-night-defects.mjs.',
  advisoryWouldFail: dayBlack || dayBlue,
});
