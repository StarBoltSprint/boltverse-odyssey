import { CHUNK, KIND_RH, SEED, type Kind, type SpawnRow } from "./types";
import { noise01, OCTAVE_LOCK, sampleLock } from "./noise";
import { onPath } from "./path";

/** Bole continents. Below this is a moth-hole, not a tree. */
export const N1_BOLE = 0.42;
/** Rare ruin continents. The field is 2 octaves. A per-cell coin flip is not this line. */
export const N2_RUIN = 0.72;
/** Crystal shards. Own page, 3 octaves. Not the ruin field. */
export const N3_SHARD = 0.7;

const TREES: Kind[] = ["bole", "bole", "bole", "elder", "fern"];

/**
 * Level set of the three locked pages. Null is a gap.
 * Ruin is n2 only (octaves 2). Crystal is n3. Bole, elder, and fern sit in n1.
 * Height is not an input. Adding octaves does not change which line this is.
 */
export function pickKind(n1: number, n2: number, n3: number, pick: number): Kind | null {
  if (n2 >= N2_RUIN) return "ruin";
  if (n3 >= N3_SHARD) return "crystal";
  if (n1 < N1_BOLE) return null;
  const i = Math.floor(pick * TREES.length) % TREES.length;
  return TREES[i] ?? "bole";
}

/**
 * Same (ix, iz) → same woods every visit. Path corridor empty.
 * Pages: n1 bole s+0 L=14 octaves=3, n2 ruin s+17 L=40 octaves=2, n3 shard s+31 L=22 octaves=3.
 * Height (s+101) is posture only — do not gate this loop on it.
 */
export function spawnChunk(ix: number, iz: number, s: number = SEED): SpawnRow[] {
  const rows: SpawnRow[] = [];
  const ox = ix * CHUNK;
  const oz = iz * CHUNK;
  const step = 3.3;
  for (let lz = 0; lz < CHUNK; lz += step) {
    for (let lx = 0; lx < CHUNK; lx += step) {
      const x = ox + lx + noise01(ix * 100 + Math.floor(lx), iz * 100 + Math.floor(lz), 1, s) * step;
      const z = oz + lz + noise01(ix * 100 + Math.floor(lx), iz * 100 + Math.floor(lz), 2, s) * step;
      if (onPath(x, z, s)) continue;
      const n1 = sampleLock("n1", x, z, s);
      const n2 = sampleLock("n2", x, z, s);
      const n3 = sampleLock("n3", x, z, s);
      const pick = noise01(Math.floor(x * 10), Math.floor(z * 10), 3, s);
      const kind = pickKind(n1, n2, n3, pick);
      if (!kind) continue;
      const rh = KIND_RH[kind];
      const yaw = noise01(Math.floor(x * 10), Math.floor(z * 10), 4, s) * Math.PI * 2;
      const variant = Math.floor(noise01(Math.floor(x * 10), Math.floor(z * 10), 5, s) * 3);
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

/** Hung grain. Ruin is 2. Height is not in this table's job. */
export const SPAWN_OCTAVES = {
  n1: OCTAVE_LOCK.n1.octaves,
  n2: OCTAVE_LOCK.n2.octaves,
  n3: OCTAVE_LOCK.n3.octaves,
} as const;
