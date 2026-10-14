/**
 * Ruin colliders built from the drawn loft. Shape only: no pixels, no colour.
 *
 * Body: a 2D signed distance field in the object frame. A cell is a wall when a face of the
 * loft crosses Bolt's body band (floor + stepM .. floor + clearM). Faces above the band (an arch
 * lintel, a hull deck) and faces under it (a buried sill) are not walls, so a real opening stays
 * walkable. Faces just above the relief (up to stepM) lift the floor instead.
 * Camera: a 3D distance to the nearest face sample, for the chase line and the near plane.
 * Mag probe: per-face texel density from the UVs, read only when asked.
 *
 * Nothing here is tuned to one object. A new gate or wreck mesh gets its colliders from its faces.
 */

const INF = 1e20;

export function frameOf(obj, seat) {
  const s = Math.sin(obj.yaw);
  const c = Math.cos(obj.yaw);
  // world = (a*lx + b*lz, c*lx + d*lz) + pos. Same maps as the ruin vertex shader.
  if (obj.frame === "ship") return { a: s, b: -c, c: c, d: s, px: seat.x, py: seat.y, pz: seat.z };
  return { a: c, b: s, c: -s, d: c, px: seat.x, py: seat.y, pz: seat.z };
}

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/** Exact Euclidean distance (in cells) from each cell to the nearest feature cell. dims = [n0, n1, (n2)]. */
export function edt(feature, dims) {
  const total = feature.length;
  const g = new Float64Array(total);
  for (let i = 0; i < total; i++) g[i] = feature[i] ? 0 : INF;
  const maxN = Math.max(...dims);
  const f = new Float64Array(maxN);
  const d = new Float64Array(maxN);
  const v = new Int32Array(maxN);
  const z = new Float64Array(maxN + 1);
  // Row-major with dims[0] fastest.
  const strides = [];
  let st = 1;
  for (let a = 0; a < dims.length; a++) {
    strides.push(st);
    st *= dims[a];
  }
  for (let axis = 0; axis < dims.length; axis++) {
    const n = dims[axis];
    const stride = strides[axis];
    const lines = total / n;
    for (let l = 0; l < lines; l++) {
      // base index of line l along axis
      let rem = l;
      let base = 0;
      for (let a = 0; a < dims.length; a++) {
        if (a === axis) continue;
        const da = dims[a];
        base += (rem % da) * strides[a];
        rem = Math.floor(rem / da);
      }
      for (let q = 0; q < n; q++) f[q] = g[base + q * stride];
      edt1d(f, n, d, v, z);
      for (let q = 0; q < n; q++) g[base + q * stride] = d[q];
    }
  }
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) out[i] = Math.sqrt(g[i]);
  return out;
}

function boxBlur2(src, nx, nz, r) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= nx) continue;
        s += src[z * nx + xx];
        n++;
      }
      tmp[z * nx + x] = s / n;
    }
  }
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      let s = 0;
      let n = 0;
      for (let k = -r; k <= r; k++) {
        const zz = z + k;
        if (zz < 0 || zz >= nz) continue;
        s += tmp[zz * nx + x];
        n++;
      }
      out[z * nx + x] = s / n;
    }
  }
  return out;
}

function boxBlur3(a, nx, ny, nz) {
  const tmp = new Float32Array(a.length);
  const pass = (src, dst, stride, n, outer) => {
    for (let o = 0; o < outer.length; o++) {
      const base = outer[o];
      for (let i = 0; i < n; i++) {
        const k = base + i * stride;
        let s = src[k];
        let c = 1;
        if (i > 0) { s += src[k - stride]; c++; }
        if (i < n - 1) { s += src[k + stride]; c++; }
        dst[k] = s / c;
      }
    }
  };
  const basesX = [];
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) basesX.push((z * ny + y) * nx);
  const basesY = [];
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) basesY.push(z * ny * nx + x);
  const basesZ = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) basesZ.push(y * nx + x);
  pass(a, tmp, 1, nx, basesX);
  pass(tmp, a, nx, ny, basesY);
  pass(a, tmp, nx * ny, nz, basesZ);
  a.set(tmp);
}

