// Blocking texel gate. Aligns with biome-factory/texel-gate.mjs (PR 237):
// 2048 px/m, area-weighted stretch p99, on-screen magnification, variant count.
// A 1024 px image at 1 m must fail. Large surfaces here require 4 variants (the factory floor is 3).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FOV_Y } from '../engine/bricks/follow-cam.js';
import { buildWorld } from './world.js';
import { PLANET } from './biome.js';
import { IMAGINE, MIN_PX_PER_M, MAX_UV_STRETCH, MAG_MAX, MIN_LARGE_VARIANTS, TILE_M } from './texel-density.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PHONE_H = 1280;

function imageSize(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xc0 || m === 0xc1 || m === 0xc2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (!(len >= 2)) break;
      i += 2 + len;
    }
  }
  return null;
}

function triangleStretch(p0, p1, p2, uv0, uv1, uv2, texW, texH) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const du1 = (uv1[0] - uv0[0]) * texW;
  const dv1 = (uv1[1] - uv0[1]) * texH;
  const du2 = (uv2[0] - uv0[0]) * texW;
  const dv2 = (uv2[1] - uv0[1]) * texH;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const dpdu = [(e1[0] * dv2 + e2[0] * -dv1) * inv, (e1[1] * dv2 + e2[1] * -dv1) * inv, (e1[2] * dv2 + e2[2] * -dv1) * inv];
  const dpdv = [(e1[0] * -du2 + e2[0] * du1) * inv, (e1[1] * -du2 + e2[1] * du1) * inv, (e1[2] * -du2 + e2[2] * du1) * inv];
  const lu = Math.hypot(...dpdu);
  const lv = Math.hypot(...dpdv);
  if (!(lu > 1e-12) || !(lv > 1e-12)) return Infinity;
  return Math.max(lu, lv) / Math.min(lu, lv);
}

function triangleArea(p0, p1, p2) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const c = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  return 0.5 * Math.hypot(...c);
}

