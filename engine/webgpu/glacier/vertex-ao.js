// In-house per-vertex ambient occlusion. 64 cosine-weighted hemisphere rays.
// Static world only. No dependencies. The result multiplies ambient only;
// this module just returns the factor.

const RAYS = 64;
const RADIUS = 3.4;
const BIAS = 0.05;

const DIRS = [];
for (let i = 0; i < RAYS; i++) {
  const r1 = (i + 0.5) / RAYS;
  const r2 = (i * 0.618033988749895) % 1;
  const phi = 2 * Math.PI * r2;
  const s = Math.sqrt(r1);
  const c = Math.sqrt(Math.max(0, 1 - r1));
  DIRS.push([Math.cos(phi) * s, c, Math.sin(phi) * s]);
}

function pushTri(dst, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;
  const l = Math.hypot(nx, ny, nz);
  if (!(l > 1e-6)) return false;
  nx /= l; ny /= l; nz /= l;
  const minx = Math.min(ax, bx, cx);
  const miny = Math.min(ay, by, cy);
  const minz = Math.min(az, bz, cz);
  const maxx = Math.max(ax, bx, cx);
  const maxy = Math.max(ay, by, cy);
  const maxz = Math.max(az, bz, cz);
  dst.push(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz, minx, miny, minz, maxx, maxy, maxz);
  return true;
}

function buildBvh(tri, ids) {
  const n = ids.length;
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = ids[i];
  const maxNodes = Math.max(1, n * 2 + 4);
  const bmin = new Float32Array(maxNodes * 3);
  const bmax = new Float32Array(maxNodes * 3);
  const left = new Int32Array(maxNodes);
  const right = new Int32Array(maxNodes);
  const isLeaf = new Uint8Array(maxNodes);
  let nNodes = 0;
  const cent = (i, axis) => {
    const o = order[i] * 18;
    return (tri[o + axis] + tri[o + 3 + axis] + tri[o + 6 + axis]) / 3;
  };
  const swap = (a, b) => { const t = order[a]; order[a] = order[b]; order[b] = t; };
  function rec(start, count) {
    const id = nNodes++;
    let minx = 1e30, miny = 1e30, minz = 1e30, maxx = -1e30, maxy = -1e30, maxz = -1e30;
    for (let i = 0; i < count; i++) {
      const o = order[start + i] * 18;
      for (let p = 0; p < 9; p += 3) {
        const x = tri[o + p], y = tri[o + p + 1], z = tri[o + p + 2];
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (z < minz) minz = z;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
        if (z > maxz) maxz = z;
      }
    }
    bmin[id * 3] = minx; bmin[id * 3 + 1] = miny; bmin[id * 3 + 2] = minz;
    bmax[id * 3] = maxx; bmax[id * 3 + 1] = maxy; bmax[id * 3 + 2] = maxz;
    if (count <= 6) {
      isLeaf[id] = 1; left[id] = start; right[id] = count; return;
    }
    const ext = [maxx - minx, maxy - miny, maxz - minz];
    let axis = 0;
    if (ext[1] > ext[axis]) axis = 1;
    if (ext[2] > ext[axis]) axis = 2;
    const midI = start + (count >> 1);
    const end = start + count - 1;
    if (cent(start, axis) > cent(midI, axis)) swap(start, midI);
    if (cent(midI, axis) > cent(end, axis)) swap(midI, end);
    if (cent(start, axis) > cent(midI, axis)) swap(start, midI);
    const pivot = cent(midI, axis);
    swap(midI, end);
    let s = start;
    for (let i = start; i < end; i++) {
      if (cent(i, axis) < pivot) { swap(s, i); s++; }
    }
    swap(s, end);
    let leftCount = s - start;
    if (leftCount < 1 || leftCount >= count) leftCount = count >> 1;
    left[id] = nNodes;
    rec(start, leftCount);
    right[id] = nNodes;
    rec(start + leftCount, count - leftCount);
  }
  if (n) rec(0, n);
  return { bmin, bmax, left, right, isLeaf, order, nNodes, tri };
}

const STACK = new Int32Array(256);