/** Visit points on every triangle, spaced at most `spacing` apart. cb(lx, ly, lz, ny, gi, ti). */
function visitFaces(groups, spacing, cb) {
  for (let gi = 0; gi < groups.length; gi++) {
    const p = groups[gi].xyzuv;
    const idx = groups[gi].idx;
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const ia = idx[t] * 5;
      const ib = idx[t + 1] * 5;
      const ic = idx[t + 2] * 5;
      const ax = p[ia], ay = p[ia + 1], az = p[ia + 2];
      const ex = p[ib] - ax, ey = p[ib + 1] - ay, ez = p[ib + 2] - az;
      const fx = p[ic] - ax, fy = p[ic + 1] - ay, fz = p[ic + 2] - az;
      const nxv = ey * fz - ez * fy;
      const nyv = ez * fx - ex * fz;
      const nzv = ex * fy - ey * fx;
      const nl = Math.hypot(nxv, nyv, nzv);
      const ny = nl > 1e-12 ? nyv / nl : 0;
      const e = Math.max(Math.hypot(ex, ey, ez), Math.hypot(fx, fy, fz), Math.hypot(ex - fx, ey - fy, ez - fz));
      const n = Math.max(1, Math.ceil(e / spacing));
      if (n === 1) {
        cb(ax, ay, az, ny, gi, t);
        cb(ax + ex, ay + ey, az + ez, ny, gi, t);
        cb(ax + fx, ay + fy, az + fz, ny, gi, t);
        cb(ax + (ex + fx) / 3, ay + (ey + fy) / 3, az + (ez + fz) / 3, ny, gi, t);
        continue;
      }
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        for (let j = 0; j <= n - i; j++) {
          const w = j / n;
          cb(ax + u * ex + w * fx, ay + u * ey + w * fy, az + u * ez + w * fz, ny, gi, t);
        }
      }
    }
  }
}

/**
 * Build the colliders for one placed ruin.
 * groups: [{ skin, xyzuv, idx }] in the object frame. frame: frameOf(). heightAt: world relief.
 */
