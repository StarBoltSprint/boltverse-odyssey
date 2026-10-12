// Oblique profile. A flat textured face has ~0 m of residual depth after a plane fit.
// A face with real ledges keeps a residual of at least max(0.5 m, 0.003 * height).
// Same check name the tower-volumes step uses: `oblique-profile`.

export const OBLIQUE_LIMITS = {
  minResidualM: 0.5,
  heightFactor: 0.003,
  minRoughness: 1.04,
};

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const L = len(a) || 1; return [a[0] / L, a[1] / L, a[2] / L]; }

export function bboxOf(pos) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], pos[i + k]);
      max[k] = Math.max(max[k], pos[i + k]);
    }
  }
  return { min, max, height: max[1] - min[1] };
}

function camera(target, dist, yawDeg, elevDeg) {
  const yaw = yawDeg * Math.PI / 180, el = elevDeg * Math.PI / 180;
  const eye = [
    target[0] + dist * Math.cos(el) * Math.sin(yaw),
    target[1] + dist * Math.sin(el),
    target[2] + dist * Math.cos(el) * Math.cos(yaw),
  ];
  const fwd = norm(sub(target, eye));
  let right = cross(fwd, [0, 1, 0]);
  if (len(right) < 1e-4) right = [1, 0, 0];
  right = norm(right);
  const up = norm(cross(right, fwd));
  return { eye, fwd, right, up };
}

/** Rasterize camera-space depth. Returns {depth, mask, w, h}. */
export function rasterDepth(pos, idx, eye, fwd, right, up, fovY, w, h) {
  const depth = new Float32Array(w * h);
  depth.fill(Infinity);
  const mask = new Uint8Array(w * h);
  const fy = (h / 2) / Math.tan((fovY * Math.PI / 180) / 2);
  const fx = fy * (h / w) * (w / h);
  const cx = w / 2, cy = h / 2;
  const proj = (i) => {
    const p = [pos[i * 3] - eye[0], pos[i * 3 + 1] - eye[1], pos[i * 3 + 2] - eye[2]];
    const z = dot(p, fwd);
    if (z < 0.2) return null;
    return { x: cx + (dot(p, right) / z) * fx, y: cy - (dot(p, up) / z) * fy, z };
  };
  for (let t = 0; t < idx.length; t += 3) {
    const A = proj(idx[t]), B = proj(idx[t + 1]), C = proj(idx[t + 2]);
    if (!A || !B || !C) continue;
    const minx = Math.max(0, Math.floor(Math.min(A.x, B.x, C.x)));
    const maxx = Math.min(w - 1, Math.ceil(Math.max(A.x, B.x, C.x)));
    const miny = Math.max(0, Math.floor(Math.min(A.y, B.y, C.y)));
    const maxy = Math.min(h - 1, Math.ceil(Math.max(A.y, B.y, C.y)));
    const den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y);
    if (Math.abs(den) < 1e-8) continue;
    for (let y = miny; y <= maxy; y++) {
      for (let x = minx; x <= maxx; x++) {
        const wa = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / den;
        const wb = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / den;
        const wc = 1 - wa - wb;
        if (wa < -0.01 || wb < -0.01 || wc < -0.01) continue;
        const z = wa * A.z + wb * B.z + wc * C.z;
        const p = y * w + x;
        if (z < depth[p]) { depth[p] = z; mask[p] = 1; }
      }
    }
  }
  return { depth, mask, w, h };
}

function residualRange(depth, mask, w, h) {
  const xs = [], ys = [], zs = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    xs.push(x); ys.push(y); zs.push(depth[y * w + x]);
  }
  if (zs.length < 12) return { residualM: 0, pixels: zs.length, roughness: 1 };
  let s1 = zs.length, sx = 0, sy = 0, sz = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0;
  for (let i = 0; i < zs.length; i++) {
    sx += xs[i]; sy += ys[i]; sz += zs[i];
    sxx += xs[i] * xs[i]; syy += ys[i] * ys[i]; sxy += xs[i] * ys[i];
    sxz += xs[i] * zs[i]; syz += ys[i] * zs[i];
  }
  // Solve [sxx sxy sx; sxy syy sy; sx sy n] [a,b,c] = [sxz, syz, sz]
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, s1]];
  const B = [sxz, syz, sz];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A) || 1e-8;
  const replace = (col) => det(A.map((row, i) => row.map((v, j) => (j === col ? B[i] : v))));
  const a = replace(0) / D, b = replace(1) / D, c = replace(2) / D;
  const res = [];
  for (let i = 0; i < zs.length; i++) res.push(Math.abs(zs[i] - (a * xs[i] + b * ys[i] + c)));
  res.sort((p, q) => p - q);
  const p05 = res[Math.floor(res.length * 0.05)];
  const p95 = res[Math.floor(res.length * 0.95)];
  // Silhouette roughness: boundary pixels over the bbox perimeter.
  let boundary = 0, minx = w, maxx = 0, miny = h, maxy = 0, on = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    on++;
    minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x];
    if (edge) boundary++;
  }
  const per = Math.max(1, 2 * ((maxx - minx) + (maxy - miny)));
  const roughness = boundary / per;
  return { residualM: +(p95 - p05).toFixed(3), pixels: on, roughness: +roughness.toFixed(3) };
}

export function thresholdM(height) {
  return Math.max(OBLIQUE_LIMITS.minResidualM, OBLIQUE_LIMITS.heightFactor * height);
}

/** One view. yaw 45 = three-quarter, yaw 75 = grazing. */
export function scoreView(pos, idx, dist, yawDeg, elevDeg = 12) {
  const box = bboxOf(pos);
  const target = [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, (box.min[2] + box.max[2]) / 2];
  const cam = camera(target, dist, yawDeg, elevDeg);
  const ras = rasterDepth(pos, idx, cam.eye, cam.fwd, cam.right, cam.up, 40, 96, 160);
  const fit = residualRange(ras.depth, ras.mask, ras.w, ras.h);
  const need = thresholdM(box.height || 1);
  return {
    dist, yawDeg,
    heightM: +box.height.toFixed(2),
    needM: +need.toFixed(3),
    ...fit,
    pass: fit.residualM >= need,
  };
}

export function scoreOblique(pos, idx, distances = [8, 30]) {
  const views = [];
  for (const dist of distances) {
    for (const yaw of [45, 75]) views.push(scoreView(pos, idx, dist, yaw));
  }
  return { views, pass: views.every((v) => v.pass) };
}

/** Flat 10 m quad, and the same quad with a 1.2 m box on it. */
export function fixtures() {
  const quad = (zOf) => {
    const pos = [];
    const idx = [];
    const n = 8;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = (i / n) * 10, y = (j / n) * 10;
      pos.push(x, y, zOf(x, y));
    }
    const w = n + 1;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * w + i;
      idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
    return { pos, idx };
  };
  const flat = quad(() => 0);
  const proud = quad((x, y) => (x > 3 && x < 7 && y > 3 && y < 7 ? 1.2 : 0));
  return { flat, proud };
}
