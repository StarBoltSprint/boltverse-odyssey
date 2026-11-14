// House texture rule. Blocking. The density floor is not a biome setting.
// SmiR: every Imagine texture is used at its native resolution. Never upscale, never stretch.
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { FOV_Y } from '../engine/bricks/follow-cam.js';

// Native Imagine pixels per metre. A config that sets a lower number is refused.
export const MIN_PX_PER_M = 2048;
export const STRETCH_P99_MAX = 1.3;
export const MAG_MAX = 1;
export const MIN_LARGE_VARIANTS = 4;
export const MIN_PROP_VARIANTS = 3;
export const PHONE_VIEW_H = 1280;

// Mirror row. Blocking. These three numbers are not a biome setting.
// Written before the run-32 trial. A 48 px mid-tile strip whose detail correlates
// with its own flip above 0.30, or a whole-still flip above 0.02, is a mirrored
// tile. Pearson is on the detail field (a radius-4 box mean removed) so a broad
// ice shade is not scored as a seam. r equal to the floor still passes; only r
// above the floor fails.
export const MIRROR_STRIP_PX = 48;
export const MIRROR_STRIP_R = 0.30;
export const MIRROR_FLIP_R = 0.02;
export const MIRROR_DETAIL_R = 4;

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

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function lumaOf(rgb, n, channels) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const r = rgb[o];
    const g = channels > 1 ? rgb[o + 1] : r;
    const b = channels > 2 ? rgb[o + 2] : r;
    out[i] = r * 0.2126 + g * 0.7152 + b * 0.0722;
  }
  return out;
}

function unfilterPng(raw, w, h, channels) {
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let src = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src++];
      const a = i >= bpp ? out[row + i - bpp] : 0;
      const b = y > 0 ? out[prev + i] : 0;
      const c = y > 0 && i >= bpp ? out[prev + i - bpp] : 0;
      let v = x;
      if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + Math.floor((a + b) / 2);
      else if (filter === 4) v = x + paeth(a, b, c);
      else if (filter !== 0) return null;
      out[row + i] = v & 255;
    }
  }
  return out;
}

function decodePng(buf) {
  if (!buf || buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  let o = 8;
  let w = 0;
  let h = 0;
  let color = -1;
  let depth = 0;
  let interlace = 0;
  const idat = [];
  while (o + 8 <= buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      color = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  const channels = color === 6 ? 4 : color === 2 ? 3 : color === 0 ? 1 : color === 4 ? 2 : 0;
  if (!(w > 0 && h > 0) || depth !== 8 || !channels || interlace !== 0) return null;
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }
  const pix = unfilterPng(raw, w, h, channels);
  if (!pix) return null;
  return { w, h, luma: lumaOf(pix, w * h, channels) };
}

function decodeJpeg(buf) {
  const size = imageSize(buf);
  if (!size) return null;
  const run = spawnSync('ffmpeg', [
    '-v', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
  ], { input: buf, maxBuffer: size.w * size.h * 3 + 65536 });
  if (run.status !== 0 || !run.stdout || run.stdout.length < size.w * size.h * 3) return null;
  return { w: size.w, h: size.h, luma: lumaOf(run.stdout, size.w * size.h, 3) };
}

export function decodeImage(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50) return decodePng(buf);
  if (buf[0] === 0xff && buf[1] === 0xd8) return decodeJpeg(buf);
  return null;
}

function pearson(a, b, n) {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n;
  mb /= n;
  let da = 0;
  let db = 0;
  let dot = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    da += xa * xa;
    db += xb * xb;
    dot += xa * xb;
  }
  if (!(da > 1e-12) || !(db > 1e-12)) return 0;
  return dot / Math.sqrt(da * db);
}

function detailField(luma, w, h, radius) {
  const iw = w + 1;
  const ii = new Float64Array(iw * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += luma[y * w + x];
      ii[(y + 1) * iw + (x + 1)] = ii[y * iw + (x + 1)] + row;
    }
  }
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const sum = ii[y1 * iw + x1] - ii[y0 * iw + x1] - ii[y1 * iw + x0] + ii[y0 * iw + x0];
      out[y * w + x] = luma[y * w + x] - sum / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

