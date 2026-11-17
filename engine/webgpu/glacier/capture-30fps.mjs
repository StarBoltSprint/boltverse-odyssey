// 2.0 s at true 30 fps from t=24. 720×1280 follow camera. 4× samples, same as the stills.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const out = process.env.GLACIER_OUT || '/opt/cursor/artifacts/run33';
const dir = '/tmp/glacier-ao-30fps';
const fps = 30;
const frames = 60;
const t0s = Number(process.env.GLACIER_T0 || 24);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync(out, { recursive: true });
const port = 8795;
const server = await serve(webgpu, port);
const wall = Date.now();
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&jpg=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9455,
    url,
    tries: 900,
    fn: async ({ evalJson }) => {
      for (let i = 0; i < frames; i++) {
        const t = t0s + i / fps;
        const payload = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        fs.writeFileSync(path.join(dir, `f_${String(i).padStart(4, '0')}.jpg`), Buffer.from(payload.jpg, 'base64'));
        if (i % 10 === 0) console.log(`frame ${i} t=${t.toFixed(2)} z=${payload.info.z.toFixed(1)} ${((Date.now() - wall) / 1000).toFixed(0)}s`);
      }
    },
  });
  const enc = spawnSync('ffmpeg', [
    '-y', '-framerate', String(fps), '-i', path.join(dir, 'f_%04d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-movflags', '+faststart',
    path.join(out, `glacier-t${String(t0s).replace('.', 'p')}-2s-30fps.mp4`),
  ], { encoding: 'utf8' });
  if (enc.status !== 0) throw new Error(String(enc.stderr).slice(-400));
  console.log('CLIP', path.join(out, `glacier-t${String(t0s).replace('.', 'p')}-2s-30fps.mp4`));
} finally {
  server.close();
}
