// Gameplay stills at the D5 times. 720×1280. Same seed and chase as capture.mjs.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const webgpu = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tag = process.argv[2] || 'after';
const outDir = process.env.GLACIER_OUT || path.join('/opt/cursor/artifacts/run32', tag);
const times = [5.10, 5.567, 7.9, 11.70, 24, 30];
fs.mkdirSync(outDir, { recursive: true });

const port = 8771;
const server = await serve(webgpu, port);
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort: 9381,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const info = await evalJson('JSON.stringify(window.__glacierInfo)');
      fs.writeFileSync(path.join(outDir, 'info.json'), JSON.stringify(info, null, 2));
      for (const t of times) {
        const payload = await evalJson(`window.__glacierFrame(${t}).then(r => JSON.stringify(r))`);
        if (payload.info.gpuErr) throw new Error(payload.info.gpuErr);
        const name = 't' + String(t).replace('.', '_');
        const png = path.join(outDir, name + '.png');
        fs.writeFileSync(png, Buffer.from(payload.png, 'base64'));
        spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', png, '-q:v', '2', path.join(outDir, name + '.jpg')]);
        const px = payload.info.boltPx ? payload.info.boltPx.map((n) => Math.round(n)).join(',') : 'off';
        console.log(tag, name, 'z', payload.info.z.toFixed(1), 'bolt', px, 'draws', payload.info.draws, 'tris', payload.info.tris);
      }
    },
  });
  console.log('STILLS_DONE', outDir);
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
