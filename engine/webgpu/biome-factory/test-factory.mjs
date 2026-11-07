// Factory gates. A passing config still HOLDs until a visual verdict exists.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPipeline, sha256, readC2paSelfId, sourceUsesReferenceAsTexture } from './pipeline.mjs';
import { TILE_M, repeatsAcross, materialGate, ALBEDO, shadeFactor, skyProjection } from '../crystal/materials.js';
import { createMesh } from '../engine/bricks/facet-mesh.js';

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
if (page.includes('sky-panorama.jpg')) bad('page samples the rejected sky');
if (repeatsAcross(8, TILE_M.stream) !== 4) bad('stream period');
if (shadeFactor(1) - shadeFactor(0.25) < 0.6) bad('shade still flattens facets');
const skyFit = skyProjection(1280, 720, 7.68);
if (skyFit.ok || skyFit.reason !== 'not-2:1-equirect') bad('16:9 sky accepted');
if (!skyProjection(4096, 2048, 4).ok) bad('house 2:1 rejected');
if (skyProjection(2048, 1024, 20).ok) bad('failed wrap accepted');
{
  const mesh = createMesh();
  mesh.boxBevel(0, 0, 0, 2, 4, 2, 0.4, 6, 0.16);
  const v = mesh.finish();
  let inward = 0;
  for (let i = 0; i < v.length; i += 8) {
    if (v[i] * v[i + 4] + v[i + 1] * v[i + 5] + v[i + 2] * v[i + 6] < -0.02) inward++;
  }
  if (inward) bad('bevel normals inward ' + inward);
}
let threw = false;
try { repeatsAcross(10, 0); } catch { threw = true; }
if (!threw) bad('missing scale did not throw');

const dir = path.join(here, 'fixtures/materials-v2');
const files = {};
for (const name of Object.values(ALBEDO)) files[name] = fs.readFileSync(path.join(dir, name));
for (const slot of cfg.materials) {
  if (!slot.file) continue;
  if (sha256(files[slot.file]) !== slot.sha256) bad('hash config ' + slot.id);
  const declared = {
    'obsidian-wall': TILE_M.wall,
    crystal: TILE_M.crystal,
    ground: TILE_M.ground,
    architecture: TILE_M.architecture,
    violet: TILE_M.violet,
    stream: TILE_M.stream,
  }[slot.id] ?? null;
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
for (const code of ['missing_asset', 'scale_unproven', 'quality_hold', 'visual_not_passed', 'sky_unusable', 'missing_capture', 'missing_review', 'phone_unmeasured']) {
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

const badSky = runPipeline({ ...base, config: { ...cfg, sky: { ...cfg.sky, runtimeTexture: true } } });
if (!badSky.hard.some(h => h.code === 'sky_projection')) bad('bad sky installed');

const gate = materialGate(new URLSearchParams('candidate=materials-v2-r2'));
if (!gate.render || gate.release !== 'HOLD' || gate.referenceIsTexture || !gate.missing.includes('sky-equirect')) bad('candidate gate');
const old = materialGate(new URLSearchParams('candidate=materials-v2-r1'));
if (old.render) bad('r1 candidate still paints');
const closed = materialGate(new URLSearchParams(''));
if (closed.render) bad('default page would paint');

if (fail) { console.error(fail + ' failed'); process.exit(1); }
console.log('PASS factory', { hold: held.hold.length, hard: held.hard.length, label: held.label });
