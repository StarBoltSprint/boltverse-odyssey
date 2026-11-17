// 30 s chase, 720×1280, 30 fps. Same route as the stills.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const out = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32';
// SwiftShader renders this mesh at about ten seconds a frame. A 900-frame
// 30 fps chase does not finish here. This file is 5 fps over the same 30 s,
// same route, same 720×1280 follow camera. It is not a 30 fps master.
const frames = 5 * 30;
const fps = 5;
const dir = '/tmp/glacier-ao-film';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(out, { recursive: true });
const port = 8788;
const server = await serve(webgpu, port);
const t0 = Date.now();
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&jpg=1&w=720&h=1280&msaa=1&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9441,
    url,
      tries: 900,
    fn: async ({ evalJson }) => {
      for (let i = 0; i < frames; i++) {
        const t = i / fps;
        const payload = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        fs.writeFileSync(path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`), Buffer.from(payload.jpg, 'base64'));
        if (i % 60 === 0) console.log(`frame ${i} z=${payload.info.z.toFixed(1)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    },
  });
  const enc = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
    path.join(out, 'glacier-chase-30s.mp4'),
  ], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error(enc.stderr.slice(-400));
  console.log('FILM', path.join(out, 'glacier-chase-30s.mp4'), ((Date.now() - t0) / 1000).toFixed(0) + 's');
} finally {
  server.close();
}
