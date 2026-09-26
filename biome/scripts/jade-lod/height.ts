import { fbm, OCTAVE_LOCK } from "./noise";
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
/** Withers above the posture. Bolt snaps here every physics tick. */
export const WITHERS = 0.45;
/** Contact shadow lift. Law 49 shadow child uses the same 0.02. */
export const SHADOW_LIFT = 0.02;
/** Ground mp4 stays here. Do not warp the mesh with h. */
export const GROUND_MESH_Y = 0;
/** Smooth flatten band, as a fraction of pathHalf. Not a hard step. */
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

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, (x - edge0) / span));
  return t * t * (3 - 2 * t);
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
 * w = 1 - smoothstep(pathHalf*0.55, pathHalf*1.15, abs(x))
 */
export function pathWeight(x: number, pathHalf: number = PATH_HALF): number {
  return 1 - smoothstep(pathHalf * PATH_IN, pathHalf * PATH_OUT, Math.abs(x));
}

/**
 * Flatten toward the base, not a trench.
 * h = mix(h0, base, w). A later curved path uses distance-to-spline in place of abs(x).
 */
export function postureHeight(
  x: number,
  z: number,
  s: number = SEED,
  pathHalf: number = PATH_HALF,
): number {
  const h0 = heightRaw(x, z, s);
  const w = pathWeight(x, pathHalf);
  return h0 * (1 - w) + HEIGHT_BASE * w;
}

/** Bolt, every physics tick. Snap. Do not lerp this for 200 ms. */
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
