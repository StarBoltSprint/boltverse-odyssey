import { applyLod, volumesOf } from "./lod";
import { spawnChunk } from "./spawn";
import { CHUNK, LodRow, SpawnRow, Volume } from "./types";

const loaded = new Map<string, SpawnRow[]>();

function key(ix: number, iz: number) {
  return `${ix},${iz}`;
}

/** Chunk stream: keep 3×3 around camera, forget the rest. */
export function tickField(
  camX: number,
  camZ: number,
  _dt: number,
): { rows: LodRow[]; volumes: Volume[] } {
  const cx = Math.floor(camX / CHUNK);
  const cz = Math.floor(camZ / CHUNK);
  const keep = new Set<string>();
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ix = cx + dx;
      const iz = cz + dz;
      const k = key(ix, iz);
      keep.add(k);
      if (!loaded.has(k)) loaded.set(k, spawnChunk(ix, iz));
    }
  }
  for (const k of [...loaded.keys()]) {
    if (!keep.has(k)) loaded.delete(k);
  }

  const all: SpawnRow[] = [];
  for (const rows of loaded.values()) all.push(...rows);

  const rows = applyLod(all, camX, camZ);
  const volumes = volumesOf(rows);
  return { rows, volumes };
}

export function resetField() {
  loaded.clear();
}
