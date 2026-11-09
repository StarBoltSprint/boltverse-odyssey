#!/usr/bin/env node
// One command: node engine/webgpu/biome-factory/make.mjs --biome crystal
// Exit 0 release, 2 hold, 1 hard fail. Writes only under biome-factory/out/<id>/.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline } from './pipeline.mjs';
import { assemble } from './assemble.mjs';
import { crystalColourStatus } from './colour-same-light.mjs';
import { measureSky } from './procedural-sky.js';
import { jpegPixels } from './albedo-stats.mjs';

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
  const cfg = JSON.parse(fs.readFileSync(path.join(webgpu, 'crystal/biome.factory.json'), 'utf8'));
  const dir = path.join(here, 'fixtures/materials-v2');
  const files = {};
  for (const slot of cfg.materials) {
    if (!slot.file) continue;
    const p = path.join(dir, slot.file);
    if (fs.existsSync(p)) files[slot.file] = fs.readFileSync(p);
  }
  const breathDir = path.join(webgpu, 'assets/meadow/bolt_idle4b5_rgba');
  const breathFrames = fs.existsSync(breathDir) ? fs.readdirSync(breathDir).filter(f => /^f\d{4}\.png$/.test(f)).length : 0;
  const bolt = path.join(webgpu, 'assets/meadow/bolt439_atlas.png');
  return {
    config: cfg,
    pageSource: page,
    files,
    identity: { boltAtlas: fs.existsSync(bolt), breathFrames },
    evidence: fs.existsSync(path.join(here, 'evidence/crystal.json'))
      ? JSON.parse(fs.readFileSync(path.join(here, 'evidence/crystal.json'), 'utf8'))
      : { capture: false, visualVerdict: null, phoneMeasured: false },
    openDefects: [
      'gen4b tail crop and paw plant are not claimed fixed',
      'idle/run crossfade is 200ms between two different pictures',
      'crystal kinematic slip at 7 m/s is 0; meadow stride stays 1.95; paw pixels are not locked to the ground',
      'obsidian wall albedo stays near L* 8; sky bounce lifts a side face from L* 5.53 to 7.71 and does not replace the texture',
      'sky plate rejected: not equirect 2:1',
      'phone performance was not measured',
    ],
  };
}

const force = args.includes('--force');
const noSwatch = args.includes('--no-swatch');

if (!configs[biome]) {
  console.log(JSON.stringify({ label: 'FAIL', error: 'unknown biome ' + biome }));
  process.exit(1);
}

const ctx = configs[biome]();
const state = runPipeline(ctx);
const dest = path.join(outRoot, biome);
fs.mkdirSync(dest, { recursive: true });
const prevKeep = path.join(dest, 'KEEP');
if (fs.existsSync(prevKeep) && !state.release) state.note = 'previous KEEP left in place';
else if (state.release) fs.writeFileSync(prevKeep, state.label + '\n');

try {
  const report = await assemble(ctx, {
    outRoot: dest,
    fixtureDir: path.join(here, 'fixtures/materials-v2'),
    swatch: !noSwatch,
    force,
  });
  state.premise = report.premise;
  state.sky = measureSky({
    pageSource: ctx.pageSource,
    plate: ctx.config.sky,
    procedural: ctx.config.proceduralSky,
  });
  if (state.sky.procedural.status === 'FAIL') {
    state.hard.push({ code: 'sky_procedural', detail: state.sky.procedural.checks });
    state.label = 'FAIL';
  }
  const fixtureDir = path.join(here, 'fixtures/materials-v2');
  const sameLight = args.includes('--same-light') && args[args.indexOf('--same-light') + 1] === 'crystal-rig';
  state.materialsColour = crystalColourStatus(
    (ctx.config.materials || []).filter(m => m.file && ctx.files[m.file]).map(m => ({
      id: m.id,
      pixels: jpegPixels(path.join(fixtureDir, m.file)),
      sha256: m.sha256 || null,
      knownTarget: null,
    })),
    sameLight ? { sameLight: 'crystal-rig' } : {},
  );
  if (sameLight && state.materialsColour.length && state.materialsColour.every(m => m.verdict !== 'UNCERTAIN')) {
    state.hold = state.hold.filter(h => h.code !== 'colour_uncertain');
  }
  state.label = state.hard.length ? 'FAIL' : (state.hold.length ? 'HOLD' : 'RELEASE');
  state.release = state.label === 'RELEASE';
  state.pending = report.pending;
  state.runId = report.runId;
  state.swatch = report.swatch;
  state.signoff = report.signoff;
} catch (err) {
  state.hard.push({ code: 'assemble', detail: String(err && err.stack || err) });
  state.label = 'FAIL';
}
fs.writeFileSync(path.join(dest, 'state.json'), JSON.stringify(state, null, 2));
console.log(JSON.stringify({
  label: state.label,
  release: state.release,
  premise: state.premise && state.premise.holds,
  sky: state.sky || null,
  materials: (state.materialsColour || []).map(m => ({ id: m.id, verdict: m.verdict, dE76: m.dE76 ?? null, mode: m.mode || 'no-target' })),
  runId: state.runId || null,
  hold: state.hold.map(h => h.code),
  hard: state.hard.map(h => h.code),
  out: dest,
}));
process.exit(state.hard.length ? 1 : state.release ? 0 : 2);
