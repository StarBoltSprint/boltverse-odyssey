// Heightfield sampled from the baked key grid. Topology matches createDuneField
// (same cell, same LODs, same skirt) so the vertex cost does not move.

export async function loadGrid(binUrl, jsonUrl) {
  const meta = await (await fetch(jsonUrl)).json();
  const buf = await (await fetch(binUrl)).arrayBuffer();
  const heights = new Float32Array(buf);
  if (heights.length !== meta.nx * meta.nz) {
    throw new Error(`height bin ${heights.length} != ${meta.nx}*${meta.nz}`);
  }
  return { ...meta, heights };
}

export function createKeyedField(biome, grid) {
  const R = biome.ground.relief || {};
  const cellM = R.cellM ?? 64;
  const lods = R.lods ?? [[96, 32], [192, 16], [400, 8]];
  const lattice = cellM / lods[0][1];
  const skirtM = R.skirtM ?? 1.5;
  const originX = grid.origin[0];
  const originZ = grid.origin[1];
  const step = grid.step;
  const nx = grid.nx;
  const nz = grid.nz;
  const H = grid.heights;
  const heading = (grid.avenue && grid.avenue.headingDeg) || 78;

  function fieldHeight(x, z) {
    let fx = (x - originX) / step - 0.5;
    let fz = (z - originZ) / step - 0.5;
    fx = Math.min(nx - 1.001, Math.max(0, fx));
    fz = Math.min(nz - 1.001, Math.max(0, fz));
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const x1 = Math.min(x0 + 1, nx - 1), z1 = Math.min(z0 + 1, nz - 1);
    const i00 = z0 * nx + x0, i10 = z0 * nx + x1, i01 = z1 * nx + x0, i11 = z1 * nx + x1;
    return H[i00] * (1 - tx) * (1 - tz) + H[i10] * tx * (1 - tz) + H[i01] * (1 - tx) * tz + H[i11] * tx * tz;
  }

  function surfaceHeight(x, z) {
    const gx = x / lattice, gz = z / lattice;
    const i = Math.floor(gx), j = Math.floor(gz);
    const fx = gx - i, fz = gz - j;
    const h00 = fieldHeight(i * lattice, j * lattice);
    const h11 = fieldHeight((i + 1) * lattice, (j + 1) * lattice);
    if (fx >= fz) {
      const h10 = fieldHeight((i + 1) * lattice, j * lattice);
      return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    }
    const h01 = fieldHeight(i * lattice, (j + 1) * lattice);
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }

  function normalAt(x, z, e = 0.75) {
    const hx = fieldHeight(x + e, z) - fieldHeight(x - e, z);
    const hz = fieldHeight(x, z + e) - fieldHeight(x, z - e);
    const nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }

  const slopeDegAt = (x, z) => (Math.acos(Math.min(1, normalAt(x, z)[1])) * 180) / Math.PI;

  function cellGeometry(cx, cz, res) {
    const n = res + 1, stepC = cellM / res, skirt = skirtM;
    const vCount = n * n + 4 * n;
    const pos = new Float32Array(vCount * 3), nor = new Float32Array(vCount * 3);
    let v = 0;
    const put = (x, y, z) => {
      const nn = normalAt(x, z);
      pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
      nor[v * 3] = nn[0]; nor[v * 3 + 1] = nn[1]; nor[v * 3 + 2] = nn[2];
      return v++;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = cx * cellM + i * stepC, z = cz * cellM + j * stepC;
      put(x, fieldHeight(x, z), z);
    }
    const idx = [];
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx.push(a, d, b, a, c, d);
    }
    const edges = [
      [...Array(n).keys()].map((i) => i),
      [...Array(n).keys()].map((i) => res * n + (res - i)),
      [...Array(n).keys()].map((j) => (res - j) * n),
      [...Array(n).keys()].map((j) => j * n + res),
    ];
    for (const e of edges) {
      const base = e.map((k) => put(pos[k * 3], pos[k * 3 + 1] - skirt, pos[k * 3 + 2]));
      for (let k = 0; k < e.length - 1; k++) idx.push(e[k], base[k], e[k + 1], e[k + 1], base[k], base[k + 1]);
    }
    return { positions: pos.subarray(0, v * 3), normals: nor.subarray(0, v * 3), indices: Uint32Array.from(idx), tris: idx.length / 3 };
  }

  const hd = heading * Math.PI / 180;
  const avenueX = (z) => {
    // straight lane through the spawn, heading fixed. Meander stays in the baked grid.
    const ox = grid.camera.x, oz = grid.camera.z;
    const fx = Math.sin(hd), fz = -Math.cos(hd);
    const along = ((z - oz) * fz + 0 * fx);
    return ox + (z - oz) * (fx / (fz || 1e-6)) * 0 + ox;
  };
  // The page only uses avenueX as a spawn fallback. The keyed camera replaces that.
  return {
    enabled: true,
    seed: 1011,
    cellM,
    lods,
    lattice,
    anchors: [],
    fieldHeight,
    surfaceHeight,
    normalAt,
    slopeDegAt,
    avenueX: () => grid.camera.x,
    cellGeometry,
    camera: grid.camera,
    hLo: grid.hLo,
    hHi: grid.hHi,
  };
}
