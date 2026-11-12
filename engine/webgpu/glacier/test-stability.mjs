// Wall temporal stability and speckle. The camera for the static check does not move.
// Eight chase frames are compared with the same crop on run 11. Speckle is Nyquist
// energy over the mid band. Neither limit is a high-pass score.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const run11 = path.resolve(here, 'artifacts/run11/glacier-chase-45s.mp4');
const CROP = { x: 580, y: 220, w: 130, h: 300 };
const TEMPORAL_MAX = 1.5;
// Speckle is Nyquist energy stronger than the mid band. Run 13's glitter
// crop was about 4. Structured ice stays under 1.
const SPECKLE_MAX = 1;

function load(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }).stdout;
  return { raw, w, h };
}

function luma(raw, w, x, y) {
  const i = (y * w + x) * 3;
  return 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
}

function cropLuma(im) {
  const { x, y, w, h } = CROP;
  const L = new Float64Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) L[yy * w + xx] = luma(im.raw, im.w, x + xx, y + yy);
  }
  return L;
}

function meanStd(frames) {
  const n = frames[0].length;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let s2 = 0;
    for (const f of frames) { s += f[i]; s2 += f[i] * f[i]; }
    const m = s / frames.length;
    acc += Math.sqrt(Math.max(0, s2 / frames.length - m * m));
  }
  return acc / n;
}

function box(L, w, h, r) {
  const out = new Float64Array(L.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += L[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function bands(L, w, h) {
  let ny = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = L[y * w + x];
      ny += Math.abs(c - L[y * w + x + 1]);
      ny += Math.abs(c - L[(y + 1) * w + x]);
      n += 2;
    }
  }
  const midB = box(L, w, h, 3);
  const wide = box(L, w, h, 15);
  let mid = 0;
  let m = 0;
  for (let i = 0; i < L.length; i++) { mid += Math.abs(midB[i] - wide[i]); m++; }
  return { nyquist: ny / n, mid: mid / m, ratio: (ny / n) / Math.max(mid / m, 1e-6) };
}

function extractRun11() {
  const dir = '/tmp/r15-run11';
  fs.mkdirSync(dir, { recursive: true });
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', run11, '-vf', "select='between(n,210,217)'", '-vsync', 'vfr', path.join(dir, 'f%d.png')], { encoding: 'utf8' });
  return fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(dir, f));
}

const server = await serve(path.resolve(here, '..'), 8765);
const dir = '/tmp/r15-stab';
fs.mkdirSync(dir, { recursive: true });
let fail = 0;
try {
  await withChrome({
    debugPort: 9372,
    tries: 90,
    url: `http://127.0.0.1:8765/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`,
    fn: async ({ evalJson }) => {
      const aniso = await evalJson('window.__glacierAniso');
      console.log('anisotropy', aniso, 'device limit may clamp the request of 16');
      for (let i = 0; i < 8; i++) {
        const t = 8 + i / 30;
        const a = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify({png:r.png}))`);
        fs.writeFileSync(path.join(dir, `chase${i}.png`), Buffer.from(a.png, 'base64'));
      }
      for (let i = 0; i < 8; i++) {
        const a = await evalJson('window.__glacierFrame(8).then(r => JSON.stringify({png:r.png}))');
        fs.writeFileSync(path.join(dir, `still${i}.png`), Buffer.from(a.png, 'base64'));
      }
    },
  });
  const chase = [...Array(8)].map((_, i) => cropLuma(load(path.join(dir, `chase${i}.png`))));
  const still = [...Array(8)].map((_, i) => cropLuma(load(path.join(dir, `still${i}.png`))));
  const r11files = extractRun11();
  const r11 = r11files.map((f) => cropLuma(load(f)));
  const stdChase = meanStd(chase);
  const stdStill = meanStd(still);
  const std11 = meanStd(r11);
  const speckle = bands(chase[0], CROP.w, CROP.h);
  const speckle11 = bands(r11[0], CROP.w, CROP.h);
  const report = {
    anisotropyRequested: 16,
    staticLumaStd: +stdStill.toFixed(4),
    chaseLumaStd: +stdChase.toFixed(4),
    run11ChaseLumaStd: +std11.toFixed(4),
    temporalRatio: +(stdChase / Math.max(std11, 1e-6)).toFixed(3),
    temporalLimit: TEMPORAL_MAX,
    nyquist: +speckle.nyquist.toFixed(3),
    mid: +speckle.mid.toFixed(3),
    speckleRatio: +speckle.ratio.toFixed(3),
    run11Nyquist: +speckle11.nyquist.toFixed(3),
    run11Mid: +speckle11.mid.toFixed(3),
    run11SpeckleRatio: +speckle11.ratio.toFixed(3),
    speckleVsRun11: +(speckle.ratio / Math.max(speckle11.ratio, 1e-6)).toFixed(3),
    speckleLimit: SPECKLE_MAX,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!(stdStill < 0.75)) { console.error('FAIL static wall flickers', stdStill); fail++; }
  if (!(stdChase <= std11 * TEMPORAL_MAX)) { console.error('FAIL chase wall less stable than run 11'); fail++; }
  if (!(speckle.ratio < SPECKLE_MAX)) { console.error('FAIL wall speckle, Nyquist dominates the mid band'); fail++; }
} finally {
  server.close();
}
if (fail) process.exit(1);
console.log('PASS stability');