function dist2Box(bvh, n, x, y, z) {
  const o = n * 3;
  const dx = x < bvh.bmin[o] ? bvh.bmin[o] - x : x > bvh.bmax[o] ? x - bvh.bmax[o] : 0;
  const dy = y < bvh.bmin[o + 1] ? bvh.bmin[o + 1] - y : y > bvh.bmax[o + 1] ? y - bvh.bmax[o + 1] : 0;
  const dz = z < bvh.bmin[o + 2] ? bvh.bmin[o + 2] - z : z > bvh.bmax[o + 2] ? z - bvh.bmax[o + 2] : 0;
  return dx * dx + dy * dy + dz * dz;
}

function sphereNear(bvh, x, y, z) {
  if (!bvh.nNodes) return false;
  const r2 = RADIUS * RADIUS;
  let sp = 0;
  STACK[sp++] = 0;
  while (sp) {
    const n = STACK[--sp];
    if (dist2Box(bvh, n, x, y, z) > r2) continue;
    if (bvh.isLeaf[n]) return true;
    STACK[sp++] = bvh.left[n];
    STACK[sp++] = bvh.right[n];
  }
  return false;
}

function rayBox(bvh, n, ox, oy, oz, ix, iy, iz) {
  const o = n * 3;
  let t0 = BIAS;
  let t1 = RADIUS;
  const orig = [ox, oy, oz];
  const inv = [ix, iy, iz];
  for (let a = 0; a < 3; a++) {
    let ta = (bvh.bmin[o + a] - orig[a]) * inv[a];
    let tb = (bvh.bmax[o + a] - orig[a]) * inv[a];
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  return true;
}

function rayOccluded(bvh, ox, oy, oz, dx, dy, dz) {
  if (!bvh.nNodes) return false;
  const ix = Math.abs(dx) > 1e-12 ? 1 / dx : (dx >= 0 ? 1e30 : -1e30);
  const iy = Math.abs(dy) > 1e-12 ? 1 / dy : (dy >= 0 ? 1e30 : -1e30);
  const iz = Math.abs(dz) > 1e-12 ? 1 / dz : (dz >= 0 ? 1e30 : -1e30);
  let sp = 0;
  STACK[sp++] = 0;
  while (sp) {
    const n = STACK[--sp];
    if (!rayBox(bvh, n, ox, oy, oz, ix, iy, iz)) continue;
    if (bvh.isLeaf[n]) {
      const s = bvh.left[n];
      const c = bvh.right[n];
      for (let i = 0; i < c; i++) {
        if (hitTri(ox, oy, oz, dx, dy, dz, bvh.tri, bvh.order[s + i] * 18)) return true;
      }
    } else {
      STACK[sp++] = bvh.left[n];
      STACK[sp++] = bvh.right[n];
    }
  }
  return false;
}

function hitTri(ox, oy, oz, dx, dy, dz, tri, o) {
  const ax = tri[o], ay = tri[o + 1], az = tri[o + 2];
  const e1x = tri[o + 3] - ax, e1y = tri[o + 4] - ay, e1z = tri[o + 5] - az;
  const e2x = tri[o + 6] - ax, e2y = tri[o + 7] - ay, e2z = tri[o + 8] - az;
  const px = dy * e2z - dz * e2y;
  const py = dz * e2x - dx * e2z;
  const pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (det > -1e-7 && det < 1e-7) return false;
  const inv = 1 / det;
  const sx = ox - ax, sy = oy - ay, sz = oz - az;
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return false;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t > BIAS && t < RADIUS;
}

function frame(nx, ny, nz) {
  const ax = Math.abs(ny) < 0.9 ? 0 : 1;
  const ay = Math.abs(ny) < 0.9 ? 1 : 0;
  const az = 0;
  let tx = ay * nz - az * ny;
  let ty = az * nx - ax * nz;
  let tz = ax * ny - ay * nx;
  const l = Math.hypot(tx, ty, tz) || 1;
  tx /= l; ty /= l; tz /= l;
  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;
  return [tx, ty, tz, bx, by, bz];
}

function visibilityAt(x, y, z, nx, ny, nz, solid, groundBvh, sourceGround) {
  if (sourceGround && !sphereNear(solid, x, y, z)) return 1;
  const fr = frame(nx, ny, nz);
  const ox = x + nx * BIAS;
  const oy = y + ny * BIAS;
  const oz = z + nz * BIAS;
  let hit = 0;
  for (let i = 0; i < RAYS; i++) {
    const d = DIRS[i];
    const dx = fr[0] * d[0] + nx * d[1] + fr[3] * d[2];
    const dy = fr[1] * d[0] + ny * d[1] + fr[4] * d[2];
    const dz = fr[2] * d[0] + nz * d[1] + fr[5] * d[2];
    let blocked = rayOccluded(solid, ox, oy, oz, dx, dy, dz);
    if (!blocked && !sourceGround) blocked = rayOccluded(groundBvh, ox, oy, oz, dx, dy, dz);
    if (blocked) hit++;
  }
  return 1 - hit / RAYS;
}

function xform(p, inst) {
  const x = inst[0], y = inst[1], z = inst[2], yaw = inst[3];
  const sx = inst[4], sy = inst[5], sz = inst[6], lean = inst[7];
  const px = p[0] * sx, py = p[1] * sy, pz = p[2] * sz;
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const pLx = cl * px - sl * py, pLy = sl * px + cl * py, pLz = pz;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [c * pLx + s * pLz + x, pLy + y, -s * pLx + c * pLz + z];
}

function addMesh(store, verts, floorAt, instances) {
  const n = verts.length / 8;
  if (instances) {
    const count = instances.length / 8;
    for (let k = 0; k < count; k++) {
      const inst = instances.subarray(k * 8, k * 8 + 8);
      for (let t = 0; t + 24 <= n * 8; t += 24) {
        const A = xform([verts[t], verts[t + 1], verts[t + 2]], inst);
        const B = xform([verts[t + 8], verts[t + 9], verts[t + 10]], inst);
        const C = xform([verts[t + 16], verts[t + 17], verts[t + 18]], inst);
        if (pushTri(store.floats, A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2])) store.ground.push(0);
      }
    }
    return;
  }
  for (let t = 0; t + 24 <= verts.length; t += 24) {
    const mat = Math.round(verts[t + 3]);
    const ax = verts[t], ay = verts[t + 1], az = verts[t + 2];
    const bx = verts[t + 8], by = verts[t + 9], bz = verts[t + 10];
    const cx = verts[t + 16], cy = verts[t + 17], cz = verts[t + 18];
    const before = store.floats.length;
    if (!pushTri(store.floats, ax, ay, az, bx, by, bz, cx, cy, cz)) continue;
    let ground = 0;
    if (mat === 0) {
      const mx = (ax + bx + cx) / 3;
      const my = (ay + by + cy) / 3;
      const mz = (az + bz + cz) / 3;
      const h = my - floorAt(mx, mz);
      const ny = store.floats[before + 10];
      // The ground sheet stays out of the occluder set. Tall snow (ridges,
      // spires) stays in, so a base can darken.
      if (h < 1.6 && ny > 0.45) ground = 1;
    }
    store.ground.push(ground);
  }
}