export function buildCollider(groups, frame, heightAt, opt = {}) {
  const cellM = opt.cellM || 0.1;
  const voxM = opt.voxM || 0.15;
  const stepM = opt.stepM == null ? 0.25 : opt.stepM;
  const clearM = opt.clearM || 1.3;
  const padM = opt.padM || 1.2;
  const spacing = Math.min(cellM, voxM) * 0.5;
  let minX = INF, minY = INF, minZ = INF, maxX = -INF, maxY = -INF, maxZ = -INF;
  for (let gi = 0; gi < groups.length; gi++) {
    const p = groups[gi].xyzuv;
    for (let i = 0; i < p.length; i += 5) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
      if (p[i + 2] < minZ) minZ = p[i + 2];
      if (p[i + 2] > maxZ) maxZ = p[i + 2];
    }
  }
  const { a, b, c, d, px, py, pz } = frame;
  const toWorldX = (lx, lz) => a * lx + b * lz + px;
  const toWorldZ = (lx, lz) => c * lx + d * lz + pz;

  // Body grid.
  const gx0 = minX - padM;
  const gz0 = minZ - padM;
  const nx = Math.ceil((maxX - minX + 2 * padM) / cellM) + 1;
  const nz = Math.ceil((maxZ - minZ + 2 * padM) / cellM) + 1;
  const ground = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const lx = gx0 + (ix + 0.5) * cellM;
      const lz = gz0 + (iz + 0.5) * cellM;
      ground[iz * nx + ix] = heightAt(toWorldX(lx, lz), toWorldZ(lx, lz));
    }
  }
  const liftRaw = new Float32Array(nx * nz);
  const covered = new Uint8Array(nx * nz);

  // Camera voxels.
  const vx0 = minX - padM;
  const vy0 = minY - padM;
  const vz0 = minZ - padM;
  const vnx = Math.ceil((maxX - minX + 2 * padM) / voxM) + 1;
  const vny = Math.ceil((maxY - minY + 2 * padM) / voxM) + 1;
  const vnz = Math.ceil((maxZ - minZ + 2 * padM) / voxM) + 1;
  const occ = new Uint8Array(vnx * vny * vnz);

  visitFaces(groups, spacing, (lx, ly, lz) => {
    const ix = Math.floor((lx - gx0) / cellM);
    const iz = Math.floor((lz - gz0) / cellM);
    if (ix >= 0 && iz >= 0 && ix < nx && iz < nz) {
      const k = iz * nx + ix;
      const h = py + ly - ground[k];
      if (h > -0.02 && h <= stepM && h > liftRaw[k]) liftRaw[k] = h;
      if (h > clearM) covered[k] = 1;
    }
    const vx = Math.floor((lx - vx0) / voxM);
    const vy = Math.floor((ly - vy0) / voxM);
    const vz = Math.floor((lz - vz0) / voxM);
    if (vx >= 0 && vy >= 0 && vz >= 0 && vx < vnx && vy < vny && vz < vnz) occ[(vz * vny + vy) * vnx + vx] = 1;
  });
  const block = new Uint8Array(nx * nz);
  visitFaces(groups, spacing, (lx, ly, lz) => {
    const ix = Math.floor((lx - gx0) / cellM);
    const iz = Math.floor((lz - gz0) / cellM);
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return;
    const k = iz * nx + ix;
    const h = py + ly - ground[k] - liftRaw[k];
    if (h > stepM && h < clearM) block[k] = 1;
  });
  // A space Bolt cannot reach from outside (a pier's hollow, a sealed hull) is solid.
  const seen = new Uint8Array(nx * nz);
  const queue = new Int32Array(nx * nz);
  let qh = 0;
  let qt = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (const iz of [0, nz - 1]) {
      const k = iz * nx + ix;
      if (!block[k] && !seen[k]) { seen[k] = 1; queue[qt++] = k; }
    }
  }
  for (let iz = 0; iz < nz; iz++) {
    for (const ix of [0, nx - 1]) {
      const k = iz * nx + ix;
      if (!block[k] && !seen[k]) { seen[k] = 1; queue[qt++] = k; }
    }
  }
  while (qh < qt) {
    const k = queue[qh++];
    const ix = k % nx;
    const iz = (k - ix) / nx;
    if (ix > 0 && !block[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; queue[qt++] = k - 1; }
    if (ix < nx - 1 && !block[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; queue[qt++] = k + 1; }
    if (iz > 0 && !block[k - nx] && !seen[k - nx]) { seen[k - nx] = 1; queue[qt++] = k - nx; }
    if (iz < nz - 1 && !block[k + nx] && !seen[k + nx]) { seen[k + nx] = 1; queue[qt++] = k + nx; }
  }
  let sealed = 0;
  let wallCells = 0;
  for (let k = 0; k < nx * nz; k++) {
    if (!block[k] && !seen[k]) { block[k] = 1; sealed++; }
    if (block[k]) wallCells++;
  }
  const free = new Uint8Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) free[k] = block[k] ? 0 : 1;
  const dOut = edt(block, [nx, nz]);
  const dIn = edt(free, [nx, nz]);
  const sdRaw = new Float32Array(nx * nz);
  for (let k = 0; k < nx * nz; k++) sdRaw[k] = block[k] ? -(dIn[k] - 0.5) * cellM : (dOut[k] - 0.5) * cellM;
  // One light blur so a stair-stepped wall reads as a smooth wall to the slide.
  const sd = boxBlur2(sdRaw, nx, nz, 1);
  const lift = boxBlur2(boxBlur2(liftRaw, nx, nz, 2), nx, nz, 2);

  const vdist = edt(occ, [vnx, vny, vnz]);
  const df = new Float32Array(vdist.length);
  for (let i = 0; i < df.length; i++) df[i] = Math.max(0, (vdist[i] - 0.5) * voxM);
  // One 3x3x3 box pass: the trilinear field is then smooth enough for the camera to slide on
  // (a raw voxel EDT has a stepped gradient that shakes a sliding eye). Shifts it by < voxM / 3.
  boxBlur3(df, vnx, vny, vnz);

  const toLocalX = (wx, wz) => a * (wx - px) + c * (wz - pz);
  const toLocalZ = (wx, wz) => b * (wx - px) + d * (wz - pz);

  function bil(arr, lx, lz, outside) {
    const fx = (lx - gx0) / cellM - 0.5;
    const fz = (lz - gz0) / cellM - 0.5;
    if (fx < 0 || fz < 0 || fx > nx - 1.001 || fz > nz - 1.001) return outside;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const k = iz * nx + ix;
    const v0 = arr[k] * (1 - tx) + arr[k + 1] * tx;
    const v1 = arr[k + nx] * (1 - tx) + arr[k + nx + 1] * tx;
    return v0 * (1 - tz) + v1 * tz;
  }
  function sdLocal(lx, lz) {
    return bil(sd, lx, lz, padM);
  }
  function dfLocal(lx, ly, lz) {
    const fx = (lx - vx0) / voxM - 0.5;
    const fy = (ly - vy0) / voxM - 0.5;
    const fz = (lz - vz0) / voxM - 0.5;
    if (fx < 0 || fy < 0 || fz < 0 || fx > vnx - 1.001 || fy > vny - 1.001 || fz > vnz - 1.001) {
      // Outside the voxel box: at least the pad away from every face.
      const ox = Math.max(0, -fx, fx - (vnx - 1)) * voxM;
      const oy = Math.max(0, -fy, fy - (vny - 1)) * voxM;
      const oz = Math.max(0, -fz, fz - (vnz - 1)) * voxM;
      return padM + Math.hypot(ox, oy, oz);
    }
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const ty = fy - iy;
    const tz = fz - iz;
    const sx = 1;
    const sy = vnx;
    const sz = vnx * vny;
    const k = (iz * vny + iy) * vnx + ix;
    const c00 = df[k] * (1 - tx) + df[k + sx] * tx;
    const c10 = df[k + sy] * (1 - tx) + df[k + sy + sx] * tx;
    const c01 = df[k + sz] * (1 - tx) + df[k + sz + sx] * tx;
    const c11 = df[k + sz + sy] * (1 - tx) + df[k + sz + sy + sx] * tx;
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
  }
  // Horizontal reach of the faces from the object origin (for a cheap "near" test).
  let reach = 0;
  for (const [x, z] of [[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]]) reach = Math.max(reach, Math.hypot(x, z));
  return {
    cellM, voxM, stepM, clearM, padM, nx, nz, vnx, vny, vnz, reach,
    wallCells, sealed,
    bounds: { minX, minY, minZ, maxX, maxY, maxZ },
    px, py, pz,
    toLocalX, toLocalZ, toWorldX, toWorldZ,
    sdLocal, dfLocal,
    near(wx, wz, extra) {
      return Math.hypot(wx - px, wz - pz) < reach + padM + (extra || 0);
    },
    sd(wx, wz) {
      return sdLocal(toLocalX(wx, wz), toLocalZ(wx, wz));
    },
    /** World-space gradient of the body field (unit length or zero). */
    grad(wx, wz) {
      const lx = toLocalX(wx, wz);
      const lz = toLocalZ(wx, wz);
      const h = cellM;
      const gx = sdLocal(lx + h, lz) - sdLocal(lx - h, lz);
      const gz = sdLocal(lx, lz + h) - sdLocal(lx, lz - h);
      const l = Math.hypot(gx, gz);
      if (l < 1e-9) return [0, 0];
      // local -> world (rotation only)
      return [(a * gx + b * gz) / l, (c * gx + d * gz) / l];
    },
    lift(wx, wz) {
      return bil(lift, toLocalX(wx, wz), toLocalZ(wx, wz), 0);
    },
    covered(wx, wz) {
      const lx = toLocalX(wx, wz);
      const lz = toLocalZ(wx, wz);
      const ix = Math.floor((lx - gx0) / cellM);
      const iz = Math.floor((lz - gz0) / cellM);
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
      return covered[iz * nx + ix] === 1;
    },
    wall(wx, wz) {
      const lx = toLocalX(wx, wz);
      const lz = toLocalZ(wx, wz);
      const ix = Math.floor((lx - gx0) / cellM);
      const iz = Math.floor((lz - gz0) / cellM);
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return false;
      return block[iz * nx + ix] === 1;
    },
    /** Distance from a world point to the nearest drawn face (camera use). */
    dist(wx, wy, wz) {
      return dfLocal(toLocalX(wx, wz), wy - py, toLocalZ(wx, wz));
    },
    /** Raw grids for tests and the selftest dump. */
    grids() {
      return { gx0, gz0, nx, nz, block, liftRaw, ground };
    },
  };
}

