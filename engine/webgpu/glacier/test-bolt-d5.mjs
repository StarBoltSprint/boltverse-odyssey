// D5 gates. Thresholds are artifacts/run32/thresholds.md, written before this trial.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE, DRAWS, LIMITS } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const port = 8773;
const server = await serve(webgpu, port);
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function meanLab(pixels) {
  const labs = pixels.map((p) => srgbToLab(p));
  const n = labs.length || 1;
  const s = [0, 0, 0];
  for (const L of labs) { s[0] += L[0]; s[1] += L[1]; s[2] += L[2]; }
  return s.map((v) => v / n);
}
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx; const b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return num / Math.sqrt(dx * dy);
}
function linChan(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  const raw = await withChrome({
    debugPort: 9383,
    url,
    tries: 160,
    fn: async ({ evalJson }) => evalJson('window.__glacierD5().then(r => JSON.stringify(r))'),
  });
  const dEs = raw.samples.map((s) => ({ ...s, dE: dE76(srgbToLab(s.got), srgbToLab(s.pred)) }));
  const ranked = dEs.slice().sort((a, b) => b.dE - a.dE);
  console.log('worst samples', JSON.stringify(ranked.slice(0, 6), null, 2));
  const meanDE = dEs.reduce((a, b) => a + b.dE, 0) / (dEs.length || 1);
  const worstDE = dEs.reduce((a, b) => Math.max(a, b.dE), 0);
  const bandRows = raw.bands.map((row) => {
    const back = meanLab(row.back);
    const belly = meanLab(row.belly);
    const meanLin = (px) => {
      const s = [0, 0, 0];
      for (const p of px) { s[0] += linChan(p[0]); s[1] += linChan(p[1]); s[2] += linChan(p[2]); }
      return s.map((v) => v / (px.length || 1));
    };
    const bL = meanLin(row.back);
    const yL = meanLin(row.belly);
    return {
      frame: row.frame, nBack: row.back.length, nBelly: row.belly.length,
      backLab: back.map((v) => +v.toFixed(2)),
      bellyLab: belly.map((v) => +v.toFixed(2)),
      db: +(back[2] - belly[2]).toFixed(2),
      backBR: +(bL[2] / bL[0]).toFixed(3),
      bellyBR: +(yL[2] / yL[0]).toFixed(3),
    };
  });
  const fr = raw.paws.map((p) => p.frac);
  const fMin = Math.min(...fr);
  const fMax = Math.max(...fr);
  const usable = raw.paws.filter((p) => p.ratio !== null);
  const r = usable.length > 3 ? pearson(usable.map((p) => 1 - (p.frac - fMin) / (fMax - fMin)), usable.map((p) => p.ratio)) : null;
  const down = raw.paws.filter((p) => p.frac >= 0.12);
  const up = raw.paws.filter((p) => p.frac <= 0.04);
  const report = {
    base: { n: dEs.length, meanDE: +meanDE.toFixed(3), worstDE: +worstDE.toFixed(3), limit: 3 },
    bands: bandRows,
    pawSummary: { down: down.map((p) => p.ratio), up: up.map((p) => p.ratio), correlation: r === null ? null : +r.toFixed(3), n: usable.length },
    paws: raw.paws,
    prints: { seen: raw.seen, at10: raw.at10, stamps: raw.stamps },
    cardH: raw.cardH, draws: raw.draws, drawNames: DRAWS, tris: raw.tris, limits: LIMITS,
    boltPx: raw.boltPx, useR16: raw.useR16,
  };
  const out = path.join(here, 'artifacts/run32/d5.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ base: report.base, bands: bandRows, paw: report.pawSummary, prints: report.prints, draws: report.draws, tris: report.tris, cardH: report.cardH, boltPx: report.boltPx, useR16: raw.useR16 }, null, 2));
  if (!(raw.samples.length >= 8)) bad('too few base samples ' + raw.samples.length);
  if (!(meanDE <= 3) || !(worstDE <= 3)) bad('base colour dE ' + meanDE.toFixed(2) + ' / ' + worstDE.toFixed(2));
  for (const row of bandRows) {
    if (row.nBack < 4 || row.nBelly < 4) bad('band samples ' + row.frame);
    if (!(row.db >= 3)) bad('Lab b split ' + row.db + ' frame ' + row.frame);
    if (!(row.bellyBR > row.backBR)) bad('B/R split frame ' + row.frame);
  }
  if (down.length < 1 || up.length < 1) bad('paw classes empty');
  for (const p of down) if (!(p.ratio <= 0.55)) bad('paw down ' + p.i + ' ' + p.ratio);
  for (const p of up) if (!(p.ratio >= 0.85)) bad('paw up ' + p.i + ' ' + p.ratio);
  if (!(r >= 0.7)) bad('paw correlation ' + r);
  if (!raw.seen || raw.seen.length < 3) bad('print frames ' + (raw.seen && raw.seen.length));
  else for (const s of raw.seen) {
    if (!(s.behind >= 7.5)) bad('print behind ' + s.behind);
    if (!s.darker) bad('print not darker ' + JSON.stringify(s));
    if (!(s.height <= -0.35 * 0.72)) bad('print height ' + s.height);
  }
  if (!raw.at10 || !(raw.at10.behind >= 10) || !(raw.at10.height <= -0.25 * 0.72)) bad('10 m print ' + JSON.stringify(raw.at10));
  if (raw.cardH !== 1.15) bad('card ' + raw.cardH);
  if (raw.draws > 12) bad('draws ' + raw.draws);
  if (raw.tris > 200000) bad('tris ' + raw.tris);
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS bolt-d5');
