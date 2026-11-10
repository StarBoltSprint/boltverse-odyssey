// Night defect gates. Day blue/black ratios stay advisory in test-frames.mjs.
// Same 0.0003 limit for pure-black tears. A grid is an FFT peak, a hole is
// far-plane depth inside a wall's screen hull. Each has a negative control.
import { spawnSync } from 'child_process';
import { lookAt, persp, mul } from '../engine/bricks/follow-cam.js';
import { buildWorld, pathX, pathPsi, terrH } from './world.js';

const BLACK_LIMIT = 0.0003;
const GRID_PEAK = 1.8;
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

function load(file) {
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 }).stdout;
  return { raw, w: 720, h: 1280 };
}

function pureBlack(im) {
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let black = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < im.w; x++) {
      if (x > im.w * 0.34 && x < im.w * 0.66) continue;
      const i = (y * im.w + x) * 3;
      n++;
      if (im.raw[i] === 0 && im.raw[i + 1] === 0 && im.raw[i + 2] === 0) black++;
    }
  }
  return black / n;
}

function rowSignal(im) {
  const w = im.w;
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  const sig = new Float64Array(w);
  let rows = 0;
  for (let y = y0; y < y1; y += 2) {
    rows++;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      sig[x] += im.raw[i] * 0.3 + im.raw[i + 1] * 0.59 + im.raw[i + 2] * 0.11;
    }
  }
  for (let x = 0; x < w; x++) sig[x] /= rows || 1;
  return sig;
}

function gridPeak(im) {
  const sig = rowSignal(im);
  const n = sig.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sig[i];
  mean /= n;
  const hp = new Float64Array(n);
  for (let i = 0; i < n; i++) hp[i] = sig[i] - sig[Math.max(0, i - 24)];
  let meanH = 0;
  for (let i = 0; i < n; i++) meanH += hp[i];
  meanH /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (hp[i] - meanH) ** 2;
  v /= n;
  if (v < 1e-6) return 0;
  const ac = (lag) => {
    let c = 0;
    const m = n - lag;
    for (let i = 0; i < m; i++) c += (hp[i] - meanH) * (hp[i + lag] - meanH);
    return c / (m * v);
  };
  const peak = Math.max(ac(8), ac(16), ac(24));
  const beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4;
  return peak / (Math.abs(beside) + 0.08);
}

function paintGrid(im) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  for (let y = 0; y < copy.h; y++) {
    for (let x = 0; x < copy.w; x++) {
      const v = Math.round((Math.sin((x / 16) * Math.PI * 2) * 0.5 + 0.5) * 70 + 10);
      const i = (y * copy.w + x) * 3;
      copy.raw[i] = v; copy.raw[i + 1] = v; copy.raw[i + 2] = v + 15;
    }
  }
  return copy;
}

function paintTear(im) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  for (let y = 800; y < 860; y++) {
    for (let x = 40; x < 120; x++) {
      const i = (y * copy.w + x) * 3;
      copy.raw[i] = copy.raw[i + 1] = copy.raw[i + 2] = 0;
    }
  }
  return copy;
}

function project(vp, p, W, H) {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const z = vp[2] * p[0] + vp[6] * p[1] + vp[10] * p[2] + vp[14];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  if (!(w > 0.05)) return null;
  return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, z / w];
}

function countHoles(depth, W, H) {
  let holes = 0;
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const id = y * W + x;
      if (depth[id] < 0.9995) continue;
      let around = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (depth[(y + dy) * W + (x + dx)] < 0.9995) around++;
      }
      if (around === 4) holes++;
    }
  }
  return holes;
}

function rasterHoles(world, eye, tgt, punch) {
  const W = 160, H = 280;
  const view = lookAt(eye, tgt, [0, 1, 0]);
  const proj = persp(62 * Math.PI / 180, W / H, 0.08, 5200);
  const vp = mul(proj, view);
  const depth = new Float32Array(W * H).fill(1);
  let written = 0;
  let seen = 0;
  const tri = (ax, ay, bx, by, cx, cy, za, zb, zc) => {
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const maxx = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const maxy = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-4) return;
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
        const w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * za + w1 * zb + w2 * zc;
        const id = y * W + x;
        if (z < depth[id]) { depth[id] = z; written++; }
        seen++;
      }
    }
  };
  const verts = world.verts;
  for (let v = 0; v < verts.length; v += 24) {
    if (Math.abs(verts[v + 3] - 6) > 0.2) continue;
    const P = [];
    let ok = true;
    for (let k = 0; k < 3; k++) {
      const o = v + k * 8;
      const pr = project(vp, [verts[o], verts[o + 1], verts[o + 2]], W, H);
      if (!pr) ok = false;
      P.push(pr);
    }
    if (!ok) continue;
    tri(P[0][0], P[0][1], P[1][0], P[1][1], P[2][0], P[2][1], P[0][2], P[1][2], P[2][2]);
  }
  if (punch) {
    for (let y = 8; y < H - 8; y++) {
      for (let x = 8; x < W - 8; x++) {
        const id = y * W + x;
        if (depth[id] < 0.9995 && depth[id - 1] < 0.9995 && depth[id + 1] < 0.9995 && depth[id - W] < 0.9995 && depth[id + W] < 0.9995) {
          depth[id] = 1;
          return countHoles(depth, W, H);
        }
      }
    }
  }
  return countHoles(depth, W, H);
}

