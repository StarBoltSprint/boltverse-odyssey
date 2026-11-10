// Glacier abyss at dawn. Isolated candidate. Not a live biome and not a KEEP.
import light from './dawn-light.json' with { type: 'json' };

export const CANDIDATE = 'glacier-abyss-dawn';
export const LIGHT = light;

export const MAT = {
  snow: 0,
  fall: 1,
  arch: 2,
  icicle: 3,
  drift: 4,
  sky: 5,
  wall: 6,
  mountain: 7,
};

export const LIMITS = {
  tris: 200000,
  draws: 12,
};

export const DRAWS = ['sky', 'planet', 'world', 'icicle', 'chunk', 'drift', 'contact', 'bolt'];

export const PLANET = {
  dir: [0.22, 0.33, -0.92],
  distance: 5200,
  radius: 1180,
};

export const GLACIER = {
  id: 'glacier-abyss',
  bolt: '../assets/meadow/bolt439_atlas.png',
  boltNote: 'Usual live bolt439 atlas and the meadow follow card. Not a new dog.',
  speed: 7,
  boltR: 0.42,
  msaa: 4,
  fovY: 62,
  z0: 140,
  z1: -4500,
  fog: 0,
};

export function planetCenter() {
  const d = PLANET.dir;
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l * PLANET.distance, d[1] / l * PLANET.distance, d[2] / l * PLANET.distance];
}
