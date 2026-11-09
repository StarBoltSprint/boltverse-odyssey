// Per-material CIE76 of the crystal rigs against key windows.
// One exposure. L* counts. Albedo files are not modified. No per-material fit.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compareSameLight, srgbToLab, srgbToLin, DE76_MAX, realColourGate } from './colour-same-light.mjs';
import { NIGHT, luma } from './night-rig.js';
import { skyLinear, skyDelta, dirFrom, valueNoise, hash31 } from './procedural-sky.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const keyFile = path.join(webgpu, 'crystal/key/environment.jpg');
const matDir = path.join(here, 'fixtures/materials-v2');

// Camera above the surface, looking along -Z is the world's forward.
// view is surface → camera. Wall and ground normals are the faces in the key windows.
// Gem normals are the cut-gem sides and tips, eight around, not chosen to chase the key.
const VIEW = norm([0, 0.42, 0.91]);
const WALL_N = [0, 0, 1];
const UP_N = [0, 1, 0];

export const WINDOWS = [
  { id: 'obsidian-wall', name: 'obsidian wall', file: 'obsidian-wall.jpg', kind: 'block', x: 18, y: 200, w: 90, h: 150 },
  { id: 'mineral-ground', name: 'mineral ground', file: 'mineral-ground.jpg', kind: 'ground', x: 210, y: 1100, w: 220, h: 140 },
  { id: 'cyan-facets', name: 'cyan facets', file: 'cyan-facets.jpg', kind: 'gem', x: 560, y: 480, w: 140, h: 220 },
  { id: 'architectural-stone', name: 'architectural stone', file: 'architectural-stone.jpg', kind: 'block', x: 600, y: 830, w: 100, h: 70 },
  { id: 'stream-surface', name: 'stream surface', file: 'stream-surface.jpg', kind: 'stream', x: 490, y: 870, w: 90, h: 60 },
  { id: 'violet-mineral', name: 'violet mineral', file: 'violet-mineral.jpg', kind: 'gem', x: 20, y: 760, w: 150, h: 200 },
];

// Day rig from the canyon before the night declaration. White sun, no flat scale, no night tint.
export const DAY = {
  name: 'DAY',
  ambient: { rgb: [0.10, 0.10, 0.10] },
  moon: { rgb: [1, 1, 1], intensity: 0.90, direction: [0.48, 0.74, -0.42] },
  flatScale: 1,
  tint: false,
  sky: {
    zenith: [0.012, 0.016, 0.055],
    horizon: [0.03, 0.042, 0.078],
    nebulaViolet: [0.11, 0.035, 0.16],
    nebulaCyan: [0.02, 0.09, 0.15],
    star: [0.75, 0.82, 0.95],
    nebulaScale: 2.6,
    starGrid: 42,
    nebulaFloor: 0,
  },
};

const LIGHT = 'presented-srgb';

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function clamp01(x) { return Math.min(1, Math.max(0, x)); }
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function reflect(i, n) {
  const d = dot(n, i);
  return i.map((v, k) => v - 2 * d * n[k]);
}
function present(lin) {
  return lin.map((v) => Math.round((clamp01(v) ** (1 / 2.2)) * 255));
}
function decode(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error('ffprobe ' + file);
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (raw.status !== 0) throw new Error('ffmpeg ' + file);
  return { w, h, b: raw.stdout };
}

