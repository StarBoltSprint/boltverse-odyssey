// House-engine biome factory. Technical gates only.
// A manifest hash does not prove who painted the pixels.
// Embedded C2PA names are self-identification. Signatures are not checked.
// There is no cryptographic release gate.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { compareSameLight, PRIOR_RAW, DE76_MAX } from './colour-same-light.mjs';

export const STAGES = ['config', 'refs', 'materials', 'provenance', 'scale', 'quality', 'identity', 'evidence', 'release'];

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

// PNG IHDR width/height. JPEG parsing above is unchanged.
export function imageSize(buf) {
  if (buf && buf.length >= 24 && buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return jpegSize(buf);
}

// Reads the two strings that are actually in the file. Does not validate the signature.
export function readC2paSelfId(buf) {
  const s = buf.toString('latin1');
  const softwareAgent = s.includes('softwareAgent') && s.includes('Grok Imagine');
  const certificate = s.includes('xAI Grok Imagine');
  return {
    softwareAgent: softwareAgent ? 'Grok Imagine' : null,
    certificateIdentity: certificate ? 'xAI Grok Imagine' : null,
    signatureVerified: false,
    label: softwareAgent
      ? 'self-identified Grok Imagine via embedded metadata'
      : 'no Grok Imagine self-identification in file bytes',
  };
}

export function sourceUsesReferenceAsTexture(src) {
  return /KEY\.file|environment\.jpg|cropUV\(/.test(src);
}

function hold(state, code, detail) {
  state.hold.push({ code, detail });
}

function hard(state, code, detail) {
  state.hard.push({ code, detail });
}

export function runPipeline(ctx) {
  const state = {
    biome: ctx.config.id,
    stages: {},
    hold: [],
    hard: [],
    release: false,
    label: 'HOLD',
    provenanceLimit: 'A manifest hash does not prove authorship. Embedded C2PA softwareAgent and certificate names are self-identification only. The signature and trust chain were not verified. That is not a cryptographic certificate, and release is not blocked on a crypto backend.',
    openDefects: ctx.openDefects || [],
  };

  const cfg = ctx.config;
  state.stages.config = cfg && cfg.id && Array.isArray(cfg.materials) && Array.isArray(cfg.refs) ? 'pass' : 'fail';
  if (state.stages.config !== 'pass') hard(state, 'config', 'biome config incomplete');

  if (ctx.pageSource && sourceUsesReferenceAsTexture(ctx.pageSource)) {
    hard(state, 'ref_as_texture', 'page source still samples the artistic reference');
  }
  if (ctx.pageSource && /sky-panorama\.jpg|sky-wrap-seam|surface-tiling-inspection/.test(ctx.pageSource)) {
    hard(state, 'sky_projection', 'page samples a rejected sky or a QA sheet');
  }
  for (const ref of cfg.refs || []) {
    if (ref.runtimeTexture !== false) hard(state, 'ref_as_texture', ref.id || ref.file);
  }
  const sky = cfg.sky;
  if (sky) {
    const equirect = Array.isArray(sky.resolution) && sky.resolution[0] === sky.resolution[1] * 2;
    if (sky.runtimeTexture !== false && (!equirect || sky.wrapPass !== true)) {
      hard(state, 'sky_projection', sky.file || 'sky');
    }
    if (!equirect || sky.wrapPass !== true) hold(state, 'sky_unusable', sky.reason || 'sky is not a 2:1 wrap');
    if (sky.status === 'BLOCKED') hold(state, 'sky_blocked', sky.blocker || 'GenerateImage cannot request this sky');
  }
  state.stages.refs = state.hard.some(h => h.code === 'ref_as_texture') ? 'fail' : 'pass';

  const materials = [];
  for (const slot of cfg.materials || []) {
    const row = { id: slot.id, role: slot.role, tileMeters: slot.tileMeters || null };
    if (slot.source === 'house-procedural' || slot.generator === 'house-procedural') {
      hard(state, 'procedural_albedo', slot.id);
    }
    if (slot.previewOnly) {
      hard(state, 'preview_as_albedo', slot.id);
      row.status = 'rejected_preview';
      materials.push(row);
      continue;
    }
    if (!slot.file) {
      hold(state, 'missing_asset', slot.id);
      row.status = 'missing';
      materials.push(row);
      continue;
    }
    const buf = ctx.files?.[slot.file];
    if (!buf) {
      hold(state, 'missing_asset', slot.file);
      row.status = 'missing';
      materials.push(row);
      continue;
    }
    const hash = sha256(buf);
    row.sha256 = hash;
    if (slot.sha256 && hash !== slot.sha256) hard(state, 'hash', slot.id);
    const dim = imageSize(buf);
    row.resolution = dim ? [dim.w, dim.h] : null;
    if (slot.resolution && dim && (dim.w !== slot.resolution[0] || dim.h !== slot.resolution[1])) {
      hard(state, 'resolution', slot.id);
    }
    if (!(slot.tileMeters > 0) || slot.tileMeters > 16) hard(state, 'scale', slot.id + ' tileMetres');
    if (slot.scaleMeasured !== true) {
      hold(state, 'scale_unproven', slot.id + ' declared tile is not a measured fit');
    }
    const c2 = readC2paSelfId(buf);
    row.c2pa = c2;
    if (slot.qualityHold) hold(state, 'quality_hold', slot.id + ': ' + (slot.qualityNote || 'visual hold'));
    else if (slot.visualPass !== true) hold(state, 'visual_not_passed', slot.id);
    if (slot.seamlessCertified === true) hard(state, 'fake_seamless', slot.id);
    materials.push(row);
  }
  state.materials = materials;
  state.stages.materials = state.hard.some(h => ['hash', 'resolution', 'scale', 'preview_as_albedo'].includes(h.code)) ? 'fail' : 'pass';
  state.stages.provenance = 'recorded';
  state.stages.scale = state.hold.some(h => h.code === 'scale_unproven') ? 'declared_not_measured' : 'pass';
  state.stages.quality = state.hold.some(h => h.code === 'quality_hold' || h.code === 'visual_not_passed') ? 'hold' : 'pass';

  const idn = ctx.identity || {};
  if (!idn.boltAtlas) hold(state, 'missing_animation', 'bolt439 atlas');
  if (!idn.breathFrames || idn.breathFrames < 144) hold(state, 'missing_animation', 'gen4b 144 frames');
  state.stages.identity = state.hold.some(h => h.code === 'missing_animation') ? 'fail' : 'pass';
  state.identityNote = 'gen4b tail crop and paw plant are not claimed fixed';

  if (!ctx.evidence?.capture) hold(state, 'missing_capture', 'no 720x1280 20s evidence for this material set');
  if (!ctx.evidence?.visualVerdict) hold(state, 'missing_review', 'no visual KEEP');
  if (ctx.evidence?.phoneMeasured !== true) hold(state, 'phone_unmeasured', 'real-time phone performance was not measured');
  state.stages.evidence = 'hold';

  if (cfg.proceduralSky) {
    if (cfg.proceduralSky.scope !== 'crystal-candidate-only') hard(state, 'sky_scope', cfg.proceduralSky.scope || 'missing scope');
    else state.proceduralSky = 'candidate-exception';
  }
  if (cfg.colour) {
    const colour = compareSameLight(cfg.colour.sample, cfg.colour.reference);
    state.colour = { ...colour, priorRaw: PRIOR_RAW, threshold: DE76_MAX };
    if (colour.verdict === 'UNCERTAIN') hold(state, 'colour_uncertain', colour.reason);
    if (colour.verdict === 'BLOCK') hard(state, 'colour', 'same-light dE76 ' + colour.dE76);
  }

  state.release = state.hard.length === 0 && state.hold.length === 0;
  state.label = state.release ? 'RELEASE' : (state.hard.length ? 'FAIL' : 'HOLD');
  state.stages.release = state.label;
  state.keep = false;
  return state;
}

export function loadFileMap(dir, names) {
  const files = {};
  for (const name of names) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) files[name] = fs.readFileSync(p);
  }
  return files;
}
