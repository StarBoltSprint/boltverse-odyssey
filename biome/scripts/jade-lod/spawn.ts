import { CHUNK, KIND_RH, Kind, PATH_HALF, SEED, SpawnRow } from "./types";
import { noise01, valueNoise } from "./noise";

const KINDS: Kind[] = ["bole", "bole", "bole", "elder", "ruin", "crystal", "fern"];

/** Same (ix, iz) → same woods every visit. Path corridor empty. */
export function spawnChunk(ix: number, iz: number): SpawnRow[] {
  const rows: SpawnRow[] = [];
  const ox = ix * CHUNK;
  const oz = iz * CHUNK;
  // ~1 candidate per 3.3 m tree cell, like Grove
  const step = 3.3;
  for (let lz = 0; lz < CHUNK; lz += step) {
    for (let lx = 0; lx < CHUNK; lx += step) {
      const x = ox + lx + noise01(ix * 100 + Math.floor(lx), iz * 100 + Math.floor(lz), 1) * step;
      const z = oz + lz + noise01(ix * 100 + Math.floor(lx), iz * 100 + Math.floor(lz), 2) * step;
      // keep path empty (ribbon along z≈0 for demo; remix can replace with real path fn)
      if (Math.abs(x) < PATH_HALF) continue;
      const grove = valueNoise(x * 0.04, z * 0.04, SEED);
      if (grove < 0.42) continue; // gap
      const pick = noise01(Math.floor(x * 10), Math.floor(z * 10), 3);
      const kind = KINDS[Math.floor(pick * KINDS.length) % KINDS.length];
      const rh = KIND_RH[kind];
      const yaw = noise01(Math.floor(x * 10), Math.floor(z * 10), 4) * Math.PI * 2;
      const variant = Math.floor(noise01(Math.floor(x * 10), Math.floor(z * 10), 5) * 3);
      rows.push({
        id: `${ix}:${iz}:${Math.floor(x * 100)}:${Math.floor(z * 100)}`,
        kind,
        x,
        z,
        r: rh.r,
        h: rh.h,
        yaw,
        variant,
        hit: rh.hit,
      });
    }
  }
  return rows;
}
