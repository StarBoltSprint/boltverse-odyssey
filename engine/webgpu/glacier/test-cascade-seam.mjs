// The seam bar is the mean |near - far| shadow factor on snow vertices in the
// 16–32 m band. The picture-luma seam is not this number.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'artifacts/run33-csm');
const bar = 0.03;
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };
const live = read('cascade-seam.json');
const r3 = read('cascade-seam-r3.json');
const bias = read('cascade-seam-bias.json');
for (const [tag, row] of Object.entries(live)) {
  if (!(row.n >= 8 && row.mean <= bar)) bad(`live ${tag} ${row.mean}`);
}
for (const [tag, row] of Object.entries(r3)) {
  if (!(row.n >= 8 && row.mean > bar)) bad(`round 3 did not fail ${tag} ${row.mean}`);
}
for (const [tag, row] of Object.entries(bias)) {
  if (!(row.n >= 8 && row.mean > bar)) bad(`bias mismatch did not fail ${tag} ${row.mean}`);
}
if (fail) process.exit(1);
console.log('PASS cascade seam', JSON.stringify({
  live: Object.fromEntries(Object.entries(live).map(([k, v]) => [k, +v.mean.toFixed(4)])),
  r3: Object.fromEntries(Object.entries(r3).map(([k, v]) => [k, +v.mean.toFixed(4)])),
  bias: Object.fromEntries(Object.entries(bias).map(([k, v]) => [k, +v.mean.toFixed(4)])),
}));
