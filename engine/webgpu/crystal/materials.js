// Dedicated albedo slots. The environment key is not a texture.
import { shadeAt } from '../biome-factory/night-rig.js';
// Tile metres are the declared period, not a measured fit.
// The house sky is an equirectangular 2:1. A 16:9 plate is not that map.
export const CANDIDATE = 'materials-v2-r2';
// Each native 1024 image covers 0.5 m. 1024 / 0.5 = 2048 px/m. Do not widen a tile.
export const TILE_M = { ground: 0.5, wall: 0.5, crystal: 0.5, architecture: 0.5, violet: 0.5, stream: 0.5 };
export const VARIANTS = {
  ground: ['basalt-ground/v1.jpg', 'basalt-ground/v2.jpg', 'basalt-ground/v3.jpg', 'basalt-ground/v4.jpg'],
  wall: ['obsidian-wall/v1.jpg', 'obsidian-wall/v2.jpg', 'obsidian-wall/v3.jpg', 'obsidian-wall/v4.jpg'],
  crystal: ['cyan-facets/v1.jpg', 'cyan-facets/v2.jpg', 'cyan-facets/v3.jpg'],
  architecture: ['architectural-stone/v1.jpg', 'architectural-stone/v2.jpg', 'architectural-stone/v3.jpg', 'architectural-stone/v4.jpg'],
  violet: ['violet-mineral/v1.jpg', 'violet-mineral/v2.jpg', 'violet-mineral/v3.jpg'],
  stream: ['stream-surface/v1.jpg', 'stream-surface/v2.jpg', 'stream-surface/v3.jpg', 'stream-surface/v4.jpg'],
};
export const ALBEDO = {
  ground: VARIANTS.ground[0],
  wall: VARIANTS.wall[0],
  crystal: VARIANTS.crystal[0],
  architecture: VARIANTS.architecture[0],
  violet: VARIANTS.violet[0],
  stream: VARIANTS.stream[0],
};
export const MISSING_SLOTS = ['sky-equirect'];

export const SKY_HOUSE = {
  projection: 'equirectangular',
  aspect: '2:1',
  uv: 'lon = atan2(x, -z); lat = asin(y); uv = (lon / tau + 0.5, 0.5 - lat / pi)',
  repeatU: true,
  minSize: [2048, 1024],
  meadowExample: [4096, 2048],
  horizonRow: 0.5,
  wrapMeanAbsMax: 12,
};

export function materialGate(search) {
  const id = search?.get?.('candidate') || '';
  const base = {
    release: 'HOLD',
    keep: false,
    referenceIsTexture: false,
    missing: MISSING_SLOTS,
    sky: 'rejected-16x9-wrap',
  };
  if (id !== CANDIDATE) {
    return { ...base, render: false, candidate: null, reason: 'HOLD: no approved material release' };
  }
  return { ...base, render: true, candidate: id, reason: 'isolated candidate, visual KEEP not granted' };
}

export function repeatsAcross(metres, tile) {
  if (!(tile > 0) || tile > 16) throw new Error('missing scale ' + tile);
  return metres / tile;
}

export function shadeFactor(ndotl) {
  const n = Math.min(1, Math.max(0, ndotl));
  return shadeAt(n, 0).luma;
}

export function skyProjection(w, h, wrapMeanAbs) {
  const equirect = h > 0 && w === h * 2;
  const wrap = wrapMeanAbs <= SKY_HOUSE.wrapMeanAbsMax;
  let reason = 'ok';
  if (!equirect) reason = 'not-2:1-equirect';
  else if (!wrap) reason = 'horizontal-wrap-failed';
  return { ok: equirect && wrap, reason, w, h, wrapMeanAbs };
}
