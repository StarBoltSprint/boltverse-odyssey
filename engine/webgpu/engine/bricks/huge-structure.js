// Kilometre landmarks. The foot is the collider. LOD keeps the same corners and the
// same crest; cheaper levels drop edge points that sit inside that silhouette.
// Far copies stay solids. A card is not a level.

import { LIVE_BOLT } from './follow-bolt.js';

export function seatY(spec, heightOf) {
  const foot = footprint(spec);
  let m = Infinity;
  for (const [x, z] of foot) m = Math.min(m, heightOf(x, z));
  const c = heightOf(spec.x, spec.z);
  if (c < m) m = c;
  return m - 0.5;
}

export function footprint(spec) {
  if (spec.kind === 'spire') {
    const hx = spec.hx, hz = spec.hz;
    return [[spec.x - hx, spec.z], [spec.x, spec.z - hz], [spec.x + hx * 0.82, spec.z + hz * 0.15], [spec.x - hx * 0.2, spec.z + hz]];
  }
  const c = Math.cos(spec.yaw), s = Math.sin(spec.yaw);
  const hx = spec.length * 0.5, hz = spec.width * 0.5;
  const local = [[-hx, -hz], [hx * 0.92, -hz * 0.78], [hx * 0.7, hz], [-hx * 0.84, hz * 0.88]];
  return local.map(([x, z]) => [spec.x + x * c - z * s, spec.z + x * s + z * c]);
}

function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

function inset(poly, k) {
  const c = centroid(poly);
  return poly.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);
}

function subdivide(poly, n) {
  if (n <= 1) return poly.slice();
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let s = 0; s < n; s++) {
      const t = s / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function lodSegments(lod) {
  if (lod <= 0) return 4;
  if (lod === 1) return 2;
  return 1;
}

// lod 0 near, 1 mid, 2 far. Corners and crest stay put.
export function buildSolid(spec, lod, heightOf) {
  const y0 = seatY(spec, heightOf);
  const foot = footprint(spec);
  const seg = lodSegments(lod);
  const ring0 = subdivide(foot, seg);
  const topK = spec.kind === 'spire' ? 0 : 0.62;
  const shoulderK = spec.kind === 'spire' ? 0.45 : 0.78;
  const y1 = y0 + spec.height * (spec.kind === 'spire' ? 0.42 : 0.22);
  const y2 = y0 + spec.height;
  const ring1 = inset(subdivide(foot, seg), spec.kind === 'spire' ? 0.62 : 0.9);
  const ring2 = spec.kind === 'spire'
    ? [[spec.x + spec.tip[0], spec.z + spec.tip[1]]]
    : inset(subdivide(foot, seg), topK);
  const rings = [[ring0, y0], [ring1, y1], [ring2, y2]];
  if (spec.kind !== 'spire') rings.splice(1, 0, [inset(subdivide(foot, seg), shoulderK), y0 + spec.height * 0.72]);
  const pos = [];
  const idx = [];
  const mat = spec.material | 0;
  const pushRing = (ring, y) => {
    const base = pos.length / 4;
    for (const [x, z] of ring) pos.push(x, y, z, mat);
    return base;
  };
  const bases = rings.map(([ring, y]) => pushRing(ring, y));
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r][0], b = rings[r + 1][0];
    if (b.length === 1) {
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        idx.push(bases[r] + i, bases[r] + j, bases[r + 1]);
      }
    } else {
      const n = a.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        idx.push(bases[r] + i, bases[r] + j, bases[r + 1] + j, bases[r] + i, bases[r + 1] + j, bases[r + 1] + i);
      }
    }
  }
  const c = centroid(foot);
  const cb = pos.length / 4;
  pos.push(c[0], y0, c[1], mat);
  for (let i = 0; i < ring0.length; i++) {
    const j = (i + 1) % ring0.length;
    idx.push(cb, bases[0] + j, bases[0] + i);
  }
  let maxY = y0;
  for (let i = 1; i < pos.length; i += 4) if (pos[i] > maxY) maxY = pos[i];
  const sphere = boundingSphere(pos);
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), y0, crest: maxY, sphere, mat, id: spec.id, lod };
}

function boundingSphere(pos) {
  let x = 0, y = 0, z = 0, n = 0;
  for (let i = 0; i < pos.length; i += 4) { x += pos[i]; y += pos[i + 1]; z += pos[i + 2]; n++; }
  x /= n; y /= n; z /= n;
  let r = 0;
  for (let i = 0; i < pos.length; i += 4) r = Math.max(r, Math.hypot(pos[i] - x, pos[i + 1] - y, pos[i + 2] - z));
  return { center: [x, y, z], radius: r };
}

export function lodForDistance(d) {
  if (d < 450) return 0;
  if (d < 1600) return 1;
  return 2;
}

export function clearance(poly, x, z, radius = LIVE_BOLT.boltR) {
  let best = Infinity;
  let inside = true;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const abx = b[0] - a[0], abz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / (abx * abx + abz * abz || 1)));
    const dx = x - (a[0] + abx * t), dz = z - (a[1] + abz * t);
    best = Math.min(best, Math.hypot(dx, dz));
    const cross = abx * (z - a[1]) - abz * (x - a[0]);
    if (cross < 0) inside = false;
  }
  return inside ? -best : best - radius;
}

export function pushOut(poly, x, z, radius = LIVE_BOLT.boltR) {
  for (let iter = 0; iter < 4; iter++) {
    if (clearance(poly, x, z, 0) >= 0) {
      let hit = null, hitD = radius;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const abx = b[0] - a[0], abz = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / (abx * abx + abz * abz || 1)));
        const qx = a[0] + abx * t, qz = a[1] + abz * t;
        const d = Math.hypot(x - qx, z - qz);
        if (d < hitD) { hitD = d; hit = [qx, qz, d]; }
      }
      if (!hit || hit[2] >= radius || hit[2] < 1e-6) break;
      const s = radius / hit[2];
      x = hit[0] + (x - hit[0]) * s;
      z = hit[1] + (z - hit[1]) * s;
      break;
    }
    let best = null, bestD = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const abx = b[0] - a[0], abz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * abx + (z - a[1]) * abz) / (abx * abx + abz * abz || 1)));
      const qx = a[0] + abx * t, qz = a[1] + abz * t;
      const d = Math.hypot(x - qx, z - qz);
      if (d < bestD) { bestD = d; best = [qx, qz]; }
    }
    if (!best) break;
    const dx = x - best[0], dz = z - best[1];
    const l = Math.hypot(dx, dz) || 1;
    x = best[0] + (dx / l) * (radius + 0.02);
    z = best[1] + (dz / l) * (radius + 0.02);
  }
  return [x, z];
}
