// Replaces only this biome. Refuses meadow, diag, pace, prof, cull, occl, breath-install, m448.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const forbid = ['meadow', 'diag-install', 'pace-install', 'prof-install', 'cull-install', 'occl-install', 'breath-install', 'm448'];
const allow = [
  'engine/webgpu/crystal/',
  'engine/webgpu/biome-factory/',
  'engine/webgpu/engine/bricks/planet-sphere.js',
  'engine/webgpu/engine/bricks/follow-cam.js',
  'engine/webgpu/engine/bricks/circle-collide.js',
  'engine/webgpu/engine/bricks/facet-mesh.js',
];
const files = [
  'engine/webgpu/crystal/crystal.html',
  'engine/webgpu/crystal/crystal.js',
  'engine/webgpu/crystal/world.js',
  'engine/webgpu/crystal/biome.js',
  'engine/webgpu/crystal/PROVENANCE.md',
  'engine/webgpu/crystal/install.mjs',
  'engine/webgpu/crystal/install-update.mjs',
  'engine/webgpu/crystal/capture.mjs',
  'engine/webgpu/crystal/capture-seq.mjs',
  'engine/webgpu/crystal/test-world.mjs',
  'engine/webgpu/crystal/test-guard.mjs',
  'engine/webgpu/crystal/test-idle-loop.mjs',
  'engine/webgpu/crystal/test-planet.mjs',
  'engine/webgpu/crystal/key/environment.jpg',
  'engine/webgpu/crystal/key/planet-surface.jpg',
  'engine/webgpu/engine/bricks/planet-sphere.js',
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
  if (low.includes('..')) throw new Error('refuse ' + rel);
  for (const g of forbid) if (low.includes(g)) throw new Error('refuse ' + rel);
  if (!allow.some(a => low.includes(a))) throw new Error('refuse path ' + rel);
}

const dest = process.argv.includes('--dest') ? process.argv[process.argv.indexOf('--dest') + 1] : null;
let n = 0;
for (const rel of files) {
  assertSafe(rel);
  const src = path.join(repo, rel);
  if (!fs.existsSync(src)) throw new Error('missing ' + rel);
  if (dest) {
    const out = path.join(dest, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(src, out);
  }
  n++;
}
console.log(dest ? 'UPDATED' : 'PASS update-check', n);
