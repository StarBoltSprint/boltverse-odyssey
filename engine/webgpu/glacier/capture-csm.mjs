// Capture the CSM trial. Before stills are the PR 239 head (run 32 after).
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE, LIGHT } from './biome.js';
import { buildCascades, lightAxes } from './shadows.js';
import { FOV_Y } from '../engine/bricks/follow-cam.js';
import { srgbToLab, dE76 } from '../biome-factory/cie76.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const root = path.join(here, 'artifacts/run33-csm');
const times = [
  ['51', 5.10],
  ['5567', 5.567],
  ['79', 7.9],
  ['117', 11.70],
  ['24', 24],
  ['30', 30],
];

function loadRaw(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = probe.stdout.trim().split(',').map(Number);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 }).stdout;
  return { raw, w, h };
}

async function page(port, debugPort, query, fn) {
  const server = await serve(webgpu, port);
  try {
    await withChrome({
      debugPort,
      tries: 200,
      url: `http://127.0.0.1:${port}/glacier/glacier.html?candidate=${CANDIDATE}&${query}`,
      fn,
    });
  } finally {
    server.close();
  }
}

fs.mkdirSync(path.join(root, 'after'), { recursive: true });
fs.mkdirSync(path.join(root, 'mask'), { recursive: true });
fs.mkdirSync(path.join(root, 'csmoff'), { recursive: true });
fs.mkdirSync(path.join(root, 'before'), { recursive: true });
const srcBefore = path.join(here, 'artifacts/run32-hdr/after');
for (const name of fs.readdirSync(srcBefore)) {
  if (/^t[\d.]+\.(jpg|png)$/.test(name) || name.endsWith('-mat.png')) {
    fs.copyFileSync(path.join(srcBefore, name), path.join(root, 'before', name));
  }
}

const t0 = Date.now();
const log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', m);

await page(8811, 9411, 'cap=1&w=720&h=1280', async ({ evalJson }) => {
  for (const [tag, t] of times) {
    for (const mode of ['beauty', 'mat', 'shadow']) {
      const payload = await evalJson(`window.__glacierStill(${t}, ${JSON.stringify(mode)}).then(r => JSON.stringify(r))`);
      if (payload.info.gpuErr) throw new Error(tag + ' ' + mode + ' ' + payload.info.gpuErr);
      const buf = Buffer.from(payload.png, 'base64');
      if (mode === 'beauty') {
        fs.writeFileSync(path.join(root, 'after', `t${tag}.png`), buf);
        spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(root, 'after', `t${tag}.png`), '-q:v', '2', path.join(root, 'after', `t${tag}.jpg`)]);
        fs.writeFileSync(path.join(root, 'after', `t${tag}.json`), JSON.stringify(payload.info, null, 2));
      } else if (mode === 'mat') {
        fs.writeFileSync(path.join(root, 'after', `t${tag}-mat.png`), buf);
      } else {
        fs.writeFileSync(path.join(root, 'mask', `t${tag}.png`), buf);
      }
    }
    log('still ' + tag);
  }
  const info = JSON.parse(fs.readFileSync(path.join(root, 'after/t51.json'), 'utf8'));
  const sun = LIGHT.sun.direction;
  const aspect = 720 / 1280;
  const base = buildCascades({ eye: info.eye, tgt: info.tgt, fovY: FOV_Y, aspect, sun, tier: 'phone' });
  const { s } = lightAxes(sun);
  let eyeB = null;
  let tgtB = null;
  for (let k = 1; k <= 8 && !eyeB; k++) {
    const d = 0.004 * k;
    const eye = info.eye.map((v, i) => v + s[i] * d);
    const tgt = info.tgt.map((v, i) => v + s[i] * d);
    const next = buildCascades({ eye, tgt, fovY: FOV_Y, aspect, sun, tier: 'phone' });
    const same = base.centers[0].every((v, i) => Math.abs(v - next.centers[0][i]) < 1e-3);
    if (same) { eyeB = eye; tgtB = tgt; }
  }
  if (!eyeB) throw new Error('no stable camera pair for shimmer');
  const a = await evalJson(`window.__glacierPose(${JSON.stringify(info.eye)}, ${JSON.stringify(info.tgt)}, "shadow").then(r => JSON.stringify(r))`);
  const b = await evalJson(`window.__glacierPose(${JSON.stringify(eyeB)}, ${JSON.stringify(tgtB)}, "shadow").then(r => JSON.stringify(r))`);
  fs.writeFileSync(path.join(root, 'shimmer-a.png'), Buffer.from(a.png, 'base64'));
  fs.writeFileSync(path.join(root, 'shimmer-b.png'), Buffer.from(b.png, 'base64'));
  const A = loadRaw(path.join(root, 'shimmer-a.png'));
  const B = loadRaw(path.join(root, 'shimmer-b.png'));
  let edge = 0;
  let changed = 0;
  for (let i = 0; i < A.w * A.h; i += 4) {
    const sa = A.raw[i * 3] / 255;
    const sb = B.raw[i * 3] / 255;
    if (sa > 0.05 && sa < 0.95 || sb > 0.05 && sb < 0.95) {
      edge++;
      if (Math.abs(sa - sb) > 0.1) changed++;
    }
  }
  const shimmer = {
    fraction: edge ? changed / edge : 0, edge, changed,
    eyeA: info.eye, tgtA: info.tgt, eyeB, tgtB,
  };
  fs.writeFileSync(path.join(root, 'shimmer.json'), JSON.stringify(shimmer, null, 2));
  log('shimmer ' + shimmer.fraction.toFixed(4));

  const at = [info.eye[0] * 0.3 + info.tgt[0] * 0.7, 1.2, info.eye[2] * 0.3 + info.tgt[2] * 0.7];
  const eye2 = [info.eye[0] + 3.2, info.eye[1] + 0.6, info.eye[2] + 1.4];
  const c1 = await evalJson(`window.__glacierPose(${JSON.stringify(info.eye)}, ${JSON.stringify(at)}, "beauty").then(r => JSON.stringify(r))`);
  const c2 = await evalJson(`window.__glacierPose(${JSON.stringify(eye2)}, ${JSON.stringify(at)}, "beauty").then(r => JSON.stringify(r))`);
  fs.writeFileSync(path.join(root, 'cross-a.png'), Buffer.from(c1.png, 'base64'));
  fs.writeFileSync(path.join(root, 'cross-b.png'), Buffer.from(c2.png, 'base64'));
  const patch = (png, eye) => {
    const im = loadRaw(png);
    const cols = [];
    const cx = im.w * 0.5;
    const cy = im.h * 0.62;
    for (let y = cy - 10; y <= cy + 10; y += 2) {
      for (let x = cx - 10; x <= cx + 10; x += 2) {
        const o = ((y | 0) * im.w + (x | 0)) * 3;
        cols.push([im.raw[o], im.raw[o + 1], im.raw[o + 2]]);
      }
    }
    const labs = cols.map(srgbToLab);
    const mid = (k) => labs.map((v) => v[k]).sort((p, q) => p - q)[labs.length >> 1];
    return [mid(0), mid(1), mid(2)];
  };
  const de76 = dE76(patch(path.join(root, 'cross-a.png')), patch(path.join(root, 'cross-b.png')));
  fs.writeFileSync(path.join(root, 'cross.json'), JSON.stringify({ de76, at, eye2 }, null, 2));
  log('cross ' + de76.toFixed(2));
});