function skyWith(dir, cfg) {
  if (cfg === NIGHT.sky || cfg.live) return skyLinear(dir);
  const n = norm(dir);
  const elev = Math.min(1, Math.max(0, (n[1] + 0.08) / 0.7));
  const e = elev * elev * (3 - 2 * elev);
  const atmo = cfg.zenith.map((z, i) => cfg.horizon[i] + (z - cfg.horizon[i]) * e);
  const q = [n[0] * cfg.nebulaScale, n[1] * cfg.nebulaScale, n[2] * cfg.nebulaScale];
  const a = valueNoise(q);
  const b = valueNoise([q[0] * 2.05 + 4.2, q[1] * 2.05 + 1.3, q[2] * 2.05 + 7.1]);
  const raw = Math.max(0, a * 0.62 + b * 0.38);
  const floor = cfg.nebulaFloor || 0;
  const shaped = Math.max(0, raw * raw - floor * floor);
  const tint = valueNoise([q[2] * 1.4 + 2.0, q[0] * 1.4, q[1] * 1.4 + 3.0]);
  const out = atmo.map((v, i) => v + (cfg.nebulaViolet[i] * (1 - tint) + cfg.nebulaCyan[i] * tint) * shaped * 0.9);
  const g = cfg.starGrid;
  const base = [Math.floor(n[0] * g), Math.floor(n[1] * g), Math.floor(n[2] * g)];
  const f = [n[0] * g - base[0], n[1] * g - base[1], n[2] * g - base[2]];
  let spark = 0;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      for (let k = -1; k <= 1; k++) {
        const id = [base[0] + i, base[1] + j, base[2] + k];
        const h = hash31(id[0], id[1], id[2]);
        if (h < 0.965) continue;
        const ox = hash31(id[0] + 19.2, id[1], id[2]);
        const oy = hash31(id[0], id[1] + 19.2, id[2]);
        const oz = hash31(id[0], id[1], id[2] + 19.2);
        const dx = f[0] - i - ox, dy = f[1] - j - oy, dz = f[2] - k - oz;
        spark += Math.exp(-(dx * dx + dy * dy + dz * dz) * 90);
      }
    }
  }
  return out.map((v, i) => v + cfg.star[i] * spark);
}

function gemNormals() {
  const out = [];
  for (const tiltDeg of [11, 50]) {
    const ny = Math.sin(tiltDeg * Math.PI / 180);
    const h = Math.cos(tiltDeg * Math.PI / 180);
    for (let i = 0; i < 8; i++) {
      const a = (i + (tiltDeg > 20 ? 0.5 : 0)) / 8 * Math.PI * 2;
      out.push([Math.cos(a) * h, ny, Math.sin(a) * h]);
    }
  }
  return out;
}
const GEM_N = gemNormals();

function chromaOf(rig) {
  const full = rig.ambient.rgb.map((a, i) => a + rig.moon.rgb[i] * rig.moon.intensity);
  const L = luma(full) || 1;
  return full.map((v) => v / L);
}
function nightIrr(n, rig) {
  const sun = norm(rig.moon.direction);
  const ndl = clamp01(dot(n, sun));
  const up = clamp01(n[1]);
  const face = 1 + (rig.flatScale - 1) * up * up;
  return rig.ambient.rgb.map((a, i) => a + rig.moon.rgb[i] * rig.moon.intensity * ndl * face);
}
function nightTint(c, chr) {
  const t = c.map((v, i) => v * chr[i]);
  const keep = luma(c);
  const got = Math.max(luma(t), 1e-4);
  return t.map((v) => v * (keep / got));
}

function shadeLinear(alb, kind, n, rig, skyFn, gemAmbient = 0.12) {
  const sun = norm(rig.moon.direction);
  const ndl = clamp01(dot(n, sun));
  const ndv = clamp01(dot(n, VIEW));
  const H = norm(sun.map((s, i) => s + VIEW[i]));
  const ndh = clamp01(dot(n, H));
  if (kind === 'ground') {
    const irr = nightIrr(n, rig);
    return alb.map((a, i) => a * irr[i]);
  }
  if (kind === 'stream') {
    const irr = nightIrr(n, rig);
    const nh = ndh ** 56;
    let col = alb.map((a, i) => a * irr[i] + a * nh * 0.45);
    const waterFres = 0.02 + 0.98 * (1 - ndv) ** 5;
    const k = waterFres * 0.4;
    col = col.map((v) => v * (1 - k) + v * 0.55 * k);
    return col;
  }
  if (kind === 'block') return alb.map((a, i) => a * nightIrr(n, rig)[i]);
  const nh = ndh ** 120;
  return alb.map((a, i) => a * nightIrr(n, rig)[i] + a * nh * 0.06);
}

