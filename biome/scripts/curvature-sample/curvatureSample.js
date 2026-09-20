/**
 * Adaptive curvature resampling for living-film path ribbons.
 *
 * Author spline → fine polyline → keep by turning / chord / width / windows
 * → arc-length table + stable normals.
 *
 * Plate UV is [0,1]^2. All distances are in UV units.
 */

function dist(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function normalize(v) {
  const L = Math.hypot(v[0], v[1]);
  if (L < 1e-12) return [0, 0];
  return [v[0] / L, v[1] / L];
}

function perpLeft(t) {
  return [-t[1], t[0]];
}

/** Cubic Bézier at u in [0,1]. */
function bezierPoint(p0, p1, p2, p3, u) {
  const o = 1 - u;
  const a = o * o * o;
  const b = 3 * o * o * u;
  const c = 3 * o * u * u;
  const d = u * u * u;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Evaluate a path into a dense polyline.
 * @param {object} path
 *   { kind: 'polyline', points: [ [x,y], ... ] }
 *   { kind: 'bezier', spans: [ { p0,p1,p2,p3 }, ... ] }
 *   { kind: 'catmull', points: [...], alpha?: 0.5 }
 */
function evaluateFine(path, samplesPerSpan = 16) {
  if (path.kind === 'polyline') {
    return path.points.map((p) => [p[0], p[1]]);
  }

  if (path.kind === 'bezier') {
    const out = [];
    path.spans.forEach((span, si) => {
      const n = samplesPerSpan;
      for (let i = 0; i <= n; i++) {
        if (si > 0 && i === 0) continue;
        out.push(bezierPoint(span.p0, span.p1, span.p2, span.p3, i / n));
      }
    });
    return out;
  }

  if (path.kind === 'catmull') {
    const pts = path.points;
    if (pts.length < 2) return pts.map((p) => [p[0], p[1]]);
    const alpha = path.alpha == null ? 0.5 : path.alpha;
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];
      const t0 = 0;
      const t1 = t0 + Math.pow(dist(p0, p1), alpha) || 1e-6;
      const t2 = t1 + Math.pow(dist(p1, p2), alpha) || 1e-6;
      const t3 = t2 + Math.pow(dist(p2, p3), alpha) || 1e-6;
      for (let s = 0; s <= samplesPerSpan; s++) {
        if (i > 0 && s === 0) continue;
        const t = t1 + ((t2 - t1) * s) / samplesPerSpan;
        out.push(catmullPoint(p0, p1, p2, p3, t0, t1, t2, t3, t));
      }
    }
    return out;
  }

  throw new Error(`unknown path.kind: ${path.kind}`);
}

function lerpPt(p, q, t) {
  return lerp(p, q, t);
}

function catmullPoint(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  const a1 = lerpPt(p0, p1, safeDiv(t - t0, t1 - t0));
  const a2 = lerpPt(p1, p2, safeDiv(t - t1, t2 - t1));
  const a3 = lerpPt(p2, p3, safeDiv(t - t2, t3 - t2));
  const b1 = lerpPt(a1, a2, safeDiv(t - t0, t2 - t0));
  const b2 = lerpPt(a2, a3, safeDiv(t - t1, t3 - t1));
  return lerpPt(b1, b2, safeDiv(t - t1, t2 - t1));
}

function safeDiv(n, d) {
  return Math.abs(d) < 1e-12 ? 0 : n / d;
}

function accumulate(fine) {
  const ell = new Array(fine.length);
  ell[0] = 0;
  for (let i = 1; i < fine.length; i++) {
    ell[i] = ell[i - 1] + dist(fine[i - 1], fine[i]);
  }
  return ell;
}

function tangentAt(fine, i) {
  const n = fine.length;
  const a = fine[Math.max(0, i - 1)];
  const b = fine[Math.min(n - 1, i + 1)];
  return normalize([b[0] - a[0], b[1] - a[1]]);
}

function turnAngle(tPrev, tNext) {
  const d = clamp(tPrev[0] * tNext[0] + tPrev[1] * tNext[1], -1, 1);
  return Math.acos(d);
}

/**
 * Discrete curvature from three polyline points (1/UV).
 */
function discreteKappa(prev, cur, next) {
  const ds = dist(prev, next);
  if (ds < 1e-12) return 0;
  const t0 = normalize([cur[0] - prev[0], cur[1] - prev[1]]);
  const t1 = normalize([next[0] - cur[0], next[1] - cur[1]]);
  const theta = turnAngle(t0, t1);
  return theta / Math.max(dist(prev, cur) * 0.5 + dist(cur, next) * 0.5, 1e-12);
}

function defaultOptions() {
  return {
    samplesPerSpan: 16,
    thetaMaxDeg: 8,
    ellMax: 0.04,
    wRelMax: 0.08,
    nShip: 48,
    nMin: 16,
    windows: [],
    width: null,
    sagittaPx: null,
    plateWidthPx: 1080,
  };
}

function widthAt(width, i, n) {
  if (width == null) return 1;
  if (typeof width === 'number') return width;
  if (width.length === n) return width[i];
  const t = i / Math.max(1, n - 1);
  const x = t * (width.length - 1);
  const j = Math.min(width.length - 2, Math.floor(x));
  return width[j] + (width[j + 1] - width[j]) * (x - j);
}

/**
 * Adaptive keep on a fine polyline.
 * @returns {number[]} indices into `fine`
 */
