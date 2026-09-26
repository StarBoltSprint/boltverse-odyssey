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