/** Texels per metre along the least dense direction of one triangle (min singular value). */
function texDensity(p, ia, ib, ic, tw, th) {
  const ex = p[ib] - p[ia], ey = p[ib + 1] - p[ia + 1], ez = p[ib + 2] - p[ia + 2];
  const fx = p[ic] - p[ia], fy = p[ic + 1] - p[ia + 1], fz = p[ic + 2] - p[ia + 2];
  const le = Math.hypot(ex, ey, ez);
  if (le < 1e-9) return 0;
  const b1x = ex / le, b1y = ey / le, b1z = ez / le;
  const f1 = fx * b1x + fy * b1y + fz * b1z;
  let rx = fx - f1 * b1x, ry = fy - f1 * b1y, rz = fz - f1 * b1z;
  const f2 = Math.hypot(rx, ry, rz);
  if (f2 < 1e-9) return 0;
  // world 2D: q1 = (le, 0), q2 = (f1, f2)
  const t1u = (p[ib + 3] - p[ia + 3]) * tw, t1v = (p[ib + 4] - p[ia + 4]) * th;
  const t2u = (p[ic + 3] - p[ia + 3]) * tw, t2v = (p[ic + 4] - p[ia + 4]) * th;
  // J * [[le, f1],[0, f2]] = [[t1u, t2u],[t1v, t2v]]  => J = T * Q^-1
  const i11 = 1 / le, i12 = -f1 / (le * f2), i22 = 1 / f2;
  const j11 = t1u * i11, j12 = t1u * i12 + t2u * i22;
  const j21 = t1v * i11, j22 = t1v * i12 + t2v * i22;
  // singular values of 2x2
  const s1 = j11 * j11 + j12 * j12 + j21 * j21 + j22 * j22;
  const det = Math.abs(j11 * j22 - j12 * j21);
  const disc = Math.sqrt(Math.max(0, s1 * s1 / 4 - det * det));
  const smin2 = Math.max(0, s1 / 2 - disc);
  return Math.sqrt(smin2);
}

