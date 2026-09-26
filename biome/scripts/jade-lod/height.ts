import { fbm, OCTAVE_LOCK } from "./noise";
import { flattenWeight, pathDist, tintStrip } from "./path";
import { PATH_HALF, SEED } from "./types";

/**
 * Posture only. Law 50. Does not decide whether a tree exists.
 * Spawn pages are s+0 / s+17 / s+31 at L = 14 / 40 / 22.
 * This page is s+101 at L = 28, so the ground rolls wider than the grove.
 * The ground Imagine film stays the flat plate at y = 0. This number moves feet, cards, shadow, and the capsule base.
 * No Math.sin. No Date.now. Same valueNoise as spawn, different page.
 */

/** Spawn salts. Height must not sample these. */
export const SPAWN_PAGES = [0, 17, 31] as const;

export const HEIGHT_BASE = 0.2;
export const HEIGHT_AMP = 0.2;
export const HEIGHT_L = OCTAVE_LOCK.height.L;
export const HEIGHT_PAGE = OCTAVE_LOCK.height.page;
/** Three while the rise is 20 cm. Four only if the amp becomes meters. */
export const HEIGHT_OCTAVES = OCTAVE_LOCK.height.octaves;
/** Card offset above posture. The keyed gallop plant does not use this. Its paws sit on `h`. */
export const WITHERS = 0.45;
/** Contact shadow lift. Law 49 shadow child uses the same 0.02. */
export const SHADOW_LIFT = 0.02;
/** Ground mp4 stays here. Do not warp the mesh with h. */
export const GROUND_MESH_Y = 0;
/** Smooth flatten band, as a fraction of pathHalf. Law 54. Not a hard step. */
export const PATH_IN = 0.55;
export const PATH_OUT = 1.15;

/** Aliases kept for the older posture names. */
export const HEIGHT_MIN = HEIGHT_BASE;
export const HEIGHT_SCALE = HEIGHT_L;
export const HEIGHT_SALT = HEIGHT_PAGE;

export { fbm } from "./noise";

/**
 * At 20 cm the lock is 3. A fourth octave (~3.5 m) fights the stride.
 * Four is allowed only when the amplitude is meters, and not before.
 */
export function heightOctaveCount(amp: number = HEIGHT_AMP): number {
  if (amp >= 1) return 4;
  return HEIGHT_OCTAVES;
}

/**
 * Unflattened field. h0 = 0.20 + 0.20 * fbm(x/28, z/28, s+101), 3 octaves.
 * Peak 0.40. Elder and fern share this field.
 */
export function heightRaw(x: number, z: number, s: number = SEED): number {
  const page = s + HEIGHT_PAGE;
  const raw = fbm(x / HEIGHT_L, z / HEIGHT_L, page, heightOctaveCount(HEIGHT_AMP));
  return HEIGHT_BASE + HEIGHT_AMP * raw;
}

/** Same as heightRaw. The path has not flattened it yet. */
export function terrainHeight(x: number, z: number, s: number = SEED): number {
  return heightRaw(x, z, s);
}

/**
 * 1 on the path, 0 outside the band.
 * d = abs(x - center(z)). Same d as the spawn skip and the shader tint.
 * w = 1 - smoothstep(pathHalf*0.55, pathHalf*1.15, d)
 */
export function pathWeight(
  x: number,
  z: number,
  pathHalf: number = PATH_HALF,
  s: number = SEED,
): number {
  return flattenWeight(pathDist(x, z, s), pathHalf);
}

/** Tint strip for the remix shader. Wider than the flatten. Not painted into the ground mp4. */
export function pathShade(x: number, z: number, s: number = SEED, pathHalf: number = PATH_HALF): number {
  return tintStrip(pathDist(x, z, s), pathHalf);
}

/**
 * Flatten toward the base, not a trench.
 * h = mix(h0, base, w). The valley is law 54. Not a trench. Not abs(x).
 */
export function postureHeight(
  x: number,
  z: number,
  s: number = SEED,
  pathHalf: number = PATH_HALF,
): number {
  const h0 = heightRaw(x, z, s);
  const w = pathWeight(x, z, pathHalf, s);
  return h0 * (1 - w) + HEIGHT_BASE * w;
}

/** Card offset, `h + 0.45`. The keyed plant is `postureHeight` (paws on h). Snap. Do not lerp. */
export function pawnY(x: number, z: number, s: number = SEED, pathHalf: number = PATH_HALF): number {
  return postureHeight(x, z, s, pathHalf) + WITHERS;
}

export type KitPosture = {
  /** Sampled once when the kit spawns. Do not re-sample each frame. */
  groundY: number;
  shadowY: number;
  /** Cylinder base. Never 0 while the group sits on a bump. */
  volumeBase: number;
  volumeTop: number;
};

/**
 * One sample for a new kit. Shadow and the cylinder hang off that stored groundY.
 * hBole is the bole height from the two-plane table. The crown is not in the cylinder.
 */
export function kitPosture(
  x: number,
  z: number,
  hBole: number,
  s: number = SEED,
  pathHalf: number = PATH_HALF,
): KitPosture {
  const groundY = postureHeight(x, z, s, pathHalf);
  return {
    groundY,
    shadowY: groundY + SHADOW_LIFT,
    volumeBase: groundY,
    volumeTop: groundY + hBole,
  };
}
