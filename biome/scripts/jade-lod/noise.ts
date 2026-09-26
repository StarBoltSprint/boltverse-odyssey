import { SEED } from "./types";

/** Deterministic value-noise from seed s. Same (x,z) → same woods. */
function hash2(ix: number, iz: number, s: number): number {
  let n = (ix * 374761393 + iz * 668265263 + s * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = n ^ (n >>> 16);
  return (n >>> 0) / 4294967296;
}

export function valueNoise(x: number, z: number, s: number = SEED): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0, s);
  const b = hash2(x0 + 1, z0, s);
  const c = hash2(x0, z0 + 1, s);
  const d = hash2(x0 + 1, z0 + 1, s);
  const u = a + (b - a) * sx;
  const v = c + (d - c) * sx;
  return u + (v - u) * sz;
}

export function noise01(ix: number, iz: number, salt: number, s: number = SEED): number {
  return hash2(ix, iz, s + salt * 1013);
}

/**
 * Octave lock. Law 51. Page and L stay put. Octaves only add grain inside that wavelength.
 * Amp ladder 0.50, 0.25, 0.125 … normalized by the sum so the result stays 0..1.
 * Height stays 3 at a 20 cm rise. Ruins stay 2. Do not share one count across jobs.
 */
export const OCTAVE_LOCK = {
  height: { page: 101, octaves: 3, L: 28 },
  n1: { page: 0, octaves: 3, L: 14 },
  n2: { page: 17, octaves: 2, L: 40 },
  n3: { page: 31, octaves: 3, L: 22 },
} as const;

export type OctaveJob = keyof typeof OCTAVE_LOCK;

const FBM_AMP = 0.5;

/**
 * Reprint the same page at half size and half ink. The page does not change per octave.
 * `x` and `z` are already divided by L.
 */
export function fbm(x: number, z: number, page: number, octaves: number): number {
  const n = octaves < 1 ? 1 : octaves | 0;
  let amp = FBM_AMP;
  let sum = 0;
  let norm = 0;
  let freq = 1;
  for (let i = 0; i < n; i++) {
    sum += amp * valueNoise(x * freq, z * freq, page);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** One locked job. Height must not be passed here to decide a tree. */
export function sampleLock(job: OctaveJob, x: number, z: number, s: number = SEED): number {
  const row = OCTAVE_LOCK[job];
  return fbm(x / row.L, z / row.L, s + row.page, row.octaves);
}

/** Path valley is path.ts. Page s+7 is not an octave-lock job. Two octaves. x stays out of the fbm. */
