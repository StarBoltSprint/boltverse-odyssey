// Additive install. Refuses meadow, diag, pace, prof, cull, occl, breath, and any overwrite.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const guard = ['meadow', 'diag', 'pace', 'prof', 'cull', 'occl', 'breath', 'm448'];
const files = [
  'engine/webgpu/crystal/crystal.html',
  'engine/webgpu/crystal/crystal.js',
  'engine/webgpu/crystal/world.js',
  'engine/webgpu/crystal/biome.js',
  'engine/webgpu/crystal/install.mjs',
  'engine/webgpu/crystal/test-world.mjs',
  'engine/webgpu/crystal/test-guard.mjs',
  'engine/webgpu/crystal/capture.mjs',
  'engine/webgpu/crystal/capture-seq.mjs',
  'engine/webgpu/crystal/key/environment.jpg',
  'engine/webgpu/crystal/key/planet-surface.jpg',
  'engine/webgpu/crystal/test-idle-loop.mjs',
  'engine/webgpu/crystal/test-planet.mjs',
  'engine/webgpu/engine/bricks/planet-sphere.js',
  'engine/webgpu/crystal/PROVENANCE.md',
  'engine/webgpu/engine/bricks/follow-cam.js',
  'engine/webgpu/engine/bricks/circle-collide.js',
  'engine/webgpu/engine/bricks/facet-mesh.js',
  'engine/webgpu/crystal/materials.js',
  'engine/webgpu/crystal/biome.factory.json',
  'engine/webgpu/biome-factory/make.mjs',
  'engine/webgpu/biome-factory/pipeline.mjs',
  'engine/webgpu/biome-factory/test-factory.mjs',
  'engine/webgpu/biome-factory/test-assemble.mjs',
  'engine/webgpu/biome-factory/assemble.mjs',
  'engine/webgpu/biome-factory/albedo-stats.mjs',
  'engine/webgpu/biome-factory/shade.js',
  'engine/webgpu/biome-factory/swatch.js',
  'engine/webgpu/biome-factory/swatch.html',
  'engine/webgpu/biome-factory/swatch-run.mjs',
  'engine/webgpu/biome-factory/README.md',
  'engine/webgpu/biome-factory/colour-same-light.mjs',
  'engine/webgpu/biome-factory/test-colour-same-light.mjs',
  'engine/webgpu/biome-factory/procedural-sky.js',
  'engine/webgpu/biome-factory/test-sky-sphere.mjs',
  'engine/webgpu/biome-factory/test-quality.mjs',
  'engine/webgpu/biome-factory/fixtures/materials-v2/mineral-ground.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/obsidian-wall.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/cyan-facets.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/architectural-stone.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/manifest.json',
  'engine/webgpu/biome-factory/fixtures/materials-v2/stream-surface.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/violet-mineral.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/sky-panorama.jpg',
  'engine/webgpu/biome-factory/fixtures/materials-v2/qa/prompts-full.json',
  'engine/webgpu/biome-factory/evidence/crystal.json',
];

function assertSafe(rel) {
  const low = rel.replaceAll('\\', '/').toLowerCase();
  const base = path.basename(low);
  if (low.includes('..')) throw new Error('refuse ' + rel);
  for (const g of guard) {
    if (base.includes(g) || low.includes('/' + g + '/') || low.includes(g + '-')) throw new Error('refuse ' + rel);
  }
}

const dest = process.argv.includes('--dest') ? process.argv[process.argv.indexOf('--dest') + 1] : null;
let n = 0;
for (const rel of files) {
  assertSafe(rel);
  const src = path.join(repo, rel);
  if (!fs.existsSync(src)) throw new Error('missing ' + rel);
  if (!dest) { n++; continue; }
  const out = path.join(dest, rel);
  assertSafe(out);
  if (fs.existsSync(out)) {
    const a = fs.readFileSync(src);
    const b = fs.readFileSync(out);
    if (!a.equals(b)) throw new Error('refuse overwrite ' + rel);
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(src, out);
  }
  n++;
}
console.log(dest ? 'INSTALLED' : 'PASS install-check', n);
