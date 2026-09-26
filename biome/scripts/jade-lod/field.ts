import { forgetFades } from "./fade";
import { postureHeight } from "./height";
import { applyLod, forgetIds, volumesOf } from "./lod";
import { spawnChunk } from "./spawn";
import { CHUNK, type LodRow, type SpawnRow, type Volume } from "./types";

/** Kits and volumes. 3×3 chunks. */
export const GEO_RING = 1;
/** holdBand, kit.groundY, and fade. 5×5 chunks. */
export const MEM_RING = 2;
/** Ids kept past the geo ring. Evict the farthest past this. */
export const MEM_CAP = 512;

const loaded = new Map<string, SpawnRow[]>();
const memory = new Map<string, { x: number; z: number; groundY: number }>();

function key(ix: number, iz: number) {
  return `${ix},${iz}`;
}

function ringKeys(cx: number, cz: number, ring: number): Set<string> {
  const keep = new Set<string>();
  for (let dz = -ring; dz <= ring; dz++) {
    for (let dx = -ring; dx <= ring; dx++) keep.add(key(cx + dx, cz + dz));
  }
  return keep;
}

function chunkKeyOf(x: number, z: number): string {
  return key(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
}

/**
 * geoRing streams what you can thud. memRing remembers the crown and the ground
 * across a 32 m seam so a bole does not pop. forgetIds runs only on the way out.
 */
export function tickField(
  camX: number,
  camZ: number,
  _dt: number,
): { rows: LodRow[]; volumes: Volume[] } {
  const cx = Math.floor(camX / CHUNK);
  const cz = Math.floor(camZ / CHUNK);
  const mem = ringKeys(cx, cz, MEM_RING);
  const geo = ringKeys(cx, cz, GEO_RING);

  for (const k of mem) {
    if (!loaded.has(k)) {
      const [ix, iz] = k.split(",").map(Number);
      loaded.set(k, spawnChunk(ix, iz));
    }
  }
  for (const k of [...loaded.keys()]) {
    if (!mem.has(k)) loaded.delete(k);
  }

  const memRows: SpawnRow[] = [];
  for (const [k, rows] of loaded) {
    if (!mem.has(k)) continue;
    for (const row of rows) memRows.push(row);
  }

  const live = new Set(memRows.map((row) => row.id));
  const forgotten: string[] = [];
  for (const id of memory.keys()) {
    if (!live.has(id)) {
      forgotten.push(id);
      memory.delete(id);
    }
  }

  const ranked = [...memory.entries()].sort((a, b) => {
    const da = (a[1].x - camX) ** 2 + (a[1].z - camZ) ** 2;
    const db = (b[1].x - camX) ** 2 + (b[1].z - camZ) ** 2;
    return db - da;
  });
  while (memory.size > MEM_CAP && ranked.length) {
    const next = ranked.shift();
    if (!next) break;
    forgotten.push(next[0]);
    memory.delete(next[0]);
  }

  const fresh = memRows
    .filter((row) => !memory.has(row.id))
    .sort((a, b) => {
      const da = (a.x - camX) ** 2 + (a.z - camZ) ** 2;
      const db = (b.x - camX) ** 2 + (b.z - camZ) ** 2;
      return da - db;
    });
  for (const row of fresh) {
    if (memory.size >= MEM_CAP) break;
    memory.set(row.id, { x: row.x, z: row.z, groundY: postureHeight(row.x, row.z) });
  }

  if (forgotten.length) {
    forgetIds(forgotten);
    forgetFades(forgotten);
  }

  const held = memRows.filter((row) => memory.has(row.id));
  const lod = applyLod(held, camX, camZ);
  const rows = lod.filter((row) => geo.has(chunkKeyOf(row.x, row.z)));
  return { rows, volumes: volumesOf(rows) };
}

/** Stored once. The card does not re-sample this every frame. */
export function rememberedGroundY(id: string): number | undefined {
  return memory.get(id)?.groundY;
}

export function resetField() {
  loaded.clear();
  memory.clear();
}
