// Tone-map gate. Limits live in tonemap-limits.json and are not lowered here.
//   node tonemap-gate.mjs --frames <after-dir> --before <before-dir> [--mean <json>] [--info <json>]
// A frame pair is t<tag>.jpg plus t<tag>-mat.png. The before dir is the run-31 key.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const limits = JSON.parse(fs.readFileSync(path.join(here, 'tonemap-limits.json'), 'utf8'));
const SNOW_KEY = [
  'tex/snow-v2/snow-v2-0.png',
  'tex/snow-v2/snow-v2-2.png',
  'tex/snow-v2/snow-v2-3.png',
  'tex/crust/v4.jpg',
];
const ICE_KEY = [
  'tex/glacier-ice/v1.jpg',
  'tex/glacier-ice/v2.jpg',
  'tex/glacier-ice/v3.jpg',
  'tex/glacier-ice/v4.jpg',
];
const ICE_MATS = new Set([1, 2, 3, 6, 7]);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
  if (!raw || raw.length !== w * h * 3) throw new Error('unreadable ' + file);
  return { raw, w, h };
}

function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function percentile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
}

function medianLab(pixels) {
  const labs = pixels.map(srgbToLab);
  const mid = (k) => labs.map((v) => v[k]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
  return [mid(0), mid(1), mid(2)];
}

function sampleStill(file) {
  const im = load(path.join(here, file));
  const step = 4;
  const cols = [];
  const ys = [];
  for (let y = 0; y < im.h; y += step) {
    for (let x = 0; x < im.w; x += step) {
      const i = (y * im.w + x) * 3;
      const rgb = [im.raw[i], im.raw[i + 1], im.raw[i + 2]];
      cols.push(rgb);
      ys.push(luma(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255));
    }
  }
  ys.sort((a, b) => a - b);
  return { cols, ys };
}

function pool(files) {
  const cols = [];
  const ys = [];
  for (const file of files) {
    const s = sampleStill(file);
    cols.push(...s.cols);
    ys.push(...s.ys);
  }
  ys.sort((a, b) => a - b);
  return {
    p1: percentile(ys, 0.01),
    p50: percentile(ys, 0.50),
    p99: percentile(ys, 0.99),
    lab: medianLab(cols),
    n: ys.length,
  };
}

function matOf(r, g) {
  const id = Math.round(r / 255 * 8 - 0.5);
  if (id === 5 && g < 128) return 'planet';
  if (id === 5) return 'sky';
  return id;
}

function readPair(dir, tag) {
  const colour = ['jpg', 'png'].map((ext) => path.join(dir, `t${tag}.${ext}`)).find((p) => fs.existsSync(p));
  const mat = path.join(dir, `t${tag}-mat.png`);
  if (!colour || !fs.existsSync(mat)) return null;
  return { colour: load(colour), mat: load(mat), colourPath: colour };
}

function analyse(pair) {
  const { colour, mat } = pair;
  const n = colour.w * colour.h;
  const all = [];
  const snow = [];
  const ice = [];
  const iceRgb = [];
  let clip = 0;
  let crush = 0;
  let crushN = 0;
  let grey = 0;
  let bright = 0;
  let blue = 0;
  let iceN = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const r = colour.raw[o] / 255;
    const g = colour.raw[o + 1] / 255;
    const b = colour.raw[o + 2] / 255;
    const y = luma(r, g, b);
    all.push(y);
    sum += y;
    if (r > limits.clipAt || g > limits.clipAt || b > limits.clipAt) clip++;
    const id = matOf(mat.raw[o], mat.raw[o + 1]);
    const planet = id === 'planet';
    if (!planet) {
      crushN++;
      if (y < limits.crushAt) crush++;
    }
    if (id === 0) snow.push(y);
    if (ICE_MATS.has(id)) {
      ice.push([colour.raw[o], colour.raw[o + 1], colour.raw[o + 2]]);
      iceN++;
      blue += b - r;
      if (y > limits.brightLuma) {
        bright++;
        if (Math.max(r, g, b) - Math.min(r, g, b) < limits.greyChroma) grey++;
      }
    }
  }
  all.sort((a, b) => a - b);
  snow.sort((a, b) => a - b);
  return {
    p1: percentile(all, 0.01),
    p50: percentile(all, 0.50),
    p99: percentile(all, 0.99),
    meanY: sum / n,
    clip: clip / n,
    crush: crushN ? crush / crushN : 0,
    snow: snow.length ? { p1: percentile(snow, 0.01), p50: percentile(snow, 0.50), p99: percentile(snow, 0.99), n: snow.length } : null,
    iceLab: ice.length >= 8 ? medianLab(ice) : null,
    iceN,
    greyBright: bright ? grey / bright : null,
    blue: iceN ? blue / iceN : null,
    bright,
  };
}

function round4(n) { return Math.round(n * 10000) / 10000; }

const framesDir = arg('--frames');
const beforeDir = arg('--before');
const meanFile = arg('--mean');
const infoFile = arg('--info');
if (!framesDir || !beforeDir) {
  console.error('usage: node tonemap-gate.mjs --frames <after> --before <before> [--mean mean.json] [--info info.json]');
  process.exit(2);
}

const snowKey = pool(SNOW_KEY);
const iceKey = pool(ICE_KEY);
const tags = [...new Set(fs.readdirSync(framesDir).filter((f) => /^t[\d.]+\.(jpg|png)$/.test(f) && !f.includes('-mat')).map((f) => f.replace(/^t/, '').replace(/\.(jpg|png)$/, '')))];
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const rows = [];
const keyscoreParts = [];

