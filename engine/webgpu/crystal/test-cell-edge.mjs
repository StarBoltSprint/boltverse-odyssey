// Cell-edge gate. The old per-cell switch must fail. The hex blend must pass.
// Orthographic ground close-up: 1.0 m across 720 px. Magnification 720/2048 = 0.35.
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { VARIANTS } from './materials.js';
import { squareColour, hexColour, seamBreak } from '../biome-factory/hex-tile.mjs';

const BREAK_MAX = 2;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../biome-factory/fixtures/materials-v2');
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function load(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('decode ' + file);
  return { w: 1024, h: 1024, rgb: raw.stdout };
}

const images = VARIANTS.ground.map((file) => load(path.join(root, file)));
const W = 720;
const H = 720;
const metres = 1;
const period = Math.round(W * (0.5 / metres));

function paint(fn) {
  const rgb = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const uv = [(x + 0.5) / W * (metres / 0.5), (y + 0.5) / H * (metres / 0.5)];
      const c = fn(images, uv);
      const i = (y * W + x) * 3;
      rgb[i] = c[0]; rgb[i + 1] = c[1]; rgb[i + 2] = c[2];
    }
  }
  return rgb;
}

const oldBreak = seamBreak(paint(squareColour), W, H, period);
const hexBreak = seamBreak(paint(hexColour), W, H, period);
if (!(oldBreak > BREAK_MAX)) bad('old per-cell switch did not fail, seam break ' + oldBreak.toFixed(3));
if (!(hexBreak <= BREAK_MAX)) bad('hex blend seam break ' + hexBreak.toFixed(3));
if (fail) process.exit(1);
console.log('PASS cell-edge', JSON.stringify({
  metres, widthPx: W, periodPx: period, breakMax: BREAK_MAX,
  oldSquare: +oldBreak.toFixed(3), hex: +hexBreak.toFixed(3),
}));