function stripMirror(field, w, h, axis) {
  const span = MIRROR_STRIP_PX;
  if (axis === 'x') {
    const x0 = Math.floor((w - span) / 2);
    const n = h * span;
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < span; i++) {
        a[y * span + i] = field[y * w + x0 + i];
        b[y * span + i] = field[y * w + x0 + (span - 1 - i)];
      }
    }
    return pearson(a, b, n);
  }
  const y0 = Math.floor((h - span) / 2);
  const n = span * w;
  const a = new Float64Array(n);
  const b = new Float64Array(n);
  for (let i = 0; i < span; i++) {
    for (let x = 0; x < w; x++) {
      a[i * w + x] = field[(y0 + i) * w + x];
      b[i * w + x] = field[(y0 + (span - 1 - i)) * w + x];
    }
  }
  return pearson(a, b, n);
}

function flipMirror(field, w, h, axis) {
  const n = w * h;
  const b = new Float64Array(n);
  if (axis === 'x') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) b[y * w + x] = field[y * w + (w - 1 - x)];
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) b[y * w + x] = field[(h - 1 - y) * w + x];
    }
  }
  return pearson(field, b, n);
}

// Blocking mirror row. strip r > 0.30 on X or Y, or global flip r > 0.02, fails.
export function mirrorCorrelation(luma, w, h) {
  const field = detailField(luma, w, h, MIRROR_DETAIL_R);
  const stripX = stripMirror(field, w, h, 'x');
  const stripY = stripMirror(field, w, h, 'y');
  const flipX = flipMirror(field, w, h, 'x');
  const flipY = flipMirror(field, w, h, 'y');
  const stripFail = stripX > MIRROR_STRIP_R || stripY > MIRROR_STRIP_R;
  const flipFail = flipX > MIRROR_FLIP_R || flipY > MIRROR_FLIP_R;
  return { stripX, stripY, flipX, flipY, pass: !stripFail && !flipFail };
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
  const mirrors = [];
  for (const v of present) {
    const img = decodeImage(files[v.name]);
    if (!img || img.w !== v.size.w || img.h !== v.size.h) {
      v.mirrorFail = true;
      reasons.push(`mirror unread ${v.name}`);
      continue;
    }
    const m = mirrorCorrelation(img.luma, img.w, img.h);
    mirrors.push({ name: v.name, ...m });
    if (!m.pass) {
      v.mirrorFail = true;
      const bits = [];
      if (m.stripX > MIRROR_STRIP_R || m.stripY > MIRROR_STRIP_R) {
        bits.push(`48px strip r ${m.stripX.toFixed(3)}/${m.stripY.toFixed(3)} > ${MIRROR_STRIP_R}`);
      }
      if (m.flipX > MIRROR_FLIP_R || m.flipY > MIRROR_FLIP_R) {
        bits.push(`flip r ${m.flipX.toFixed(3)}/${m.flipY.toFixed(3)} > ${MIRROR_FLIP_R}`);
      }
      reasons.push(`mirror ${v.name}: ${bits.join('; ')}`);
    }
  }
  const unique = [];
  const seen = new Set();
  for (const v of present) {
    if (v.mirrorFail) continue;
    if (seen.has(v.hash)) continue;
    seen.add(v.hash);
    unique.push(v);
  }
  const native = unique[0]?.size || present[0]?.size || null;
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
    mirrors,
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
  for (const row of result.rows) {
    for (const m of row.mirrors || []) {
      const verdict = m.pass ? 'PASS' : 'FAIL';
      lines.push(
        `mirror ${row.id} ${m.name} | strip ${m.stripX.toFixed(3)}/${m.stripY.toFixed(3)} | flip ${m.flipX.toFixed(3)}/${m.flipY.toFixed(3)} | ${verdict}`,
      );
    }
  }
  if (result.screen) lines.push(result.screen);
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
  const result = gateBiome(config, files, { pageSource: page, stretchById });
  try {
    const { foregroundReport } = await import('../glacier/screen-texel.mjs');
    const screen = foregroundReport();
    result.screen = screen.text;
    result.screenRows = screen.rows;
  } catch (err) {
    result.screen = `onscreen unread: ${err && err.message || err}`;
  }
  return result;
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
