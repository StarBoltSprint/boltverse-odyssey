// Imagine texel law for the glacier. 2048 native px per metre.
// A 1024 px still covers at most 0.5 m. Do not upscale. Do not invent pixels.
import { MAT, PLANET } from './biome.js';

export const MIN_PX_PER_M = 2048;
export const MAX_UV_STRETCH = 1.3;
export const VARIANT_METRES = 1024 / MIN_PX_PER_M;

// Repeats are the ones the shader actually uses. The largest tile is the
// most magnified, and that is the one the gate scores.
export const IMAGINE = [
  {
    id: 'snow',
    file: 'tex/glacier-snow-floor.jpg',
    role: 'ground/snow',
    scales: [
      { name: 'broad', repeatsPerM: 0.012 },
      { name: 'fine', repeatsPerM: 0.08 },
    ],
    worldMats: [MAT.snow, MAT.fall, MAT.arch, MAT.drift, MAT.wall, MAT.mountain],
    instances: ['drift', 'chunk'],
  },
  {
    id: 'ice',
    file: 'tex/glacier-ice-wall.jpg',
    role: 'ice',
    scales: [
      { name: 'broad', repeatsPerM: 0.014 },
      { name: 'fine', repeatsPerM: 0.06 },
    ],
    worldMats: [MAT.fall, MAT.arch, MAT.icicle, MAT.drift, MAT.wall, MAT.mountain],
    instances: ['icicle', 'drift', 'chunk'],
  },
  {
    id: 'planet',
    file: 'tex/glacier-planet-surface.jpg',
    role: 'planet',
    equirect: true,
    radius: PLANET.radius,
  },
];

export function tileMetres(repeatsPerM) {
  return 1 / repeatsPerM;
}

export function pxPerMetre(nativePx, metres) {
  return nativePx / metres;
}
