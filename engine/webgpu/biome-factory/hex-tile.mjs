// Three-weight hex blend. Same skew as the crystal shader.
// Each tap is a rotation and offset of the native tile, scale 1.

export function hash2(ix, iy) {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  const n2 = Math.sin(ix * 269.5 + iy * 183.3) * 43758.5453;
  return [n - Math.floor(n), n2 - Math.floor(n2)];
}

export function unskew(c) {
  return [c[0] + c[1] * 0.5, c[1] * 0.86602540378];
}

export function hexFrame(uv) {
  const s = uv[0] - uv[1] * 0.57735026919;
  const t = uv[1] * 1.15470053838;
  const cell = [Math.floor(s), Math.floor(t)];
  const f = [s - cell[0], t - cell[1]];
  const lower = f[0] + f[1] < 1;
  let w = lower
    ? [1 - f[0] - f[1], f[0], f[1]]
    : [f[0] + f[1] - 1, 1 - f[1], 1 - f[0]];
  w = w.map((v) => v * v * (3 - 2 * v));
  const sum = w[0] + w[1] + w[2] || 1;
  w = w.map((v) => v / sum);
  const cells = lower
    ? [cell, [cell[0] + 1, cell[1]], [cell[0], cell[1] + 1]]
    : [[cell[0] + 1, cell[1] + 1], [cell[0], cell[1] + 1], [cell[0] + 1, cell[1]]];
  return { w, cells };
}

export function tapUv(uv, cell) {
  const h = hash2(cell[0], cell[1]);
  const rot = h[0] * Math.PI * 2;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const center = unskew([cell[0] + 0.5, cell[1] + 0.5]);
  const dx = uv[0] - center[0];
  const dy = uv[1] - center[1];
  const rx = dx * cs - dy * sn;
  const ry = dx * sn + dy * cs;
  const u = rx + h[0];
  const v = ry + h[1];
  return [u - Math.floor(u), v - Math.floor(v), Math.floor(h[1] * 1e6) % 997];
}

export function hp3(c0, c1, c2, w) {
  const mu = [0, 1, 2].map((k) => (c0[k] + c1[k] + c2[k]) / 3);
  const len = Math.hypot(w[0], w[1], w[2]) || 1;
  return mu.map((m, k) => m + (w[0] * (c0[k] - m) + w[1] * (c1[k] - m) + w[2] * (c2[k] - m)) / len);
}

// images: array of { w, h, rgb } byte buffers, 1024 square.
export function sampleImage(img, u, v) {
  const x = Math.min(img.w - 1, Math.max(0, Math.floor(u * img.w)));
  const y = Math.min(img.h - 1, Math.max(0, Math.floor(v * img.h)));
  const i = (y * img.w + x) * 3;
  return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
}

export function hexColour(images, uv) {
  const { w, cells } = hexFrame(uv);
  const taps = cells.map((cell) => {
    const tuv = tapUv(uv, cell);
    const img = images[Math.abs(tuv[2]) % images.length];
    return sampleImage(img, tuv[0], tuv[1]);
  });
  return hp3(taps[0], taps[1], taps[2], w);
}

// The run-28 per-cell switch. Hard edge at the square boundary.
function rotSample(images, h, f) {
  const rot = h[0] * Math.PI * 2;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const fu = f[0] - 0.5;
  const fv = f[1] - 0.5;
  const rx = fu * cs - fv * sn + 0.5 + h[1];
  const ry = fu * sn + fv * cs + 0.5 + h[0];
  const img = images[Math.floor(h[1] * images.length) % images.length];
  return sampleImage(img, rx - Math.floor(rx), ry - Math.floor(ry));
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Run 28 blend: two rotated variants, weight resets on the square edge.
export function squareColour(images, uv) {
  const ix = Math.floor(uv[0]);
  const iy = Math.floor(uv[1]);
  const f = [uv[0] - ix, uv[1] - iy];
  const h = hash2(ix, iy);
  const h2 = hash2(ix + 17, iy + 3);
  const k = smoothstep(0.3, 0.7, f[0] * 0.65 + f[1] * 0.35 + h[0] * 0.12);
  const a = rotSample(images, h, f);
  const b = rotSample(images, h2, f);
  return a.map((v, i) => Math.round(v * (1 - k) + b[i] * k));
}

function boxBlur(src, w, h, r) {
  const out = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -r; dy <= r; dy += 2) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -r; dx <= r; dx += 2) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          s += src[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function lineCorr(L, w, a, b, horizontal) {
  let s0 = 0;
  let s1 = 0;
  let ab = 0;
  let a2 = 0;
  let b2 = 0;
  const n = horizontal ? w : L.length / w;
  for (let i = 0; i < n; i++) {
    const p = horizontal ? L[a * w + i] : L[i * w + a];
    const q = horizontal ? L[b * w + i] : L[i * w + b];
    s0 += p; s1 += q; ab += p * q; a2 += p * p; b2 += q * q;
  }
  s0 /= n; s1 /= n;
  const cov = ab / n - s0 * s1;
  const v0 = a2 / n - s0 * s0;
  const v1 = b2 / n - s1 * s1;
  return cov / Math.sqrt(Math.max(v0 * v1, 1e-12));
}

// High when a square lattice breaks texture continuation and the interior does not.
export function seamBreak(rgb, w, h, period) {
  const L = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = rgb[i * 3] * 0.3 + rgb[i * 3 + 1] * 0.59 + rgb[i * 3 + 2] * 0.11;
  const seams = [];
  const inner = [];
  for (let y = period; y < h; y += period) seams.push(lineCorr(L, w, y - 1, y, true));
  for (let x = period; x < w; x += period) seams.push(lineCorr(L, w, x - 1, x, false));
  const half = Math.round(period / 2);
  for (let y = half; y < h; y += period) inner.push(lineCorr(L, w, y - 1, y, true));
  for (let x = half; x < w; x += period) inner.push(lineCorr(L, w, x - 1, x, false));
  const seam = Math.min(...seams);
  const mid = inner.slice().sort((a, b) => a - b)[Math.floor(inner.length / 2)];
  return mid / (Math.max(seam, 0) + 0.02);
}

export function edgeRatio(rgb, w, h, period) {
  const raw = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) raw[i] = rgb[i * 3] * 0.3 + rgb[i * 3 + 1] * 0.59 + rgb[i * 3 + 2] * 0.11;
  // Blur under the cell size so millimetre cracks do not hide the square.
  const L = boxBlur(raw, w, h, Math.max(2, Math.round(period * 0.06)));
  let edge = 0;
  let edgeN = 0;
  let inner = 0;
  let innerN = 0;
  const band = Math.max(1, Math.round(period * 0.02));
  for (let y = 1; y < h; y++) {
    for (let x = 1; x < w; x++) {
      const d = Math.abs(L[y * w + x] - L[y * w + x - 1]);
      const on = (x % period) < band;
      if (on) { edge += d; edgeN++; }
      else { inner += d; innerN++; }
    }
  }
  for (let y = 1; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.abs(L[y * w + x] - L[(y - 1) * w + x]);
      const on = (y % period) < band;
      if (on) { edge += d; edgeN++; }
      else { inner += d; innerN++; }
    }
  }
  const e = edge / (edgeN || 1);
  const inn = inner / (innerN || 1);
  return e / (inn + 1e-6);
}
