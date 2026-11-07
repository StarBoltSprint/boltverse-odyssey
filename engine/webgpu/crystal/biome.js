// crystal/biome.js — obsidian canyon. Crops are windows into the approved key, not new paint.
// Key: 720×1280, sha256 a912d091c0a698d47c027f1ca2e9c1f5faa7d329c29c56ce6fa6f135ab6274e9
// SmiR 2026-11-07: "Ok trop bien".
export const KEY = {
  file: 'key/environment.jpg',
  w: 720,
  h: 1280,
  sha256: 'a912d091c0a698d47c027f1ca2e9c1f5faa7d329c29c56ce6fa6f135ab6274e9',
  sourceNote: 'Parent path /workspace/biome-crystal-1107/new-biome-key.jpg. Bytes copied from the approved attachment.',
};

// Pixel rects, origin top-left. Order is the GPU crop table.
export const PLANET = {
  file: 'key/planet-surface.jpg',
  w: 1280,
  h: 720,
  sha256: '62a6b8e69bb71b557219b41740bfa7bf64ed2d38068ba5d77bfc56a66a4c1f81',
  // Upper right of the canyon view (psi 0 looks down -Z). Fixed in the world.
  dir: [0.46, 0.42, -0.78],
  distance: 2600,
  radius: 430,
  limb: 1.045,
  seamBand: 56,
  poleRows: 4,
};

export const CROPS = [
  { id: 'mineral', x: 70, y: 960, w: 420, h: 300 },
  { id: 'violet', x: 16, y: 760, w: 170, h: 220 },
  { id: 'cyan', x: 540, y: 560, w: 165, h: 280 },
  { id: 'stone', x: 10, y: 90, w: 190, h: 280 },
  { id: 'stream', x: 500, y: 820, w: 180, h: 130 },
  { id: 'stars', x: 250, y: 16, w: 180, h: 160 },
  { id: 'planet', x: 430, y: 30, w: 270, h: 280 },
];

export const MAT = { mineral: 0, violet: 1, cyan: 2, stone: 3, stream: 4, sky: 5 };

export function cropUV(c, key = KEY) {
  return [c.x / key.w, c.y / key.h, c.w / key.w, c.h / key.h];
}

export const CRYSTAL = {
  id: 'crystal-canyon',
  bolt: '../assets/meadow/bolt439_atlas.png',
  boltNote: 'Usual live bolt439 atlas. Not a new dog.',
  speed: 7,
  boltR: 0.42,
  msaa: 4,
  fovY: 62,
  sun: [0.48, 0.74, -0.42],
  streamLat: 3.55,
  fogDist: [36, 150],
};
