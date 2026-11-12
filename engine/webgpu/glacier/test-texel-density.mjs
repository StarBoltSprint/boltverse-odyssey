// Blocking texel gate. Aligns with biome-factory/texel-gate.mjs (PR 237):
// 2048 px/m, area-weighted stretch p99, on-screen magnification, variant count.
// A 1024 px image at 1 m must fail. Large surfaces here require 4 variants (the factory floor is 3).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FOV_Y } from '../engine/bricks/follow-cam.js';
import { buildWorld } from './world.js';
import { MAT, PLANET } from './biome.js';
import { IMAGINE, MIN_PX_PER_M, MAX_UV_STRETCH, MAG_MAX, MIN_LARGE_VARIANTS, TILE_M } from './texel-density.js';
import {
  gateBiome, stretchByMaterial, formatTable, triangleStretch as gateStretch, triangleArea as gateArea,
  MIN_PX_PER_M as GATE_MIN, MIN_LARGE_VARIANTS as GATE_LARGE, MIN_PROP_VARIANTS, STRETCH_P99_MAX, MAG_MAX as GATE_MAG,
} from '../biome-factory/texel-gate.mjs';

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

if (GATE_MIN !== 2048 || GATE_LARGE !== 4 || MIN_PROP_VARIANTS !== 3 || STRETCH_P99_MAX !== 1.3 || GATE_MAG !== 1) {
  bad('PR 237 gate limits moved');
}

const world = buildWorld();
const fileBytes = {};
const materials = [];
for (const spec of IMAGINE) {
  if (spec.equirect) continue;
  const files = spec.files.map((file) => {
    const buf = fs.readFileSync(path.join(here, file));
    const size = imageSize(buf);
    if (!size) bad(spec.id + ' unreadable ' + file);
    const name = spec.id + '/' + path.basename(file);
    fileBytes[name] = buf;
    return { file: name, sha256: crypto.createHash('sha256').update(buf).digest('hex'), native: [size.w, size.h] };
  });
  materials.push({ id: spec.id, surfaceClass: spec.surfaceClass, tileMetres: spec.tileMetres, files });
}
const tex = { w: 1024, h: 1024 };
function groupStretch(mats) {
  const by = stretchByMaterial(
    world.verts,
    new Map(mats.map((m) => [m, 0.5])),
    new Map(mats.map((m) => [m, tex])),
  );
  let worst = 0;
  for (const s of by.values()) worst = Math.max(worst, s);
  return worst;
}
const stretchById = new Map([
  ['snow', groupStretch([MAT.snow, MAT.drift])],
  ['glacier-ice', groupStretch([MAT.wall, MAT.icicle, MAT.drift])],
  ['serac', groupStretch([MAT.mountain])],
  ['fall-ice', groupStretch([MAT.fall])],
  ['arch-ice', groupStretch([MAT.arch])],
]);
const page = fs.readFileSync(path.join(here, 'glacier.js'), 'utf8') + '\n' + fs.readFileSync(path.join(here, 'albedo.js'), 'utf8');
const result = gateBiome({ id: 'glacier-abyss', materials }, fileBytes, { pageSource: page, stretchById });
console.log(formatTable(result));
if (!result.ok) bad(result.message);

function dominantUv(p, n, m) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0] / m, p[2] / m];
  if (ax >= az) return [p[2] / m, p[1] / m];
  return [p[0] / m, p[1] / m];
}
function jacobian(p0, p1, p2, uv0, uv1, uv2) {
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const du1 = (uv1[0] - uv0[0]) * 1024, dv1 = (uv1[1] - uv0[1]) * 1024;
  const du2 = (uv2[0] - uv0[0]) * 1024, dv2 = (uv2[1] - uv0[1]) * 1024;
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const dpdu = [(e1[0] * dv2 - e2[0] * dv1) * inv, (e1[1] * dv2 - e2[1] * dv1) * inv, (e1[2] * dv2 - e2[2] * dv1) * inv];
  const dpdv = [(-e1[0] * du2 + e2[0] * du1) * inv, (-e1[1] * du2 + e2[1] * du1) * inv, (-e1[2] * du2 + e2[2] * du1) * inv];
  return { lu: Math.hypot(...dpdu), lv: Math.hypot(...dpdv) };
}
const v = world.verts;
const worst = [];
for (let t = 0; t + 24 <= v.length; t += 24) {
  const mat = Math.round(v[t + 3]);
  const P = (k) => [v[t + k * 8], v[t + k * 8 + 1], v[t + k * 8 + 2]];
  const N = (k) => [v[t + k * 8 + 4], v[t + k * 8 + 5], v[t + k * 8 + 6]];
  const a = P(0), b = P(1), c = P(2);
  const area = gateArea(a, b, c);
  if (!(area > 1e-4)) continue;
  const na = N(0);
  const uva = dominantUv(a, na, 0.5), uvb = dominantUv(b, N(1), 0.5), uvc = dominantUv(c, N(2), 0.5);
  const stretch = gateStretch(a, b, c, uva, uvb, uvc, 1024, 1024);
  if (worst.length < 3 || stretch > worst[worst.length - 1].stretch) {
    worst.push({ mat, stretch, area, p: a, n: na, J: jacobian(a, b, c, uva, uvb, uvc) });
    worst.sort((p, q) => q.stretch - p.stretch);
    worst.length = Math.min(3, worst.length);
  }
}
console.log('worst triangles under the gate UV (dominant axis, per-face normal):');
for (const w of worst) {
  const J = w.J;
  console.log(' mat', w.mat, 'stretch', w.stretch.toFixed(3), 'area', w.area.toFixed(2),
    'p', w.p.map((n) => n.toFixed(1)).join(','),
    'n', w.n.map((n) => n.toFixed(2)).join(','),
    J ? 'lu ' + J.lu.toExponential(2) + ' lv ' + J.lv.toExponential(2) : 'singular');
}

const planet = IMAGINE.find((s) => s.equirect);
const planetView = planetMag();
console.log('planet sky body (no sky class in the gate; not a prop): magnification ' + planetView.toFixed(3) + (planetView <= 1 ? ' PASS' : ' FAIL') + ', equirect stretch 2.000 reported separately');
if (!(planetView <= 1)) bad('planet magnification ' + planetView);

console.log('negative control: 1024 px at 1 m → ' + negPx + ' px/m FAIL; measured stretch ' + stretched.toFixed(3) + ' > ' + STRETCH_P99_MAX + ' FAIL');
if (fail) process.exit(1);
console.log('PASS texel-density');