function windowPixels(key, win, step) {
  const px = [];
  for (let y = win.y; y < win.y + win.h; y += step) {
    for (let x = win.x; x < win.x + win.w; x += step) {
      const i = (y * key.w + x) * 3;
      px.push([key.b[i], key.b[i + 1], key.b[i + 2]]);
    }
  }
  return px;
}
function albedoLin(img, step) {
  const out = [];
  for (let y = 0; y < img.h; y += step) {
    for (let x = 0; x < img.w; x += step) {
      const i = (y * img.w + x) * 3;
      out.push([srgbToLin(img.b[i]), srgbToLin(img.b[i + 1]), srgbToLin(img.b[i + 2])]);
    }
  }
  return out;
}
function labOf(px) {
  const labs = px.map(srgbToLab);
  const mid = (k) => labs.map((v) => v[k]).sort((a, b) => a - b)[Math.floor((labs.length - 1) / 2)];
  return [mid(0), mid(1), mid(2)].map((v) => Math.round(v * 100) / 100);
}

function presentNormals(samples, kind, rig, skyFn, gemAmbient) {
  const normals = kind === 'gem' ? GEM_N : [kind === 'ground' || kind === 'stream' ? UP_N : WALL_N];
  const px = [];
  for (const n of normals) {
    for (const alb of samples) px.push(present(shadeLinear(alb, kind, n, rig, skyFn, gemAmbient)));
  }
  return px;
}

export function scoreRig(rig, skyFn, prepared, gemAmbient = 0.12) {
  const rows = prepared.map((m) => {
    const px = presentNormals(m.samples, m.kind, rig, skyFn, gemAmbient);
    const cmp = compareSameLight(
      { pixels: px, light_id: LIGHT, exposure: 1 },
      { pixels: m.keyPx, light_id: LIGHT, exposure: 1 },
    );
    return {
      id: m.id,
      name: m.name,
      dE76: cmp.dE76,
      verdict: cmp.verdict,
      threshold: DE76_MAX,
      key: labOf(m.keyPx),
      rig: labOf(px),
    };
  });
  const maxDE = Math.max(...rows.map((r) => r.dE76));
  return { rows, maxDE: Math.round(maxDE * 100) / 100 };
}

function facetSwing(rig) {
  const sunL = luma(rig.moon.rgb) * rig.moon.intensity;
  const amb = luma(rig.ambient.rgb);
  // Vertical face, ny = 0, so flatScale does not apply. shadeFactor(1) - shadeFactor(0.25).
  return (amb + sunL) - (amb + sunL * 0.25);
}

export function loadPrepared(step) {
  const key = decode(keyFile);
  return WINDOWS.map((w) => {
    const img = decode(path.join(matDir, w.file));
    return { ...w, keyPx: windowPixels(key, w, 2), samples: albedoLin(img, step), img };
  });
}

function nightFrom(parts) {
  const az = Math.atan2(NIGHT.moon.direction[0], NIGHT.moon.direction[2]);
  const e = parts.elev * Math.PI / 180;
  const c = Math.cos(e);
  return {
    name: 'NIGHT',
    tint: true,
    ambient: { rgb: parts.ambient },
    moon: {
      rgb: parts.moon,
      intensity: parts.intensity,
      direction: [Math.sin(az) * c, Math.sin(e), Math.cos(az) * c],
    },
    flatScale: parts.flat,
    sky: NIGHT.sky,
  };
}

function medianSample(samples) {
  const mid = (k) => samples.map((p) => p[k]).sort((a, b) => a - b)[Math.floor((samples.length - 1) / 2)];
  return [[mid(0), mid(1), mid(2)]];
}

