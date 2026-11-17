// Score saved follow frames. Contact pixels are flat snow inside the baked
// radius (AO < 0.6). The reference is flat snow outside that radius, stepped
// 3/1.75 times the contact half-width into the lane. The same pixels are
// read on the pre-change frames.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';
import { glacierIrr, shMeta } from './sh-sky.js';

const root = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32';
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
const W = 720;
const H = 1280;

function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], { maxBuffer: 12 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(String(r.stderr).slice(-180));
  return r.stdout;
}
function luma(buf, i) {
  const R = (buf[i] / 255) ** 2.2;
  const G = (buf[i + 1] / 255) ** 2.2;
  const B = (buf[i + 2] / 255) ** 2.2;
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor((s.length - 1) / 2)];
}
function matOf(s, i) { return Math.round(s[i] / 255 * 8 - 0.5); }
function flat(shade, normal, i) {
  if (matOf(shade, i) !== 0) return false;
  const ny = normal[i + 1] / 255 * 2 - 1;
  const ndl = shade[i + 1] / 255;
  return ny > 0.9 && ndl > 0.18 && ndl < 0.4;
}
function ratio(surface, albedo, i) {
  const al = luma(albedo, i);
  return al > 0.05 ? luma(surface, i) / al : null;
}

function load(dir, t) {
  const tag = String(t).replace('.', 'p');
  const g = (n) => decode(path.join(dir, `t${tag}-${n}.png`));
  return { surface: g('surface'), shade: g('shade'), normal: g('normal'), albedo: g('albedo'), beauty: g('beauty'), bolt: g('bolt') };
}

function clusters(after) {
  const pts = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (!flat(after.shade, after.normal, i)) continue;
    const ao = after.shade[i + 3] / 255;
    if (ao > 0.6) continue;
    pts.push([x, y, ao]);
  }
  const groups = [];
  for (const p of pts) {
    let g = groups.find((q) => Math.abs(q.x - p[0]) < 28 && Math.abs(q.y - p[1]) < 18);
    if (!g) { g = { x: p[0], y: p[1], pts: [] }; groups.push(g); }
    g.pts.push(p);
    g.x = g.pts.reduce((s, v) => s + v[0], 0) / g.pts.length;
    g.y = g.pts.reduce((s, v) => s + v[1], 0) / g.pts.length;
  }
  return groups.filter((g) => g.pts.length >= 6);
}

function darkenAt(buf, group) {
  const lights = [];
  let minX = 1e9;
  let maxX = -1e9;
  for (const p of group.pts) {
    const i = (p[1] * W + p[0]) * 4;
    if (!flat(buf.shade, buf.normal, i)) continue;
    const r = ratio(buf.surface, buf.albedo, i);
    if (r) lights.push(r);
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
  }
  if (lights.length < 6) return null;
  const half = Math.max(8, (maxX - minX) / 2);
  const step = Math.round(half * (3 / 1.75));
  const dir = group.x < W / 2 ? 1 : -1;
  const refs = [];
  const cx = Math.round(group.x + dir * step);
  const cy = Math.round(group.y);
  for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
    const i = (y * W + x) * 4;
    if (!flat(buf.shade, buf.normal, i)) continue;
    if (buf.shade[i + 3] / 255 < 0.98) continue;
    const r = ratio(buf.surface, buf.albedo, i);
    if (r) refs.push(r);
  }
  if (refs.length < 6) return null;
  const L05 = median(lights);
  const L3 = median(refs);
  return { n: lights.length, n3: refs.length, L05, L3, darken: 1 - L05 / L3, ao: median(group.pts.map((p) => p[2])) };
}

function openStats(buf) {
  const ndls = [];
  for (let y = 840; y <= 1020; y += 2) for (let x = 340; x <= 380; x += 2) {
    const i = (y * W + x) * 4;
    if (matOf(buf.shade, i) !== 0) continue;
    if (buf.normal[i + 1] / 255 * 2 - 1 > 0.96) ndls.push(buf.shade[i + 1] / 255);
  }
  const mid = ndls.length ? median(ndls) : 0.28;
  const bands = [860, 930, 1000];
  const lights = [];
  const raws = [];
  const aos = [];
  for (const cy of bands) {
    const L = [];
    const R = [];
    const A = [];
    for (let y = cy - 16; y <= cy + 16; y++) for (let x = 344; x <= 376; x++) {
      const i = (y * W + x) * 4;
      if (matOf(buf.shade, i) !== 0) continue;
      const ny = buf.normal[i + 1] / 255 * 2 - 1;
      const ndl = buf.shade[i + 1] / 255;
      if (ny < 0.96 || Math.abs(ndl - mid) > 0.02) continue;
      const al = luma(buf.albedo, i);
      if (!(al > 0.05)) continue;
      L.push(luma(buf.surface, i) / al);
      R.push(luma(buf.surface, i));
      A.push(buf.shade[i + 3] / 255);
    }
    if (L.length >= 40) { lights.push(median(L)); raws.push(median(R)); aos.push(median(A)); }
  }
  if (lights.length < 2) return { spread: null, raw: null, ao: null };
  const mean = lights.reduce((s, v) => s + v, 0) / lights.length;
  return {
    spread: (Math.max(...lights) - Math.min(...lights)) / mean,
    raw: median(raws),
    ao: Math.min(...aos),
  };
}

