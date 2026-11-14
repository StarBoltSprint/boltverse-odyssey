// D8 stills, flicker, contrast, horizon, chroma. Same seed, same route.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';
import { srgbToLab, srgbToLin } from '../biome-factory/cie76.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const TIMES = [5.10, 5.567, 7.9, 11.70, 24, 30];

function meanLab(px) {
  if (!px || !px.length) return null;
  const acc = [0, 0, 0];
  for (const p of px) {
    const lab = srgbToLab(p);
    acc[0] += lab[0]; acc[1] += lab[1]; acc[2] += lab[2];
  }
  return acc.map((v) => v / px.length);
}
function meanRgb(px) {
  if (!px || !px.length) return null;
  const a = [0, 0, 0];
  for (const p of px) { a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; }
  return a.map((v) => v / px.length);
}
function dirOf(rgb) {
  if (!rgb) return null;
  const lin = rgb.map((c) => srgbToLin(c));
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return lin.map((v) => v / Math.max(y, 1e-4));
}
function dirDist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const outDir = process.argv[2] || path.join(here, 'artifacts', 'run32');
const port = Number(process.argv[3] || 8771);
const debugPort = Number(process.argv[4] || 9391);
fs.mkdirSync(outDir, { recursive: true });
const server = await serve(webgpu, port);
const t0 = Date.now();
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const rows = [];
      for (const t of TIMES) {
        const row = await evalJson(`window.__glacierD8(${t}).then(r => JSON.stringify(r))`);
        if (row.gpuErr) throw new Error(row.gpuErr);
        const nearLab = meanLab(row.nearPx);
        const farLab = meanLab(row.farPx);
        const skyLab = meanLab(row.skyPx);
        const dIce = dirDist(dirOf(meanRgb(row.farPx)), dirOf(meanRgb(row.nearPx)));
        const dSky = dirDist(dirOf(meanRgb(row.farPx)), dirOf(meanRgb(row.skyPx)));
        const slim = {
          t: row.t, z: row.z, flicker: row.flicker, flickerN: row.flickerN,
          shimmer: row.shimmer, mid: row.mid, midN: row.midN,
          nearLuma: row.nearLuma, nearN: row.nearN, farLuma: row.farLuma, farN: row.farN,
          contrast: row.contrast, horizon: row.horizon,
          nearLab, farLab, skyLab, dIce, dSky,
          chromaPass: dIce != null && dSky != null && dIce <= dSky + 0.02,
          tris: row.tris, worldTris: row.worldTris, lodTris: row.lodTris,
          particleTris: row.particleTris, draws: row.draws,
        };
        rows.push(slim);
        console.log(JSON.stringify(slim));
        const film = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify(r))`);
        if (film.info && film.info.gpuErr) throw new Error(film.info.gpuErr);
        const jpg = path.join(outDir, `t${t}.jpg`);
        fs.writeFileSync(jpg, Buffer.from(film.jpg, 'base64'));
      }
      fs.writeFileSync(path.join(outDir, 'd8.json'), JSON.stringify({ rows }, null, 2) + '\n');
    },
  });
  console.log('D8_DONE', outDir, ((Date.now() - t0) / 1000).toFixed(1) + 's');
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
