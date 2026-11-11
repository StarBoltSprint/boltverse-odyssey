// House texture rule. Blocking. The density floor is not a biome setting.
// SmiR: every Imagine texture is used at its native resolution. Never upscale, never stretch.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { FOV_Y } from '../engine/bricks/follow-cam.js';

// Native Imagine pixels per metre. A config that sets a lower number is refused.
export const MIN_PX_PER_M = 2048;
export const STRETCH_P99_MAX = 1.3;
export const MAG_MAX = 1;
export const MIN_LARGE_VARIANTS = 4;
export const MIN_PROP_VARIANTS = 3;
export const PHONE_VIEW_H = 1280;

// Follow camera on flat ground. Eye height 1.12 m, target 0.66 m, boom 2.35 + look 2.2.
const EYE_H = 1.12;
const LOOK_AHEAD = 2.35 + 2.2;
const LOOK_DROP = 1.12 - 0.66;

export const LARGE_CLASSES = new Set(['ground', 'floor', 'snow', 'ice', 'wall', 'cliff']);

// A material slot the factory will build:
// { id, surfaceClass, tileMetres, files: [{ file, sha256, native: [w, h] }] }
export const SLOT_SCHEMA = {
  files: 'Imagine variants. Large surfaces need at least 4 distinct sha256 files. Small props need at least 3.',
  tileMetres: 'World metres covered by one tile. px/m = native width / tileMetres. Existing configs may spell this tileMeters.',
  surfaceClass: 'ground | floor | snow | ice | wall | cliff | prop',
};

const CLASS_WORDS = [
  ['snow', 'snow'],
  ['ice', 'ice'],
  ['cliff', 'cliff'],
  ['wall', 'wall'],
  ['mesa', 'wall'],
  ['spire', 'wall'],
  ['obsidian', 'wall'],
  ['architecture', 'wall'],
  ['stone', 'wall'],
  ['floor', 'floor'],
  ['basin', 'floor'],
  ['ground', 'ground'],
  ['mineral', 'ground'],
  ['stream', 'ground'],
  ['crystal', 'prop'],
  ['violet', 'prop'],
  ['prop', 'prop'],
];

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function imageSize(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xc0 || m === 0xc1 || m === 0xc2) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (!(len >= 2)) break;
      i += 2 + len;
    }
  }
  return null;
}

export function pngHeader(w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(w, 8);
  ihdr.writeUInt32BE(h, 12);
  ihdr[20] = 8;
  return Buffer.concat([sig, ihdr, Buffer.from(String(w) + 'x' + h + ':' + Math.random())]);
}

export function tileMetresOf(slot) {
  const n = Number(slot.tileMetres ?? slot.tileMeters);
  return n > 0 ? n : null;
}

export function inferSurfaceClass(slot) {
  if (slot.surfaceClass) return String(slot.surfaceClass);
  const hay = `${slot.id || ''} ${slot.role || ''}`.toLowerCase();
  for (const [word, cls] of CLASS_WORDS) if (hay.includes(word)) return cls;
  return 'prop';
}

export function isLargeClass(surfaceClass) {
  return LARGE_CLASSES.has(surfaceClass);
}

function raisedFloor(given, floor, name, label) {
  if (given == null || given === '') return { ok: true, value: floor };
  const n = Number(given);
  if (!(n >= floor)) {
    return {
      ok: false,
      message: `${name} ${given} is below ${floor}. The ${label} cannot be lowered.`,
    };
  }
  return { ok: true, value: n };
}

export function limitLock(config) {
  const cfg = config || {};
  const checks = [
    raisedFloor(cfg.minPxPerM, MIN_PX_PER_M, 'minPxPerM', 'house texel floor'),
    raisedFloor(cfg.minLargeVariants, MIN_LARGE_VARIANTS, 'minLargeVariants', 'large-surface variant floor'),
    raisedFloor(cfg.minPropVariants, MIN_PROP_VARIANTS, 'minPropVariants', 'prop variant floor'),
  ];
  const blocked = checks.filter((row) => !row.ok);
  if (blocked.length) return { ok: false, message: blocked.map((row) => row.message).join(' ') };
  return {
    ok: true,
    minPxPerM: checks[0].value,
    minLargeVariants: checks[1].value,
    minPropVariants: checks[2].value,
  };
}

