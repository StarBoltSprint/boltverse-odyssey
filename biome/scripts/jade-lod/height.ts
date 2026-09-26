import { valueNoise } from "./noise";
import { PATH_HALF, SEED } from "./types";

/**
 * Posture only. Law 46. Does not decide whether a tree exists.
 * Spawn stays spawnChunk (the n1/n2/n3 page at L=14/40/22). Different salt, different job.
 * The ground Imagine film stays the flat plate. This number moves feet, cards, shadow, and the capsule base.
 */

export const HEIGHT_MIN = 0.2;
export const HEIGHT_AMP = 0.2;
export const HEIGHT_SCALE = 28;
export const HEIGHT_SALT = 101;

/** Four octaves of the hung value noise. Returns 0..1. Does not paint sol. */
export function fbm(x: number, z: number, s: number): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x * freq, z * freq, s + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** h = 0.20 + 0.20 * fbm(x/28, z/28, s+101) → 20–40 cm. */
export function terrainHeight(x: number, z: number, s: number = SEED): number {
  return HEIGHT_MIN + HEIGHT_AMP * fbm(x / HEIGHT_SCALE, z / HEIGHT_SCALE, s + HEIGHT_SALT);
}

/** Path corridor eases toward 0.20 inside pathHalf. Outside, the full posture. */
export function postureHeight(
  x: number,
  z: number,
  s: number = SEED,
  pathHalf: number = PATH_HALF,
): number {
  const h = terrainHeight(x, z, s);
  const d = Math.abs(x);
  if (d >= pathHalf) return h;
  const t = pathHalf <= 0 ? 0 : d / pathHalf;
  return HEIGHT_MIN + (h - HEIGHT_MIN) * t;
}
