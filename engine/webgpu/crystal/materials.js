// Dedicated albedo slots. The environment key is not a texture.
// Tile metres are the declared period, not a measured fit.
// The house sky is an equirectangular 2:1. A 16:9 plate is not that map.
export const CANDIDATE = 'materials-v2-r2';
export const TILE_M = { ground: 3, wall: 2, crystal: 0.5, architecture: 2, violet: 0.5, stream: 2 };
export const ALBEDO = {
  ground: 'mineral-ground.jpg',
  wall: 'obsidian-wall.jpg',
  crystal: 'cyan-facets.jpg',
  architecture: 'architectural-stone.jpg',
  violet: 'violet-mineral.jpg',
  stream: 'stream-surface.jpg',
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
  return 0.1 + 0.9 * n;
}

export function skyProjection(w, h, wrapMeanAbs) {
  const equirect = h > 0 && w === h * 2;
  const wrap = wrapMeanAbs <= SKY_HOUSE.wrapMeanAbsMax;
  let reason = 'ok';
  if (!equirect) reason = 'not-2:1-equirect';
  else if (!wrap) reason = 'horizontal-wrap-failed';
  return { ok: equirect && wrap, reason, w, h, wrapMeanAbs };
}
