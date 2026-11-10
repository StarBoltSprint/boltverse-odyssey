#!/usr/bin/env node
// One command: node engine/webgpu/biome-factory/make.mjs --biome glacier
// Exit 0 would be a release. This candidate stays HOLD. It does not write KEEP.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { DE76_MAX } from './cie76.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const args = process.argv.slice(2);
const biome = args.includes('--biome') ? args[args.indexOf('--biome') + 1] : 'glacier';
if (biome !== 'glacier') {
  console.log(JSON.stringify({ label: 'FAIL', error: 'unknown biome ' + biome }));
  process.exit(1);
}

const cpu = spawnSync('node', [path.join(webgpu, 'glacier/test-cpu.mjs')], { encoding: 'utf8' });
const holes = spawnSync('node', [path.join(webgpu, 'glacier/test-holes.mjs')], { encoding: 'utf8' });
if (cpu.status !== 0 || holes.status !== 0) {
  console.error(cpu.stdout, cpu.stderr, holes.stdout, holes.stderr);
  process.exit(1);
}
const summary = JSON.parse(cpu.stdout.replace(/^PASS cpu /, ''));
const hole = JSON.parse(holes.stdout.replace(/^PASS holes /, ''));
const out = path.join(here, 'out/glacier');
fs.mkdirSync(out, { recursive: true });
const state = {
  label: 'HOLD',
  release: false,
  visualKeep: false,
  live: false,
  reason: 'Measured gates are separate. A visual KEEP is not claimed.',
  de76: DE76_MAX,
  budget: summary,
  holes: hole,
};
fs.writeFileSync(path.join(out, 'state.json'), JSON.stringify(state, null, 2) + '\n');
const keep = path.join(out, 'KEEP');
if (fs.existsSync(keep)) fs.rmSync(keep);
console.log(JSON.stringify({ label: 'HOLD', release: false, visualKeep: false, tris: summary.tris, draws: summary.draws, out }));
process.exit(2);
