// Dedicated albedo slots. The environment key is not a texture.
// Tile metres are the declared period (world metres per repeat), not a measured fit.
export const CANDIDATE = 'materials-v2-r1';
export const TILE_M = { ground: 3, wall: 2, crystal: 0.5, architecture: 2 };
export const ALBEDO = {
  ground: 'mineral-ground.jpg',
  wall: 'obsidian-wall.jpg',
  crystal: 'cyan-facets.jpg',
  architecture: 'architectural-stone.jpg',
};
export const MISSING_SLOTS = ['stream', 'sky', 'separate-violet'];

export function materialGate(search) {
  const id = search?.get?.('candidate') || '';
  const base = {
    release: 'HOLD',
    keep: false,
    referenceIsTexture: false,
    missing: MISSING_SLOTS,
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
