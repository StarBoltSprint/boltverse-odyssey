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
    id: 'crust',
    role: 'snow',
    surfaceClass: 'snow',
    tileMetres: TILE_M,
    files: ['tex/snow-v2/snow-v2-0.png', 'tex/snow-v2/snow-v2-2.png', 'tex/snow-v2/snow-v2-3.png', 'tex/crust/v4.jpg'],
    worldMats: [MAT.snow, MAT.drift],
    instances: ['drift', 'chunk'],
  },
  {
    id: 'glacier-ice',
    role: 'ice',
    surfaceClass: 'ice',
    tileMetres: TILE_M,
    files: ['tex/glacier-ice/v1.jpg', 'tex/glacier-ice/v2.jpg', 'tex/glacier-ice/v3.jpg', 'tex/glacier-ice/v4.jpg'],
    worldMats: [MAT.wall, MAT.icicle, MAT.drift],
    instances: ['icicle', 'chunk'],
  },
  {
    id: 'serac',
    role: 'serac',
    surfaceClass: 'ice',
    tileMetres: TILE_M,
    files: ['tex/serac/v1.jpg', 'tex/serac/v2.jpg', 'tex/serac/v3.jpg', 'tex/serac/v4.jpg'],
    worldMats: [MAT.mountain],
  },
  {
    id: 'fall-ice',
    role: 'waterfall',
    surfaceClass: 'ice',
    tileMetres: TILE_M,
    files: ['tex/fall-ice/v1.jpg', 'tex/fall-ice/v2.jpg', 'tex/fall-ice/v3.jpg', 'tex/fall-ice/v4.jpg'],
    worldMats: [MAT.fall],
  },
  {
    id: 'arch-ice',
    role: 'arch',
    surfaceClass: 'ice',
    tileMetres: TILE_M,
    files: ['tex/arch-ice/v1.jpg', 'tex/arch-ice/v2.jpg', 'tex/arch-ice/v3.jpg', 'tex/arch-ice/v4.jpg'],
    worldMats: [MAT.arch],
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
