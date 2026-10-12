// Triangle quality. A noisy depth displacement fails. A coarse smooth hull passes.
// Thresholds are the rock-profile defaults. A scene may tighten them.

export const TRI_LIMITS = {
  maxAspectP95: 8,
  aspectSliver: 12,
  maxSliverFraction: 0.03,
  minDihedralDeg: 28,
  maxDihedralOutlier: 0.08,
  maxNormalVarDeg: 22,
  tinyPx: 1.5,
  maxTinyFragments: 400,
  viewDistM: 30,
  viewW: 720,
  viewH: 1600,
  viewFovY: 52,
};

function weld(pos, idx) {
  const key = (i) => {
    const o = i * 3;
    return `${Math.round(pos[o] * 1e3)},${Math.round(pos[o + 1] * 1e3)},${Math.round(pos[o + 2] * 1e3)}`;
  };
  const map = new Map();
  const id = (i) => {
    const k = key(i);
    if (!map.has(k)) map.set(k, map.size);
    return map.get(k);
  };
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = id(idx[t]), b = id(idx[t + 1]), c = id(idx[t + 2]);
    if (a !== b && b !== c && a !== c) tris.push([a, b, c]);
  }
  const verts = new Array(map.size);
  for (let i = 0; i < idx.length; i++) {
    const v = id(idx[i]);
    if (!verts[v]) {
      const o = idx[i] * 3;
      verts[v] = [pos[o], pos[o + 1], pos[o + 2]];
    }
  }
  return { verts, tris };
}

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const L = len(a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }

function p95(values) {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
}

/** Project and count triangles whose screen area is under tinyPx at viewDistM. */
function tinyFragments(verts, tris, limits) {
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) {
    if (!v) continue;
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]); }
  }
  const c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const eye = [c[0], c[1], c[2] + limits.viewDistM];
  const fwd = norm(sub(c, eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = norm(cross(right, fwd));
  const fy = (limits.viewH / 2) / Math.tan((limits.viewFovY * Math.PI / 180) / 2);
  const fx = fy;
  const cx = limits.viewW / 2, cy = limits.viewH / 2;
  const proj = (p) => {
    const d = sub(p, eye);
    const z = dot(d, fwd);
    if (z < 0.05) return null;
    return [cx + (dot(d, right) / z) * fx, cy - (dot(d, up) / z) * fy];
  };
  let tiny = 0;
  for (const [ia, ib, ic] of tris) {
    const A = proj(verts[ia]), B = proj(verts[ib]), C = proj(verts[ic]);
    if (!A || !B || !C) continue;
    const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) * 0.5;
    if (area < limits.tinyPx) tiny++;
  }
  return tiny;
}

export function scoreTriangles(pos, idx, limits = TRI_LIMITS) {
  const L = { ...TRI_LIMITS, ...limits };
  const { verts, tris } = weld(pos, idx);
  const aspects = [];
  const normals = [];
  const areas = [];
  let slivers = 0;
  for (const [ia, ib, ic] of tris) {
    const a = verts[ia], b = verts[ib], c = verts[ic];
    const e = [len(sub(b, a)), len(sub(c, b)), len(sub(a, c))].sort((x, y) => x - y);
    const aspect = e[0] < 1e-8 ? 999 : e[2] / e[0];
    aspects.push(aspect);
    if (aspect > L.aspectSliver) slivers++;
    const n = cross(sub(b, a), sub(c, a));
    const area = len(n) * 0.5;
    areas.push(area);
    normals.push(area > 1e-10 ? norm(n) : [0, 0, 0]);
  }
  const edgeFaces = new Map();
  tris.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const u = t[k], v = t[(k + 1) % 3];
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      if (!edgeFaces.has(key)) edgeFaces.set(key, []);
      edgeFaces.get(key).push(ti);
    }
  });
  let interior = 0, outliers = 0;
  const jumps = [];
  for (const faces of edgeFaces.values()) {
    if (faces.length !== 2) continue;
    interior++;
    const ang = Math.acos(Math.min(1, Math.max(-1, dot(normals[faces[0]], normals[faces[1]])))) * 180 / Math.PI;
    // 0° = coplanar. A spike folds the faces toward each other (large angle).
    if (ang > 180 - L.minDihedralDeg) outliers++;
    jumps.push(ang);
  }
  const sliverFraction = tris.length ? slivers / tris.length : 0;
  const dihedralOutlier = interior ? outliers / interior : 0;
  const normalVarDeg = jumps.length ? jumps.reduce((s, v) => s + v, 0) / jumps.length : 0;
  const tiny = tinyFragments(verts, tris, L);
  const aspectP95 = p95(aspects);
  const fails = [];
  if (aspectP95 > L.maxAspectP95) fails.push(`aspect p95 ${aspectP95.toFixed(2)} > ${L.maxAspectP95}`);
  if (sliverFraction > L.maxSliverFraction) fails.push(`sliver fraction ${sliverFraction.toFixed(3)} > ${L.maxSliverFraction}`);
  if (dihedralOutlier > L.maxDihedralOutlier) fails.push(`dihedral outliers ${dihedralOutlier.toFixed(3)} > ${L.maxDihedralOutlier}`);
  if (normalVarDeg > L.maxNormalVarDeg) fails.push(`mean normal jump ${normalVarDeg.toFixed(1)}° > ${L.maxNormalVarDeg}°`);
  if (tiny > L.maxTinyFragments) fails.push(`screen fragments ${tiny} > ${L.maxTinyFragments} at ${L.viewDistM} m`);
  return {
    tris: tris.length,
    aspectP95: +aspectP95.toFixed(3),
    sliverFraction: +sliverFraction.toFixed(4),
    dihedralOutlier: +dihedralOutlier.toFixed(4),
    normalVarDeg: +normalVarDeg.toFixed(2),
    tinyFragments: tiny,
    pass: fails.length === 0,
    fails,
  };
}

/** Grid mesh. noisy=true displaces Z with high-frequency noise (the solids2 failure). */
export function gridMesh(n, noisy) {
  const pos = [];
  const idx = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = i * 0.4, y = j * 0.4;
      let z = 0.15 * Math.sin(i / 3) * Math.cos(j / 4);
      if (noisy) z += (((i * 17 + j * 13) % 7) - 3) * 0.35;
      pos.push(x, y, z);
    }
  }
  const w = n + 1;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * w + i;
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }
  return { pos, idx };
}
