// Blocking texel gate. 2048 native Imagine px per metre. UV stretch stays ≤ 1.3.
// A 1024 px image at 1 m must fail. Do not upscale. Do not invent pixels.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PLANET } from './biome.js';
import { buildWorld, pathX } from './world.js';
import {
  IMAGINE, MIN_PX_PER_M, MAX_UV_STRETCH, VARIANT_METRES, tileMetres, pxPerMetre,
} from './texel-density.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const NEAR_M = 40;

function jpegSize(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error('jpeg size missing');
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : null;
};

function triArea(a, b, c) {
  const n = cross(sub(b, a), sub(c, a));
  return 0.5 * Math.hypot(n[0], n[1], n[2]);
}

function axesFor(normal) {
  const ax = Math.abs(normal[0]);
  const ay = Math.abs(normal[1]);
  const az = Math.abs(normal[2]);
  if (ay >= ax && ay >= az) return [[1, 0, 0], [0, 0, 1]];
  if (ax >= az) return [[0, 0, 1], [0, 1, 0]];
  return [[1, 0, 0], [0, 1, 0]];
}

// Ratio of the two singular values of the world-metre UV used by the shader.
function triStretch(a, b, c, tileM) {
  const n = norm(cross(sub(b, a), sub(c, a)));
  if (!n) return null;
  const t1 = norm(sub(b, a));
  if (!t1) return null;
  const e2 = sub(c, a);
  const t2 = norm(sub(e2, t1.map((v) => v * dot(e2, t1))));
  if (!t2) return null;
  const [u, v] = axesFor(n);
  const col = (t) => [dot(t, u) / tileM, dot(t, v) / tileM];
  const j1 = col(t1);
  const j2 = col(t2);
  const b00 = j1[0] * j1[0] + j1[1] * j1[1];
  const b01 = j1[0] * j2[0] + j1[1] * j2[1];
  const b11 = j2[0] * j2[0] + j2[1] * j2[1];
  const tr = b00 + b11;
  const det = b00 * b11 - b01 * b01;
  const disc = Math.max(0, tr * tr - 4 * det);
  const s1 = Math.sqrt(Math.max(0, (tr + Math.sqrt(disc)) / 2));
  const s2 = Math.sqrt(Math.max(0, (tr - Math.sqrt(disc)) / 2));
  if (!(s2 > 1e-8)) return null;
  return s1 / s2;
}

function eachTri(verts, fn) {
  for (let i = 0; i + 24 <= verts.length; i += 24) {
    const mat = Math.round(verts[i + 3]);
    const a = [verts[i], verts[i + 1], verts[i + 2]];
    const b = [verts[i + 8], verts[i + 9], verts[i + 10]];
    const c = [verts[i + 16], verts[i + 17], verts[i + 18]];
    fn(mat, a, b, c);
  }
}

function scaledTri(proto, sx, sy, sz, fn) {
  for (let i = 0; i + 24 <= proto.length; i += 24) {
    const a = [proto[i] * sx, proto[i + 1] * sy, proto[i + 2] * sz];
    const b = [proto[i + 8] * sx, proto[i + 9] * sy, proto[i + 10] * sz];
    const c = [proto[i + 16] * sx, proto[i + 17] * sy, proto[i + 18] * sz];
    fn(a, b, c);
  }
}

function near(a, b, c) {
  const x = (a[0] + b[0] + c[0]) / 3 - pathX(0);
  const z = (a[2] + b[2] + c[2]) / 3;
  return x * x + z * z <= NEAR_M * NEAR_M;
}

function cover(spec, world, tileM) {
  let area = 0;
  let nearArea = 0;
  let stretch = 1;
  const mats = new Set(spec.worldMats || []);
  if (!spec.equirect) {
    eachTri(world.verts, (mat, a, b, c) => {
      if (!mats.has(mat)) return;
      const s = triArea(a, b, c);
      area += s;
      if (near(a, b, c)) nearArea += s;
      const k = triStretch(a, b, c, tileM);
      if (k > stretch) stretch = k;
    });
    for (const name of spec.instances || []) {
      const slot = world.instances[name];
      const data = slot.data;
      const count = data.length / 8;
      for (let n = 0; n < count; n++) {
        const o = n * 8;
        const origin = [data[o], data[o + 1], data[o + 2]];
        scaledTri(slot.proto, data[o + 4], data[o + 5], data[o + 6], (a, b, c) => {
          const s = triArea(a, b, c);
          area += s;
          const wa = [a[0] + origin[0], a[1] + origin[1], a[2] + origin[2]];
          const wb = [b[0] + origin[0], b[1] + origin[1], b[2] + origin[2]];
          const wc = [c[0] + origin[0], c[1] + origin[1], c[2] + origin[2]];
          if (near(wa, wb, wc)) nearArea += s;
          const k = triStretch(a, b, c, tileM);
          if (k > stretch) stretch = k;
        });
      }
    }
  }
  return { area, nearArea, stretch };
}

