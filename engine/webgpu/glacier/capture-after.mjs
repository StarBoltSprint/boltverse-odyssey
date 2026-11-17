// Recapture the follow stills with the current bake. The pre-change frames stay.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const dir = path.join(process.env.GLACIER_OUT || '/opt/cursor/artifacts/run32', 'after');
const TIMES = [5.1, 5.567, 7.9, 11.7, 24, 30];
fs.mkdirSync(dir, { recursive: true });
const port = 8781;
const server = await serve(webgpu, port);
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9431,
    url,
    tries: 500,
    fn: async ({ evalJson }) => {
      for (const t of TIMES) {
        const frame = await evalJson(`window.__glacierAoFrame(${t}).then(r => JSON.stringify(r))`);
        if (frame.info.gpuErr) throw new Error(frame.info.gpuErr);
        const tag = String(t).replace('.', 'p');
        for (const key of ['beauty', 'surface', 'bolt', 'shade', 'normal', 'albedo']) {
          fs.writeFileSync(path.join(dir, `t${tag}-${key}.png`), Buffer.from(frame[key], 'base64'));
        }
        spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(dir, `t${tag}-beauty.png`), '-q:v', '2', path.join(dir, `t${tag}.jpg`)]);
        console.log(JSON.stringify({ t, z: +frame.info.z.toFixed(2), boltX: frame.info.boltPx && +frame.info.boltPx[0].toFixed(1), ao: frame.info.ao }));
      }
    },
  });
} finally {
  server.close();
}
