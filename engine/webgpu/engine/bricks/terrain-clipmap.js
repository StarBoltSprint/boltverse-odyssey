// Camera-centred clipmap. Levels share one centre, so a coarse edge is a subset of the
// fine edge. Odd fine-edge vertices sit on the coarse segment (averaged height) so the
// rings meet without a crack and without a T-junction gap.
// The mesh is only the window around the camera: that window is the stream.

export const HALF = 32;
export const CELL0 = 1;
export const LEVELS = 10;

export function cellOf(level) { return CELL0 * 2 ** level; }
export function outerRadius(level = LEVELS - 1) { return HALF * cellOf(level); }

function rimHeight(level, i, j, camX, camZ, heightOf) {
  const cell = cellOf(level);
  const x = camX + i * cell;
  const z = camZ + j * cell;
  const onRim = level < LEVELS - 1 && (Math.abs(i) === HALF || Math.abs(j) === HALF);
  if (!onRim) return heightOf(x, z);
  const along = Math.abs(i) === HALF ? j : i;
  if ((along & 1) === 0) return heightOf(x, z);
  const cell2 = cell;
  if (Math.abs(i) === HALF) {
    return 0.5 * (heightOf(x, camZ + (j - 1) * cell2) + heightOf(x, camZ + (j + 1) * cell2));
  }
  return 0.5 * (heightOf(camX + (i - 1) * cell2, z) + heightOf(camX + (i + 1) * cell2, z));
}

export function buildLevel(level, camX, camZ, heightOf) {
  const cell = cellOf(level);
  const n = HALF * 2 + 1;
  const inner = level === 0 ? -1 : HALF >> 1;
  const pos = new Float32Array(n * n * 3);
  const patchOf = new Uint16Array(n * n);
  const patches = [];
  const pSide = (HALF * 2) / 8;
  for (let i = -HALF; i <= HALF; i++) {
    for (let j = -HALF; j <= HALF; j++) {
      const y = rimHeight(level, i, j, camX, camZ, heightOf);
      const o = ((i + HALF) * n + (j + HALF)) * 3;
      pos[o] = camX + i * cell;
      pos[o + 1] = y;
      pos[o + 2] = camZ + j * cell;
      const pi = Math.min(pSide - 1, Math.floor((i + HALF) / 8));
      const pj = Math.min(pSide - 1, Math.floor((j + HALF) / 8));
      patchOf[(i + HALF) * n + (j + HALF)] = pi * pSide + pj;
    }
  }
  const idx = [];
  const outside = (i, j) => Math.max(Math.abs(i), Math.abs(j)) > inner;
  const vid = (i, j) => (i + HALF) * n + (j + HALF);
  const used = new Uint8Array(pSide * pSide);
  for (let i = -HALF; i < HALF; i++) {
    for (let j = -HALF; j < HALF; j++) {
      if (level > 0 && !(outside(i, j) || outside(i + 1, j) || outside(i, j + 1) || outside(i + 1, j + 1))) continue;
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1);
      idx.push(a, b, d, a, d, c);
      used[patchOf[a]] = 1;
    }
  }
  for (let p = 0; p < used.length; p++) if (used[p]) patches.push(p);
  return { level, cell, pos, idx: new Uint32Array(idx), patchOf, patches, n };
}

export function buildWindow(camX, camZ, heightOf) {
  const levels = [];
  for (let L = 0; L < LEVELS; L++) levels.push(buildLevel(L, camX, camZ, heightOf));
  return { levels, radius: outerRadius(), camX, camZ };
}

export function pointInMesh(mesh, x, z) {
  const { pos, idx } = mesh;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    if (bary(x, z, pos[a], pos[a + 2], pos[b], pos[b + 2], pos[c], pos[c + 2])) return true;
  }
  return false;
}

function bary(px, pz, ax, az, bx, bz, cx, cz) {
  const v0x = bx - ax, v0z = bz - az, v1x = cx - ax, v1z = cz - az, v2x = px - ax, v2z = pz - az;
  const den = v0x * v1z - v1x * v0z;
  if (Math.abs(den) < 1e-12) return false;
  const u = (v2x * v1z - v1x * v2z) / den;
  const v = (v0x * v2z - v2x * v0z) / den;
  return u >= -1e-5 && v >= -1e-5 && u + v <= 1 + 1e-5;
}

// Shared-edge error. 0 means the fine rim lies on the coarse rim.
export function seamError(fine, coarse) {
  const cellF = fine.cell;
  const n = fine.n;
  let maxDy = 0, missing = 0, checked = 0;
  const map = new Map();
  for (let i = 0; i < coarse.pos.length; i += 3) {
    const x = coarse.pos[i], z = coarse.pos[i + 2];
    map.set(key(x, z), coarse.pos[i + 1]);
  }
  for (let i = -HALF; i <= HALF; i++) {
    for (let j = -HALF; j <= HALF; j++) {
      if (Math.abs(i) !== HALF && Math.abs(j) !== HALF) continue;
      const o = ((i + HALF) * n + (j + HALF)) * 3;
      const x = fine.pos[o], y = fine.pos[o + 1], z = fine.pos[o + 2];
      const along = Math.abs(i) === HALF ? j : i;
      if ((along & 1) === 0) {
        const cy = map.get(key(x, z));
        checked++;
        if (cy === undefined) missing++;
        else maxDy = Math.max(maxDy, Math.abs(cy - y));
      } else {
        const ax = Math.abs(i) === HALF ? x : x - cellF;
        const az = Math.abs(i) === HALF ? z - cellF : z;
        const bx = Math.abs(i) === HALF ? x : x + cellF;
        const bz = Math.abs(i) === HALF ? z + cellF : z;
        const ya = map.get(key(ax, az));
        const yb = map.get(key(bx, bz));
        checked++;
        if (ya === undefined || yb === undefined) missing++;
        else maxDy = Math.max(maxDy, Math.abs(0.5 * (ya + yb) - y));
      }
    }
  }
  return { maxDy, missing, checked };
}

function key(x, z) { return Math.round(x * 1000) + ',' + Math.round(z * 1000); }

export function residentChunks(camX, camZ, chunk = 256) {
  const r = outerRadius();
  const set = new Set();
  const x0 = Math.floor((camX - r) / chunk), x1 = Math.floor((camX + r) / chunk);
  const z0 = Math.floor((camZ - r) / chunk), z1 = Math.floor((camZ + r) / chunk);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) set.add(x + ',' + z);
  return set;
}