function contactPower(solid, groundBvh, probes) {
  if (!probes.length) return { power: 1, meanVis: 1, n: 0, aoTarget: 1 };
  let vis = 0;
  for (const p of probes) {
    vis += visibilityAt(p[0], p[1], p[2], p[3], p[4], p[5], solid, groundBvh, 1);
  }
  vis /= probes.length;
  // Target AO on an up face so ambient-only occlusion clears 15% with margin.
  // visibility 1 stays 1 for any exponent.
  const amb = probes.amb;
  const sun = probes.sun;
  const L1 = amb + sun;
  const aoTarget = Math.min(0.85, Math.max(0.2, ((1 - 0.30) * L1 - sun) / Math.max(1e-4, amb)));
  let power = 1;
  if (vis < 0.98 && vis > 0.05) {
    power = Math.log(aoTarget) / Math.log(vis);
    if (!Number.isFinite(power)) power = 1;
    power = Math.min(4, Math.max(1, power));
  }
  return { power, meanVis: vis, n: probes.length, aoTarget };
}

export function bakeVertexAo(verts, extras, floorAt, energy) {
  const t0 = Date.now();
  const store = { floats: [], ground: [] };
  addMesh(store, verts, floorAt, null);
  for (const ex of extras) addMesh(store, ex.verts, floorAt, ex.instances);
  const nTri = store.ground.length;
  const tri = new Float32Array(store.floats);
  const ground = Uint8Array.from(store.ground);
  const solidIds = [];
  const groundIds = [];
  for (let t = 0; t < nTri; t++) (ground[t] ? groundIds : solidIds).push(t);
  const solid = buildBvh(tri, solidIds);
  const groundBvh = buildBvh(tri, groundIds);
  const probes = [];
  probes.amb = energy.amb;
  probes.sun = energy.sun;
  // A few bases along the near rift, 0.45 m out from a wall-like face.
  const seen = new Set();
  for (let t = 0; t < nTri && probes.length < 16; t++) {
    if (ground[t]) continue;
    const o = t * 18;
    const ny = tri[o + 10];
    if (ny > 0.55) continue;
    const mx = (tri[o] + tri[o + 3] + tri[o + 6]) / 3;
    const my = Math.min(tri[o + 1], tri[o + 4], tri[o + 7]);
    const mz = (tri[o + 2] + tri[o + 5] + tri[o + 8]) / 3;
    if (mz < -280 || mz > 40) continue;
    if (my - floorAt(mx, mz) > 0.8) continue;
    const nx = tri[o + 9], nz = tri[o + 11];
    const h = Math.hypot(nx, nz);
    if (h < 0.35) continue;
    const bucket = Math.round(mz / 18);
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    probes.push([mx + (nx / h) * 0.45, floorAt(mx, mz) + 0.08, mz + (nz / h) * 0.45, 0, 1, 0]);
  }
  const fit = contactPower(solid, groundBvh, probes);
  const nVerts = verts.length / 8;
  const ao = new Float32Array(nVerts);
  const cache = new Map();
  let traced = 0;
  for (let i = 0; i < nVerts; i++) {
    const x = verts[i * 8], y = verts[i * 8 + 1], z = verts[i * 8 + 2];
    const nx = verts[i * 8 + 4], ny = verts[i * 8 + 5], nz = verts[i * 8 + 6];
    const mat = Math.round(verts[i * 8 + 3]);
    const qk = (Math.round(x * 40)) + ',' + (Math.round(y * 40)) + ',' + (Math.round(z * 40))
      + ':' + (Math.round(nx * 4)) + ',' + (Math.round(ny * 4)) + ',' + (Math.round(nz * 4))
      + ':' + (mat === 0 ? 1 : 0);
    const hit = cache.get(qk);
    if (hit !== undefined) { ao[i] = hit; continue; }
    const sourceGround = mat === 0 && (y - floorAt(x, z) < 1.6);
    const vis = visibilityAt(x, y, z, nx, ny, nz, solid, groundBvh, sourceGround);
    if (vis < 0.999) traced++;
    const v = vis >= 0.999 ? 1 : Math.pow(Math.max(0, vis), fit.power);
    cache.set(qk, v);
    ao[i] = v;
  }
  let open = 0;
  let openN = 0;
  let contact = 0;
  let contactN = 0;
  for (let i = 0; i < nVerts; i += 7) {
    if (Math.round(verts[i * 8 + 3]) !== 0) continue;
    const y = verts[i * 8 + 1];
    const ny = verts[i * 8 + 5];
    if (ny < 0.75) continue;
    if (y - floorAt(verts[i * 8], verts[i * 8 + 2]) > 1.2) continue;
    if (ao[i] > 0.999) { open += ao[i]; openN++; }
    else { contact += ao[i]; contactN++; }
  }
  return {
    ao,
    ms: Date.now() - t0,
    rays: RAYS,
    radius: RADIUS,
    power: +fit.power.toFixed(3),
    probeVis: +fit.meanVis.toFixed(3),
    probeN: fit.n,
    aoTarget: +fit.aoTarget.toFixed(3),
    tris: nTri,
    traced,
    unique: cache.size,
    meanContactAo: contactN ? +(contact / contactN).toFixed(3) : null,
    meanOpenAo: openN ? +(open / openN).toFixed(4) : null,
    openVerts: openN,
    contactVerts: contactN,
  };
}