function stretchP99(rows) {
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

function nearestGroundDistance() {
  const pitch = Math.atan2(1.12 - 0.66, 2.35 + 2.2);
  const down = pitch + FOV_Y / 2;
  return 1.12 / Math.sin(down);
}

function magnification(pxPerM, distance = nearestGroundDistance()) {
  const focal = (PHONE_H / 2) / Math.tan(FOV_Y / 2);
  return (focal / distance) / pxPerM;
}

function geoNormal(a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(...n) || 1;
  return n.map((v) => v / l);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm(a) {
  const l = Math.hypot(...a);
  return l > 1e-12 ? a.map((v) => v / l) : null;
}

// Same frame the shader uses: orthonormal tangents on the geometric face. Repeats are 2 per metre.
function faceUv(p, n) {
  const helper = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t = norm(cross(helper, n));
  if (!t) return [0, 0];
  const b = norm(cross(n, t));
  if (!b) return [0, 0];
  return [dot(p, t) / TILE_M, dot(p, b) / TILE_M];
}

function faceStretch(verts, mats) {
  const rows = [];
  const want = new Set(mats);
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    if (!want.has(Math.round(verts[t + 3]))) continue;
    const P = (k) => [verts[t + k * 8], verts[t + k * 8 + 1], verts[t + k * 8 + 2]];
    const a = P(0);
    const b = P(1);
    const c = P(2);
    const n = geoNormal(a, b, c);
    rows.push({
      stretch: triangleStretch(a, b, c, faceUv(a, n), faceUv(b, n), faceUv(c, n), 1024, 1024),
      area: triangleArea(a, b, c),
    });
  }
  return stretchP99(rows);
}

function planetMag() {
  const focal = (PHONE_H / 2) / Math.tan(FOV_Y / 2);
  return (focal * 2 * Math.PI * PLANET.radius) / (PLANET.distance * 1024);
}

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

if (MIN_PX_PER_M !== 2048) bad('floor moved ' + MIN_PX_PER_M);
if (TILE_M !== 0.5) bad('0.5 m tile drifted ' + TILE_M);

const negPx = 1024 / 1;
if (!(negPx < MIN_PX_PER_M)) bad('1024 px at 1 m did not fail');
const legalPx = 1024 / 0.5;
if (legalPx !== 2048) bad('1024 px at 0.5 m is not 2048');
const stretched = triangleStretch([0, 0, 0], [1.31, 0, 0], [0, 1, 0], [0, 0], [1, 0], [0, 1], 1024, 1024);
if (!(stretched > MAX_UV_STRETCH)) bad('stretch 1.31 measured ' + stretched + ' and did not fail');

const page = fs.readFileSync(path.join(here, 'glacier.js'), 'utf8');
const asksAniso = /maxAnisotropy\s*:/.test(page) && /Math\.min\(\s*[2-9]/.test(page);
const mips = /mipmapFilter\s*:\s*['"]linear['"]/.test(page) && /mipLevelCount/.test(page);
if (!asksAniso || !mips) bad('sampler missing full mips or anisotropic filtering');

const world = buildWorld();
const rows = [];
for (const spec of IMAGINE) {
  const hashes = new Set();
  let native = null;
  for (const file of spec.files) {
    const buf = fs.readFileSync(path.join(here, file));
    const size = imageSize(buf);
    if (!size) bad(spec.id + ' unreadable ' + file);
    hashes.add(crypto.createHash('sha256').update(buf).digest('hex'));
    native = size;
  }
  const variants = hashes.size;
  let px = null;
  let mag = null;
  let stretch = null;
  let pass = true;
  const reasons = [];
  if (spec.equirect) {
    mag = planetMag();
    stretch = 2;
    if (mag > MAG_MAX) { pass = false; reasons.push('magnification ' + mag.toFixed(2)); }
  } else {
    const short = Math.min(native.w, native.h);
    px = short / spec.tileMetres;
    mag = magnification(px);
    stretch = faceStretch(world.verts, spec.worldMats);
    if (px < MIN_PX_PER_M) { pass = false; reasons.push(px.toFixed(0) + ' px/m'); }
    if (mag > MAG_MAX) { pass = false; reasons.push('magnification ' + mag.toFixed(2)); }
    if (stretch > MAX_UV_STRETCH) { pass = false; reasons.push('stretch ' + stretch.toFixed(2)); }
    if (variants < MIN_LARGE_VARIANTS) { pass = false; reasons.push('variants ' + variants); }
  }
  rows.push({
    material: spec.id,
    native: native.w + '×' + native.h,
    tileM: spec.equirect ? 'sky' : spec.tileMetres,
    pxPerM: px == null ? '—' : px.toFixed(0),
    mag: mag.toFixed(3),
    variants,
    stretch: stretch == null ? '—' : stretch.toFixed(3),
    verdict: pass ? 'PASS' : 'FAIL',
    reasons,
  });
  if (!pass) bad(spec.id + ' ' + reasons.join(', '));
}

console.log('limit ' + MIN_PX_PER_M + ' px/m, stretch p99 ≤ ' + MAX_UV_STRETCH + ', magnification ≤ ' + MAG_MAX + ', large variants ≥ ' + MIN_LARGE_VARIANTS);
console.log('negative control: 1024 px at 1 m → ' + negPx + ' px/m FAIL; measured stretch ' + stretched.toFixed(3) + ' > ' + MAX_UV_STRETCH + ' FAIL');
console.log('planet stretch 2.000 is the equirect equator ratio and is not the ground-tile limit; the sky body is gated on magnification');
console.log('');
console.log('| material | native WxH | tile metres | px/m | variants | magnification | stretch p99 | verdict |');
console.log('| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |');
for (const row of rows) {
  console.log(`| ${row.material} | ${row.native} | ${row.tileM} | ${row.pxPerM} | ${row.variants} | ${row.mag} | ${row.stretch} | ${row.verdict} |`);
}
if (fail) process.exit(1);
console.log('PASS texel-density');
