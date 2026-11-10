// 10 s third-person chase, 720×1280, 30 fps, plus four stills and one wide plate.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.env.GLACIER_OUT || '/opt/cursor/artifacts';
const frames = 300;
const fps = 30;
const dir = '/tmp/glacier-frames';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const port = 8765;
const server = await serve(webgpu, port);
const t0 = Date.now();
let fail = 0;
try {
  const chaseUrl = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&jpg=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9371,
    url: chaseUrl,
    tries: 100,
    fn: async ({ evalJson }) => {
      const centers = [];
      for (let i = 0; i < frames; i++) {
        const t = 1 + i / fps;
        const payload = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        const name = path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`);
        fs.writeFileSync(name, Buffer.from(payload.jpg, 'base64'));
        if (payload.info.boltPx) centers.push(payload.info.boltPx[0]);
        if (i % 30 === 0) {
          const px = payload.info.boltPx ? payload.info.boltPx.map((n) => Math.round(n)).join(',') : 'off';
          console.log(`frame ${i} z=${payload.info.z.toFixed(1)} v=${payload.info.v.toFixed(2)} bolt=${px} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
        }
      }
      const mid = centers.slice(30);
      const mean = mid.reduce((s, v) => s + v, 0) / mid.length;
      fs.writeFileSync(path.join(outDir, 'glacier-chase-camera.json'), JSON.stringify({
        frames, fps, seconds: frames / fps, width: 720, height: 1280,
        boltCenterX: +mean.toFixed(2), frameCenterX: 360, samples: mid.length,
      }, null, 2));
      if (Math.abs(mean - 360) > 28) throw new Error('Bolt not centred ' + mean.toFixed(1));
    },
  });
  const stills = [40, 135, 195, 258];
  stills.forEach((i, n) => {
    fs.copyFileSync(path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`), path.join(outDir, `glacier-still-${n + 1}.jpg`));
  });
  const enc = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    path.join(outDir, 'glacier-chase.mp4'),
  ], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error(enc.stderr.slice(-500));
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', path.join(outDir, 'glacier-chase.mp4')], { encoding: 'utf8' });
  console.log(probe.stdout);

  const wideUrl = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=1280&h=720&shot=establish&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9372,
    url: wideUrl,
    fn: async ({ evalJson }) => {
      const payload = await evalJson('window.__glacierFrame(1.2).then(r => JSON.stringify(r))');
      if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
      fs.writeFileSync(path.join(outDir, 'glacier-still-establish.jpg'), Buffer.from(payload.jpg, 'base64'));
    },
  });
  console.log('CAPTURE_DONE', outDir, ((Date.now() - t0) / 1000).toFixed(1) + 's');
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
