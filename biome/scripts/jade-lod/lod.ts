import type { Band, LodRow, SpawnRow, Volume } from "./types";

/** Enter / leave distances — leave farther than enter (hysteresis). */
export const BANDS = {
  near: { enter: 12, leave: 14 },
  mid: { enter: 40, leave: 44 },
  far: { enter: 72, leave: 80 },
} as const;

export const NEAR_BUDGET = 24;

const prevBand = new Map<string, Band>();

function pickBand(dist: number, prev: Band | undefined): Band {
  if (prev === "near") {
    if (dist < BANDS.near.leave) return "near";
  } else if (dist < BANDS.near.enter) return "near";

  if (prev === "mid") {
    if (dist < BANDS.mid.leave) return "mid";
  } else if (dist < BANDS.mid.enter) return "mid";

  if (prev === "far") {
    if (dist < BANDS.far.leave) return "far";
  } else if (dist < BANDS.far.enter) return "far";

  return "cull";
}

function pictureOf(band: Band): LodRow["picture"] {
  if (band === "near") return "full";
  if (band === "mid") return "bole";
  if (band === "far") return "impostor";
  return "none";
}

/**
 * Hysteresis + near budget. Near capped at 24; extras drop to mid and keep capsule.
 * Volume dies with the card: far/cull → no volume.
 */
export function applyLod(rows: SpawnRow[], camX: number, camZ: number): LodRow[] {
  const scored = rows.map((row) => {
    const dist = Math.hypot(camX - row.x, camZ - row.z);
    const prev = prevBand.get(row.id);
    let band = pickBand(dist, prev);
    return { row, dist, band };
  });

  scored.sort((a, b) => a.dist - b.dist);
  let nearCount = 0;
  for (const s of scored) {
    if (s.band === "near") {
      nearCount++;
      if (nearCount > NEAR_BUDGET) s.band = "mid"; // keep capsule
    }
    prevBand.set(s.row.id, s.band);
  }

  // drop stale hysteresis for forgotten ids (caller should prune; soft GC)
  if (prevBand.size > 4000) {
    const keep = new Set(scored.map((s) => s.row.id));
    for (const id of [...prevBand.keys()]) {
      if (!keep.has(id)) prevBand.delete(id);
    }
  }

  return scored.map(({ row, band }) => ({
    ...row,
    band,
    picture: pictureOf(band),
    volume: band === "near" || band === "mid",
  }));
}

/** Twins that thud — near/mid only. Far ghosts live in the ground film. */
export function volumesOf(lodRows: LodRow[]): Volume[] {
  const out: Volume[] = [];
  for (const row of lodRows) {
    if (!row.volume) continue;
    if (row.hit === "decor") continue;
    out.push({
      x: row.x,
      z: row.z,
      r: row.r,
      h: row.h,
      kind: row.kind,
      hit: row.hit,
      id: row.id,
    });
  }
  return out;
}

export function resetLodState() {
  prevBand.clear();
}