function planetCover() {
  const r = PLANET.radius;
  const area = 4 * Math.PI * r * r;
  // Equirectangular: u circles the parallel, v runs pole to pole.
  // At the equator one texel-row is twice as long in the world as a texel-column.
  const tileU = 2 * Math.PI * r;
  const tileV = Math.PI * r;
  const stretch = tileU / tileV;
  return { area, nearArea: 0, stretch, tileU, tileV };
}

function judge(nativeMin, metres, stretch) {
  const px = pxPerMetre(nativeMin, metres);
  const density = px >= MIN_PX_PER_M;
  const shape = stretch <= MAX_UV_STRETCH;
  return { px, density, shape, pass: density && shape };
}

function variantsFor(area) {
  return Math.ceil(area / (VARIANT_METRES * VARIANT_METRES));
}

let fail = 0;
const bad = (m) => { console.error('FAIL', m); fail++; };

if (MIN_PX_PER_M !== 2048) bad('texel minimum moved ' + MIN_PX_PER_M);
if (MAX_UV_STRETCH !== 1.3) bad('stretch limit moved ' + MAX_UV_STRETCH);

const control = judge(1024, 1, 1);
if (control.pass || !(control.px < MIN_PX_PER_M)) bad('1024 px at 1 m did not fail ' + control.px.toFixed(1));
const exact = judge(1024, 0.5, 1);
if (!exact.pass || exact.px !== 2048) bad('1024 px at 0.5 m is the legal line ' + exact.px);
const loose = judge(2048, 0.5, 1.31);
if (loose.pass) bad('stretch 1.31 did not fail');

const world = buildWorld();
const rows = [];
for (const spec of IMAGINE) {
  const buf = fs.readFileSync(path.join(here, spec.file));
  const native = jpegSize(buf);
  const nativeMin = Math.min(native.w, native.h);
  let metres;
  let stretch;
  let area;
  let nearArea;
  if (spec.equirect) {
    const planet = planetCover();
    metres = Math.max(planet.tileU, planet.tileV);
    stretch = planet.stretch;
    area = planet.area;
    nearArea = planet.nearArea;
  } else {
    const repeats = spec.scales.map((s) => s.repeatsPerM);
    metres = tileMetres(Math.min(...repeats));
    const covered = cover(spec, world, metres);
    stretch = covered.stretch;
    area = covered.area;
    nearArea = covered.nearArea;
  }
  const scored = judge(nativeMin, metres, stretch);
  const variants = variantsFor(area);
  const nearVariants = variantsFor(nearArea);
  rows.push({
    material: spec.id,
    role: spec.role,
    native: native.w + '×' + native.h,
    tileM: +metres.toFixed(3),
    pxPerM: +scored.px.toFixed(2),
    maxStretch: +stretch.toFixed(3),
    verdict: scored.pass ? 'PASS' : 'FAIL',
    variants,
    nearVariants,
    have: 1,
  });
  if (!scored.pass) bad(spec.id + ' texel ' + scored.px.toFixed(1) + ' px/m stretch ' + stretch.toFixed(2));
}

console.log('limit px/m ' + MIN_PX_PER_M + '  stretch ≤ ' + MAX_UV_STRETCH);
console.log('negative control: 1024 px at 1 m → ' + control.px.toFixed(0) + ' px/m FAIL');
console.log('');
console.log('| material | native WxH | tile metres | px/m | max stretch | verdict |');
console.log('| --- | --- | ---: | ---: | ---: | --- |');
for (const row of rows) {
  console.log(`| ${row.material} | ${row.native} | ${row.tileM} | ${row.pxPerM} | ${row.maxStretch} | ${row.verdict} |`);
}
console.log('');
console.log('Distinct 0.5 m Imagine variants still required (1024×1024 each, no upscale, no procedural fill):');
for (const row of rows) {
  console.log(`${row.material}: ${row.variants} for the whole surface, ${row.nearVariants} within ${NEAR_M} m of the chase start. Have ${row.have}.`);
}

if (fail) process.exit(1);
console.log('PASS texel-density');
