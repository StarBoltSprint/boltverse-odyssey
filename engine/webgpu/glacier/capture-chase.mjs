// 9:16 chase. Same seed and route as the stills. 30 s at 10 fps.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const out = process.argv[2] || '/opt/cursor/artifacts/glacier-d8-chase.mp4';
const port = Number(process.argv[3] || 8784);
const debugPort = Number(process.argv[4] || 9404);
const fps = Number(process.argv[5] || 4);
const seconds = Number(process.argv[6] || 12);
const frames = fps * seconds;
const dir = '/tmp/glacier-d8-chase';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const server = await serve(webgpu, port);
const t0 = Date.now();
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort,
    url,
    tries: 100,
    fn: async ({ evalJson }) => {
      for (let i = 0; i < frames; i++) {
        const t = i / fps;
        const payload = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify(r))`);
        if (payload.info && payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        fs.writeFileSync(path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`), Buffer.from(payload.jpg, 'base64'));
        if (i % fps === 0) console.log('chase', t.toFixed(1), ((Date.now() - t0) / 1000).toFixed(1) + 's');
      }
    },
  });
  const enc = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    out,
  ], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error((enc.stderr || '').slice(-400));
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,nb_frames,duration', '-of', 'json', out,
  ], { encoding: 'utf8' });
  console.log(probe.stdout);
  console.log('CHASE_DONE', out);
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