function boltLuma(beauty, bolt) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < bolt.length; i += 4) {
    if (bolt[i] < 16 && bolt[i + 1] < 16 && bolt[i + 2] < 16) continue;
    s += luma(beauty, i);
    n++;
  }
  return n ? s / n : null;
}

function shadeDE(buf) {
  const got = [];
  const pred = [];
  const cool = [];
  const warm = [];
  for (let y = 80; y < H - 80; y += 2) for (let x = 40; x < W - 40; x += 2) {
    const i = (y * W + x) * 4;
    const mat = matOf(buf.shade, i);
    const ndl = buf.shade[i + 1] / 255;
    const ndv = buf.shade[i + 2] / 255;
    const ao = buf.shade[i + 3] / 255;
    if (ndv <= 0.55 || ndl >= 0.12) continue;
    if (mat !== 6 && mat !== 1 && mat !== 2) continue;
    const N = [buf.normal[i] / 255 * 2 - 1, buf.normal[i + 1] / 255 * 2 - 1, buf.normal[i + 2] / 255 * 2 - 1];
    const alb = [buf.albedo[i], buf.albedo[i + 1], buf.albedo[i + 2]].map((c) => (c / 255) ** 2.2);
    const irr = glacierIrr(N, ao);
    let col = alb.map((c, k) => c * irr[k]);
    if ((mat > 0.5 && mat < 3.5) || (mat > 5.5 && mat < 6.5)) {
      const t = Math.min(1, Math.max(0, (ndl - 0.02) / 0.3));
      const sm = t * t * (3 - 2 * t);
      col = col.map((c, k) => c + alb[k] * [0.2, 0.26, 0.38][k] * (1 - sm));
    }
    pred.push(col.map((c) => Math.round((Math.min(1, Math.max(0, c)) ** (1 / 2.2)) * 255)));
    got.push([buf.surface[i], buf.surface[i + 1], buf.surface[i + 2]]);
    const br = (buf.surface[i + 2] / 255) ** 2.2 - (buf.surface[i] / 255) ** 2.2;
    if (N[1] > 0.25) cool.push(br);
    if (N[1] < -0.05) warm.push(br);
    if (got.length > 400) break;
  }
  if (got.length < 8) return { n: got.length, dE76: null };
  const lab = (pix) => {
    const labs = pix.map((p) => srgbToLab(p));
    const mid = (k) => labs.map((v) => v[k]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
    return [mid(0), mid(1), mid(2)];
  };
  return {
    n: got.length,
    dE76: +dE76(lab(got), lab(pred)).toFixed(2),
    cool: cool.length >= 8 ? +median(cool).toFixed(4) : null,
    warm: warm.length >= 8 ? +median(warm).toFixed(4) : null,
  };
}

const rows = [];
for (const t of TIMES) {
  const before = load(path.join(root, 'before'), t);
  const after = load(path.join(root, 'after'), t);
  const groups = clusters(after);
  const samples = [];
  for (const g of groups) {
    const b = darkenAt(before, g);
    const a = darkenAt(after, g);
    if (!b || !a) continue;
    samples.push({
      x: Math.round(g.x), y: Math.round(g.y), n: g.pts.length,
      before: +b.darken.toFixed(4), after: +a.darken.toFixed(4), ao: +a.ao.toFixed(3),
    });
  }
  const ob = openStats(before);
  const oa = openStats(after);
  const boltB = boltLuma(before.beauty, before.bolt);
  const boltA = boltLuma(after.beauty, after.bolt);
  rows.push({
    t,
    samples,
    contactMinAfter: samples.length ? Math.min(...samples.map((s) => s.after)) : null,
    contactMedAfter: samples.length ? +median(samples.map((s) => s.after)).toFixed(4) : null,
    contactMedBefore: samples.length ? +median(samples.map((s) => s.before)).toFixed(4) : null,
    openBefore: ob,
    openAfter: oa,
    snowDelta: ob.raw && oa.raw ? +((oa.raw - ob.raw) / ob.raw).toFixed(4) : null,
    bolt: { before: boltB && +boltB.toFixed(4), after: boltA && +boltA.toFixed(4), delta: boltB && boltA ? +(boltA - boltB).toFixed(4) : null },
    shade: shadeDE(after),
  });
  console.log(JSON.stringify({
    t, n: samples.length,
    medBefore: rows.at(-1).contactMedBefore,
    medAfter: rows.at(-1).contactMedAfter,
    minAfter: rows.at(-1).contactMinAfter,
    spreadB: ob.spread && +ob.spread.toFixed(4),
    spreadA: oa.spread && +oa.spread.toFixed(4),
    ao: oa.ao,
    snowDelta: rows.at(-1).snowDelta,
    bolt: rows.at(-1).bolt,
    de: rows.at(-1).shade,
  }));
}
const meta = shMeta();
const out = path.join(path.dirname(new URL(import.meta.url).pathname), 'artifacts', 'run32', 'score.json');
fs.writeFileSync(out, JSON.stringify({ meta, rows }, null, 2));
fs.writeFileSync(path.join(root, 'score.json'), JSON.stringify({ meta, rows }, null, 2));
