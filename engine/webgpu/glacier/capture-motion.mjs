// Motion residual only. mode 28 = run 31 derivatives with mip bias -2, no TAA.
// mode 30 = run 31 derivatives, no TAA. mode 0 = the live path.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const mode = Number(process.argv[2] || 30);
const times = (process.argv[3] || '5.10').split(',').map(Number);
const outFile = process.argv[4] || path.join(here, 'fixtures', 'motion', 'gpu.json');
const port = Number(process.argv[5] || 8838);
const debugPort = Number(process.argv[6] || 9468);
const pair = process.argv[7] == null || process.argv[7] === '' ? null : Number(process.argv[7]);
const sharp = process.env.SHARP == null || process.env.SHARP === '' ? null : Number(process.env.SHARP);
const feedback = process.env.FEEDBACK == null || process.env.FEEDBACK === '' ? null : Number(process.env.FEEDBACK);
const clamp = process.env.CLAMP == null || process.env.CLAMP === '' ? null : Number(process.env.CLAMP);
const forceSingle = process.env.SINGLE === '1';
const mipFloor = process.env.MIPFLOOR == null || process.env.MIPFLOOR === '' ? null : Number(process.env.MIPFLOOR);
const cap = process.env.MIPCAP == null || process.env.MIPCAP === '' ? null : Number(process.env.MIPCAP);
const live = mode === 0;
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const server = await serve(webgpu, port);
const t0 = Date.now();
try {
  const url = `http://127.0.0.1:${port}/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}`;
  await withChrome({
    debugPort,
    url,
    tries: 120,
    fn: async ({ evalJson }) => {
      const rows = [];
      for (const t of times) {
        const row = await evalJson(
          `window.__glacierSingle=${live && !forceSingle ? 'false' : 'true'}; window.__glacierMipBias=${live ? 0 : mode}; window.__glacierSharp=${sharp == null ? 'null' : sharp}; window.__glacierMipCap=${cap == null ? 'null' : cap}; window.__glacierMipFloor=${mipFloor == null ? 'null' : mipFloor}; window.__glacierFeedback=${feedback == null ? 'null' : feedback}; window.__glacierClamp=${clamp == null ? 'null' : clamp}; window.__glacierPair=${pair == null ? 'null' : pair}; window.__glacierD8(${t}).then(r => JSON.stringify({t:r.t,z:r.z,flicker:r.flicker,flickerMotion:r.flickerMotion,horizon:r.horizon,flickerMotionN:r.flickerMotionN,flickerN:r.flickerN,draws:r.draws,tris:r.tris,gpuErr:r.gpuErr}))`
        );
        if (row.gpuErr) throw new Error(row.gpuErr);
        rows.push({ mode, sharp, clamp, feedback, single: !live || forceSingle, ...row });
        console.log(JSON.stringify(rows[rows.length - 1]));
        if (process.env.STILL) {
          const film = await evalJson(`window.__glacierFilm(${t}).then(r => JSON.stringify({jpg:r.jpg, err:(r.info&&r.info.gpuErr)||null}))`);
          if (film.err) throw new Error(film.err);
          const jpg = process.env.STILL.replace('{t}', String(t));
          fs.mkdirSync(path.dirname(jpg), { recursive: true });
          fs.writeFileSync(jpg, Buffer.from(film.jpg, 'base64'));
          console.log('still', jpg);
        }
      }
      const head = { mode, live: live && !forceSingle, sharp, cap, feedback, clamp, mipFloor, pair: pair == null ? 1 / 30 : pair };
      const body = rows.length === 1
        ? { ...head, motion: rows[0].flickerMotion, raw: rows[0].flicker, horizon: rows[0].horizon, t: rows[0].t, n: rows[0].flickerMotionN, rawN: rows[0].flickerN }
        : { ...head, rows };
      fs.writeFileSync(outFile, JSON.stringify(body, null, 2) + '\n');
    },
  });
} finally {
  server.close();
  console.log('motion capture', mode, Math.round((Date.now() - t0) / 1000) + 's');
}