/**
 * Lazy close-up magnification probe. tagOf(gi, ti, cy, ny) names the part a face belongs to.
 * Returns a function (eyeWorld, fwd, right, up, focal, tanH, tanV) -> { tag: { mag, dist, tpm } }.
 */
export function buildMagProbe(groups, frame, texSize, tagOf, spacing = 0.08) {
  const pts = [];
  const tpms = [];
  const tags = [];
  const tagNames = [];
  const tagIndex = new Map();
  const seen = new Map();
  const { a, b, c, d, px, py, pz } = frame;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const p = g.xyzuv;
    const idx = g.idx;
    const [tw, th] = texSize[g.skin] || [1, 1];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const ia = idx[t] * 5, ib = idx[t + 1] * 5, ic = idx[t + 2] * 5;
      const tpm = texDensity(p, ia, ib, ic, tw, th);
      if (!(tpm > 0)) continue;
      const cx = (p[ia] + p[ib] + p[ic]) / 3;
      const cy = (p[ia + 1] + p[ib + 1] + p[ic + 1]) / 3;
      const cz = (p[ia + 2] + p[ib + 2] + p[ic + 2]) / 3;
      const ex = p[ib] - p[ia], ey = p[ib + 1] - p[ia + 1], ez = p[ib + 2] - p[ia + 2];
      const fx = p[ic] - p[ia], fy = p[ic + 1] - p[ia + 1], fz = p[ic + 2] - p[ia + 2];
      const nyv = ez * fx - ex * fz;
      const nl = Math.hypot(ey * fz - ez * fy, nyv, ex * fy - ey * fx) || 1;
      const name = tagOf(gi, t, cy, nyv / nl);
      if (!tagIndex.has(name)) { tagIndex.set(name, tagNames.length); tagNames.push(name); }
      const ti = tagIndex.get(name);
      const e = Math.max(Math.hypot(ex, ey, ez), Math.hypot(fx, fy, fz));
      const n = Math.max(1, Math.ceil(e / spacing));
      for (let i = 0; i <= n; i++) {
        for (let j = 0; j <= n - i; j++) {
          const u = i / n;
          const w = j / n;
          const lx = p[ia] + u * ex + w * fx;
          const ly = p[ia + 1] + u * ey + w * fy;
          const lz = p[ia + 2] + u * ez + w * fz;
          const key = Math.floor(lx / spacing) + "," + Math.floor(ly / spacing) + "," + Math.floor(lz / spacing) + ":" + ti;
          const prev = seen.get(key);
          if (prev != null) {
            if (tpm < tpms[prev]) tpms[prev] = tpm;
            continue;
          }
          seen.set(key, tpms.length);
          pts.push(a * lx + b * lz + px, py + ly, c * lx + d * lz + pz);
          tpms.push(tpm);
          tags.push(ti);
        }
      }
    }
  }
  const P = new Float32Array(pts);
  const T = new Float32Array(tpms);
  const G = new Uint8Array(tags);
  return function probe(eye, fwd, right, up, focal, tanH, tanV) {
    const out = {};
    // near: smallest view depth of a face sample inside the frustum (widened by the sample spacing).
    // Below the camera near plane that face would be cut open on screen.
    for (let i = 0; i < tagNames.length; i++) out[tagNames[i]] = { mag: 0, dist: Infinity, tpm: 0, at: null, near: Infinity };
    for (let i = 0, k = 0; i < T.length; i++, k += 3) {
      const rx = P[k] - eye[0], ry = P[k + 1] - eye[1], rz = P[k + 2] - eye[2];
      const vz = rx * fwd[0] + ry * fwd[1] + rz * fwd[2];
      if (vz < -spacing) continue;
      const vx = rx * right[0] + ry * right[1] + rz * right[2];
      const vy = rx * up[0] + ry * up[1] + rz * up[2];
      if (vz < 1.0) {
        const zc = Math.max(0, vz);
        if (Math.abs(vx) <= tanH * zc + spacing && Math.abs(vy) <= tanV * zc + spacing) {
          const o = out[tagNames[G[i]]];
          if (vz < o.near) o.near = vz;
        }
      }
      if (vz < 0.05) continue;
      if (Math.abs(vx / vz) > tanH || Math.abs(vy / vz) > tanV) continue;
      const dist = Math.hypot(rx, ry, rz);
      const m = focal / (Math.max(0.05, dist) * T[i]);
      const o = out[tagNames[G[i]]];
      if (dist < o.dist) o.dist = dist;
      if (m > o.mag) { o.mag = m; o.tpm = T[i]; o.at = [P[k], P[k + 1], P[k + 2]]; }
    }
    return out;
  };
}
