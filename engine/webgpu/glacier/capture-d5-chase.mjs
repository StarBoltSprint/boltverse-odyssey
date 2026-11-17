// 9:16 chase, 8 seconds at 10 fps. Same seed as the stills.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outDir = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32';
const fps = Number(process.env.GLACIER_FPS || 10);
const frames = Number(process.env.GLACIER_FRAMES || Math.round(8 * fps));
const dir = '/tmp/glacier-d5-chase';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const port = 8779;
const server = await serve(webgpu, port);
const t0 = Date.now();
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&jpg=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9398,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const centers = [];
      for (let i = 0; i < frames; i++) {
        const t = 1 + i / fps;
        const payload = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        const id = String(i).padStart(4, '0');
        fs.writeFileSync(path.join(dir, `f_${id}.jpg`), Buffer.from(payload.jpg, 'base64'));
        if (payload.info.boltPx) centers.push(payload.info.boltPx[0]);
        if (i % 10 === 0) console.log('frame', i, 'z', payload.info.z.toFixed(1), ((Date.now() - t0) / 1000).toFixed(1) + 's');
      }
      const mid = centers.slice(8);
      const mean = mid.reduce((s, v) => s + v, 0) / mid.length;
      fs.writeFileSync(path.join(outDir, 'chase-camera.json'), JSON.stringify({
        frames, fps, seconds: frames / fps, width: 720, height: 1280,
        boltCenterX: +mean.toFixed(2), frameCenterX: 360,
      }, null, 2));
      if (Math.abs(mean - 360) > 28) throw new Error('Bolt not centred ' + mean.toFixed(1));
    },
  });
  const enc = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    path.join(outDir, 'chase.mp4'),
  ], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error(enc.stderr.slice(-400));
  console.log('CHASE_DONE', path.join(outDir, 'chase.mp4'), ((Date.now() - t0) / 1000).toFixed(1) + 's');
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
