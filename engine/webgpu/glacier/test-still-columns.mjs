// Blocking per-still gate. A crust still that scores above 1.5 on the chase
// column metric cannot enter the snow mix. Still 3 is the bar, about 1.3.
// The limit is not lowered.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { serve, withChrome } from './chrome.mjs';
import { CANDIDATE } from './biome.js';

const STILL_COLUMN_MAX = 1.5;
const TIMES = [5.1, 5.567, 7.9, 11.7];
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '..');

const server = await serve(root, 8826);
let failed = false;
try {
  await withChrome({
    debugPort: 9450,
    tries: 160,
    url: `http://127.0.0.1:8826/glacier/glacier.html?cap=1&w=720&h=1280&candidate=${CANDIDATE}${process.env.SNOW ? '&snow=' + process.env.SNOW : ''}`,
    fn: async ({ evalJson }) => {
      for (const t of TIMES) {
        const row = await evalJson(`window.__glacierStills(${t}).then(r => JSON.stringify(r))`);
        if (!row || !row.rows) throw new Error('no stills ' + JSON.stringify(row).slice(0, 240));
        const bits = row.rows.map((r) => `${r.name}=${r.peak.toFixed(3)}`).join(' ');
        console.log('t', t, bits);
        for (const r of row.rows) {
          if (!r.name.startsWith('still')) continue;
          if (!(r.peak <= STILL_COLUMN_MAX)) {
            console.log('FAIL', r.name, 'at', t, r.peak.toFixed(3), '>', STILL_COLUMN_MAX);
            failed = true;
          }
        }
      }
    },
  });
} finally {
  server.close();
}
const out = path.join(dir, 'artifacts/run26');
fs.mkdirSync(out, { recursive: true });
if (failed) {
  console.log('FAIL still-columns');
  process.exit(1);
}
console.log('PASS still-columns');
