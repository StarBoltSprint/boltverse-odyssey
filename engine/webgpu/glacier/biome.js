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

export const DRAWS = ['sky', 'planet', 'world', 'icicle', 'chunk', 'drift', 'contact', 'flake', 'bolt'];

// One instanced draw. Near, mid, and far fill the camera frustum. Blow is
// snow lifted off the sastrugi. Puffs stay a small paw burst.
export const FLAKES = { near: 1000, mid: 900, far: 500, blow: 180, puff: 18 };

export const PLANET = {
  dir: [0.04, 0.30, -0.95],
  distance: 5200,
  radius: 756,
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
