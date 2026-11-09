#!/usr/bin/env node
// One command: node engine/webgpu/biome-factory/make.mjs --biome <id>
// The biome is engine/webgpu/<id>/biome.factory.json plus <id>.js.
// Exit 0 release, 2 hold, 1 hard fail. Writes only under biome-factory/out/<id>/.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline } from './pipeline.mjs';
import { assemble } from './assemble.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const repo = path.resolve(webgpu, '../..');
const args = process.argv.slice(2);
const biome = args.includes('--biome') ? args[args.indexOf('--biome') + 1] : '';
const outRoot = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(here, 'out');

function loadBiome(id) {
  const cfgPath = path.join(webgpu, id, 'biome.factory.json');
  const pagePath = path.join(webgpu, id, id + '.js');
  if (!fs.existsSync(cfgPath) || !fs.existsSync(pagePath)) return null;
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const files = {};
  for (const slot of cfg.materials || []) {
    if (!slot.file) continue;
    const src = slot.source ? path.resolve(repo, slot.source) : path.join(webgpu, id, slot.file);
    if (fs.existsSync(src)) files[slot.file] = fs.readFileSync(src);
  }
  const bolt = path.join(webgpu, 'assets/meadow/bolt439_atlas.png');
  const breathDir = path.join(webgpu, 'assets/meadow/bolt_idle4b5_rgba');
  const breathFrames = fs.existsSync(breathDir) ? fs.readdirSync(breathDir).filter(f => /^f\d{4}\.png$/.test(f)).length : 0;
  return {
    config: cfg,
    pageSource: fs.readFileSync(pagePath, 'utf8'),
    files,
    identity: { boltAtlas: fs.existsSync(bolt), breathFrames },
    evidence: cfg.evidence || { capture: false, visualVerdict: null, phoneMeasured: false },
    openDefects: cfg.openDefects || [],
  };
}

const force = args.includes('--force');
const noSwatch = args.includes('--no-swatch');
const ctx = biome ? loadBiome(biome) : null;
if (!ctx) {
  console.log(JSON.stringify({ label: 'FAIL', error: 'unknown biome ' + biome }));
  process.exit(1);
}

const state = runPipeline(ctx);
const dest = path.join(outRoot, biome);
fs.mkdirSync(dest, { recursive: true });
const prevKeep = path.join(dest, 'KEEP');
if (fs.existsSync(prevKeep) && !state.release) state.note = 'previous KEEP left in place';
else if (state.release) fs.writeFileSync(prevKeep, state.label + '\n');

try {
  const sources = (ctx.config.materials || []).map(m => m.source).filter(Boolean);
  const fixtureDir = sources.length ? path.dirname(path.resolve(repo, sources[0])) : path.join(webgpu, biome);
  const report = await assemble(ctx, { outRoot: dest, fixtureDir, swatch: !noSwatch, force });
  state.premise = report.premise;
  state.sky = 'BLOCKED';
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
  runId: state.runId || null,
  hold: state.hold.map(h => h.code),
  hard: state.hard.map(h => h.code),
  out: dest,
}));
process.exit(state.hard.length ? 1 : state.release ? 0 : 2);
