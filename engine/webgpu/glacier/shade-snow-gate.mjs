// Shaded-snow gate. Cast sun shadow ahead of Bolt, follow camera.
// b* must sit in the run-31 mauve band. CIE76 against that key includes lightness.
// The limit is the existing 10. It is not a knob.
import { spawnSync } from 'child_process';
import fs from 'fs';
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

// Clean snow, E's mask. Shadow factor is the sun term until a cascade exists.
// Mask blue is the overlay: Bolt, contact decals, prints, and flakes move
// beauty off the surface. Snow's mask blue stays under 0.03.
function overlayBlue(buf, i) {
  if (buf.bolt[i] > 8 || buf.bolt[i + 2] > 8) return 1;
  let d = 0;
  for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(buf.beauty[i + k] - buf.surface[i + k]));
  return d / 255;
}

// Lit path snow sits near ndl 0.28. E's shadow factor under 0.35 is the
// occluded set on a 0–1 visibility. Here that set is the sun term under 0.12.
const SHADE_NDL = 0.12;

function cleanLabs(buf, shadowMax) {
  const labs = [];
  const y0 = Math.floor(H * 0.62);
  const y1 = Math.floor(H * 0.82);
  const x0 = Math.floor(W * 0.35);
  const x1 = Math.floor(W * 0.65);
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      const shadow = buf.mask ? buf.mask[i] / 255 : buf.shade[i + 1] / 255;
      if (shadow >= shadowMax) continue;
      if (overlayBlue(buf, i) >= 0.03) continue;
      if (buf.mask && buf.mask[i + 2] / 255 >= 0.03) continue;
      labs.push(srgbToLab([buf.beauty[i], buf.beauty[i + 1], buf.beauty[i + 2]]));
    }
  }
  return labs;
}

export function shadeSnowAt(buf, tag) {
  const labs = cleanLabs(buf, buf.mask ? 0.35 : SHADE_NDL);
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
  const maskPath = path.join(dir, `t${tag}-mask.png`);
  return {
    beauty: g('beauty'), surface: g('surface'), bolt: g('bolt'), shade: g('shade'),
    mask: fs.existsSync(maskPath) ? g('mask') : null,
  };
}

function linY(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

// Shade/sun on clean snow. Shade is shadow factor under 0.35. Sun is the
// same crop with the sun term above 0.55. Overlays are out. Ratio is linear luma.
export function shadeSunAt(buf) {
  const shade = [];
  const sun = [];
  // Shade is the lower-center clean crop. Sunlit snow is often higher in
  // the frame, so the sun sample uses the wider window. Both exclude overlays.
  const y0 = Math.floor(H * 0.40);
  const y1 = Math.floor(H * 0.92);
  const x0 = Math.floor(W * 0.08);
  const x1 = Math.floor(W * 0.92);
  const sy0 = Math.floor(H * 0.62);
  const sy1 = Math.floor(H * 0.82);
  const sx0 = Math.floor(W * 0.35);
  const sx1 = Math.floor(W * 0.65);
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      if (overlayBlue(buf, i) >= 0.03) continue;
      if (buf.mask && buf.mask[i + 2] / 255 >= 0.03) continue;
      const shadow = buf.mask ? buf.mask[i] / 255 : buf.shade[i + 1] / 255;
      const shadeCut = buf.mask ? 0.35 : SHADE_NDL;
      const sunCut = buf.mask ? 0.65 : 0.22;
      if (shadow < shadeCut && y >= sy0 && y < sy1 && x >= sx0 && x < sx1) shade.push(linY(buf.beauty, i));
      else if (shadow > sunCut) sun.push(linY(buf.beauty, i));
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
