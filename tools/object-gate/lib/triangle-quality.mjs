// Blocking triangle-quality. A noisy depth displace shreds into slivers.
// A Zone B voxel hull (square faces, 90° folds) stays under every limit.
//
// Thresholds (phone 720×1600, vfov 51.47°, object at 30 m):
//   maxAspectP95        8     longest/shortest edge, area-weighted p95
//   sliverAspect       20     a triangle longer than this is a sliver
//   maxSliverFrac    0.02     share of triangles over sliverAspect
//   maxFacingTinyFrac 0.05   facing triangles (normal·view > 0.35) whose
//                            projected area at 30 m is under 1 px
//   maxSpikeFrac     0.03    edges whose face-normals differ by more than 140°
//   maxNormalP90Deg    42    p90 angle between a face and its near-coplanar
//                            neighbours (dot > 0.7). Cube corners are 90° and
//                            are excluded by that dot test.

export const TRI_LIMITS = {
  maxAspectP95: 8,
  sliverAspect: 20,
  maxSliverFrac: 0.02,
  maxFacingTinyFrac: 0.05,
  maxSpikeFrac: 0.03,
  maxNormalP90Deg: 42,
  fovDeg: 51.47,
  distM: 30,
  heightPx: 1600,
  minFacing: 0.35,
};

function triOf(pos, idx, t) {
  const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
  return [
    [pos[i0], pos[i0 + 1], pos[i0 + 2]],
    [pos[i1], pos[i1 + 1], pos[i1 + 2]],
    [pos[i2], pos[i2 + 1], pos[i2 + 2]],
  ];
}
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }

export function scoreTriangles(pos, idx, limits = TRI_LIMITS) {
  const nTri = idx.length / 3;
  const aspects = [];
  const areas = [];
  const normals = [];
  let sliver = 0;
  let facingTiny = 0;
  let facing = 0;
  const focal = (limits.heightPx / 2) / Math.tan((limits.fovDeg * Math.PI / 180) / 2);
  const view = [0, 0, 1];
  for (let t = 0; t < nTri; t++) {
    const [a, b, c] = triOf(pos, idx, t * 3);
    const e0 = len(sub(b, a)), e1 = len(sub(c, b)), e2 = len(sub(a, c));
    const longest = Math.max(e0, e1, e2);
    const shortest = Math.min(e0, e1, e2);
    const aspect = shortest < 1e-8 ? 99 : longest / shortest;
    const cr = cross(sub(b, a), sub(c, a));
    const area = len(cr) * 0.5;
    const n = area < 1e-10 ? [0, 0, 1] : [cr[0] / (2 * area), cr[1] / (2 * area), cr[2] / (2 * area)];
    aspects.push(aspect);
    areas.push(area);
    normals.push(n);
    if (aspect > limits.sliverAspect) sliver++;
    const facingDot = Math.abs(dot(n, view));
    if (facingDot > limits.minFacing) {
      facing++;
      const screen = area * facingDot * (focal * focal) / (limits.distM * limits.distM);
      if (screen < 1) facingTiny++;
    }
  }
  const order = aspects.map((v, i) => [v, areas[i]]).sort((a, b) => a[0] - b[0]);
  let acc = 0;
  const tot = areas.reduce((s, v) => s + v, 0) || 1;
  let p95 = order.length ? order[order.length - 1][0] : 0;
  for (const [v, w] of order) {
    acc += w;
    if (acc >= 0.95 * tot) { p95 = v; break; }
  }
  // adjacency by undirected edge
  const edges = new Map();
  const add = (a, b, t) => {
    const k = a < b ? a + "_" + b : b + "_" + a;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push(t);
  };
  for (let t = 0; t < nTri; t++) add(idx[t * 3], idx[t * 3 + 1], t), add(idx[t * 3 + 1], idx[t * 3 + 2], t), add(idx[t * 3 + 2], idx[t * 3], t);
  let spikes = 0;
  let edgeN = 0;
  const dev = Array.from({ length: nTri }, () => []);
  for (const faces of edges.values()) {
    if (faces.length < 2) continue;
    edgeN++;
    const n0 = normals[faces[0]], n1 = normals[faces[1]];
    const c = Math.max(-1, Math.min(1, dot(n0, n1)));
    const ang = Math.acos(c) * 180 / Math.PI;
    if (ang > 140) spikes++;
    if (c > 0.7) {
      dev[faces[0]].push(ang);
      dev[faces[1]].push(ang);
    }
  }
  const samples = dev.filter((a) => a.length).map((a) => a.reduce((s, v) => s + v, 0) / a.length).sort((a, b) => a - b);
  const p90 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.9))] : 0;
  const sliverFrac = nTri ? sliver / nTri : 1;
  const tinyFrac = facing ? facingTiny / facing : 0;
  const spikeFrac = edgeN ? spikes / edgeN : 0;
  const pass = p95 <= limits.maxAspectP95
    && sliverFrac <= limits.maxSliverFrac
    && tinyFrac <= limits.maxFacingTinyFrac
    && spikeFrac <= limits.maxSpikeFrac
    && p90 <= limits.maxNormalP90Deg;
  return {
    tris: nTri,
    aspectP95: +p95.toFixed(3),
    sliverFrac: +sliverFrac.toFixed(4),
    facingTinyFrac: +tinyFrac.toFixed(4),
    spikeFrac: +spikeFrac.toFixed(4),
    normalP90Deg: +p90.toFixed(2),
    pass,
    limits,
  };
}

function pushTri(pos, idx, a, b, c) {
  const base = pos.length / 3;
  pos.push(...a, ...b, ...c);
  idx.push(base, base + 1, base + 2);
}

/** 4×4×4 clean cubes. Square faces, aspect √2. */
export function cleanHullFixture() {
  const pos = [], idx = [];
  const n = 4;
  const cell = 0.5;
  const occ = new Set();
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) occ.add(`${x}_${y}_${z}`);
  const faces = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]],
    [-1, 0, 0, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [0, 1, 0, [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]],
    [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [0, 0, 1, [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]]],
    [0, 0, -1, [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]],
  ];
  for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
    for (const [dx, dy, dz, corners] of faces) {
      if (occ.has(`${x + dx}_${y + dy}_${z + dz}`)) continue;
      const p = corners.map(([cx, cy, cz]) => [(x + cx) * cell, (y + cy) * cell, (z + cz) * cell]);
      pushTri(pos, idx, p[0], p[1], p[2]);
      pushTri(pos, idx, p[0], p[2], p[3]);
    }
  }
  return { pos, idx };
}

/** Depth tear: each quad jumps 4 m across a 5 cm pixel. Solids2 triangle soup. */
export function noisyDepthFixture() {
  const pos = [], idx = [];
  const n = 24;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const z0 = (i % 2) ? 0 : 4;
    const z1 = (i % 2) ? 4 : 0;
    const a = [i * 0.05, j * 0.05, z0];
    const b = [(i + 1) * 0.05, j * 0.05, z1];
    const c = [(i + 1) * 0.05, (j + 1) * 0.05, z1];
    const d = [i * 0.05, (j + 1) * 0.05, z0];
    pushTri(pos, idx, a, b, c);
    pushTri(pos, idx, a, c, d);
  }
  return { pos, idx };
}
