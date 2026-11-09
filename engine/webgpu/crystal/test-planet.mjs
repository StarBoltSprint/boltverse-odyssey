import assert from 'node:assert/strict';
import { createPlanetMesh, prepareSurfaceRGBA, frontYaw, planetCenter } from '../engine/bricks/planet-sphere.js';
import { PLANET } from './biome.js';

const mesh = createPlanetMesh(8, 12);
assert.equal(mesh.length % 6, 0);
const n = mesh.length / 6;
let north = 0, south = 0;
for (let i = 0; i < n; i++) {
  const y = mesh[i * 6 + 1];
  if (y > 0.98) north++;
  if (y < -0.98) south++;
  const p = [mesh[i * 6], mesh[i * 6 + 1], mesh[i * 6 + 2]];
  const len = Math.hypot(...p);
  assert.ok(Math.abs(len - 1) < 1e-4, len);
}
assert.ok(north > 0 && south > 0);

const w = 8, h = 4, band = 2;
const data = new Uint8ClampedArray(w * h * 4);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = (y * w + x) * 4;
  data[i] = x * 10; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255;
}
const out = prepareSurfaceRGBA(data, w, h, band, 1);
const left = out[0];
const right = out[(w - 1) * 4];
assert.equal(left, right, 'seam columns differ ' + left + ' ' + right);
const c = planetCenter(PLANET.dir, PLANET.distance);
const dist = Math.hypot(...c);
assert.ok(Math.abs(dist - PLANET.distance) < 1e-3);
assert.ok(Number.isFinite(frontYaw(PLANET.dir)));
console.log('PASS planet', { verts: n, seam: left, dist: +dist.toFixed(1) });
