// Assembly without Chrome. The swatch itself is run by make.mjs.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { assemble, SKY_BLOCK } from './assemble.mjs';
import { lit8 } from './albedo-stats.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const cfg = JSON.parse(fs.readFileSync(path.join(webgpu, 'crystal/biome.factory.json'), 'utf8'));
const dir = path.join(here, 'fixtures/materials-v2');
const files = {};
for (const slot of cfg.materials) {
  if (!slot.file) continue;
  files[slot.file] = fs.readFileSync(path.join(dir, slot.file));
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'crystal-assemble-'));
const ctx = { config: cfg, files };
const a = await assemble(ctx, { outRoot: out, fixtureDir: dir, swatch: false });
if (a.premise.holds) bad('premise released');
if (a.pending.sky.status !== 'BLOCKED') bad('sky not blocked');
if (SKY_BLOCK.supportedAspects.includes('2:1')) bad('schema invented 2:1');
if (a.signoff.visualKeep || a.signoff.phoneMeasured) bad('signoff invented');
const tex = fs.readdirSync(path.join(out, 'runs', a.runId, 'textures'));
if (tex.includes('sky-panorama.jpg') || tex.includes('environment.jpg')) bad('sky or key copied as texture');
if (!tex.includes('mineral-ground.jpg') || !tex.includes('violet-mineral.jpg')) bad('textures not assembled');
const again = await assemble(ctx, { outRoot: out, fixtureDir: dir, swatch: false });
if (again.runId !== a.runId) bad('run id changed');
if (!fs.existsSync(path.join(out, 'runs', a.runId, 'report.json'))) bad('report missing');
let threw = false;
try {
  await assemble({ config: cfg, files: { ...files, 'environment.jpg': Buffer.from('x') }, }, {
    outRoot: out, fixtureDir: dir, swatch: false,
  });
} catch { threw = false; }
const poisoned = { ...cfg, materials: [...cfg.materials, { id: 'ref', file: 'environment.jpg', sha256: 'aa', tileMeters: 1 }] };
try {
  await assemble({ config: poisoned, files: { ...files, 'environment.jpg': Buffer.from('no') } }, { outRoot: out, fixtureDir: dir, swatch: false });
} catch (err) {
  threw = String(err.message || err).includes('reference');
}
if (!threw) bad('reference texture was assembled');
if (!(lit8(255, 1) > 250 && lit8(0, 1) === 0 && lit8(26, 0) < lit8(26, 1))) bad('shade model');
if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS assemble', { runId: a.runId, blocked: a.pending.sky.status, textures: tex.length });
