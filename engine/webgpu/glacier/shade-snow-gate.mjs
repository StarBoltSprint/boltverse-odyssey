// Shaded-snow gate. Cast sun shadow ahead of Bolt, follow camera.
// b* must sit in the run-31 mauve band. CIE76 against that key includes lightness.
// The limit is the existing 10. It is not a knob.
import { spawnSync } from 'child_process';
import path from 'path';
import { srgbToLab, dE76, DE76_MAX } from '../biome-factory/cie76.mjs';
import { KEY_SHADE_LAB, KEY_B_LO, KEY_B_HI, KEY_SHADE_SUN } from './sh-sky.js';

const W = 720;
const H = 1280;
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 12 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(file);
  return r.stdout;
}
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}
function matOf(sh, i) { return Math.round(sh[i] / 255 * 8 - 0.5); }

export function shadeSnowAt(buf, tag) {
  let maxy = 0;
  let fx = 360;
  for (let y = 800; y < 1150; y += 2) {
    for (let x = 280; x < 440; x += 2) {
      const i = (y * W + x) * 4;
      if (buf.bolt[i] > 40 && buf.bolt[i + 1] > 40 && y > maxy) { maxy = y; fx = x; }
    }
  }
  const labs = [];
  const y0 = maxy - 90;
  const y1 = maxy - 24;
  for (let y = y0; y < y1; y++) {
    for (let x = fx - 36; x < fx + 36; x++) {
      if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) continue;
      const i = (y * W + x) * 4;
      if (buf.bolt[i] > 16) continue;
      if (matOf(buf.shade, i) !== 0) continue;
      const beauty = srgbToLab([buf.beauty[i], buf.beauty[i + 1], buf.beauty[i + 2]]);
      const surf = srgbToLab([buf.surface[i], buf.surface[i + 1], buf.surface[i + 2]]);
      // The decal is the cast shadow. Pixels it did not darken are open snow.
      if (surf[0] - beauty[0] < 6) continue;
      labs.push(beauty);
    }
  }
  if (labs.length < 30) return { t: tag, n: labs.length, b: null, dE76: null, pass: false };
  const lab = [0, 1, 2].map((k) => median(labs.map((v) => v[k])));
  const de = dE76(lab, KEY_SHADE_LAB);
  const b = lab[2];
  const pass = b >= KEY_B_LO && b <= KEY_B_HI && de <= DE76_MAX;
  return {
    t: tag,
    n: labs.length,
    L: +lab[0].toFixed(2),
    a: +lab[1].toFixed(2),
    b: +b.toFixed(2),
    dE76: +de.toFixed(2),
    pass,
  };
}

export function loadFrame(dir, t) {
  const tag = String(t).replace('.', 'p');
  const g = (n) => decode(path.join(dir, `t${tag}-${n}.png`));
  return { beauty: g('beauty'), surface: g('surface'), bolt: g('bolt'), shade: g('shade') };
}

function linY(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Shade/sun on the path. Shade is snow the cast decal darkened. Sun is the
// undarkened snow beside that same paw. Ratio is linear luma.
export function shadeSunAt(buf) {
  let maxy = 0;
  let fx = 360;
  for (let y = 800; y < 1150; y += 2) {
    for (let x = 280; x < 440; x += 2) {
      const i = (y * W + x) * 4;
      if (buf.bolt[i] > 40 && buf.bolt[i + 1] > 40 && y > maxy) { maxy = y; fx = x; }
    }
  }
  const shade = [];
  const sun = [];
  for (let y = maxy - 110; y < maxy + 40; y++) {
    for (let x = fx - 80; x < fx + 80; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = (y * W + x) * 4;
      if (buf.bolt[i] > 16) continue;
      if (matOf(buf.shade, i) !== 0) continue;
      const beauty = srgbToLab([buf.beauty[i], buf.beauty[i + 1], buf.beauty[i + 2]]);
      const surf = srgbToLab([buf.surface[i], buf.surface[i + 1], buf.surface[i + 2]]);
      const dark = surf[0] - beauty[0];
      if (dark >= 6) shade.push(linY(buf.beauty, i));
      else if (dark < 1.5 && beauty[0] > 55 && Math.abs(x - fx) > 24) sun.push(linY(buf.beauty, i));
    }
  }
  if (shade.length < 30 || sun.length < 30) {
    return { nShade: shade.length, nSun: sun.length, ratio: null, pass: false };
  }
  const ys = median(shade);
  const yu = median(sun);
  const ratio = ys / yu;
  const err = Math.abs(ratio - KEY_SHADE_SUN) / KEY_SHADE_SUN;
  return {
    nShade: shade.length,
    nSun: sun.length,
    shadeY: +ys.toFixed(4),
    sunY: +yu.toFixed(4),
    ratio: +ratio.toFixed(4),
    err: +err.toFixed(4),
    pass: err <= 0.10,
  };
}

export function scoreDir(dir) {
  return TIMES.map((t) => shadeSnowAt(loadFrame(dir, t), t));
}

export function shadeSnowReport(dir) {
  const rows = TIMES.map((t) => {
    const buf = loadFrame(dir, t);
    const colour = shadeSnowAt(buf, t);
    const ratio = shadeSunAt(buf);
    return { ...colour, ratio };
  });
  const pass = rows.every((r) => r.pass && r.ratio && r.ratio.pass);
  return {
    dir,
    key: KEY_SHADE_LAB,
    bBand: [KEY_B_LO, KEY_B_HI],
    de76: DE76_MAX,
    keyRatio: KEY_SHADE_SUN,
    ratioBand: 0.10,
    pass,
    rows,
  };
}

if (process.argv[1] && process.argv[1].endsWith('shade-snow-gate.mjs')) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: shade-snow-gate.mjs <frame dir>');
    process.exit(2);
  }
  const report = shadeSnowReport(dir);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}