await page(8812, 9412, 'cap=1&w=720&h=1280&csmoff=1', async ({ evalJson }) => {
  for (const [tag, t] of times) {
    const payload = await evalJson(`window.__glacierStill(${t}, "beauty").then(r => JSON.stringify(r))`);
    if (payload.info.gpuErr) throw new Error('csmoff ' + payload.info.gpuErr);
    const png = path.join(root, 'csmoff', `t${tag}.png`);
    fs.writeFileSync(png, Buffer.from(payload.png, 'base64'));
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '2', path.join(root, 'csmoff', `t${tag}.jpg`)]);
    log('csmoff ' + tag);
  }
});

const frames = path.join(root, 'chase-frames');
fs.mkdirSync(frames, { recursive: true });
await page(8813, 9413, 'cap=1&w=720&h=1280', async ({ evalJson }) => {
  const fps = 30;
  const n = 60;
  for (let i = 0; i < n; i++) {
    const t = 5 + i / fps;
    const payload = await evalJson(`window.__glacierStill(${t}, "beauty").then(r => JSON.stringify(r))`);
    if (payload.info.gpuErr) throw new Error('chase ' + payload.info.gpuErr);
    const png = path.join(frames, `f_${String(i).padStart(4, '0')}.png`);
    fs.writeFileSync(png, Buffer.from(payload.png, 'base64'));
    if (i % 4 === 0) log('chase ' + i);
  }
});
const enc = spawnSync('ffmpeg', [
  '-y', '-framerate', '30', '-i', path.join(frames, 'f_%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
  path.join(root, 'chase.mp4'),
], { encoding: 'utf8' });
if (enc.status !== 0) throw new Error(enc.stderr.slice(-400));
log('chase encoded');

await page(8814, 9414, 'cap=1&w=540&h=960', async ({ evalJson }) => {
  const perf = await evalJson('window.__glacierPerf(4).then(r => JSON.stringify(r))');
  fs.writeFileSync(path.join(root, 'perf.json'), JSON.stringify(perf, null, 2));
  log('perf ' + JSON.stringify(perf));
});

fs.writeFileSync(path.join(root, 'tags.json'), JSON.stringify(times.map((t) => t[0])));
log('capture done');
