import { fbm } from "./noise";
import { PATH_HALF, SEED } from "./types";

/**
 * Path valley. Law 54. Same book as the trees, its own page.
 * center is a function of z only. x in the fbm twists a ribbon the pawn cannot climb.
 * Spawn, height, and the plate tint read pathDist. No magnet. No road in the mp4.
 */

export const PATH_PAGE = 7;
export const L_PATH = 64;
export const PATH_OCTAVES = 2;
/** ±9 m around x = 0. */
export const WANDER = 18;
/** Knot spacing. Consumers lerp between these. */
export const PATH_SAMPLE_M = 4;
/** Flatten shoulders. Not a step at pathHalf. */
export const FLATTEN_IN = 0.55;
export const FLATTEN_OUT = 1.15;
/** Shader strip. Wider than the flatten, still not a curb in the mp4. */
export const TINT_IN = 0.7;
export const TINT_OUT = 1.3;
export const TINT_DARK = 0.72;
/** First cut. A later 5% assist is not this law. */
export const PATH_ASSIST = 0;

export const PATH_NOISE = {
  page: PATH_PAGE,
  octaves: PATH_OCTAVES,
  L: L_PATH,
  wander: WANDER,
} as const;

const knots = new Map<string, number>();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  const t = span === 0 ? 0 : Math.min(1, Math.max(0, (x - edge0) / span));
  return t * t * (3 - 2 * t);
}

/**
 * Knot. center(z) = (fbm(0, z/64, s+7, octaves=2) - 0.5) * 18.
 * The first argument of fbm stays 0.
 */
export function pathCenter(z: number, s: number = SEED): number {
  const n = fbm(0, z / L_PATH, s + PATH_PAGE, PATH_OCTAVES);
  return (n - 0.5) * WANDER;
}

function knot(bucket: number, s: number): number {
  const key = `${s}:${bucket}`;
  const hit = knots.get(key);
  if (hit !== undefined) return hit;
  const c = pathCenter(bucket * PATH_SAMPLE_M, s);
  knots.set(key, c);
  return c;
}

/**
 * One center per sample. Knots every 4 m, lerp between them.
 * Spawn, posture, and the tint call this through pathDist so they share d.
 */
export function sampledCenter(z: number, s: number = SEED): number {
  const step = PATH_SAMPLE_M;
  const i = Math.floor(z / step);
  const t = (z - i * step) / step;
  return knot(i, s) * (1 - t) + knot(i + 1, s) * t;
}

/** d(x,z) = abs(x - center(z)). The center is the 4 m sample. */
export function pathDist(x: number, z: number, s: number = SEED): number {
  return Math.abs(x - sampledCenter(z, s));
}

export function onPath(
  x: number,
  z: number,
  s: number = SEED,
  pathHalf: number = PATH_HALF,
): boolean {
  return pathDist(x, z, s) < pathHalf;
}

/** w = 1 - smoothstep(pathHalf*0.55, pathHalf*1.15, d). 1 on the ribbon. */
export function flattenWeight(d: number, pathHalf: number = PATH_HALF): number {
  return 1 - smoothstep(pathHalf * FLATTEN_IN, pathHalf * FLATTEN_OUT, d);
}

/** strip = 1 - smoothstep(pathHalf*0.7, pathHalf*1.3, d). */
export function tintStrip(d: number, pathHalf: number = PATH_HALF): number {
  return 1 - smoothstep(pathHalf * TINT_IN, pathHalf * TINT_OUT, d);
}

/** albedo *= mix(1, 0.72, strip). Not a pixel baked into the plate. */
export function tintAlbedo(albedo: number, d: number, pathHalf: number = PATH_HALF): number {
  const strip = tintStrip(d, pathHalf);
  return albedo * (1 + (TINT_DARK - 1) * strip);
}

export function resetPathCache(): void {
  knots.clear();
}
