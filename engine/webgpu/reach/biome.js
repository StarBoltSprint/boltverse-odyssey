// Obsidian Reach. A kilometre basin on the measured zone A stone, not a crystal canyon.
// The stills are dedicated ground tiles at 1.45 m. They are not a cropped reference.

export const TILE_M = 1.45;

export const HEIGHT_SPEC = {
  K: 2 * Math.PI / 2400,
  terms: [
    { a: 22, fx: 1, px: 0, fz: 0.8, pz: 0.4, z: 'sin' },
    { a: 7, fx: 2.2, px: 1.1, fz: 1.6, pz: 0, z: 'cos' },
  ],
};

export const LIBRARY = [
  { id: 'floor', file: 'm0.png', source: 'packs/zone-a/src/ground/m0.png', role: 'basin floor', layer: 0,
    sha256: 'adfc25668ff8a499999ba9e7c4f571a0fe84f0011c5bd1977fdc9057b8ed48f3' },
  { id: 'west-mesa', file: 'm1.png', source: 'packs/zone-a/src/ground/m1.png', role: 'west mesa stone', layer: 1,
    sha256: '2f42633ba5f137f17501e1c7bc0db9d12371280b6f1b79214df7c88780c9c136' },
  { id: 'east-mesa', file: 'm2.png', source: 'packs/zone-a/src/ground/m2.png', role: 'east mesa stone', layer: 2,
    sha256: 'b7f6cfb9eb84a72c18c9194e980f68f77796fd420fab5e42c8391512d4ec4da0' },
  { id: 'spire', file: 'm3.png', source: 'packs/zone-a/src/ground/m3.png', role: 'spire stone', layer: 3,
    sha256: '1aa8063fa28ab9b41cdd6ee15c37af2fc6a38e16f62fc67452543c584a5f6e27' },
];

export const STRUCTURES = [
  { id: 'east-mesa', kind: 'mesa', x: 160, z: -340, yaw: 0.15, height: 240, length: 420, width: 110, material: 2 },
  { id: 'west-mesa', kind: 'mesa', x: -1500, z: -900, yaw: -0.4, height: 460, length: 980, width: 280, material: 1 },
  { id: 'spire', kind: 'spire', x: 40, z: -2600, hx: 58, hz: 36, height: 740, tip: [6, -8], material: 3 },
];

export const SUN = [0.42, 0.62, 0.28];

export const REACH = {
  id: 'reach',
  name: 'Obsidian Reach',
  tileM: TILE_M,
  sun: SUN,
  revision: 1,
};
