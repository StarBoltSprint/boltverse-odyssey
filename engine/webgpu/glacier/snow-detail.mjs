// Ground-band Laplacian against the spire band, at 1 m and 8 m.
// Threshold 0.6 was written before the run-32 trial. Clean snow stills only.
// The spire is the wall ice the chase sees, sampled the way sampleArr does:
// hex cells, one lead still at 0.85 plus 0.05 of the other three, mip bias 4.
// Snow is the play shader: hex cell, one or two clean stills, height blend, bias 2.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FOV_Y } from '../engine/bricks/follow-cam.js';
import { decodeImage } from '../biome-factory/texel-gate.mjs';
import { REPEATS_PER_M } from './texel-density.js';

export const LAP_RATIO_MIN = 0.6;
export const LAP_DISTANCES = [1, 8];
const PHONE_H = 1280;
const TEX = 1024;
const CELLS = 2;
const SNOW_BIAS = 2;
const SPIRE_BIAS = 4;
const COVER = 3 / TEX;

const here = path.dirname(fileURLToPath(import.meta.url));

function hash21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function rot2(x, y, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

function mipsOf(luma, w) {
  const chain = [luma];
  let cur = luma;
  let cw = w;
  while (cw > 1) {
    const nw = Math.max(1, cw >> 1);
    const next = new Float32Array(nw * nw);
    for (let y = 0; y < nw; y++) {
      for (let x = 0; x < nw; x++) {
        const x0 = Math.min(cw - 1, x * 2);
        const x1 = Math.min(cw - 1, x0 + 1);
        const y0 = Math.min(cw - 1, y * 2);
        const y1 = Math.min(cw - 1, y0 + 1);
        next[y * nw + x] = (cur[y0 * cw + x0] + cur[y0 * cw + x1] + cur[y1 * cw + x0] + cur[y1 * cw + x1]) * 0.25;
      }
    }
    chain.push(next);
    cur = next;
    cw = nw;
  }
  return chain;
}

function sampleLevel(level, u, v) {
  const w = Math.round(Math.sqrt(level.length));
  const x = ((u % 1) + 1) % 1 * w - 0.5;
  const y = ((v % 1) + 1) % 1 * w - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const at = (ix, iy) => level[((iy % w) + w) % w * w + ((ix % w) + w) % w];
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

function sampleLod(chain, u, v, lod) {
  const l0 = Math.max(0, Math.min(chain.length - 1, Math.floor(lod)));
  const l1 = Math.min(chain.length - 1, l0 + 1);
  const t = Math.min(1, Math.max(0, lod - l0));
  return sampleLevel(chain[l0], u, v) * (1 - t) + sampleLevel(chain[l1], u, v) * t;
}

export function lodAt(distance, bias) {
  const focal = (PHONE_H / 2) / Math.tan(FOV_Y / 2);
  const uvPerPx = (distance / focal) * REPEATS_PER_M * bias;
  const d = Math.max(uvPerPx, COVER);
  return Math.log2(Math.max(d * TEX, 1));
}

function hex(mx, my) {
  const sx = (mx + my * 0.5) * CELLS;
  const sy = my * 0.8660254 * CELLS;
  const i = Math.floor(sx);
  const j = Math.floor(sy);
  const fx = sx - i;
  const fy = sy - j;
  const lower = fx > fy;
  const w0 = lower ? 1 - fx : 1 - fy;
  const w1 = lower ? fx - fy : fy - fx;
  const w2 = lower ? fx : fy;
  const sm = [w0, w1, w2].map((w) => w * w * (3 - 2 * w));
  const sum = sm[0] + sm[1] + sm[2] || 1e-4;
  const id1 = lower ? [i + 1, j] : [i, j + 1];
  return { ids: [[i, j], id1, [i + 1, j + 1]], w: sm.map((v) => v / sum) };
}

function layerOf(id, salt, n) {
  const h = hash21(id[0] + salt, id[1] + 1.7);
  return Math.floor(h * n) % n;
}

function heightW(ha, hb) {
  const t = Math.min(1, Math.max(0, 0.5 + (ha - hb) / 0.012));
  return t * t * (3 - 2 * t);
}

function cellColour(chains, uv, lod, id) {
  const n = chains.length;
  const a = layerOf(id, 8.0, n);
  const b = layerOf(id, 2.2, n);
  const two = hash21(id[0] + 9.2, id[1] + 4.4) > 0.42 && a !== b;
  const ca = sampleLod(chains[a], uv[0], uv[1], lod);
  if (!two) return ca;
  const cb = sampleLod(chains[b], uv[0], uv[1], lod);
  const ha = ca - sampleLod(chains[a], uv[0], uv[1], Math.min(lod + 4, 8));
  const hb = cb - sampleLod(chains[b], uv[0], uv[1], Math.min(lod + 4, 8));
  const w = heightW(ha, hb);
  return cb * (1 - w) + ca * w;
}

function variantW(id, n) {
  const lead = Math.floor(hash21(id[0] + 8, id[1] + 1) * 4) % 4;
  const w = [0.05, 0.05, 0.05, 0.05];
  w[lead % n] = 0.85;
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

export function renderPatch(chains, distance, bias, mode, size = 96) {
  const focal = (PHONE_H / 2) / Math.tan(FOV_Y / 2);
  const metresPerPx = distance / focal;
  const lod = lodAt(distance, bias);
  const img = new Float32Array(size * size);
  const ang = 0.41;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = (x - size / 2) * metresPerPx;
      const wy = (y - size / 2) * metresPerPx;
      const base = rot2(wx, wy, ang);
      const cell = hex(base[0], base[1]);
      let acc = 0;
      for (let k = 0; k < 3; k++) {
        const id = cell.ids[k];
        const spin = hash21(id[0] + 3.7, id[1] + 9.1) * Math.PI * 2;
        const ox = hash21(id[0] + 2.2, id[1] + 5.1) * 0.5;
        const oy = hash21(id[0] + 4.4, id[1] + 1.3) * 0.5;
        const spun = rot2(base[0], base[1], spin);
        const uv = [spun[0] * REPEATS_PER_M + ox, spun[1] * REPEATS_PER_M + oy];
        let c;
        if (mode === 'snow') c = cellColour(chains, uv, lod, id);
        else {
          const w = variantW(id, chains.length);
          c = 0;
          for (let i = 0; i < chains.length; i++) c += sampleLod(chains[i], uv[0], uv[1], lod) * w[i];
        }
        acc += c * cell.w[k];
      }
      img[y * size + x] = acc;
    }
  }
  return { img, size, lod };
}

export function meanAbsLaplacian(img, size) {
  let s = 0;
  let n = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const c = img[y * size + x];
      const lap = img[y * size + x - 1] + img[y * size + x + 1] + img[(y - 1) * size + x] + img[(y + 1) * size + x] - 4 * c;
      s += Math.abs(lap);
      n++;
    }
  }
  return n ? s / n : 0;
}

