// Module load, crop bounds, and the installer refuse list.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CROPS, KEY, CRYSTAL, cropUV } from './biome.js';
import { buildWorld } from './world.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const keyPath = path.join(dir, KEY.file);
if (!fs.existsSync(keyPath)) bad('missing key');
else {
  const sha = (await import('crypto')).createHash('sha256').update(fs.readFileSync(keyPath)).digest('hex');
  if (sha !== KEY.sha256) bad('key sha ' + sha);
}
const bolt = path.resolve(dir, CRYSTAL.bolt);
if (!fs.existsSync(bolt)) bad('missing bolt439 ' + bolt);
if (!bolt.endsWith('bolt439_atlas.png')) bad('not the live atlas');

for (const c of CROPS) {
  if (c.x < 0 || c.y < 0 || c.x + c.w > KEY.w || c.y + c.h > KEY.h) bad('crop outside ' + c.id);
  const uv = cropUV(c);
  if (uv.some(v => v < 0 || v > 1)) bad('uv ' + c.id);
}
const world = buildWorld();
if (!world.circles.length) bad('no collision');

const guard = ['meadow', 'diag', 'pace', 'prof', 'cull', 'occl', 'breath', 'm448'];
const allow = [
  'engine/webgpu/crystal/',
  'engine/webgpu/engine/bricks/follow-cam.js',
  'engine/webgpu/engine/bricks/circle-collide.js',
  'engine/webgpu/engine/bricks/facet-mesh.js',
];
function assertSafe(rel) {
  const low = rel.replaceAll('\\', '/').toLowerCase();
  const base = path.basename(low);
  for (const g of guard) {
    if (base.includes(g) || low.includes('/' + g) || low.includes(g + '-')) throw new Error('refuse overwrite ' + rel);
  }
  if (!allow.some(a => low.includes(a))) throw new Error('refuse path ' + rel);
}
try { assertSafe('engine/webgpu/m448aaa3.js'); bad('guard missed meadow page'); } catch (e) { if (!String(e).includes('refuse')) bad(e); }
try { assertSafe('engine/webgpu/crystal/crystal.js'); } catch (e) { bad('crystal path refused ' + e); }
for (const g of guard) {
  try { assertSafe('engine/webgpu/' + g + '-install/files/x.js'); bad('allowed ' + g); } catch { /* refuse */ }
}

const files = ['crystal.js', 'crystal.html', 'world.js', 'biome.js', 'key/environment.jpg'];
for (const f of files) if (!fs.existsSync(path.join(dir, f))) bad('missing ' + f);
if (!fs.existsSync(path.join(root, 'engine/webgpu/engine/bricks/circle-collide.js'))) bad('brick missing');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS guard', { crops: CROPS.length, bolt: path.basename(bolt) });
