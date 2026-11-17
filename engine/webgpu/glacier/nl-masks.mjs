// Debug N.L masks for the six follow times. Beauty frames stay as they are.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';
import { buildWorld } from './world.js';
import {
  TIMES, loadRgb, chasePoses, measureNlMask, terminatorVisibility,
} from './planet-sky-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const outDir = path.join(here, 'artifacts/d9/nl');
fs.mkdirSync(outDir, { recursive: true });

const port = 8783;
const server = await serve(webgpu, port);
const poses = chasePoses(buildWorld());
let fail = 0;
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  const rows = await withChrome({
    debugPort: 9398,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const out = [];
      for (const t of TIMES) {
        const payload = await evalJson(`window.__glacierNlAt(${t}).then(r => JSON.stringify(r))`);
        if (payload.gpuErr) throw new Error(payload.gpuErr);
        const name = `nl-t${t}.png`;
        fs.writeFileSync(path.join(outDir, name), Buffer.from(payload.png, 'base64'));
        console.log('nl', t, 'z', payload.z);
        out.push({ t, name });
      }
      return out;
    },
  });
  const report = [];
  for (const row of rows) {
    const pose = poses.find((p) => Math.abs(p.t - row.t) < 1e-6);
    const img = loadRgb(path.join(outDir, row.name));
    const nl = measureNlMask(img.rgb, img.w, img.h, pose);
    const vis = terminatorVisibility(img.rgb, img.w, img.h, pose);
    const line = { t: row.t, ...nl, visibleFraction: vis && vis.fraction, onScreen: vis && vis.onScreen, visible: vis && vis.visible };
    if (vis && vis.fraction != null && vis.fraction < 0.3) line.heading = 'N/A';
    report.push(line);
    console.log(JSON.stringify(line));
  }
  fs.writeFileSync(path.join(outDir, 'nl.json'), JSON.stringify(report, null, 2) + '\n');
} catch (err) {
  console.error('FAIL', err && err.stack || err);
  fail++;
} finally {
  server.close();
}
if (fail) process.exit(1);
