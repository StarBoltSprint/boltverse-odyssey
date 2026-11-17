// Visual gates from the round-10 critic. The round-10 capture must fail these.
// The picture-luma seam is not one of them. Exposure is not a lever.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lookAt, persp, mul, FOV_Y } from '../engine/bricks/follow-cam.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const keyDir = path.join(here, 'artifacts/run31/frames');
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
function luma(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
function srgbToLin(c) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function labB(r, g, b) {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return 200 * (f(Y) - f(Z));
}
function LAt(im, x, y) {
  const o = ((y | 0) * im.w + (x | 0)) * 3;
  return luma(im.raw[o] / 255, im.raw[o + 1] / 255, im.raw[o + 2] / 255);
}
function samples(im, box) {
  const vals = [];
  for (let y = box[1] * im.h | 0; y < box[3] * im.h; y += 2) {
    for (let x = box[0] * im.w | 0; x < box[2] * im.w; x += 2) vals.push(LAt(im, x, y));
  }
  vals.sort((a, b) => a - b);
  const q = (t) => vals[Math.min(vals.length - 1, Math.floor(t * (vals.length - 1)))];
  return { step: q(0.9) - q(0.1), mean: vals.reduce((s, v) => s + v, 0) / vals.length };
}
function meanBox(im, box) { return samples(im, box).mean; }
function energy(im, box) {
  let s = 0, n = 0;
  const x0 = (box[0] * im.w | 0) + 2, x1 = (box[2] * im.w | 0) - 2;
  const y0 = (box[1] * im.h | 0) + 2, y1 = (box[3] * im.h | 0) - 2;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const c = LAt(im, x, y);
    const a = (LAt(im, x - 2, y) + LAt(im, x + 2, y) + LAt(im, x, y - 2) + LAt(im, x, y + 2)) * 0.25;
    s += Math.abs(c - a);
    n++;
  }
  return s / n;
}
function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H];
}
function contact(im, info) {
  const vp = mul(persp(FOV_Y, im.w / im.h, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  const paw = project(vp, [info.x, info.y, info.z], im.w, im.h);
  if (!paw) return null;
  let inn = 0, ni = 0, out = 0, no = 0;
  for (let dy = -16; dy <= 40; dy++) for (let dx = -70; dx <= 70; dx++) {
    const x = paw[0] + dx, y = paw[1] + dy;
    if (x < 2 || y < 2 || x >= im.w - 2 || y >= im.h - 2) continue;
    const ax = Math.abs(dx);
    const L = LAt(im, x, y);
    if (ax >= 30 && ax <= 55 && dy >= 2 && dy <= 14) { inn += L; ni++; }
    else if (ax <= 20 && dy >= 24 && dy <= 34) { out += L; no++; }
  }
  if (!ni || !no) return null;
  return { dark: out / no - inn / ni, px: paw[0] | 0 };
}
function rowDist(info, h) {
  const vp = mul(persp(FOV_Y, 720 / h, 0.08, 14000), lookAt(info.eye, info.tgt, [0, 1, 0]));
  let fx = info.tgt[0] - info.eye[0], fz = info.tgt[2] - info.eye[2];
  const fl = Math.hypot(fx, fz); fx /= fl; fz /= fl;
  const map = new Map();
  for (let d = 20; d <= 130; d++) {
    const p = [info.eye[0] + fx * d, info.y, info.eye[2] + fz * d];
    const py = project(vp, p, 720, h);
    if (py) map.set(py[1] | 0, d);
  }
  return map;
}
function penumbra(mask, mat, info) {
  const dist = rowDist(info, mask.h);
  const sh = (x, y) => mask.raw[(y * mask.w + x) * 3] / 255;
  const snow = (x, y) => Math.round(mat.raw[(y * mat.w + x) * 3] / 255 * 8 - 0.5) === 0;
  let thin = 0;
  const near = [], far = [];
  for (let y = 8; y < mask.h - 8; y++) {
    let d = dist.get(y);
    if (d == null) for (const [row, dd] of dist) if (Math.abs(row - y) <= 1) d = dd;
    if (d == null || d < 25 || d > 120) continue;
    for (let x = 40; x < mask.w - 40; x += 2) {
      if (!snow(x, y) || !snow(x, y - 1) || !snow(x, y + 1)) continue;
      const a = sh(x, y - 1), b = sh(x, y), c = sh(x, y + 1);
      if (b > 0.75 && a < 0.35 && c < 0.35) thin++;
      if ((b - 0.5) * (a - 0.5) < 0) {
        let w = 1;
        const dir = b > a ? 1 : -1;
        for (let k = 1; k < 24; k++) {
          const yy = y + k * dir;
          if (yy < 1 || yy >= mask.h - 1) break;
          const v = sh(x, yy);
          if (v <= 0.2 || v >= 0.8) break;
          w++;
        }
        (d < 45 ? near : far).push(w);
      }
    }
  }
  const med = (arr) => { if (!arr.length) return 0; const s = arr.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
  return { thin, near: med(near), far: med(far) };
}
function med(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  return s[s.length >> 1];
}
// Codes written by the id plate. (code + 0.5) / 16, stored without a grade curve.
const DRAW = { sky: 1, snow: 2, wall: 3, other: 4, bolt: 5, decal: 6, print: 7, flake: 8 };
function drawOf(idIm, x, y) {
  const r = idIm.raw[((y | 0) * idIm.w + (x | 0)) * 3] / 255;
  return Math.round(r * 16 - 0.5);
}
// The old crop is a luma window. It reports Bolt once the path snow is too bright
// to enter the window. Clean shade is snow's draw id, shadow factor under 0.35,
// and mask blue under 0.03. Bolt, the decal, the prints, and the flakes are
// excluded by those ids.
function shadeB(im, mask, idIm) {
  const mixed = [];
  const clean = [];
  let nExcluded = 0;
  for (let y = im.h * 0.62 | 0; y < im.h * 0.82; y += 3) {
    for (let x = im.w * 0.35 | 0; x < im.w * 0.65; x += 3) {
      const o = (y * im.w + x) * 3;
      const r = im.raw[o] / 255, g = im.raw[o + 1] / 255, b = im.raw[o + 2] / 255;
      const yv = luma(r, g, b);
      const bb = labB(r, g, b);
      if (yv > 0.35 && yv < 0.75) mixed.push(bb);
      if (!mask || !idIm) continue;
      const id = drawOf(idIm, x, y);
      if (id === DRAW.bolt || id === DRAW.decal || id === DRAW.print || id === DRAW.flake) { nExcluded++; continue; }
      const sh = mask.raw[o] / 255;
      const mb = mask.raw[o + 2] / 255;
      if (id !== DRAW.snow || sh >= 0.35 || mb >= 0.03) continue;
      clean.push(bb);
    }
  }
  return { mixed: med(mixed), clean: med(clean), nClean: clean.length, nExcluded };
}
function classMean(im, box, idIm, code) {
  let s = 0, n = 0;
  const x0 = box[0] * im.w | 0, x1 = box[2] * im.w | 0;
  const y0 = box[1] * im.h | 0, y1 = box[3] * im.h | 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    if (drawOf(idIm, x, y) !== code) continue;
    s += LAt(im, x, y);
    n++;
  }
  return { mean: n ? s / n : null, n };
}

const root = arg('--root');
if (!root) { console.error('usage: node visual-gate.mjs --root <dir>'); process.exit(2); }
const RIDGE = [0.70, 0.40, 0.92, 0.54];
const SLOPE_L = [0.08, 0.46, 0.42, 0.62];
const SLOPE_R = [0.58, 0.46, 0.92, 0.62];
const ICE = [0.62, 0.18, 0.96, 0.42];
const SKY = [0.30, 0.08, 0.55, 0.18];
const CONTACT_MIN = 0.04;
const SHADE_B_LO = -4.4;
const SHADE_B_HI = -3.2;
// The key's old box differences. The 0.8 factor stays. The sample inside the box changes.
const SKY_KEY = { '24': 0.076, '30': 0.086 };
const SHADE = new Set(['51', '79', '117', '30']);
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const rows = [];

const key24 = load(path.join(keyDir, 't24.jpg'));
const key30 = load(path.join(keyDir, 't30.jpg'));
const now24 = load(path.join(root, 'after/t24.jpg'));
const now30 = load(path.join(root, 'after/t30.jpg'));
const ridgeKey = samples(key24, RIDGE).step;
const ridgeNow = samples(now24, RIDGE).step;
const slopeKey = Math.abs(meanBox(key30, SLOPE_L) - meanBox(key30, SLOPE_R));
const slopeNow = Math.abs(meanBox(now30, SLOPE_L) - meanBox(now30, SLOPE_R));
if (!(ridgeNow >= 0.8 * ridgeKey)) bad(`ridge step 24 ${ridgeNow.toFixed(3)} < 0.8x key ${ridgeKey.toFixed(3)}`);
if (!(slopeNow >= 0.8 * slopeKey)) bad(`slope step 30 ${slopeNow.toFixed(3)} < 0.8x key ${slopeKey.toFixed(3)}`);
console.log('form', 'ridge', ridgeNow.toFixed(3), 'key', ridgeKey.toFixed(3), 'slope', slopeNow.toFixed(3), 'key', slopeKey.toFixed(3));

const slab = {};
for (const tag of ['24', '30']) {
  const im = tag === '24' ? now24 : now30;
  const key = tag === '24' ? key24 : key30;
  const eNow = energy(im, ICE);
  const eKey = energy(key, ICE);
  const oldNow = meanBox(im, ICE) - meanBox(im, SKY);
  const oldKey = meanBox(key, ICE) - meanBox(key, SKY);
  const idPath = path.join(root, 'after', `t${tag}-id.png`);
  if (!fs.existsSync(idPath)) bad(`draw id missing ${tag}`);
  const idIm = fs.existsSync(idPath) ? load(idPath) : null;
  let wall = null, sky = null, keyWall = null, keySky = null, skySnow = 0, skyLit = 0;
  if (idIm) {
    wall = classMean(im, ICE, idIm, DRAW.wall);
    sky = classMean(im, SKY, idIm, DRAW.sky);
    keyWall = classMean(key, ICE, idIm, DRAW.wall);
    keySky = classMean(key, SKY, idIm, DRAW.sky);
    const mask = load(path.join(root, 'mask', `t${tag}.png`));
    const x0 = SKY[0] * im.w | 0, x1 = SKY[2] * im.w | 0;
    const y0 = SKY[1] * im.h | 0, y1 = SKY[3] * im.h | 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
      if (drawOf(idIm, x, y) !== DRAW.snow) continue;
      skySnow++;
      if (mask.raw[(y * mask.w + x) * 3] / 255 > 0.7) skyLit++;
    }
  }
  const sil = wall && sky && wall.mean != null && sky.mean != null ? wall.mean - sky.mean : null;
  const silKeyMasked = keyWall && keySky && keyWall.mean != null && keySky.mean != null ? keyWall.mean - keySky.mean : null;
  const bar = SKY_KEY[tag];
  if (!(eNow >= 0.8 * eKey)) bad(`ice energy ${tag} ${eNow.toFixed(4)} < 0.8x ${eKey.toFixed(4)}`);
  if (sil == null) bad(`slab sky ${tag} missing`);
  else if (!(sil >= 0.8 * bar)) bad(`slab sky ${tag} ${sil.toFixed(3)} < 0.8x key ${bar.toFixed(3)}`);
  slab[tag] = {
    oldBox: +oldNow.toFixed(3),
    oldKey: +oldKey.toFixed(3),
    wallMinusSky: sil == null ? null : +sil.toFixed(3),
    keyMasked: silKeyMasked == null ? null : +silKeyMasked.toFixed(3),
    bar,
    wallN: wall && wall.n,
    skyN: sky && sky.n,
    skyBoxSnow: skySnow,
    skyBoxLitSnow: skyLit,
    wallL: wall && wall.mean != null ? +wall.mean.toFixed(3) : null,
    skyL: sky && sky.mean != null ? +sky.mean.toFixed(3) : null,
  };
  console.log('ice', tag, 'energy', eNow.toFixed(4), eKey.toFixed(4), 'oldBox', oldNow.toFixed(3), 'wall-sky', sil == null ? 'none' : sil.toFixed(3), 'keyMasked', silKeyMasked == null ? 'none' : silKeyMasked.toFixed(3), 'skyBoxLitSnow', skyLit);
  rows.push({ tag, iceEnergy: +eNow.toFixed(4), iceEnergyKey: +eKey.toFixed(4), slab: slab[tag] });
}

const bStar = {};
for (const tag of ['51', '5567', '79', '117', '24', '30']) {
  const im = load(path.join(root, 'after', `t${tag}.jpg`));
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after', `t${tag}.json`), 'utf8'));
  const c = contact(im, info);
  const maskPath = path.join(root, 'mask', `t${tag}.png`);
  const pngPath = path.join(root, 'after', `t${tag}.png`);
  const idPath = path.join(root, 'after', `t${tag}-id.png`);
  if (!fs.existsSync(idPath)) bad(`draw id missing ${tag}`);
  const shade = shadeB(
    fs.existsSync(pngPath) ? load(pngPath) : im,
    fs.existsSync(maskPath) ? load(maskPath) : null,
    fs.existsSync(idPath) ? load(idPath) : null,
  );
  bStar[tag] = {
    clean: shade.clean == null ? null : +shade.clean.toFixed(2),
    mixed: shade.mixed == null ? null : +shade.mixed.toFixed(2),
    nClean: shade.nClean,
    nExcluded: shade.nExcluded,
  };
  if (shade.clean == null) bad(`shade b* ${tag} empty`);
  else if (!(shade.clean >= SHADE_B_LO && shade.clean <= SHADE_B_HI)) bad(`shade b* ${tag} ${shade.clean.toFixed(2)} outside ${SHADE_B_LO}..${SHADE_B_HI}`);
  if ((tag === '5567' || tag === '24') && !(shade.mixed > 0 && shade.clean < -8)) {
    bad(`shade fixture ${tag} mixed ${shade.mixed} clean ${shade.clean}`);
  }
  if (!c) bad(`contact missing ${tag}`);
  else if (c.dark < CONTACT_MIN) bad(`contact ${tag} ${c.dark.toFixed(3)} < ${CONTACT_MIN}`);
  else if (Math.abs((c.px ?? 360) - 360) > 8) bad(`bolt x ${tag} ${c.px}`);
  if (c) console.log('contact', tag, c.dark.toFixed(3), SHADE.has(tag) ? 'shade' : 'sun');
  const matPath = path.join(root, 'after', `t${tag}-mat.png`);
  if (fs.existsSync(maskPath)) {
    const pen = penumbra(load(maskPath), load(matPath), info);
    if (pen.thin > 6) bad(`slivers ${tag} ${pen.thin}`);
    if (!(pen.far >= 3)) bad(`penumbra ${tag} far ${pen.far}px near ${pen.near}px`);
    console.log('penumbra', tag, JSON.stringify(pen));
    rows.push({ tag, contact: c && +c.dark.toFixed(3), shadeB: bStar[tag], penumbra: pen });
  }
}
rows.push({ form: { ridgeNow, ridgeKey, slopeNow, slopeKey }, shadeB: bStar, slab });
const report = { rows, verdict: fail ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(root, 'visual-gate.json'), JSON.stringify(report, null, 2) + '\n');
console.log('shade b*', JSON.stringify(bStar));
console.log(report.verdict);
if (fail) process.exit(1);