export function nearestGroundDistance(eyeH = EYE_H, fovY = FOV_Y) {
  const pitch = Math.atan2(LOOK_DROP, LOOK_AHEAD);
  const down = pitch + fovY / 2;
  return eyeH / Math.sin(down);
}

export function magnification(pxPerM, distance = nearestGroundDistance(), viewH = PHONE_VIEW_H, fovY = FOV_Y) {
  if (!(pxPerM > 0) || !(distance > 0)) return Infinity;
  const focal = (viewH / 2) / Math.tan(fovY / 2);
  return (focal / distance) / pxPerM;
}

export function triangleStretch(p0, p1, p2, uv0, uv1, uv2, texW, texH) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const du1 = (uv1[0] - uv0[0]) * texW;
  const dv1 = (uv1[1] - uv0[1]) * texH;
  const du2 = (uv2[0] - uv0[0]) * texW;
  const dv2 = (uv2[1] - uv0[1]) * texH;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const dpdu = [
    (e1[0] * dv2 + e2[0] * -dv1) * inv,
    (e1[1] * dv2 + e2[1] * -dv1) * inv,
    (e1[2] * dv2 + e2[2] * -dv1) * inv,
  ];
  const dpdv = [
    (e1[0] * -du2 + e2[0] * du1) * inv,
    (e1[1] * -du2 + e2[1] * du1) * inv,
    (e1[2] * -du2 + e2[2] * du1) * inv,
  ];
  const lu = Math.hypot(...dpdu);
  const lv = Math.hypot(...dpdv);
  if (!(lu > 1e-12) || !(lv > 1e-12)) return Infinity;
  return Math.max(lu, lv) / Math.min(lu, lv);
}

export function triangleArea(p0, p1, p2) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const c = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  return 0.5 * Math.hypot(...c);
}

export function stretchP99(rows) {
  const usable = rows.filter((t) => t.area > 0 && Number.isFinite(t.stretch));
  if (!usable.length) return null;
  usable.sort((a, b) => a.stretch - b.stretch);
  const total = usable.reduce((s, t) => s + t.area, 0);
  let acc = 0;
  for (const t of usable) {
    acc += t.area;
    if (acc >= total * 0.99) return t.stretch;
  }
  return usable[usable.length - 1].stretch;
}

function dominantUv(p, n, tileMetres) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  const m = tileMetres;
  if (ay >= ax && ay >= az) return [p[0] / m, p[2] / m];
  if (ax >= az) return [p[2] / m, p[1] / m];
  return [p[0] / m, p[1] / m];
}

// Packed stride-8 mesh: xyz, mat, normal xyz, unused uv. The shader samples world position.
export function stretchByMaterial(verts, tileByMat, texByMat, stride = 8) {
  const buckets = new Map();
  const nTris = Math.floor(verts.length / (stride * 3));
  for (let t = 0; t < nTris; t++) {
    const base = t * stride * 3;
    const mat = verts[base + 3];
    const tile = tileByMat.get(mat);
    const tex = texByMat.get(mat);
    if (!(tile > 0) || !tex) continue;
    const at = (k) => {
      const o = base + k * stride;
      return {
        p: [verts[o], verts[o + 1], verts[o + 2]],
        n: [verts[o + 4], verts[o + 5], verts[o + 6]],
      };
    };
    const a = at(0), b = at(1), c = at(2);
    const uv = (v) => dominantUv(v.p, v.n, tile);
    const stretch = triangleStretch(a.p, b.p, c.p, uv(a), uv(b), uv(c), tex.w, tex.h);
    const area = triangleArea(a.p, b.p, c.p);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push({ stretch, area });
  }
  const out = new Map();
  for (const [mat, rows] of buckets) out.set(mat, stretchP99(rows));
  return out;
}

