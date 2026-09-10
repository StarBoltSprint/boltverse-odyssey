// pHash DCT + dHash + Hamming. Gate 2 of CLIP.md. See PHASH.md.
// No native deps.

export function dct1d(vec) {
  const n = vec.length;
  const out = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += vec[i] * Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n));
    out[k] = s;
  }
  return out;
}

export function dct2d(gray, n) {
  const tmp = new Float64Array(n * n);
  const row = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) row[x] = gray[y * n + x];
    const d = dct1d(row);
    for (let x = 0; x < n; x++) tmp[y * n + x] = d[x];
  }
  const out = new Float64Array(n * n);
  const col = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) col[y] = tmp[y * n + x];
    const d = dct1d(col);
    for (let y = 0; y < n; y++) out[y * n + x] = d[y];
  }
  return out;
}

function lum(buf, i) {
  return (buf[i * 3] * 3 + buf[i * 3 + 1] * 4 + buf[i * 3 + 2]) >> 3;
}

/** 32×32 rgb24 → 63-bit pHash (8×8 DCT, skip DC, median). */
export function pHash(buf, n = 32) {
  const gray = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) gray[i] = lum(buf, i);
  const d = dct2d(gray, n);
  const vals = [];
  for (let v = 0; v < 8; v++)
    for (let u = 0; u < 8; u++) {
      if (u === 0 && v === 0) continue;
      vals.push(d[v * n + u]);
    }
  const sorted = vals.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let bits = 0n;
  let k = 0n;
  for (let v = 0; v < 8; v++)
    for (let u = 0; u < 8; u++) {
      if (u === 0 && v === 0) continue;
      if (d[v * n + u] > med) bits |= 1n << k;
      k++;
    }
  return bits;
}

/** 9×8 rgb24 → 64-bit dHash (pixel > right neighbor). Dolly / paw slide. */
export function dHash(buf, w = 9, h = 8) {
  let bits = 0n;
  let k = 0n;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w - 1; x++) {
      const a = lum(buf, y * w + x);
      const b = lum(buf, y * w + x + 1);
      if (a > b) bits |= 1n << k;
      k++;
    }
  return bits;
}

export function hamming(a, b) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
