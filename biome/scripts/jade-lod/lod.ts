import { PLATE_MODE, type PlateMode } from "./plates";
import type { Band, LodRow, SpawnRow, Volume } from "./types";

/** Enter / leave distances — leave farther than enter (hysteresis). */
export const BANDS = {
  near: { enter: 12, leave: 14 },
  mid: { enter: 40, leave: 44 },
  far: { enter: 72, leave: 80 },
} as const;

/**
 * Lab chairs. Near 24, mid 64, far 96.
 * A live tableau sets the far chair to 0. The 96 is the pre-plate bench only.
 */
export const NEAR_BUDGET = 24;
export const MID_BUDGET = 64;
export const FAR_BUDGET = 96;
export const FAR_BUDGET_LIVE = 0;
export const BUDGET = { near: NEAR_BUDGET, mid: MID_BUDGET, far: FAR_BUDGET } as const;

/** Tableau silences far instances. Lab keeps the 96 crosses. */
export function farChair(mode: PlateMode = PLATE_MODE): number {
  return mode === "tableau" ? FAR_BUDGET_LIVE : FAR_BUDGET;
}

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
 * Hysteresis, then the chairs on a separate field. Law 55.
 * prev[id] stores the hysteresis band only. promoteLod writes bandDraw.
 * A tree demoted to mid stays remembered as near, so a free slot
 * brings the crown back without requiring dist < 12.
 * Volume follows bandDraw. Far and cull have no volume.
 * Forgetting an id is forgetIds, when its chunk leaves the memory ring.
 * A geo drop does not call forgetIds. bandDraw is never written into prev.
 */
function admit(
  draw: Band,
  n: number,
  m: number,
  f: number,
  farCap: number,
): { draw: Band; n: number; m: number; f: number } {
  if (draw === "near" && n >= NEAR_BUDGET) draw = "mid";
  if (draw === "mid" && m >= MID_BUDGET) draw = "far";
  if (draw === "far" && f >= farCap) draw = "cull";
  if (draw === "near") n += 1;
  else if (draw === "mid") m += 1;
  else if (draw === "far") f += 1;
  return { draw, n, m, f };
}

export function applyLod(
  rows: SpawnRow[],
  camX: number,
  camZ: number,
  mode: PlateMode = PLATE_MODE,
): LodRow[] {
  const farCap = farChair(mode);
  const scored = rows.map((row) => {
    const dist = Math.hypot(camX - row.x, camZ - row.z);
    const band = holdBand(row.id, dist);
    return { row, dist, band };
  });

  scored.sort((a, b) => a.dist - b.dist);
  let n = 0;
  let m = 0;
  let f = 0;
  const drawn: LodRow[] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i];
    // Sticky only. The quota below must not land in this map.
    prevBand.set(s.row.id, s.band);
    const seat = admit(s.band, n, m, f, farCap);
    n = seat.n;
    m = seat.m;
    f = seat.f;
    const base: LodRow = {
      ...s.row,
      band: s.band,
      bandDraw: s.band,
      meshLod: s.band,
      picture: pictureOf(s.band),
      volume: hasVolume(s.band),
      dist: s.dist,
      fadePriority: i < NEAR_BUDGET,
    };
    drawn.push(promoteLod(base, seat.draw));
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

/**
 * Sticky meters only. Ignores quotas, fades, missing kits, and geo versus mem.
 * With dist: enter/leave against prev. Does not write prev.
 * Without dist: the stored band, if this id is still remembered.
 */
export function holdBand(id: string): Band | undefined;
export function holdBand(id: string, dist: number): Band;
export function holdBand(id: string, dist?: number): Band | undefined {
  const prev = prevBand.get(id);
  if (dist === undefined) return prev;
  return pickBand(dist, prev);
}

function hasVolume(draw: Band): boolean {
  return draw === "near" || draw === "mid";
}

/**
 * Writes bandDraw, meshLod, picture, and volume. Does not write prev.
 * A promote does not ask for dist < 12. The sticky band already decided that.
 */
export function promoteLod(row: LodRow, draw: Band): LodRow {
  return {
    ...row,
    bandDraw: draw,
    meshLod: draw,
    picture: pictureOf(draw),
    volume: hasVolume(draw),
  };
}

/** Bole pool: drawn near or mid, and not in a fade. Crown pool is near only. */
export function inBolePool(bandDraw: Band, fading: boolean): boolean {
  return (bandDraw === "near" || bandDraw === "mid") && !fading;
}

export function inCrownPool(bandDraw: Band): boolean {
  return bandDraw === "near";
}

/**
 * Idle impostor pool. A far↔cull fade leaves this pool as its own kit.
 * A scale other than 1 must not be written into the pool.
 */
export function inImpostorPool(bandDraw: Band, fading: boolean, quadScale = 1): boolean {
  return bandDraw === "far" && !fading && quadScale === 1;
}

export function resetLodState() {
  prevBand.clear();
}