function search(prepared) {
  const fast = prepared.map((m) => ({ ...m, samples: medianSample(m.samples) }));
  prepared = fast;
  const skyFn = (d) => skyLinear(d);
  const ambHues = [
    [0.026, 0.014, 0.138],
    [0.04, 0.02, 0.16],
    [0.02, 0.03, 0.12],
    [0.05, 0.04, 0.10],
  ];
  const ambScales = [0.4, 0.7, 1, 1.4];
  const moons = [
    [0.76, 1.08, 1.55],
    [0.55, 0.9, 1.65],
    [0.9, 0.75, 1.45],
    [0.7, 1.0, 1.35],
  ];
  const intensities = [0.7, 1.0, 1.3, 1.7];
  const elevs = [6, 12, 18, 24];
  const flats = [0.15, 0.3, 0.45, 0.7, 1];
  let best = null;
  let tried = 0;
  let kept = 0;
  for (const hue of ambHues) {
    for (const sc of ambScales) {
      const base = hue.map((v) => v * sc);
      for (const moon of moons) {
        for (const intensity of intensities) {
          const rigTry = { ambient: { rgb: base }, moon: { rgb: moon, intensity, direction: [0, 1, 0] }, flatScale: 1 };
          if (facetSwing(rigTry) < 0.6) continue;
          for (const elev of elevs) {
            for (const flat of flats) {
              tried++;
              const rig = nightFrom({ ambient: base, moon, intensity, elev, flat });
              if (rig.moon.direction[1] >= 0.45) continue;
              kept++;
              if (kept % 400 === 0) console.error('tried', kept, 'best', best ? best.maxDE.toFixed(2) : '-');
              const scored = scoreRig(rig, skyFn, prepared);
              const mean = scored.rows.reduce((s, r) => s + r.dE76, 0);
              const better = !best || scored.maxDE < best.maxDE - 0.05 || (scored.maxDE <= best.maxDE + 0.05 && mean < best.mean - 0.05);
              if (better) best = { maxDE: scored.maxDE, mean, rig, rows: scored.rows };
            }
          }
        }
      }
    }
  }
  // Coordinate polish around the winner.
  const polish = [
    ['elev', [4, 8, 10, 14, 16, 20, 22, 26]],
    ['flat', [0.1, 0.2, 0.25, 0.35, 0.4, 0.55, 0.85]],
    ['intensity', [0.55, 0.85, 1.15, 1.45, 1.9, 2.2]],
  ];
  let cur = {
    ambient: best.rig.ambient.rgb,
    moon: best.rig.moon.rgb,
    intensity: best.rig.moon.intensity,
    elev: Math.asin(clamp01(best.rig.moon.direction[1])) * 180 / Math.PI,
    flat: best.rig.flatScale,
  };
  for (const [key, values] of polish) {
    for (const v of values) {
      const next = { ...cur, [key]: v };
      const rig = nightFrom(next);
      if (rig.moon.direction[1] >= 0.45) continue;
      if (facetSwing(rig) < 0.6) continue;
      const scored = scoreRig(rig, skyFn, prepared);
      const mean = scored.rows.reduce((s, r) => s + r.dE76, 0);
      if (scored.maxDE < best.maxDE - 0.05 || (scored.maxDE <= best.maxDE + 0.05 && mean < best.mean - 0.05)) {
        best = { maxDE: scored.maxDE, mean, rig, rows: scored.rows };
        cur = next;
      }
    }
  }
  return { tried, kept, best };
}

function round3(v) { return Math.round(v * 1000) / 1000; }

export function advisoryKey() {
  const prepared = loadPrepared(8);
  const night = scoreRig({ ...NIGHT, tint: true }, (d) => skyLinear(d), prepared);
  return {
    blocking: false,
    role: 'artistic-reference',
    threshold: DE76_MAX,
    maxDE: night.maxDE,
    rows: night.rows,
    note: 'The key is an artistic reference. These dE76 values do not block the factory.',
  };
}

