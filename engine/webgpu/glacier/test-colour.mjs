// Blocking real-colour gate on SwiftShader pixels.
// CIE76 <= 10, lightness included. A darkened wall must block.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DE76_MAX } from '../biome-factory/cie76.mjs';
import { shadeAt } from '../biome-factory/light-rig.js';
import { scoreWindow } from '../biome-factory/render-colour-gate.mjs';
import { serve, withChrome } from './chrome.mjs';
import { buildWorld } from './world.js';
import { MAT, LIGHT, CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const MATERIALS = [
  { id: 'snow', mat: MAT.snow },
  { id: 'waterfall', mat: MAT.fall },
  { id: 'arch', mat: MAT.arch },
  { id: 'wall', mat: MAT.wall },
];

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

const sunN = norm(LIGHT.sun.direction);

function pushTri(buckets, mat, a, b, c, n) {
  if (!buckets.has(mat)) return;
  const area = 0.5 * Math.hypot(...cross(sub(b, a), sub(c, a)));
  const ndl = Math.max(0, n[0] * sunN[0] + n[1] * sunN[1] + n[2] * sunN[2]);
  const flat = n[1] > 0.75;
  if (area < 0.4) return;
  if (flat ? ndl < 0.12 : ndl < 0.45) return;
  const at = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
  if (at[2] < -220 || at[2] > 80) return;
  const d = 0.7;
  buckets.get(mat).push({
    at,
    eye: [at[0] + n[0] * d, at[1] + n[1] * d + 0.02, at[2] + n[2] * d],
    tgt: at,
    ndl,
    area,
  });
}

function pickShots() {
  const world = buildWorld();
  const v = world.verts;
  const buckets = new Map(MATERIALS.map((m) => [m.mat, []]));
  for (let i = 0; i + 24 <= v.length; i += 24) {
    const mat = Math.round(v[i + 3]);
    if (!buckets.has(mat)) continue;
    const a = [v[i], v[i + 1], v[i + 2]];
    const b = [v[i + 8], v[i + 9], v[i + 10]];
    const c = [v[i + 16], v[i + 17], v[i + 18]];
    pushTri(buckets, mat, a, b, c, norm([v[i + 4], v[i + 5], v[i + 6]]));
  }
  const shots = [];
  for (const spec of MATERIALS) {
    const faces = buckets.get(spec.mat).sort((p, q) => q.ndl - p.ndl || q.area - p.area);
    const chosen = [];
    for (const face of faces) {
      if (chosen.every((c) => Math.hypot(c.at[0] - face.at[0], c.at[1] - face.at[1], c.at[2] - face.at[2]) > 2)) chosen.push(face);
      if (chosen.length === 3) break;
    }
    for (const face of chosen) shots.push({ ...spec, ...face });
  }
  return shots;
}

function summarise(rows) {
  const by = new Map();
  for (const row of rows) {
    if (!by.has(row.id)) by.set(row.id, []);
    by.get(row.id).push(row);
  }
  return [...by.entries()].map(([id, patches]) => {
    const good = patches.filter((p) => p.ok);
    if (!good.length) return { id, patches: patches.length, verdict: 'UNCERTAIN', dE76: null, pixels: 0, reasons: patches.map((p) => p.reason || p.pixels) };
    const worst = good.reduce((a, b) => (a.dE76 > b.dE76 ? a : b));
    return {
      id,
      patches: good.length,
      tried: patches.length,
      pixels: good.reduce((s, p) => s + p.pixels, 0),
      dE76: worst.dE76,
      verdict: worst.verdict,
      lab: worst.lab,
      predLab: worst.predLab,
      threshold: DE76_MAX,
    };
  });
}

const only = process.argv[2];
const shots = pickShots().filter((s) => !only || s.id === only);
if (!only && new Set(shots.map((s) => s.id)).size < 4) {
  console.error('FAIL not enough lit faces', shots.map((s) => s.id));
  process.exit(1);
}
const port = 8765;
const server = await serve(webgpu, port);
const shade = (ndl, ny) => shadeAt(LIGHT, ndl, ny);
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  const clean = summarise(await withChrome({
    debugPort: 9341,
    url,
    fn: async ({ evalJson }) => {
      const rows = [];
      for (const shot of shots) {
        const frame = await evalJson(`window.__glacierGate(${JSON.stringify({
          eye: shot.eye, tgt: shot.tgt, at: shot.at, breakId: 0, rad: 10,
        })}).then(r => JSON.stringify(r))`);
        const scored = frame.ok ? scoreWindow(frame, shot.mat, shade) : { ok: false, pixels: 0, verdict: 'UNCERTAIN', dE76: null, reason: frame.reason };
        rows.push({ id: shot.id, mat: shot.mat, ...scored, gpuErr: frame.gpuErr || null });
      }
      return rows;
    },
  }));
  const brokenShots = shots.filter((s) => s.id === 'wall').slice(0, 2);
  const broken = summarise(await withChrome({
    debugPort: 9342,
    url,
    fn: async ({ evalJson }) => {
      const rows = [];
      for (const shot of brokenShots) {
        const frame = await evalJson(`window.__glacierGate(${JSON.stringify({
          eye: shot.eye, tgt: shot.tgt, at: shot.at, breakId: MAT.wall + 1, rad: 10,
        })}).then(r => JSON.stringify(r))`);
        const scored = frame.ok ? scoreWindow(frame, shot.mat, shade) : { ok: false, pixels: 0, verdict: 'UNCERTAIN', dE76: null, reason: frame.reason };
        rows.push({ id: shot.id, ...scored });
      }
      return rows;
    },
  }));
  const wall = broken.find((r) => r.id === 'wall');
  const report = { clean, negativeControl: wall, threshold: DE76_MAX, includesLightness: true, blocking: true };
  const outDir = path.join(here, 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'render-colour.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  for (const row of clean) {
    if (row.verdict !== 'PASS' || !(row.dE76 <= DE76_MAX) || row.patches < 1) {
      console.error('FAIL render gate', row.id, row);
      fail++;
    }
  }
  if (!only && (!wall || wall.verdict !== 'BLOCK' || !(wall.dE76 > DE76_MAX))) {
    console.error('FAIL negative control did not block', wall);
    fail++;
  }
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS render-colour');