for (const tag of tags) {
  const after = readPair(framesDir, tag);
  const before = readPair(beforeDir, tag);
  if (!after || !before) { bad('missing pair ' + tag); continue; }
  const a = analyse(after);
  const b = analyse(before);
  const d = {
    p1: Math.abs(a.p1 - b.p1),
    p50: Math.abs(a.p50 - b.p50),
    p99: Math.abs(a.p99 - b.p99),
  };
  if (d.p1 > limits.lumaDeltaMax || d.p50 > limits.lumaDeltaMax || d.p99 > limits.lumaDeltaMax) {
    bad(`frame luma ${tag} p1 ${d.p1.toFixed(3)} p50 ${d.p50.toFixed(3)} p99 ${d.p99.toFixed(3)}`);
  }
  if (a.clip > limits.clipFracMax) bad(`clip ${tag} ${a.clip.toFixed(4)}`);
  if (a.crush > limits.crushFracMax) bad(`crushed ${tag} ${a.crush.toFixed(4)}`);
  if (!a.snow) bad('no snow ' + tag);
  else if (Math.abs(a.snow.p50 - snowKey.p50) > limits.lumaDeltaMax) {
    bad(`snow p50 ${tag} ${a.snow.p50.toFixed(3)} key ${snowKey.p50.toFixed(3)}`);
  }
  if (a.greyBright == null) bad('no bright ice ' + tag);
  else if (!(a.greyBright < limits.greyBrightMax)) bad(`grey_bright ${tag} ${a.greyBright.toFixed(3)}`);
  if (a.blue == null || !(a.blue > limits.iceBlueMin)) bad(`ice b-r ${tag} ${a.blue}`);
  let dSnow = null;
  let dIce = null;
  if (a.iceLab) {
    dIce = dE76(a.iceLab, iceKey.lab);
  }
  const snowCols = [];
  const im = after.colour;
  const mat = after.mat;
  for (let i = 0; i < im.w * im.h; i += 8) {
    const o = i * 3;
    if (matOf(mat.raw[o], mat.raw[o + 1]) === 0) snowCols.push([im.raw[o], im.raw[o + 1], im.raw[o + 2]]);
  }
  if (snowCols.length >= 8) dSnow = dE76(medianLab(snowCols), snowKey.lab);
  const keyscore = (dSnow != null && dIce != null) ? 100 - (dSnow + dIce) / 2 : null;
  if (keyscore != null) keyscoreParts.push(keyscore);
  rows.push({
    tag,
    frame: { p1: round4(a.p1), p50: round4(a.p50), p99: round4(a.p99) },
    keyFrame: { p1: round4(b.p1), p50: round4(b.p50), p99: round4(b.p99) },
    delta: { p1: round4(d.p1), p50: round4(d.p50), p99: round4(d.p99) },
    snow: a.snow && { p1: round4(a.snow.p1), p50: round4(a.snow.p50), p99: round4(a.snow.p99), n: a.snow.n },
    clip: round4(a.clip),
    crush: round4(a.crush),
    greyBright: a.greyBright == null ? null : round4(a.greyBright),
    blue: a.blue == null ? null : round4(a.blue),
    dE76snow: dSnow == null ? null : round4(dSnow),
    dE76ice: dIce == null ? null : round4(dIce),
    keyscore: keyscore == null ? null : round4(keyscore),
  });
}

const keyscore = keyscoreParts.length ? keyscoreParts.reduce((s, v) => s + v, 0) / keyscoreParts.length : null;
if (limits.run31Keyscore == null) bad('run31Keyscore floor is not written');
else if (keyscore == null || keyscore < limits.run31Keyscore) bad(`keyscore ${keyscore} below run 31 ${limits.run31Keyscore}`);

if (meanFile) {
  const mean = JSON.parse(fs.readFileSync(meanFile, 'utf8'));
  const ys = mean.meanY;
  const mu = ys.reduce((s, v) => s + v, 0) / ys.length;
  const variance = ys.reduce((s, v) => s + (v - mu) ** 2, 0) / ys.length;
  const std = Math.sqrt(variance);
  rows.push({ meanY: { n: ys.length, mu: round4(mu), std: round4(std), limit: limits.meanYStdMax } });
  if (!(std <= limits.meanYStdMax)) bad(`45s mean-Y std ${std.toFixed(4)}`);
}

if (infoFile) {
  const info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
  rows.push({ tris: info.tris, draws: info.draws, presentPass: info.presentPass, tonemap: info.tonemap, exposureEv: info.exposureEv });
  if (info.draws !== limits.sceneDraws) bad('draws ' + info.draws);
  if (info.presentPass !== 1) bad('present pass missing');
}

const report = {
  limits: {
    lumaDeltaMax: limits.lumaDeltaMax,
    clipFracMax: limits.clipFracMax,
    crushFracMax: limits.crushFracMax,
    meanYStdMax: limits.meanYStdMax,
    greyBrightMax: limits.greyBrightMax,
    de76Max: limits.de76Max,
    run31Keyscore: limits.run31Keyscore,
  },
  snowKey: { p1: round4(snowKey.p1), p50: round4(snowKey.p50), p99: round4(snowKey.p99), lab: snowKey.lab.map(round4) },
  iceKeyLab: iceKey.lab.map(round4),
  keyscore: keyscore == null ? null : round4(keyscore),
  rows,
  verdict: fail ? 'FAIL' : 'PASS',
};
const out = arg('--out');
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (fail) process.exit(1);
console.log('PASS tonemap');