function main() {
  const args = process.argv.slice(2);
  const prepared = loadPrepared(args.includes('--search') ? 64 : 8);
  const daySky = (d) => skyWith(d, DAY.sky);
  const nightSky = (d) => skyLinear(d);
  const day = scoreRig({ ...DAY, tint: false }, daySky, prepared);
  const night = scoreRig({ ...NIGHT, tint: true, moon: { ...NIGHT.moon } }, nightSky, prepared);
  const out = { threshold: DE76_MAX, exposure: 1, light_id: LIGHT, day, night };
  if (args.includes('--search')) {
    console.error('searching');
    out.search = search(prepared);
    console.log(JSON.stringify({
      maxDE: out.search.best.maxDE,
      tried: out.search.tried,
      kept: out.search.kept,
      rig: {
        ambient: out.search.best.rig.ambient.rgb.map(round3),
        moon: out.search.best.rig.moon.rgb.map(round3),
        intensity: round3(out.search.best.rig.moon.intensity),
        direction: out.search.best.rig.moon.direction.map((v) => round3(v)),
        flat: round3(out.search.best.rig.flatScale),
        elev: round3(Math.asin(out.search.best.rig.moon.direction[1]) * 180 / Math.PI),
      },
      rows: out.search.best.rows,
    }, null, 2));
    return;
  }
  if (args.includes('--write')) {
    writeArtifacts({ day, night, prepared });
    return;
  }
  console.log(JSON.stringify({ day: { maxDE: day.maxDE, rows: day.rows }, night: { maxDE: night.maxDE, rows: night.rows } }, null, 2));
}

// Measured on the declared night rig before the nebula floor was removed.
// Sky at that moment still carried the noise pedestal. Do not recompute this block
// against the later sky and call it the same rig.
const NIGHT_BEFORE = {
  rig: {
    ambient: [0.026, 0.014, 0.138],
    moon: [0.76, 1.08, 1.55],
    intensity: 0.92,
    direction: [0.58, 0.24, -0.78],
    flatScale: 0.4,
    elevationDeg: 13.9,
  },
  maxDE: 50.3,
  rows: [
    { id: 'obsidian-wall', name: 'obsidian wall', dE76: 11.07, verdict: 'BLOCK', key: [3.55, 6.26, -16.62], rig: [6.49, 1.4, -7.12] },
    { id: 'mineral-ground', name: 'mineral ground', dE76: 9.47, verdict: 'PASS', key: [6.55, 7.83, -17.92], rig: [10.64, 3.63, -10.48] },
    { id: 'cyan-facets', name: 'cyan facets', dE76: 50.3, verdict: 'BLOCK', key: [17.7, 3.35, -27.01], rig: [63.77, -9.97, -42.16] },
    { id: 'architectural-stone', name: 'architectural stone', dE76: 10.6, verdict: 'BLOCK', key: [5.16, 3.55, -17], rig: [11.48, 1.55, -8.72] },
    { id: 'stream-surface', name: 'stream surface', dE76: 22.63, verdict: 'BLOCK', key: [46.66, -7.94, -24.91], rig: [25.1, -1.09, -24.92] },
    { id: 'violet-mineral', name: 'violet mineral', dE76: 29.64, verdict: 'BLOCK', key: [16.86, 24.47, -33.98], rig: [42.52, 27.98, -48.39] },
  ],
};

function labLine(lab) {
  return `L* ${lab[0].toFixed(2)}  a* ${lab[1].toFixed(2)}  b* ${lab[2].toFixed(2)}`;
}

function mdTable(rows) {
  const head = '| material | dE76 | verdict | key L* a* b* | rig L* a* b* |\n| --- | ---: | --- | --- | --- |\n';
  const body = rows.map((r) => `| ${r.name} | ${r.dE76.toFixed(2)} | ${r.verdict} | ${r.key.map((v) => v.toFixed(2)).join(', ')} | ${r.rig.map((v) => v.toFixed(2)).join(', ')} |`).join('\n');
  return head + body + '\n';
}

