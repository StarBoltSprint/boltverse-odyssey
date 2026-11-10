// Pure-black and grid gates on a chase frame. Each has an injected control that must fail.
// The grid skips the live Bolt card (alpha dilated 8 px). Limits stay 0.0003 and 1.8.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { GRID_PEAK, MASK_DILATE, maskFromRGBA, dilateMask, gridPeak, paintWorldGrid, paintBesideGrid } from './grid-measure.mjs';

const BLACK_LIMIT = 0.0003;
const frameFile = process.argv[2];
if (!frameFile) { console.error('FAIL need a frame'); process.exit(1); }
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
  return { raw, w, h };
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

function whiteFrac(im) {
  let w = 0;
  const n = im.w * im.h;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (im.raw[o] >= 250 && im.raw[o + 1] >= 250 && im.raw[o + 2] >= 250) w++;
  }
  return w / n;
}

function paintTear(im) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  for (let y = Math.floor(copy.h * 0.62); y < Math.floor(copy.h * 0.68); y++) {
    for (let x = 40; x < 120; x++) {
      const i = (y * copy.w + x) * 3;
      copy.raw[i] = copy.raw[i + 1] = copy.raw[i + 2] = 0;
    }
  }
  return copy;
}

const im = load(frameFile);
if (!im.raw || im.raw.length < 1000) bad('no frame');
const maskFile = process.argv[3] || frameFile.replace(/\.jpg$/, '-mask.png');
if (!fs.existsSync(maskFile)) bad('bolt mask missing ' + maskFile);
const png = spawnSync('ffmpeg', ['-v', 'error', '-i', maskFile, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
const mask = dilateMask(maskFromRGBA(png, im.w, im.h, im.w * 4), im.w, im.h, MASK_DILATE);
const black = pureBlack(im);
const torn = pureBlack(paintTear(im));
const grid = gridPeak(im, mask);
const world = paintWorldGrid(im, mask);
const beside = paintBesideGrid(im, mask);
const gridded = gridPeak(world, mask);
const besidePeak = gridPeak(beside, mask);
const white = whiteFrac(im);
if (black > BLACK_LIMIT) bad('pure black tears ' + black.toFixed(5));
if (!(torn > BLACK_LIMIT)) bad('tear injection did not fail ' + torn.toFixed(5));
if (grid > GRID_PEAK) bad('periodic grid ' + grid.toFixed(2));
if (!(gridded > GRID_PEAK)) bad('world grating did not fail ' + gridded.toFixed(2));
if (!(besidePeak > GRID_PEAK) || beside.painted < 1000) bad('beside grating did not fail ' + besidePeak.toFixed(2) + ' painted ' + beside.painted);
if (white > 0.005) bad('white specular blowout ' + white.toFixed(4));
if (fail) process.exit(1);
console.log('PASS defects', JSON.stringify({
  pureBlack: +black.toFixed(5),
  tearControl: +torn.toFixed(5),
  gridPeak: +grid.toFixed(2),
  gridControl: +gridded.toFixed(2),
  besideControl: +besidePeak.toFixed(2),
  besidePainted: beside.painted,
  whiteFrac: +white.toFixed(5),
  blackLimit: BLACK_LIMIT,
  gridLimit: GRID_PEAK,
  dilatePx: MASK_DILATE,
}));