function loadChain(file) {
  const img = decodeImage(fs.readFileSync(path.join(here, file)));
  if (!img) throw new Error('unread ' + file);
  return mipsOf(img.luma, img.w);
}

export function detailReport() {
  const snow = [
    'tex/snow-v2/snow-v2-2.png',
    'tex/snow-v2/snow-v2-3.png',
  ].map(loadChain);
  const spire = ['v1', 'v2', 'v3', 'v4'].map((n) => loadChain(`tex/glacier-ice/${n}.jpg`));
  const rows = [];
  let pass = true;
  for (const distance of LAP_DISTANCES) {
    const g = renderPatch(snow, distance, SNOW_BIAS, 'snow');
    const s = renderPatch(spire, distance, SPIRE_BIAS, 'spire');
    const gLap = meanAbsLaplacian(g.img, g.size);
    const sLap = meanAbsLaplacian(s.img, s.size);
    const ratio = sLap > 1e-8 ? gLap / sLap : 0;
    const row = {
      distance,
      groundLap: gLap,
      spireLap: sLap,
      ratio,
      snowLod: g.lod,
      spireLod: s.lod,
      pass: ratio >= LAP_RATIO_MIN,
    };
    if (!row.pass) pass = false;
    rows.push(row);
  }
  return { pass, min: LAP_RATIO_MIN, rows };
}

function main() {
  const report = detailReport();
  for (const row of report.rows) {
    console.log(
      `lap ${row.distance} m | ground ${row.groundLap.toFixed(4)} | spire ${row.spireLap.toFixed(4)} | ratio ${row.ratio.toFixed(3)} | snow lod ${row.snowLod.toFixed(2)} | spire lod ${row.spireLod.toFixed(2)} | ${row.pass ? 'PASS' : 'FAIL'}`,
    );
  }
  if (!report.pass) {
    console.log(`FAIL ground Laplacian under ${report.min}x the spire band`);
    process.exit(1);
  }
  console.log(`PASS snow detail >= ${report.min}x spire at 1 m and 8 m`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