function filledCount(world, eye, tgt) {
  // reuse raster by punching nowhere; count covered via a second pass is inside holes
  return rasterHoles(world, eye, tgt, false);
}

const frameFile = process.argv[2] || '/tmp/crystal-chase19/f_0180.jpg';
const im = load(frameFile);
if (!im.raw || im.raw.length < 1000) bad('no frame ' + frameFile);
const black = pureBlack(im);
const grid = gridPeak(im);
const torn = pureBlack(paintTear(im));
const gridded = gridPeak(paintGrid(im));
if (black > BLACK_LIMIT) bad('pure black tears ' + black.toFixed(5));
if (!(torn > BLACK_LIMIT)) bad('tear injection did not fail ' + torn.toFixed(5));
if (grid > GRID_PEAK) bad('periodic grid ' + grid.toFixed(2));
if (!(gridded > GRID_PEAK)) bad('grid injection did not fail ' + gridded.toFixed(2));

const world = buildWorld();
const wx = pathX(-40) - 9;
const eye = [pathX(-24), 6, -24];
const tgt = [wx, 12, -40];
function cropOf(im, x0, y0, w, h) {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) im.raw.copy(raw, y * w * 3, ((y0 + y) * im.w + x0) * 3, ((y0 + y) * im.w + x0 + w) * 3);
  return { raw, w, h };
}
function gridOn(im) {
  const boxed = { raw: im.raw, w: im.w, h: Math.max(im.h, 4) };
  const y0 = 0;
  const y1 = im.h;
  const sig = new Float64Array(im.w);
  let rows = 0;
  for (let y = y0; y < y1; y += 2) {
    rows++;
    for (let x = 0; x < im.w; x++) {
      const i = (y * im.w + x) * 3;
      sig[x] += im.raw[i] * 0.3 + im.raw[i + 1] * 0.59 + im.raw[i + 2] * 0.11;
    }
  }
  for (let x = 0; x < im.w; x++) sig[x] /= rows || 1;
  const fake = { raw: Buffer.alloc(im.w * 8 * 3), w: im.w, h: 8 };
  for (let y = 0; y < 8; y++) sig.forEach((v, x) => {
    const i = (y * im.w + x) * 3;
    const g = Math.max(0, Math.min(255, v));
    fake.raw[i] = fake.raw[i + 1] = fake.raw[i + 2] = g;
  });
  return gridPeak(fake);
}
const crystalBox = cropOf(im, 400, 300, 280, 480);
const crystalGrid = gridOn(crystalBox);
const crystalStripes = gridOn(paintGrid(crystalBox));
if (crystalGrid > GRID_PEAK) bad('crystal crop periodic ' + crystalGrid.toFixed(2));
if (!(crystalStripes > GRID_PEAK)) bad('crystal stripe injection did not fail ' + crystalStripes.toFixed(2));

const cleanHoles = rasterHoles(world, eye, tgt, false);
const injected = rasterHoles(world, eye, tgt, true);
if (cleanHoles > 0) bad('far depth inside a wall hull ' + cleanHoles);
if (!(injected > cleanHoles)) bad('hole injection did not fail ' + injected);

if (fail) process.exit(1);
console.log('PASS night-defects', JSON.stringify({
  pureBlack: +black.toFixed(5),
  tearControl: +torn.toFixed(5),
  gridPeak: +grid.toFixed(2),
  gridControl: +gridded.toFixed(2),
  wallHoles: cleanHoles,
  crystalGrid: +crystalGrid.toFixed(2),
  crystalStripe: +crystalStripes.toFixed(2),
  holeControl: injected,
  blackLimit: BLACK_LIMIT,
  gridLimit: GRID_PEAK,
}));
