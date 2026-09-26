import { forgetFades, liftFade, restoreFade, type FadeStash } from "./fade";
import { postureHeight } from "./height";
import { applyLod, forgetIds, holdBand, volumesOf } from "./lod";
import { forgetShattered, isShattered, resetHowl } from "./play";
import { spawnChunk } from "./spawn";
import { CHUNK, type Band, type LodRow, type SpawnRow, type Volume } from "./types";

/** Kits, spawn cache, volumes, cards. 3×3 chunks. */
export const GEO_RING = 1;
/** prev.band, groundY, fade, lod. 5×5 chunks. The mesh may already be gone. */
export const MEM_RING = 2;
export const geoRing = GEO_RING;
export const memRing = MEM_RING;
/**
 * Trail cap. Never spent on an id whose chunk is still inside geo.
 * A live 3×3 on this spawn is already past this, so those ids stay
 * and the chunks outside geo are what the cap drops.
 */
export const MEM_CAP = 512;

type Slot = { x: number; z: number; chunk: string; groundY: number };

/**
 * Optional. Mid-fade resume when the mesh comes back.
 * lod is a copy of holdBand for that resume. It is not bandDraw and not a second prev map.
 */
export type MemKit = { lod: Band; fade?: FadeStash };

const spawnCache = new Map<string, SpawnRow[]>();
const memory = new Map<string, Slot>();
const memKits = new Map<string, MemKit>();

/** Chunk keys around the pawn. Ring 1 is geo. Ring 2 is memory. */
export function chunksAround(x: number, z: number, ring: number): Set<string> {
  const cx = Math.floor(x / CHUNK);
  const cz = Math.floor(z / CHUNK);
  const keep = new Set<string>();
  for (let dz = -ring; dz <= ring; dz++) {
    for (let dx = -ring; dx <= ring; dx++) keep.add(`${cx + dx},${cz + dz}`);
  }
  return keep;
}

function chunkCenter(chunk: string): [number, number] {
  const [ix, iz] = chunk.split(",").map(Number);
  return [(ix + 0.5) * CHUNK, (iz + 0.5) * CHUNK];
}

/** draw = mesh. remember = prev and groundY. forget = chunk left mem. */
export function chunkFate(
  chunk: string,
  geo: ReadonlySet<string>,
  mem: ReadonlySet<string>,
): "draw" | "remember" | "forget" {
  if (!mem.has(chunk)) return "forget";
  if (!geo.has(chunk)) return "remember";
  return "draw";
}

function dropId(id: string, forgotten: string[]) {
  memory.delete(id);
  memKits.delete(id);
  forgotten.push(id);
}

/**
 * geoRing streams the mesh. memRing remembers the band and the ground.
 * A chunk can leave geo and keep prev. forgetIds runs only outside mem.
 * Instance matrices, particle births, volume objects, and Imagine textures
 * are not stored here. Shattered ids are. They leave with the chunk, same as prev.
 * A crystal in that set is omitted from rows and volumes. Geo re-enter does not rebuild it.
 */
export function tickField(
  camX: number,
  camZ: number,
  _dt: number,
): { rows: LodRow[]; volumes: Volume[] } {
  const mem = chunksAround(camX, camZ, MEM_RING);
  const geo = chunksAround(camX, camZ, GEO_RING);

  for (const k of geo) {
    if (spawnCache.has(k)) continue;
    const [ix, iz] = k.split(",").map(Number);
    spawnCache.set(k, spawnChunk(ix, iz));
  }
  for (const k of [...spawnCache.keys()]) {
    if (!geo.has(k)) spawnCache.delete(k);
  }

  const geoRows: SpawnRow[] = [];
  const geoIds = new Set<string>();
  for (const [chunk, rows] of spawnCache) {
    for (const row of rows) {
      if (!memory.has(row.id)) {
        memory.set(row.id, {
          x: row.x,
          z: row.z,
          chunk,
          groundY: postureHeight(row.x, row.z),
        });
      }
      if (isShattered(row.id)) continue;
      geoRows.push(row);
      geoIds.add(row.id);
    }
  }

  const forgotten: string[] = [];
  for (const [id, slot] of memory) {
    const fate = chunkFate(slot.chunk, geo, mem);
    if (fate === "forget") {
      dropId(id, forgotten);
      continue;
    }
    if (fate === "draw" || memKits.has(id)) continue;
    const lod = holdBand(id);
    if (!lod) continue;
    memKits.set(id, { lod, fade: liftFade(id) });
  }

  const capSkip = new Set<string>();
  while (memory.size > MEM_CAP) {
    let worstKey: string | null = null;
    let worstD = -1;
    const byChunk = new Map<string, string[]>();
    for (const [id, slot] of memory) {
      if (geo.has(slot.chunk) || capSkip.has(slot.chunk)) continue;
      // A shattered shard stays while its chunk is still in mem.
      // This spawn's live ring is already past the cap, so a geo leave
      // would otherwise evict the id and the next enter would regrow the crystal.
      if (isShattered(id)) continue;
      const list = byChunk.get(slot.chunk) ?? [];
      list.push(id);
      byChunk.set(slot.chunk, list);
      const [cx, cz] = chunkCenter(slot.chunk);
      const d = (cx - camX) ** 2 + (cz - camZ) ** 2;
      if (d > worstD) {
        worstD = d;
        worstKey = slot.chunk;
      }
    }
    const victims = worstKey ? byChunk.get(worstKey) : undefined;
    if (!victims || victims.length === 0) break;
    for (const id of victims) dropId(id, forgotten);
    if (worstKey) capSkip.add(worstKey);
  }

  for (const id of geoIds) {
    const kit = memKits.get(id);
    if (!kit) continue;
    if (kit.fade) restoreFade(id, kit.fade);
    memKits.delete(id);
  }

  if (forgotten.length) {
    forgetIds(forgotten);
    forgetFades(forgotten);
    forgetShattered(forgotten);
  }

  const rows = applyLod(
    geoRows.filter((row) => memory.has(row.id)),
    camX,
    camZ,
  );
  return { rows, volumes: volumesOf(rows) };
}

/** Sidecar. Missing id samples h once for the rebuild. It does not invent a band. */
export function groundFor(id: string, x: number, z: number): number {
  return memory.get(id)?.groundY ?? postureHeight(x, z);
}

/** Stored once. The card does not re-sample this every frame. */
export function rememberedGroundY(id: string): number | undefined {
  return memory.get(id)?.groundY;
}

export function memoryCount(): number {
  return memory.size;
}

export function memKitOf(id: string): MemKit | undefined {
  return memKits.get(id);
}

export function resetField() {
  spawnCache.clear();
  memory.clear();
  memKits.clear();
  resetHowl();
}
