// Grid measurement for the world. The live Bolt card is reference art.
// Its alpha, dilated by 8 px, is left out of the band. The band itself is unchanged.
// Limit stays 1.8.

export const GRID_PEAK = 1.8;
export const MASK_DILATE = 8;

export function maskFromRGBA(src, w, h, stride) {
  const step = stride || w * 4;
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * step + x * 4;
      const lum = src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11;
      if (lum > 12) bin[y * w + x] = 1;
    }
  }
  return bin;
}

export function dilateMask(src, w, h, radius = MASK_DILATE) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!src[y * w + x]) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  const out = new Uint8Array(w * h);
  if (maxX < 0) return out;
  const x0 = Math.max(0, minX - radius);
  const y0 = Math.max(0, minY - radius);
  const x1 = Math.min(w - 1, maxX + radius);
  const y1 = Math.min(h - 1, maxY + radius);
  const tmp = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const a = Math.max(0, x - radius);
      const b = Math.min(w - 1, x + radius);
      const row = y * w;
      for (let k = a; k <= b; k++) {
        if (src[row + k]) { tmp[row + x] = 1; break; }
      }
    }
  }
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const a = Math.max(0, y - radius);
      const b = Math.min(h - 1, y + radius);
      for (let k = a; k <= b; k++) {
        if (tmp[k * w + x]) { out[y * w + x] = 1; break; }
      }
    }
  }
  return out;
}

function luma(raw, i) {
  return raw[i] * 0.3 + raw[i + 1] * 0.59 + raw[i + 2] * 0.11;
}

function worldRow(im, mask, y) {
  const row = new Float64Array(im.w);
  const known = new Uint8Array(im.w);
  for (let x = 0; x < im.w; x++) {
    if (mask && mask[y * im.w + x]) continue;
    row[x] = luma(im.raw, (y * im.w + x) * 3);
    known[x] = 1;
  }
  for (let x = 0; x < im.w; x++) {
    if (known[x]) continue;
    let left = x - 1;
    let right = x + 1;
    while (left >= 0 && !known[left]) left--;
    while (right < im.w && !known[right]) right++;
    const a = left >= 0 ? row[left] : (right < im.w ? row[right] : 0);
    const b = right < im.w ? row[right] : a;
    const t = left >= 0 && right > left ? (x - left) / (right - left) : 0;
    row[x] = a + (b - a) * t;
  }
  return row;
}

export function gridPeak(im, mask) {
  const sig = new Float64Array(im.w);
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let rows = 0;
  for (let y = y0; y < y1; y += 2) {
    rows++;
    const row = worldRow(im, mask, y);
    for (let x = 0; x < im.w; x++) sig[x] += row[x];
  }
  for (let x = 0; x < im.w; x++) sig[x] /= rows || 1;
  const hp = new Float64Array(im.w);
  for (let i = 0; i < im.w; i++) hp[i] = sig[i] - sig[Math.max(0, i - 24)];
  let meanH = 0;
  for (let i = 0; i < im.w; i++) meanH += hp[i];
  meanH /= im.w;
  let v = 0;
  for (let i = 0; i < im.w; i++) v += (hp[i] - meanH) ** 2;
  v /= im.w;
  if (v < 1e-6) return 0;
  const ac = (lag) => {
    let c = 0;
    const m = im.w - lag;
    for (let i = 0; i < m; i++) c += (hp[i] - meanH) * (hp[i + lag] - meanH);
    return c / (m * v);
  };
  const peak = Math.max(ac(8), ac(16), ac(24));
  const beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4;
  return peak / (Math.abs(beside) + 0.08);
}

function grating(x) {
  return Math.round((Math.sin((x / 16) * Math.PI * 2) * 0.5 + 0.5) * 70 + 10);
}

export function paintWorldGrid(im, mask) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < im.w; x++) {
      if (mask && mask[y * im.w + x]) continue;
      const v = grating(x);
      const i = (y * im.w + x) * 3;
      copy.raw[i] = v;
      copy.raw[i + 1] = v;
      copy.raw[i + 2] = v + 15;
    }
  }
  return copy;
}

// A grating in the world, starting 2 px outside the dilated card, so a loose mask would hide it.
export function paintBesideGrid(im, mask) {
  const copy = { raw: Buffer.from(im.raw), w: im.w, h: im.h };
  const y0 = Math.floor(im.h * 0.55);
  const y1 = Math.floor(im.h * 0.96);
  let painted = 0;
  const width = 56;
  for (let y = y0; y < y1; y++) {
    let left = im.w;
    let right = -1;
    for (let x = 0; x < im.w; x++) {
      if (!mask || !mask[y * im.w + x]) continue;
      if (x < left) left = x;
      if (x > right) right = x;
    }
    if (right < 0) continue;
    const spans = [[right + 2, right + 2 + width], [left - 2 - width, left - 2]];
    for (const [a, b] of spans) {
      const x0 = Math.max(0, a);
      const x1 = Math.min(im.w - 1, b);
      for (let x = x0; x <= x1; x++) {
        if (mask && mask[y * im.w + x]) continue;
        const v = grating(x);
        const i = (y * im.w + x) * 3;
        copy.raw[i] = v;
        copy.raw[i + 1] = v;
        copy.raw[i + 2] = v + 15;
        painted++;
      }
    }
  }
  copy.painted = painted;
  return copy;
}
