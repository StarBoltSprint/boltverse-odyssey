#!/usr/bin/env node
// One command: node engine/webgpu/biome-factory/make.mjs --biome crystal
// Exit 0 release, 2 hold, 1 hard fail. Writes only under biome-factory/out/<id>/.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline } from './pipeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const args = process.argv.slice(2);
const biome = args.includes('--biome') ? args[args.indexOf('--biome') + 1] : 'crystal';
const outRoot = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, 'out');

const configs = {
  crystal: () => crystalContext(),
};

function crystalContext() {
  const page = fs.readFileSync(path.join(webgpu, 'crystal/crystal.js'), 'utf8');
  const dir = path.join(here, 'fixtures/materials-v2');
  const names = ['obsidian-wall.jpg', 'mineral-ground.jpg', 'cyan-facets.jpg', 'architectural-stone.jpg'];
  const files = {};
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) files[n] = fs.readFileSync(p);
  }
  const breathDir = path.join(webgpu, 'assets/meadow/bolt_idle4b5_rgba');
  const breathFrames = fs.existsSync(breathDir) ? fs.readdirSync(breathDir).filter(f => /^f\d{4}\.png$/.test(f)).length : 0;
  const bolt = path.join(webgpu, 'assets/meadow/bolt439_atlas.png');
  return {
    config: JSON.parse(fs.readFileSync(path.join(webgpu, 'crystal/biome.factory.json'), 'utf8')),
    pageSource: page,
    files,
    identity: { boltAtlas: fs.existsSync(bolt), breathFrames },
    evidence: fs.existsSync(path.join(here, 'evidence/crystal.json'))
      ? JSON.parse(fs.readFileSync(path.join(here, 'evidence/crystal.json'), 'utf8'))
      : { capture: false, visualVerdict: null, phoneMeasured: false },
    openDefects: [
      'gen4b tail crop and paw plant are not claimed fixed',
      'idle/run crossfade is 200ms between two different pictures (pose, light, volume)',
      'phone performance was not measured',
    ],
  };
}

if (!configs[biome]) {
  console.log(JSON.stringify({ label: 'FAIL', error: 'unknown biome ' + biome }));
  process.exit(1);
}

const state = runPipeline(configs[biome]());
const dest = path.join(outRoot, biome);
fs.mkdirSync(dest, { recursive: true });
const prevKeep = path.join(dest, 'KEEP');
if (fs.existsSync(prevKeep) && !state.release) {
  state.note = 'previous KEEP left in place';
} else if (state.release) {
  fs.writeFileSync(prevKeep, state.label + '\n');
}
fs.writeFileSync(path.join(dest, 'state.json'), JSON.stringify(state, null, 2));
console.log(JSON.stringify({ label: state.label, release: state.release, hold: state.hold.map(h => h.code), hard: state.hard.map(h => h.code), out: dest }));
process.exit(state.hard.length ? 1 : state.release ? 0 : 2);
