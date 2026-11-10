// Grid gate on every frame of a chase. Limit stays 1.8. One frame over the limit fails the run.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GRID_PEAK = 1.8;
const BLACK_LIMIT = 0.0003;
const dir = process.argv[2];
if (!dir) { console.error('FAIL need a frame directory'); process.exit(1); }
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort();
if (!files.length) { console.error('FAIL no frames'); process.exit(1); }

function load(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
  return { raw, w: 720, h: 1280 };
}

function gridPeak(im) {
  const sig = new Float64Array(im.w);
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let rows = 0;
  for (let y = y0; y < y1; y += 2) {
    rows++;
    for (let x = 0; x < im.w; x++) {
      const i = (y * im.w + x) * 3;
      sig[x] += im.raw[i] * 0.3 + im.raw[i + 1] * 0.59 + im.raw[i + 2] * 0.11;
    }
  }
  for (let x = 0; x < im.w; x++) sig[x] /= rows || 1;
  const hp = new Float64Array(im.w);
  for (let i = 0; i < im.w; i++) hp[i] = sig[i] - sig[Math.max(0, i - 24)];
  let meanH = 0;
  for (let i = 0; i < im.w; i++) meanH += hp[i];
  meanH /= im.w;
  let v = 0;
  for (let i = 0; i < im.w; i++) v += (hp[i] - meanH) ** 2;
  v /= im.w;
  if (v < 1e-6) return 0;
  const ac = (lag) => {
    let c = 0;
    const m = im.w - lag;
    for (let i = 0; i < m; i++) c += (hp[i] - meanH) * (hp[i + lag] - meanH);
    return c / (m * v);
  };
  const peak = Math.max(ac(8), ac(16), ac(24));
  const beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4;
  return peak / (Math.abs(beside) + 0.08);
}

function pureBlack(im) {
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let black = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < im.w; x++) {
      if (x > im.w * 0.34 && x < im.w * 0.66) continue;
      const i = (y * im.w + x) * 3;
      n++;
      if (im.raw[i] === 0 && im.raw[i + 1] === 0 && im.raw[i + 2] === 0) black++;
    }
  }
  return black / n;
}

const peaks = [];
let blackFail = 0;
let worstBlack = 0;
for (let i = 0; i < files.length; i++) {
  const im = load(path.join(dir, files[i]));
  const peak = gridPeak(im);
  const black = pureBlack(im);
  peaks.push(+peak.toFixed(3));
  if (black > worstBlack) worstBlack = black;
  if (black > BLACK_LIMIT) blackFail++;
  if (i % 50 === 0) console.log('frame', i, 'grid', peak.toFixed(2));
}
const over = peaks.map((p, i) => ({ i, p })).filter((r) => r.p > GRID_PEAK);
const sum = peaks.reduce((s, p) => s + p, 0);
const report = {
  frames: peaks.length,
  limit: GRID_PEAK,
  min: Math.min(...peaks),
  max: Math.max(...peaks),
  mean: +(sum / peaks.length).toFixed(3),
  over: over.length,
  overFrames: over.slice(0, 40),
  blackFail,
  worstBlack: +worstBlack.toFixed(5),
  blackLimit: BLACK_LIMIT,
};
const out = process.argv[3];
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ frames: report.frames, min: report.min, max: report.max, mean: report.mean, over: report.over, blackFail: report.blackFail }));
if (over.length || blackFail) process.exit(1);
console.log('PASS film-grid');
