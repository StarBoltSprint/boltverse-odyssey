// Factory gates. A passing config still HOLDs until a visual verdict exists.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline, sha256, readC2paSelfId, sourceUsesReferenceAsTexture } from './pipeline.mjs';
import { TILE_M, repeatsAcross, materialGate, ALBEDO } from '../crystal/materials.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

const page = fs.readFileSync(path.join(webgpu, 'crystal/crystal.js'), 'utf8');
const cfg = JSON.parse(fs.readFileSync(path.join(webgpu, 'crystal/biome.factory.json'), 'utf8'));
if (sourceUsesReferenceAsTexture(page)) bad('page still samples the reference');
if (page.includes('tiling-inspection.jpg')) bad('page uses the tiling sheet');
for (const key of Object.keys(TILE_M)) {
  if (!page.includes('TILE_M.' + key)) bad('shader missing scale ' + key);
}
const wide = 84;
if (repeatsAcross(wide, TILE_M.ground) !== wide / 3) bad('ground period');
if (repeatsAcross(2, TILE_M.crystal) !== 4) bad('crystal period');
let threw = false;
try { repeatsAcross(10, 0); } catch { threw = true; }
if (!threw) bad('missing scale did not throw');

const dir = path.join(here, 'fixtures/materials-v2');
const files = {};
for (const name of Object.values(ALBEDO)) files[name] = fs.readFileSync(path.join(dir, name));
for (const slot of cfg.materials) {
  if (!slot.file) continue;
  if (sha256(files[slot.file]) !== slot.sha256) bad('hash config ' + slot.id);
  const declared = slot.id === 'obsidian-wall' ? TILE_M.wall
    : slot.id === 'crystal' ? TILE_M.crystal
    : slot.id === 'ground' ? TILE_M.ground
    : slot.id === 'architecture' ? TILE_M.architecture : null;
  if (declared != null && slot.tileMeters !== declared) bad('tile mismatch ' + slot.id);
  const c2 = readC2paSelfId(files[slot.file]);
  if (c2.label !== 'self-identified Grok Imagine via embedded metadata') bad('c2pa label ' + slot.id);
  if (c2.signatureVerified !== false) bad('signature must stay unverified');
}
if (cfg.materials.some(m => m.file === 'tiling-inspection.jpg')) bad('sheet listed as albedo');

const base = {
  config: cfg,
  pageSource: page,
  files,
  identity: { boltAtlas: true, breathFrames: 144 },
  evidence: { capture: false, visualVerdict: null, phoneMeasured: false },
};
const held = runPipeline(base);
if (held.label !== 'HOLD' || held.release || held.keep) bad('valid path released ' + held.label);
if (held.hard.length) bad('valid path hard ' + JSON.stringify(held.hard));
for (const code of ['missing_asset', 'scale_unproven', 'quality_hold', 'visual_not_passed', 'missing_capture', 'missing_review', 'phone_unmeasured']) {
  if (!held.hold.some(h => h.code === code)) bad('missing hold ' + code);
}

const ref = runPipeline({ ...base, config: { ...cfg, refs: [{ id: 'k', runtimeTexture: true }] } });
if (!ref.hard.some(h => h.code === 'ref_as_texture') || ref.release) bad('ref as texture');

const hashed = runPipeline({ ...base, config: { ...cfg, materials: cfg.materials.map(m => m.file ? { ...m, sha256: '0'.repeat(64) } : m) } });
if (!hashed.hard.some(h => h.code === 'hash')) bad('bad hash');

const scaled = runPipeline({ ...base, config: { ...cfg, materials: cfg.materials.map(m => m.id === 'ground' ? { ...m, tileMeters: 0 } : m) } });
if (!scaled.hard.some(h => h.code === 'scale')) bad('missing scale');

const preview = runPipeline({ ...base, config: { ...cfg, materials: [...cfg.materials, { id: 'sheet', file: 'tiling-inspection.jpg', previewOnly: true, tileMeters: 1 }] } });
if (!preview.hard.some(h => h.code === 'preview_as_albedo')) bad('preview albedo');

const sourced = runPipeline({ ...base, pageSource: page + '\nload(KEY.file)' });
if (!sourced.hard.some(h => h.code === 'ref_as_texture')) bad('source ref');

const noAnim = runPipeline({ ...base, identity: { boltAtlas: false, breathFrames: 0 } });
if (!noAnim.hold.some(h => h.code === 'missing_animation') || noAnim.release) bad('missing animation');

const gate = materialGate(new URLSearchParams('candidate=materials-v2-r1'));
if (!gate.render || gate.release !== 'HOLD' || gate.referenceIsTexture) bad('candidate gate');
const closed = materialGate(new URLSearchParams(''));
if (closed.render) bad('default page would paint');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS factory', { hold: held.hold.length, hard: held.hard.length, label: held.label });
