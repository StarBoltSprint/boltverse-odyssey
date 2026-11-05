// perf-cull: zero-allocation CPU frustum + distance-LOD selection for instanced props (trees, rocks, any biome).
// src: Float32Array of instances, `stride` floats each, [x, z, H(size), seed, ...]. Output packed into reusable dst arrays.
export function makeCuller({ src, stride = 4, nearR = 150, farR = 225, farKeep = 0.65, fovDeg = 31, margin = 1.12 }) {
  const N = src.length / stride, out = new Float32Array(src.length), farIdx = new Int32Array(N);
  const res = { out, nNear: 0, nFar: 0 };
  // same rule set as the meadow v440 LOD, generic parameters
  res.select = (ex, ez, fx, fz, aspect) => {
    const tanH = Math.tan(fovDeg * Math.PI / 180) * aspect * margin, n2 = nearR * nearR, f2 = farR * farR; let nN = 0, nF = 0;
    for (let i = 0, o = 0; i < N; i++, o += stride) { const dx = src[o] - ex, dz = src[o + 1] - ez, H = src[o + 2]; const fd = dx * fx + dz * fz; if (fd < -H) continue;
      if (Math.abs(dx * fz - dz * fx) > Math.max(fd, 0) * tanH + H * 0.7 + 2) continue;
      const d2 = dx * dx + dz * dz; if (d2 > f2) continue; if (d2 > n2 && (src[o + 3] * 13.7 % 1) < 1 - farKeep) continue;
      if (d2 < n2) { for (let k = 0; k < stride; k++) out[nN * stride + k] = src[o + k]; nN++; } else farIdx[nF++] = i; }
    for (let j = 0; j < nF; j++) { const o = farIdx[j] * stride, d = (nN + j) * stride; for (let k = 0; k < stride; k++) out[d + k] = src[o + k]; }
    res.nNear = nN; res.nFar = nF; return res; };
  // shadow casters: disc around cascade centre (no camera frustum), near/far split by eye distance
  res.selectDisc = (cx, cz, R0, Hk, ex, ez) => { const n2 = nearR * nearR; let nN = 0, nF = 0;
    for (let i = 0, o = 0; i < N; i++, o += stride) { const qx = src[o] - cx, qz = src[o + 1] - cz, R = R0 + src[o + 2] * Hk; if (qx * qx + qz * qz > R * R) continue;
      const dx = src[o] - ex, dz = src[o + 1] - ez; if (dx * dx + dz * dz < n2) { for (let k = 0; k < stride; k++) out[nN * stride + k] = src[o + k]; nN++; } else farIdx[nF++] = i; }
    for (let j = 0; j < nF; j++) { const o = farIdx[j] * stride, d = (nN + j) * stride; for (let k = 0; k < stride; k++) out[d + k] = src[o + k]; }
    res.nNear = nN; res.nFar = nF; return res; };
  return res;
}