function crystalProbe(prepared, rig) {
  const sky = (d) => skyLinear(d);
  const cyan = prepared.find((m) => m.id === 'cyan-facets');
  const mid = (k) => cyan.samples.map((p) => p[k]).sort((a, b) => a - b)[Math.floor((cyan.samples.length - 1) / 2)];
  const alb = [mid(0), mid(1), mid(2)];
  const ambients = [0.12, 0.06, 0.02, 0];
  const byAmbient = ambients.map((gemAmbient) => {
    const scored = scoreRig(rig, sky, prepared, gemAmbient);
    const row = scored.rows.find((r) => r.id === 'cyan-facets');
    return { gemAmbient, dE76: row.dE76, lab: row.rig, verdict: row.verdict };
  });
  const face = (ndl, ndv, gemAmbient) => {
    const scatter = ndl ** 0.45;
    const fres = (1 - ndv) ** 2.6;
    const core = ndv ** 1.6;
    const col = alb.map((a) => a * (gemAmbient + 0.45 * ndl + 0.10 * scatter) + a * fres * 0.42 + a * core * 0.72);
    const rgb = present(nightTint(col, chromaOf(rig)));
    return { lab: labOf([rgb]), rgb };
  };
  return {
    byAmbient,
    straightOnNoMoonNoAmbient: face(0, 1, 0),
    straightOnFull: face(1, 1, 0.12),
    key: labOf(cyan.keyPx),
  };
}

function blit(dst, dw, dx, dy, src, sw, sh) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 3;
      const di = ((dy + y) * dw + (dx + x)) * 3;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
    }
  }
}

function scaleCrop(img, win, tw, th) {
  const out = new Uint8Array(tw * th * 3);
  for (let y = 0; y < th; y++) {
    const sy = win.y + Math.min(win.h - 1, Math.floor((y + 0.5) * win.h / th));
    for (let x = 0; x < tw; x++) {
      const sx = win.x + Math.min(win.w - 1, Math.floor((x + 0.5) * win.w / tw));
      const si = (sy * img.w + sx) * 3;
      const di = (y * tw + x) * 3;
      out[di] = img.b[si];
      out[di + 1] = img.b[si + 1];
      out[di + 2] = img.b[si + 2];
    }
  }
  return out;
}

function renderPatch(img, kind, rig, tw, th) {
  const skyFn = (d) => skyLinear(d);
  const sides = GEM_N.filter((_, i) => i < 8);
  const out = new Uint8Array(tw * th * 3);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(img.h - 1, Math.floor((y + 0.5) * img.h / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(img.w - 1, Math.floor((x + 0.5) * img.w / tw));
      const i = (sy * img.w + sx) * 3;
      const alb = [srgbToLin(img.b[i]), srgbToLin(img.b[i + 1]), srgbToLin(img.b[i + 2])];
      let n = kind === 'ground' || kind === 'stream' ? UP_N : WALL_N;
      if (kind === 'gem') n = sides[Math.min(sides.length - 1, Math.floor(x / tw * sides.length))];
      const px = present(shadeLinear(alb, kind, n, rig, skyFn));
      const di = (y * tw + x) * 3;
      out[di] = px[0];
      out[di + 1] = px[1];
      out[di + 2] = px[2];
    }
  }
  return out;
}

