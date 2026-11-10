// Pure-black and grid gates on a chase frame. Each has an injected control that must fail.
// Limits stay 0.0003 and 1.8.
import { spawnSync } from 'child_process';

const BLACK_LIMIT = 0.0003;
const GRID_PEAK = 1.8;
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
  const n = sig.length;
  const hp = new Float64Array(n);
  for (let i = 0; i < n; i++) hp[i] = sig[i] - sig[Math.max(0, i - 24)];
  let meanH = 0;
  for (let i = 0; i < n; i++) meanH += hp[i];
  meanH /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (hp[i] - meanH) ** 2;
  v /= n;
  if (v < 1e-6) return 0;
  const ac = (lag) => {
    let c = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) c += (hp[i] - meanH) * (hp[i + lag] - meanH);
    return c / (m * v);
  };
  const peak = Math.max(ac(8), ac(16), ac(24));
  const beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4;
  return peak / (Math.abs(beside) + 0.08);
}

function paintGrid(im) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  for (let y = 0; y < copy.h; y++) {
    for (let x = 0; x < copy.w; x++) {
      const v = Math.round((Math.sin((x / 16) * Math.PI * 2) * 0.5 + 0.5) * 70 + 10);
      const i = (y * copy.w + x) * 3;
      copy.raw[i] = v; copy.raw[i + 1] = v; copy.raw[i + 2] = v + 15;
    }
  }
  return copy;
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
const black = pureBlack(im);
const torn = pureBlack(paintTear(im));
const grid = gridPeak(im);
const gridded = gridPeak(paintGrid(im));
const white = whiteFrac(im);
if (black > BLACK_LIMIT) bad('pure black tears ' + black.toFixed(5));
if (!(torn > BLACK_LIMIT)) bad('tear injection did not fail ' + torn.toFixed(5));
if (grid > GRID_PEAK) bad('periodic grid ' + grid.toFixed(2));
if (!(gridded > GRID_PEAK)) bad('grid injection did not fail ' + gridded.toFixed(2));
if (white > 0.005) bad('white specular blowout ' + white.toFixed(4));
if (fail) process.exit(1);
console.log('PASS defects', JSON.stringify({
  pureBlack: +black.toFixed(5),
  tearControl: +torn.toFixed(5),
  gridPeak: +grid.toFixed(2),
  gridControl: +gridded.toFixed(2),
  whiteFrac: +white.toFixed(5),
  blackLimit: BLACK_LIMIT,
  gridLimit: GRID_PEAK,
}));
