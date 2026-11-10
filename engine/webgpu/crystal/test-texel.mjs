// Crystal candidate texel gate. 2048 px/m is not configurable.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TILE_M, VARIANTS } from './materials.js';
import { jpegSize, texelRow, MIN_PX_PER_M, MAX_STRETCH } from '../biome-factory/texel-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../biome-factory/fixtures/materials-v2');
const LARGE = new Set(['ground', 'wall', 'architecture', 'stream']);
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const neg = texelRow({ name: 'negative-1024-at-1m', width: 1024, height: 1024, metres: 1, variants: 4, minVariants: 4 });
if (neg.pass) bad('negative control passed ' + JSON.stringify(neg));
if (!(neg.pxPerM < MIN_PX_PER_M) || !(neg.stretch > MAX_STRETCH)) bad('negative control did not trip both limits ' + JSON.stringify(neg));

const rows = [];
for (const [name, files] of Object.entries(VARIANTS)) {
  const metres = TILE_M[name];
  let width = 0;
  let height = 0;
  for (const file of files) {
    const size = jpegSize(path.join(root, file));
    if (!width) { width = size.width; height = size.height; }
    if (size.width !== width || size.height !== height) bad(name + ' variant size ' + file);
  }
  const row = texelRow({
    name,
    width,
    height,
    metres,
    variants: files.length,
    minVariants: LARGE.has(name) ? 4 : 3,
  });
  rows.push(row);
  if (!row.pass) bad(name + ' ' + row.fails.join(', '));
}
const shader = fs.readFileSync(new URL('./crystal.js', import.meta.url), 'utf8');
for (const hit of shader.matchAll(/gUv\s*\*\s*([0-9]*\.?[0-9]+)/g)) {
  const scale = Number(hit[1]);
  if (!(scale + 1e-6 >= 1 / MAX_STRETCH)) bad('ground UV scale ' + scale + ' stretches past ' + MAX_STRETCH);
}
if (!shader.includes("mipmapFilter: 'linear'") || !shader.includes('maxAnisotropy: aniso')) bad('sampler missing mips or anisotropy');

if (fail) process.exit(1);
console.log('PASS texel', JSON.stringify({ minPxPerM: MIN_PX_PER_M, maxStretch: MAX_STRETCH, negative: neg, rows }, null, 2));
