// Imagine texel law. The floor is 2048 native px per metre and is not a biome setting.
// A 1024 px still covers at most 0.5 m. Large surfaces use at least 4 distinct files.
import { MAT, PLANET } from './biome.js';

export const MIN_PX_PER_M = 2048;
export const MAX_UV_STRETCH = 1.3;
export const MAG_MAX = 1;
export const MIN_LARGE_VARIANTS = 4;
export const TILE_M = 1024 / MIN_PX_PER_M;
export const REPEATS_PER_M = 1 / TILE_M;

export const IMAGINE = [
  {
    id: 'snow',
    role: 'snow',
    surfaceClass: 'snow',
    tileMetres: TILE_M,
    files: ['tex/snow/v1.jpg', 'tex/snow/v2.jpg', 'tex/snow/v3.jpg', 'tex/snow/v4.jpg'],
    worldMats: [MAT.snow, MAT.fall, MAT.arch, MAT.drift, MAT.wall, MAT.mountain],
    instances: ['drift', 'chunk'],
  },
  {
    id: 'ice',
    role: 'ice',
    surfaceClass: 'ice',
    tileMetres: TILE_M,
    files: ['tex/ice/v1.jpg', 'tex/ice/v2.jpg', 'tex/ice/v3.jpg', 'tex/ice/v4.jpg'],
    worldMats: [MAT.fall, MAT.arch, MAT.icicle, MAT.drift, MAT.wall, MAT.mountain],
    instances: ['icicle', 'drift', 'chunk'],
  },
  {
    id: 'planet',
    role: 'planet',
    surfaceClass: 'prop',
    // Unreachable sky body. One still, judged by on-screen magnification, not px/m.
    files: ['tex/glacier-planet-surface.jpg'],
    equirect: true,
    radius: PLANET.radius,
    distance: PLANET.distance,
  },
];
