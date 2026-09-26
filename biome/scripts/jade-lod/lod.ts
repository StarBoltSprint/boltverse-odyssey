import type { Band, LodRow, SpawnRow, Volume } from "./types";

/** Enter / leave distances — leave farther than enter (hysteresis). */
export const BANDS = {
  near: { enter: 12, leave: 14 },
  mid: { enter: 40, leave: 44 },
  far: { enter: 72, leave: 80 },
} as const;

export const NEAR_BUDGET = 24;

const prevBand = new Map<string, Band>();

/**
 * Sticky when prev is set. Undefined prev is a first sight, so the enter
 * distances apply. A kit that left geo and came back is not a first sight:
 * prev is still here. Do not call this as enterBand just because the mesh was missing.
 */
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
 * Hysteresis, then the near budget on a separate field.
 * prev[id] stores the hysteresis band only. Budget writes bandDraw.
 * A tree demoted to mid stays remembered as near, so a free slot
 * brings the crown back without walking out to the enter line.
 * Volume follows bandDraw. Far and cull have no volume.
 * Forgetting an id is forgetIds, when its chunk leaves the memory ring.
 * A geo drop does not call forgetIds. bandDraw is never written into prev.
 */
export function applyLod(rows: SpawnRow[], camX: number, camZ: number): LodRow[] {
  const scored = rows.map((row) => {
    const dist = Math.hypot(camX - row.x, camZ - row.z);
    const prev = prevBand.get(row.id);
    const band = pickBand(dist, prev);
    return { row, dist, band };
  });

  scored.sort((a, b) => a.dist - b.dist);
  let nearCount = 0;
  const drawn: LodRow[] = [];
  for (const s of scored) {
    // Hysteresis only. The budget below writes bandDraw and must not land here.
    prevBand.set(s.row.id, s.band);
    let bandDraw = s.band;
    if (s.band === "near") {
      nearCount++;
      if (nearCount > NEAR_BUDGET) bandDraw = "mid";
    }
    drawn.push({
      ...s.row,
      band: s.band,
      bandDraw,
      picture: pictureOf(bandDraw),
      volume: bandDraw === "near" || bandDraw === "mid",
    });
  }
  return drawn;
}

/**
 * Drop hysteresis for ids whose chunk left the memory ring.
 * Not a geo drop. Not a budget write. bandDraw is not stored here.
 */
export function forgetIds(ids: Iterable<string>): void {
  for (const id of ids) prevBand.delete(id);
}

export function prevCount(): number {
  return prevBand.size;
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

/** Sticky meshLod for this id. The shader graph does not choose it. */
export function holdBand(id: string): Band | undefined {
  return prevBand.get(id);
}

export function resetLodState() {
  prevBand.clear();
}