function selectKeeps(fine, ell, opts) {
  const o = { ...defaultOptions(), ...opts };
  const n = fine.length;
  const L = ell[n - 1] || 1;
  const thetaMax = (o.thetaMaxDeg * Math.PI) / 180;
  const keep = new Array(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;

  const windowS = new Set();
  for (const w of o.windows) {
    const target = clamp(w.s, 0, 1) * L;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(ell[i] - target);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    keep[best] = true;
    windowS.add(best);
  }

  let last = 0;
  let accTheta = 0;
  let lastW = widthAt(o.width, 0, n);
  let tPrev = tangentAt(fine, 0);

  for (let i = 1; i < n - 1; i++) {
    const t = tangentAt(fine, i);
    const theta = turnAngle(tPrev, t);
    accTheta += theta;
    tPrev = t;

    const dEll = ell[i] - ell[last];
    const w = widthAt(o.width, i, n);
    const wRel = Math.abs(w - lastW) / Math.max(lastW, 1e-6);

    if (accTheta >= thetaMax || dEll >= o.ellMax || wRel >= o.wRelMax) {
      keep[i] = true;
      last = i;
      accTheta = 0;
      lastW = w;
    }
  }

  let indices = [];
  for (let i = 0; i < n; i++) if (keep[i]) indices.push(i);

  const protectedSet = new Set([0, n - 1, ...windowS]);

  while (indices.length > o.nShip) {
    let dropAt = -1;
    let dropScore = Infinity;
    for (let k = 1; k < indices.length - 1; k++) {
      const i = indices[k];
      if (protectedSet.has(i)) continue;
      const prev = indices[k - 1];
      const next = indices[k + 1];
      const score = turnAngle(tangentAt(fine, prev), tangentAt(fine, next)) + 1e-6 * (ell[next] - ell[prev]);
      if (score < dropScore) {
        dropScore = score;
        dropAt = k;
      }
    }
    if (dropAt < 0) break;
    indices.splice(dropAt, 1);
  }

  while (indices.length < o.nMin) {
    let fillAt = -1;
    let fillGap = -1;
    for (let k = 0; k < indices.length - 1; k++) {
      const gap = ell[indices[k + 1]] - ell[indices[k]];
      if (gap > fillGap) {
        fillGap = gap;
        fillAt = k;
      }
    }
    if (fillAt < 0 || fillGap <= 0) break;
    const target = (ell[indices[fillAt]] + ell[indices[fillAt + 1]]) / 2;
    let mid = indices[fillAt];
    let best = Infinity;
    for (let i = indices[fillAt]; i <= indices[fillAt + 1]; i++) {
      const d = Math.abs(ell[i] - target);
      if (d < best) {
        best = d;
        mid = i;
      }
    }
    if (mid === indices[fillAt] || mid === indices[fillAt + 1]) break;
    indices.splice(fillAt + 1, 0, mid);
  }

  return indices;
}

function stableNormals(points) {
  const n = points.length;
  const normals = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = tangentAt(points, i);
    let N = perpLeft(t);
    if (i > 0 && N[0] * normals[i - 1][0] + N[1] * normals[i - 1][1] < 0) {
      N = [-N[0], -N[1]];
    }
    normals[i] = N;
  }
  return normals;
}

/**
 * Resample an author path to an arc-length ribbon table.
 */
function resamplePath(path, opts = {}) {
  const o = { ...defaultOptions(), ...opts };
  const fine = evaluateFine(path, o.samplesPerSpan);
  if (fine.length < 2) {
    throw new Error('path needs at least 2 samples');
  }
  const ellFine = accumulate(fine);
  const keepIdx = selectKeeps(fine, ellFine, o);
  const points = keepIdx.map((i) => fine[i]);
  const ell = accumulate(points);
  const L = ell[ell.length - 1] || 1;
  const s = ell.map((e) => e / L);
  const normals = stableNormals(points);
  const kappa = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[i];
    const c = points[Math.min(points.length - 1, i + 1)];
    return discreteKappa(a, b, c);
  });
  const width = points.map((_, i) =>
    widthAt(o.width, keepIdx[i], fine.length)
  );
  return {
    points,
    s,
    ell,
    length: L,
    normals,
    kappa,
    width,
    fineCount: fine.length,
    keepCount: points.length,
  };
}

function ribbonPoint(table, s, lambda) {
  const ss = clamp(s, 0, 1);
  const pts = table.points;
  if (pts.length === 1) return pts[0].slice();
  let i = 0;
  while (i < table.s.length - 2 && table.s[i + 1] < ss) i++;
  const s0 = table.s[i];
  const s1 = table.s[i + 1];
  const a = (ss - s0) / Math.max(s1 - s0, 1e-12);
  const C = lerp(pts[i], pts[i + 1], a);
  const N = normalize(lerp(table.normals[i], table.normals[i + 1], a));
  const w = table.width[i] + (table.width[i + 1] - table.width[i]) * a;
  return [C[0] + lambda * w * N[0], C[1] + lambda * w * N[1]];
}

function assertTable(table, opts = {}) {
  const o = { ...defaultOptions(), ...opts };
  const issues = [];
  const L = table.length;
  for (let i = 1; i < table.points.length; i++) {
    const chord = dist(table.points[i - 1], table.points[i]);
    if (chord > o.ellMax * 1.25) {
      issues.push(`chord ${i} = ${chord.toFixed(4)} > ellMax`);
    }
    const dot =
      table.normals[i][0] * table.normals[i - 1][0] +
      table.normals[i][1] * table.normals[i - 1][1];
    if (dot < 0) issues.push(`normal flip at ${i}`);
  }
  const recon = table.ell[table.ell.length - 1];
  if (Math.abs(recon - L) > 1e-9) issues.push('ell / length mismatch');
  return issues;
}

module.exports = {
  resamplePath,
  ribbonPoint,
  assertTable,
  evaluateFine,
  discreteKappa,
  defaultOptions,
};