export function samplerAudit(pageSource) {
  const src = pageSource || '';
  const asksAniso = /maxAnisotropy\s*:/.test(src) && /Math\.min\(\s*[2-9]|maxAnisotropy\s*:\s*[2-9]/.test(src);
  const mips = /mipmapFilter\s*:\s*['"]linear['"]/.test(src);
  const chain = /mipLevelCount|loadCanvasMips/.test(src);
  return {
    asksAniso,
    mips,
    chain,
    ok: asksAniso && mips && chain,
  };
}

function variantList(slot) {
  if (Array.isArray(slot.files) && slot.files.length) return slot.files;
  if (slot.file) return [{ file: slot.file, sha256: slot.sha256 || null, native: slot.resolution || slot.native || null }];
  return [];
}

function readVariant(entry, files) {
  const name = typeof entry === 'string' ? entry : entry.file;
  const bytes = files[name];
  const declaredNative = entry && entry.native ? entry.native : null;
  const size = bytes ? imageSize(bytes) : null;
  const hash = bytes ? sha256(bytes) : null;
  const wantHash = entry && entry.sha256 ? entry.sha256 : null;
  let upscaled = false;
  if (size && declaredNative && (size.w > declaredNative[0] || size.h > declaredNative[1])) upscaled = true;
  if (size && entry && entry.resolution && (size.w > entry.resolution[0] || size.h > entry.resolution[1])) upscaled = true;
  const hashMismatch = !!(wantHash && hash && wantHash !== hash);
  return { name, bytes: !!bytes, size, hash, wantHash, hashMismatch, upscaled, declaredNative };
}

export function gateSlot(slot, files, opts = {}) {
  const surfaceClass = inferSurfaceClass(slot);
  const large = isLargeClass(surfaceClass);
  const minPx = opts.minPxPerM;
  const reasons = [];
  const variants = variantList(slot).map((entry) => readVariant(entry, files));
  const present = variants.filter((v) => v.bytes && v.size);
  const unique = [];
  const seen = new Set();
  for (const v of present) {
    if (seen.has(v.hash)) continue;
    seen.add(v.hash);
    unique.push(v);
  }
  if (!variants.length) reasons.push('no Imagine file');
  for (const v of variants) {
    if (!v.bytes) reasons.push(`missing file ${v.name}`);
    else if (!v.size) reasons.push(`unreadable image ${v.name}`);
    if (v.upscaled) {
      const stored = (v.declaredNative || []).join('x');
      reasons.push(`upscaled ${v.name}: file ${v.size.w}x${v.size.h} is larger than stored native ${stored}`);
    }
    if (v.hashMismatch) reasons.push(`provenance sha256 mismatch ${v.name}`);
  }
  const native = unique[0]?.size || null;
  const tileMetres = tileMetresOf(slot) ?? Number.NaN;
  let pxPerM = null;
  if (native && tileMetres > 0) {
    pxPerM = native.w / tileMetres;
    const short = Math.min(native.w, native.h) / tileMetres;
    if (pxPerM < minPx || short < minPx) {
      reasons.push(`${Math.round(Math.min(pxPerM, short))} px/m is under ${minPx}`);
    }
  } else if (variants.length) {
    reasons.push('no tileMetres');
  }
  const need = large
    ? (opts.minLargeVariants ?? MIN_LARGE_VARIANTS)
    : (opts.minPropVariants ?? MIN_PROP_VARIANTS);
  if (unique.length < need) reasons.push(`variants ${unique.length} < ${need}`);
  let mag = null;
  if (pxPerM) {
    mag = magnification(pxPerM);
    if (mag > MAG_MAX) reasons.push(`magnification ${mag.toFixed(2)} > ${MAG_MAX}`);
  }
  const stretch = opts.stretchP99 == null ? null : opts.stretchP99;
  if (stretch != null && stretch > STRETCH_P99_MAX) {
    reasons.push(`stretch p99 ${stretch.toFixed(2)} > ${STRETCH_P99_MAX}`);
  }
  if (opts.sampler && !opts.sampler.ok) reasons.push('sampler missing full mips or anisotropic filtering');
  return {
    id: slot.id,
    surfaceClass,
    large,
    native,
    tileMetres: tileMetres > 0 ? tileMetres : null,
    pxPerM,
    variants: unique.length,
    stretch,
    magnification: mag,
    pass: reasons.length === 0,
    reasons,
  };
}

export function gateBiome(config, files, opts = {}) {
  const lock = limitLock(config || {});
  if (!lock.ok) {
    return {
      ok: false,
      label: 'HOLD',
      release: false,
      message: lock.message,
      rows: [],
      minPxPerM: MIN_PX_PER_M,
      minLargeVariants: MIN_LARGE_VARIANTS,
      minPropVariants: MIN_PROP_VARIANTS,
    };
  }
  const sampler = opts.pageSource != null ? samplerAudit(opts.pageSource) : (opts.sampler || { ok: true });
  const stretchMap = opts.stretchById || new Map();
  const rows = (config.materials || []).filter((slot) => slot && (slot.file || (slot.files && slot.files.length) || slot.tileMetres)).map((slot) => {
    if (slot.file == null && !(slot.files && slot.files.length)) {
      return {
        id: slot.id,
        surfaceClass: inferSurfaceClass(slot),
        native: null,
        tileMetres: slot.tileMetres,
        pxPerM: null,
        variants: 0,
        stretch: null,
        pass: false,
        reasons: ['no Imagine file'],
      };
    }
    return gateSlot(slot, files, {
      minPxPerM: lock.minPxPerM,
      minLargeVariants: lock.minLargeVariants,
      minPropVariants: lock.minPropVariants,
      sampler,
      stretchP99: stretchMap.get(slot.id) ?? null,
    });
  });
  const failed = rows.filter((r) => !r.pass);
  const message = failed.length
    ? failed.map((r) => `${r.id}: ${r.reasons.join('; ')}`).join(' | ')
    : 'texel gate pass';
  return {
    ok: failed.length === 0,
    label: failed.length ? 'HOLD' : 'PASS',
    release: false,
    message: failed.length ? `HOLD texel gate: ${message}` : message,
    rows,
    minPxPerM: lock.minPxPerM,
    minLargeVariants: lock.minLargeVariants,
    minPropVariants: lock.minPropVariants,
    sampler,
  };
}

export function formatRow(row) {
  const wh = row.native ? `${row.native.w}x${row.native.h}` : '—';
  const tile = row.tileMetres == null ? '—' : String(row.tileMetres);
  const px = row.pxPerM == null ? '—' : String(Math.round(row.pxPerM));
  const stretch = row.stretch == null ? '—' : row.stretch.toFixed(2);
  const verdict = row.pass ? 'PASS' : 'FAIL';
  return { material: row.id, native: wh, tileMetres: tile, pxPerM: px, variants: row.variants, stretch, verdict, reasons: row.reasons || [] };
}

export function formatTable(result) {
  const lines = ['material | native WxH | tile m | px/m | variants | max stretch | verdict'];
  for (const row of result.rows) {
    const r = formatRow(row);
    lines.push(`${r.material} | ${r.native} | ${r.tileMetres} | ${r.pxPerM} | ${r.variants} | ${r.stretch} | ${r.verdict}`);
  }
  if (!result.ok) lines.push(result.message);
  return lines.join('\n');
}

function crystalMatTiles() {
  return new Map([
    [0, { id: 'ground', tile: 3, cls: 'ground' }],
    [1, { id: 'violet', tile: 0.5, cls: 'prop' }],
    [2, { id: 'crystal', tile: 0.5, cls: 'prop' }],
    [3, { id: 'architecture', tile: 2, cls: 'wall' }],
    [4, { id: 'stream', tile: 2, cls: 'ground' }],
    [6, { id: 'obsidian-wall', tile: 2, cls: 'wall' }],
  ]);
}

function measurePacked(verts, tiles, sizes) {
  const tileByMat = new Map();
  const texByMat = new Map();
  const idOf = new Map();
  for (const [mat, info] of tiles) {
    tileByMat.set(mat, info.tile);
    idOf.set(mat, info.id);
    const size = sizes.get(info.id);
    if (size) texByMat.set(mat, size);
  }
  const byMat = stretchByMaterial(verts, tileByMat, texByMat);
  const byId = new Map();
  for (const [mat, p99] of byMat) {
    const id = idOf.get(mat);
    if (!id || p99 == null) continue;
    const prev = byId.get(id);
    byId.set(id, prev == null ? p99 : Math.max(prev, p99));
  }
  return byId;
}

export async function auditBiome(biome, dirs) {
  const webgpu = dirs.webgpu;
  const repo = dirs.repo;
  if (biome === 'crystal') return auditCrystal(webgpu);
  if (biome === 'reach') return auditReach(webgpu, repo);
  if (biome === 'glacier') return auditGlacier(webgpu);
  const cfgPath = path.join(webgpu, biome, 'biome.factory.json');
  if (!fs.existsSync(cfgPath)) {
    return { ok: false, label: 'HOLD', release: false, message: `HOLD texel gate: unknown biome ${biome}`, rows: [] };
  }
  const config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  return gateBiome(config, {}, {});
}

async function auditCrystal(webgpu) {
  const cfg = JSON.parse(fs.readFileSync(path.join(webgpu, 'crystal/biome.factory.json'), 'utf8'));
  const dir = path.join(webgpu, 'biome-factory/fixtures/materials-v2');
  const page = fs.readFileSync(path.join(webgpu, 'crystal/crystal.js'), 'utf8');
  const files = {};
  const sizes = new Map();
  for (const slot of cfg.materials || []) {
    if (!slot.file) continue;
    const p = path.join(dir, slot.file);
    if (!fs.existsSync(p)) continue;
    files[slot.file] = fs.readFileSync(p);
    sizes.set(slot.id, imageSize(files[slot.file]));
  }
  let stretchById = new Map();
  try {
    const { buildWorld } = await import('../crystal/world.js');
    const world = buildWorld();
    const protos = Object.values(world.instances || {}).map((slot) => slot.proto).filter(Boolean);
    const extra = protos.reduce((n, proto) => n + proto.length, 0);
    const all = new Float32Array(world.verts.length + extra);
    all.set(world.verts);
    let offset = world.verts.length;
    for (const proto of protos) {
      all.set(proto, offset);
      offset += proto.length;
    }
    stretchById = measurePacked(all, crystalMatTiles(), sizes);
  } catch (err) {
    stretchById = new Map();
    cfg._stretchError = String(err && err.message || err);
  }
  const result = gateBiome(cfg, files, { pageSource: page, stretchById });
  if (cfg._stretchError) result.stretchError = cfg._stretchError;
  return result;
}

async function auditReach(webgpu, repo) {
  const cfg = JSON.parse(fs.readFileSync(path.join(webgpu, 'reach/biome.factory.json'), 'utf8'));
  const page = fs.readFileSync(path.join(webgpu, 'reach/reach.js'), 'utf8');
  const files = {};
  const sizes = new Map();
  for (const slot of cfg.materials || []) {
    const src = slot.source ? path.resolve(repo, slot.source) : null;
    if (!src || !fs.existsSync(src)) continue;
    files[slot.file] = fs.readFileSync(src);
    sizes.set(slot.id, imageSize(files[slot.file]));
  }
  let stretch = null;
  try {
    const { buildWindow } = await import('../engine/bricks/terrain-clipmap.js');
    const { makeHeight } = await import('../engine/bricks/heightfield.js');
    const { HEIGHT_SPEC, TILE_M } = await import('../reach/biome.js');
    const mesh = buildWindow(0, 0, makeHeight(HEIGHT_SPEC)).levels[0];
    const size = sizes.get('floor') || { w: 1024, h: 1024 };
    const rows = [];
    const { pos, idx } = mesh;
    const step = Math.max(1, Math.floor(idx.length / 3 / 8000));
    for (let t = 0; t < idx.length; t += 3 * step) {
      const ia = idx[t] * 3, ib = idx[t + 1] * 3, ic = idx[t + 2] * 3;
      const p0 = [pos[ia], pos[ia + 1], pos[ia + 2]];
      const p1 = [pos[ib], pos[ib + 1], pos[ib + 2]];
      const p2 = [pos[ic], pos[ic + 1], pos[ic + 2]];
      const uv = (p) => [p[0] / TILE_M, p[2] / TILE_M];
      rows.push({
        stretch: triangleStretch(p0, p1, p2, uv(p0), uv(p1), uv(p2), size.w, size.h),
        area: triangleArea(p0, p1, p2),
      });
    }
    stretch = stretchP99(rows);
  } catch {
    stretch = null;
  }
  const stretchById = new Map();
  if (stretch != null) stretchById.set('floor', stretch);
  return gateBiome(cfg, files, { pageSource: page, stretchById });
}

async function auditGlacier(webgpu) {
  const page = fs.readFileSync(path.join(webgpu, 'glacier/glacier.js'), 'utf8')
    + '\n' + fs.readFileSync(path.join(webgpu, 'glacier/albedo.js'), 'utf8');
  const { IMAGINE } = await import('../glacier/texel-density.js');
  const texRoot = path.join(webgpu, 'glacier');
  const live = IMAGINE.filter((spec) => spec && !spec.equirect && spec.tileMetres > 0 && spec.files && spec.files.length);
  const slots = live.map((spec) => ({
    id: spec.id,
    surfaceClass: spec.surfaceClass,
    tileMetres: spec.tileMetres,
    files: spec.files.map((file) => {
      const buf = fs.readFileSync(path.join(texRoot, file));
      return {
        file,
        sha256: sha256(buf),
        native: (() => {
          const size = imageSize(buf);
          return size ? [size.w, size.h] : null;
        })(),
      };
    }),
  }));
  const files = {};
  for (const slot of slots) {
    for (const entry of slot.files) {
      files[entry.file] = fs.readFileSync(path.join(texRoot, entry.file));
    }
  }
  let stretchById = new Map();
  try {
    const { buildWorld } = await import('../glacier/world.js');
    const world = buildWorld();
    const tileByMat = new Map();
    const texByMat = new Map();
    const idOf = new Map();
    for (const spec of live) {
      const buf = files[spec.files[0]];
      const size = imageSize(buf);
      for (const mat of spec.worldMats || []) {
        tileByMat.set(mat, spec.tileMetres);
        texByMat.set(mat, size);
        idOf.set(mat, spec.id);
      }
    }
    const byMat = stretchByMaterial(world.verts, tileByMat, texByMat);
    for (const [mat, p99] of byMat) {
      const id = idOf.get(mat);
      if (!id || p99 == null) continue;
      const prev = stretchById.get(id);
      stretchById.set(id, prev == null ? p99 : Math.max(prev, p99));
    }
  } catch {
    stretchById = new Map();
  }
  const config = { id: 'glacier-abyss', materials: slots };
  return gateBiome(config, files, { pageSource: page, stretchById });
}

function printAudit(biome, result) {
  console.log(`# ${biome}  min ${MIN_PX_PER_M} px/m`);
  console.log(formatTable(result));
}

async function main() {
  const args = process.argv.slice(2);
  const here = path.dirname(new URL(import.meta.url).pathname);
  const webgpu = path.resolve(here, '..');
  const repo = path.resolve(webgpu, '../..');
  const biome = args.includes('--biome') ? args[args.indexOf('--biome') + 1] : '';
  const all = args.includes('--all') || !biome;
  const names = all ? ['crystal', 'glacier', 'reach'] : [biome];
  let failed = false;
  for (const name of names) {
    const result = await auditBiome(name, { webgpu, repo });
    printAudit(name, result);
    if (!result.ok) failed = true;
  }
  process.exit(failed ? 2 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
