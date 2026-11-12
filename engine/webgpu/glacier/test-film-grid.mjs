// Grid gate on every chase frame. The live Bolt card is masked out (alpha, dilated 8 px).
// The band is otherwise unchanged. Limit stays 1.8.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { GRID_PEAK, MASK_DILATE, maskFromRGBA, dilateMask, gridPeak, paintWorldGrid, paintBesideGrid } from './grid-measure.mjs';

const BLACK_LIMIT = 0.0003;
const dir = process.argv[2];
if (!dir) { console.error('FAIL need a frame directory'); process.exit(1); }
const files = fs.readdirSync(dir).filter((f) => /^f_.*\.png$/.test(f)).sort();
if (!files.length) { console.error('FAIL no frames'); process.exit(1); }

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 24 * 1024 * 1024 }).stdout;
  return { raw, w, h };
}

function loadMask(file, w, h) {
  const png = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:'], { encoding: 'buffer', maxBuffer: 24 * 1024 * 1024 }).stdout;
  if (!png || png.length < w * h * 4) return null;
  return dilateMask(maskFromRGBA(png, w, h, w * 4), w, h, MASK_DILATE);
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
let maskFrames = 0;
let controls = null;
for (let i = 0; i < files.length; i++) {
  const im = load(path.join(dir, files[i]));
  const maskFile = path.join(dir, files[i].replace(/^f_/, 'm_'));
  const mask = fs.existsSync(maskFile) ? loadMask(maskFile, im.w, im.h) : null;
  if (mask) maskFrames++;
  const peak = gridPeak(im, mask);
  const black = pureBlack(im);
  peaks.push(+peak.toFixed(3));
  if (black > worstBlack) worstBlack = black;
  if (black > BLACK_LIMIT) blackFail++;
  if (i === 0 && mask) {
    const world = paintWorldGrid(im, mask);
    const beside = paintBesideGrid(im, mask);
    controls = {
      worldGrid: +gridPeak(world, mask).toFixed(3),
      besideGrid: +gridPeak(beside, mask).toFixed(3),
      besidePainted: beside.painted,
    };
  }
  if (i % 50 === 0) console.log('frame', i, 'grid', peak.toFixed(2));
}
const over = peaks.map((p, i) => ({ i, p })).filter((r) => r.p > GRID_PEAK);
const sum = peaks.reduce((s, p) => s + p, 0);
const report = {
  frames: peaks.length,
  limit: GRID_PEAK,
  mask: 'bolt-alpha',
  dilatePx: MASK_DILATE,
  maskFrames,
  min: Math.min(...peaks),
  max: Math.max(...peaks),
  mean: +(sum / peaks.length).toFixed(3),
  over: over.length,
  overFrames: over.slice(0, 40),
  controls,
  blackFail,
  worstBlack: +worstBlack.toFixed(5),
  blackLimit: BLACK_LIMIT,
};
const out = process.argv[3];
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ frames: report.frames, min: report.min, max: report.max, mean: report.mean, over: report.over, maskFrames, controls, blackFail: report.blackFail }));
if (!maskFrames) { console.error('FAIL no bolt masks'); process.exit(1); }
if (!controls || !(controls.worldGrid > GRID_PEAK)) { console.error('FAIL world grating did not block', controls); process.exit(1); }
if (!controls || !(controls.besideGrid > GRID_PEAK) || controls.besidePainted < 1000) { console.error('FAIL beside grating did not block', controls); process.exit(1); }
if (over.length || blackFail) process.exit(1);
console.log('PASS film-grid');