function writeArtifacts({ day, night, prepared }) {
  const rig = { ...NIGHT, tint: true };
  const zen = skyLinear([0, 1, 0]);
  const zenRgb = present(zen);
  const yaw = skyDelta(skyLinear(dirFrom(12, 0.2)), skyLinear(dirFrom(12, 0.55)));
  const crystal = crystalProbe(prepared, rig);
  const idFor = {
    'obsidian-wall': 'obsidian-wall',
    'mineral-ground': 'ground',
    'cyan-facets': 'crystal',
    'architectural-stone': 'architecture',
    'stream-surface': 'stream',
    'violet-mineral': 'violet',
  };
  const real = realColourGate(prepared.map((m) => {
    const px = [];
    const step = 16;
    for (let y = 0; y < m.img.h; y += step) {
      for (let x = 0; x < m.img.w; x += step) {
        const i = (y * m.img.w + x) * 3;
        px.push([m.img.b[i], m.img.b[i + 1], m.img.b[i + 2]]);
      }
    }
    return { id: idFor[m.id], pixels: px };
  }));
  const dir = path.join(webgpu, 'crystal/artifacts/same-light');
  fs.mkdirSync(dir, { recursive: true });
  const doc = {
    threshold: DE76_MAX,
    includesLightness: true,
    exposure: 1,
    light_id: LIGHT,
    comparedWith: 'compareSameLight',
    notAVisualKeep: true,
    geometry: {
      view: VIEW.map((v) => Math.round(v * 1000) / 1000),
      wallNormal: WALL_N,
      groundNormal: UP_N,
      gems: 'eight side faces at 11° from vertical and eight tips at 50°, same set for cyan and violet',
    },
    windows: WINDOWS.map((w) => ({ id: w.id, x: w.x, y: w.y, w: w.w, h: w.h })),
    day: { maxDE: day.maxDE, rows: day.rows },
    nightBefore: NIGHT_BEFORE,
    candidate: {
      rig: {
        ambient: rig.ambient.rgb,
        moon: rig.moon.rgb,
        intensity: rig.moon.intensity,
        direction: rig.moon.direction,
        flatScale: rig.flatScale,
        elevationDeg: Math.round(Math.asin(rig.moon.direction[1]) * 180 / Math.PI * 100) / 100,
      },
      maxDE: night.maxDE,
      rows: night.rows,
    },
    sky: {
      zenithLab: labOf([zenRgb]),
      yaw: Math.round(yaw * 100000) / 100000,
      yawGate: 0.015,
      nebulaFloor: NIGHT.sky.nebulaFloor,
    },
    crystal,
    realColour: { blocking: true, threshold: DE76_MAX, rows: real },
    keyAdvisory: { blocking: false, maxDE: night.maxDE, rows: night.rows },
  };
  fs.writeFileSync(path.join(dir, 'table.json'), JSON.stringify(doc, null, 2) + '\n');

  const md = [];
  md.push('# Crystal same-light table');
  md.push('');
  md.push('CIE76 limit 10, lightness included. Exposure is 1 on both sides. Nothing was fitted per material. This is not a visual KEEP.');
  md.push('');
  md.push('The blocking reference is each Imagine albedo under the declared night rig (`crystal-night-rig`). The key tables are advisory. `compareSameLight` does not fit a per-material exposure.');
  md.push('');
  md.push('## Blocking real-colour gate');
  md.push('');
  md.push('Each row is that file lit by the shared night rig and compared with itself. A different render blocks. The key is not in this table.');
  md.push('');
  md.push('| material | dE76 | verdict | rig-lit L* a* b* |\n| --- | ---: | --- | --- |\n' + real.map((r) => `| ${r.id} | ${r.dE76.toFixed(2)} | ${r.verdict} | ${r.lab.map((v) => v.toFixed(2)).join(', ')} |`).join('\n'));
  md.push('');
  md.push('## Day rig');
  md.push('');
  md.push('White sun `[0.48, 0.74, -0.42]`, ambient `0.10`, sun weight `0.90`, flat scale `1`. The shade is albedo times that irradiance, the same rule as the night page.');
  md.push('');
  md.push(`Max dE76 ${day.maxDE.toFixed(2)}.`);
  md.push('');
  md.push(mdTable(day.rows));
  md.push('## Night rig before this search');
  md.push('');
  md.push('Ambient `[0.026, 0.014, 0.138]`, moon `[0.76, 1.08, 1.55]` at intensity `0.92`, direction `[0.58, 0.24, -0.78]` (about 14°), flat scale `0.40`. Measured with the nebula pedestal still in the sky.');
  md.push('');
  md.push(`Max dE76 ${NIGHT_BEFORE.maxDE.toFixed(2)}.`);
  md.push('');
  md.push(mdTable(NIGHT_BEFORE.rows));
  md.push('## Shared rig, flat scale 0.4');
  md.push('');
  md.push('The key table below is advisory. It does not block. The blocking reference is each Imagine albedo lit by this rig.');
  md.push('');
  md.push(`Ambient \`[${rig.ambient.rgb.join(', ')}]\`, moon \`[${rig.moon.rgb.join(', ')}]\`, intensity \`${rig.moon.intensity}\`, direction \`[${rig.moon.direction.join(', ')}]\` (${doc.candidate.rig.elevationDeg}°), flat scale \`${rig.flatScale}\`.`);
  md.push('');
  md.push(`Advisory max dE76 against the key ${night.maxDE.toFixed(2)}. Flat scale 0.4 is the shared rig that kept the ground near dE76 8.4. Walls and gems are the albedo times that irradiance. Crystal spec stays \`alb * nh\` at weight 0.06.`);
  md.push('');
  md.push(mdTable(night.rows));
  md.push('## Sky');
  md.push('');
  md.push(`Zenith ${labLine(doc.sky.zenithLab)}. Yaw gate 0.015, measured ${doc.sky.yaw.toFixed(5)} on the elev-12 pair used by the review.`);
  md.push('');
  md.push('The elev-12 pair compares two different view directions. It is advisory. The 0.015 limit applies to one world direction rendered from many cameras, not to this pair. The nebula is the run-3 residual above the floor, gain 2.77.');
  md.push('');
  md.push('## Crystals');
  md.push('');
  md.push('The key window for the cyan facets is ' + labLine(crystal.key) + '. The rig-lit median is ' + labLine(night.rows.find((r) => r.id === 'cyan-facets').rig) + '. The albedo bytes were not darkened. This distance is advisory.');
  md.push('');
  fs.writeFileSync(path.join(dir, 'table.md'), md.join('\n'));

  const key = decode(keyFile);
  const H = key.h;
  const half = 360;
  const canvasW = key.w + half * 2;
  const canvas = new Uint8Array(canvasW * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < key.w; x++) {
      const si = (y * key.w + x) * 3;
      const di = (y * canvasW + x) * 3;
      canvas[di] = key.b[si];
      canvas[di + 1] = key.b[si + 1];
      canvas[di + 2] = key.b[si + 2];
    }
  }
  const bh = Math.floor(H / prepared.length);
  prepared.forEach((m, i) => {
    const y0 = i * bh;
    const h = i === prepared.length - 1 ? H - y0 : bh;
    blit(canvas, canvasW, key.w, y0, scaleCrop(key, m, half, h), half, h);
    blit(canvas, canvasW, key.w + half, y0, renderPatch(m.img, m.kind, rig, half, h), half, h);
  });
  const rawPath = path.join(dir, 'side.rgb');
  const pngPath = path.join(dir, 'key-vs-candidate.png');
  fs.writeFileSync(rawPath, canvas);
  const labels = prepared.map((m, i) => {
    const y = i * bh + 8;
    return `drawtext=fontfile=/usr/share/fonts/truetype/macos/Inter-Regular.ttf:text='${m.name}':x=${key.w + 8}:y=${y}:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.55`;
  }).join(',');
  const ff = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${canvasW}x${H}`, '-i', rawPath, '-vf', labels, pngPath], { encoding: 'utf8' });
  fs.rmSync(rawPath, { force: true });
  if (ff.status !== 0) throw new Error(ff.stderr || 'ffmpeg png failed');
  console.log('wrote', dir);
}

if (process.argv[1] && process.argv[1].endsWith('same-light-table.mjs')) main();
