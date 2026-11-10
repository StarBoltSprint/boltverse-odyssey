// Scores the crystal candidate with the engine texel gate. Limits are that file's.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildWorld } from './world.js';
import { TILE_M, VARIANTS } from './materials.js';
import { gateBiome, stretchByMaterial, formatTable, imageSize } from '../biome-factory/texel-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webgpu = path.resolve(here, '..');
const dir = path.join(webgpu, 'biome-factory/fixtures/materials-v2');
const page = fs.readFileSync(path.join(here, 'crystal.js'), 'utf8');

const CLASS = {
  ground: 'ground',
  wall: 'wall',
  architecture: 'wall',
  stream: 'ground',
  crystal: 'prop',
  violet: 'prop',
};
const MAT = { ground: 0, violet: 1, crystal: 2, architecture: 3, stream: 4, wall: 6 };

const files = {};
const materials = [];
const tileByMat = new Map();
const texByMat = new Map();
for (const [key, list] of Object.entries(VARIANTS)) {
  const id = key === 'wall' ? 'obsidian-wall' : key;
  for (const file of list) {
    const p = path.join(dir, file);
    files[file] = fs.readFileSync(p);
  }
  const size = imageSize(files[list[0]]);
  materials.push({
    id,
    surfaceClass: CLASS[key],
    tileMetres: TILE_M[key],
    file: list[0],
    files: list,
  });
  const mat = MAT[key];
  tileByMat.set(mat, TILE_M[key]);
  texByMat.set(mat, size);
}

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
const byMat = stretchByMaterial(all, tileByMat, texByMat);
const stretchById = new Map();
for (const [key, mat] of Object.entries(MAT)) {
  const id = key === 'wall' ? 'obsidian-wall' : key;
  const p99 = byMat.get(mat);
  if (p99 != null) stretchById.set(id, p99);
}

const result = gateBiome({ id: 'crystal-canyon', materials }, files, { pageSource: page, stretchById });
console.log(formatTable(result));
if (!result.ok) process.exit(1);
console.log('PASS texel-gate', JSON.stringify({ minPxPerM: result.minPxPerM, stretch: Object.fromEntries(stretchById) }));
