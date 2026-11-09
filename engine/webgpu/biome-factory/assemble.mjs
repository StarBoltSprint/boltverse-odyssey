// Assemble an isolated candidate from the declarative config. Does not generate images.
import fs from 'fs';
import path from 'path';
import { sha256 } from './pipeline.mjs';
import { jpegStats, groundNdl, premiseFrom } from './albedo-stats.mjs';
import { SHADE } from './shade.js';

export const SKY_BLOCK = {
  status: 'BLOCKED',
  interface: 'GenerateImage',
  supportedAspects: ['1:1', '4:3', '3:4', '16:9', '9:16'],
  missingParameters: ['width', 'height', 'resolution', 'equirectangular'],
  cannotRequest: 'a native 2:1 image at 2048x1024 or larger',
  doNot: 'Do not resize, stretch, or crop a plate into a 2:1 map. It is not a 360.',
  houseNow: 'A physical atmosphere is house code. It is not an Imagine JPEG, and it is not a resized plate.',
  alternativesNotGenerated: [
    'Cubemap: six faces, each a supported 1:1 image. No face was generated for this step.',
    'Eight rectilinear views: 60 degree horizontal field, 45 degree yaw step, 25 percent overlap. No view was generated.',
  ],
};

export function runKey(cfg) {
  const body = JSON.stringify({
    revision: cfg.revision,
    materials: (cfg.materials || []).map(m => [m.id, m.sha256 || null, m.tileMeters || null, m.file || null]),
    sky: cfg.sky && cfg.sky.status,
  });
  return sha256(Buffer.from(body)).slice(0, 12);
}

export async function assemble(ctx, opts = {}) {
  const cfg = ctx.config;
  const outRoot = opts.outRoot;
  const id = runKey(cfg);
  const runDir = path.join(outRoot, 'runs', id);
  fs.mkdirSync(runDir, { recursive: true });
  const textures = path.join(runDir, 'textures');
  fs.mkdirSync(textures, { recursive: true });
  for (const slot of cfg.materials || []) {
    if (!slot.file) continue;
    if (slot.file.includes('environment')) throw new Error('refuse reference as texture ' + slot.file);
    const src = ctx.files?.[slot.file];
    if (!src) throw new Error('assemble missing ' + slot.file);
    if (slot.sha256 && sha256(src) !== slot.sha256) throw new Error('assemble hash ' + slot.id);
    fs.writeFileSync(path.join(textures, path.basename(slot.file)), src);
  }
  const pending = { sky: { ...SKY_BLOCK, file: cfg.sky?.file || null, resolution: cfg.sky?.resolution || null } };
  fs.writeFileSync(path.join(runDir, 'config.json'), JSON.stringify(cfg, null, 2));
  fs.writeFileSync(path.join(runDir, 'pending.json'), JSON.stringify(pending, null, 2));
  const fixtureDir = opts.fixtureDir;
  const materials = [];
  for (const slot of cfg.materials || []) {
    if (!slot.file) continue;
    const file = slot.source ? slot.source : path.join(fixtureDir, slot.file);
    const abs = path.isAbsolute(file) ? file : file;
    materials.push({ id: slot.id, tileMeters: slot.tileMeters, ...jpegStats(abs) });
  }
  let swatch = null;
  const panelPath = path.join(runDir, 'panels.json');
  if (opts.swatch && fs.existsSync(panelPath) && !opts.force) {
    swatch = JSON.parse(fs.readFileSync(panelPath, 'utf8'));
    swatch.resumed = true;
  } else if (opts.swatch) {
    const { runSwatch } = await import('./swatch-run.mjs');
    swatch = await runSwatch(runDir);
  }
  const byId = Object.fromEntries((swatch?.panels || []).map(p => [p.id, p]));
  const flat = byId['ground-raw'];
  const ramp = byId['ramp-lit'];
  const uv = byId['ground-uv'];
  const flatMae = flat?.sourceMean ? ((Math.abs(flat.r.mean - flat.sourceMean[0]) + Math.abs(flat.g.mean - flat.sourceMean[1]) + Math.abs(flat.b.mean - flat.sourceMean[2])) / 3) : null;
  const premise = swatch ? premiseFrom({
    flatMae: flatMae ?? 99,
    rampLitSpread: ramp?.spread ?? 0,
    materials,
    sourcePstdev: materials[0]?.sourcePstdevMax ?? 0,
    gpuPstdev: uv?.r?.pstdev ?? null,
    statement: cfg.premise,
  }) : { holds: false, because: 'swatch not run' };
  const sun = cfg.sun || [0, 1, 0];
  const report = {
    runId: id,
    shade: SHADE,
    groundNdl: Math.round(groundNdl(sun) * 1000) / 1000,
    materials,
    swatch: swatch ? {
      resumed: !!swatch.resumed,
      flatMae: flatMae == null ? null : Math.round(flatMae * 100) / 100,
      uvPeriodSad: uv?.periodSad ?? null,
      uvPeriodPx: uv?.periodPx ?? null,
      rampRaw: byId['ramp-raw']?.ends ?? null,
      rampLit: ramp?.ends ?? null,
      rampLitSpread: ramp?.spread ?? null,
    } : null,
    premise,
    pending,
    signoff: {
      visualKeep: false,
      phoneMeasured: false,
      gait: 'not signed off',
      sky: 'BLOCKED',
    },
  };
  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outRoot, 'current.json'), JSON.stringify({ runId: id, dir: runDir }, null, 2));
  return report;
}
