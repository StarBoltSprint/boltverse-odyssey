/**
 * Framebuffer rows added 2026-10-04. They read pixels. They do not draw.
 * A frame under 48 px is not a proof shot. black_regions is unchanged.
 */

import { luma } from "./pixels.mjs";

const FOOT_GAP_PX = 12;
const MIN_SIDE = 48;

export function hotspotFixes(mag, dist, scale, texels, limit = 1) {
  const fixes = [];
  if (dist && mag) fixes.push(`move the camera out to ${((dist * mag) / limit).toFixed(2)} m`);
  if (scale && mag) fixes.push(`set scale to ${((scale * limit) / mag).toFixed(3)}`);
  if (texels && mag) {
    fixes.push(`recook the skin at ${((texels * mag) / limit).toFixed(1)} texels/m and do not enlarge the current texture`);
  }
  if (!fixes.length) {
    fixes.push("move the camera back until magnification is at or under 1, or recook the skin at the on-screen pixel count");
  }
  return fixes;
}

function plane(rgba, width, height) {
  const y = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    y[i] = luma(rgba[o], rgba[o + 1], rgba[o + 2]);
  }
  return y;
}

function integral(src, width, height) {
  const ii = new Float64Array((width + 1) * (height + 1));
  const stride = width + 1;
  for (let y = 1; y <= height; y++) {
    let row = 0;
    for (let x = 1; x <= width; x++) {
      row += src[(y - 1) * width + (x - 1)];
      ii[y * stride + x] = ii[(y - 1) * stride + x] + row;
    }
  }
  return ii;
}

function localStd(y, width, height) {
  const rad = 2;
  const k = 5;
  const padW = width + rad * 2;
  const padH = height + rad * 2;
  const pad = new Float64Array(padW * padH);
  for (let row = 0; row < padH; row++) {
    const sy = Math.min(height - 1, Math.max(0, row - rad));
    for (let col = 0; col < padW; col++) {
      const sx = Math.min(width - 1, Math.max(0, col - rad));
      pad[row * padW + col] = y[sy * width + sx];
    }
  }
  const ii = integral(pad, padW, padH);
  const ii2src = new Float64Array(pad.length);
  for (let i = 0; i < pad.length; i++) ii2src[i] = pad[i] * pad[i];
  const ii2 = integral(ii2src, padW, padH);
  const std = new Float32Array(width * height);
  const n = k * k;
  const stride = padW + 1;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const x0 = col;
      const y0 = row;
      const x1 = col + k;
      const y1 = row + k;
      const sum = ii[y1 * stride + x1] - ii[y0 * stride + x1] - ii[y1 * stride + x0] + ii[y0 * stride + x0];
      const sum2 = ii2[y1 * stride + x1] - ii2[y0 * stride + x1] - ii2[y1 * stride + x0] + ii2[y0 * stride + x0];
      const mean = sum / n;
      std[row * width + col] = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    }
  }
  return std;
}

function median(values) {
  const copy = values.slice().sort((a, b) => a - b);
  return copy[Math.floor(copy.length / 2)] || 0;
}

export function footContact(rgba, width, height) {
  if (!rgba || width < MIN_SIDE || height < MIN_SIDE) return { hits: [], skipped: "small" };
  const y = plane(rgba, width, height);
  const std = localStd(y, width, height);
  const top = [];
  const topRows = Math.max(4, Math.floor(height / 10));
  for (let row = 0; row < topRows; row++) {
    for (let col = 0; col < width; col += 4) top.push(y[row * width + col]);
  }
  const sky = median(top);
  const minGround = Math.max(24, Math.floor(height * 0.08));
  const maxGap = Math.max(48, Math.floor(height * 0.12));
  const groundRow = Math.floor(height * 0.28);
  const gaps = new Int16Array(width);
  for (let x = 0; x < width; x++) {
    let r = height - 1;
    let groundRun = 0;
    while (r > 0) {
      const i = r * width + x;
      if (!(std[i] > 10 && r > groundRow)) break;
      groundRun += 1;
      r -= 1;
    }
    if (groundRun < minGround) continue;
    let gap = 0;
    let stray = 0;
    while (r >= 0) {
      const i = r * width + x;
      const solid = std[i] > 6 && Math.abs(y[i] - sky) > 28;
      if (solid) break;
      if (Math.abs(y[i] - sky) < 22 && std[i] < 9) {
        gap += 1;
        stray = 0;
      } else {
        stray += 1;
        if (stray > 4) break;
      }
      r -= 1;
    }
    if (!(gap >= FOOT_GAP_PX && gap <= maxGap && r >= 0)) continue;
    const at = r * width + x;
    if (!(std[at] > 6 && Math.abs(y[at] - sky) > 28)) continue;
    let solidRun = 0;
    let s = r;
    while (s >= 0) {
      const i = s * width + x;
      if (!(std[i] > 6 && Math.abs(y[i] - sky) > 28)) break;
      solidRun += 1;
      s -= 1;
    }
    if (solidRun >= 16) gaps[x] = gap;
  }
  let cols = 0;
  let max = 0;
  for (let x = 0; x < width; x++) {
    if (gaps[x]) {
      cols += 1;
      if (gaps[x] > max) max = gaps[x];
    }
  }
  const need = Math.max(8, Math.ceil(width * 0.04));
  return { hits: cols >= need ? [{ maxGapPx: max, columns: cols }] : [], maxGapPx: max, columns: cols, skipped: null };
}

export function untexturedSurfaces(rgba, width, height) {
  if (!rgba || width < MIN_SIDE || height < MIN_SIDE) return { hits: [], skyIgnored: 0, skipped: "small" };
  const block = 8;
  const rows = Math.floor(height / block);
  const cols = Math.floor(width / block);
  const dark = new Uint8Array(rows * cols);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let sum = 0;
      let sum2 = 0;
      let n = 0;
      for (let oy = 0; oy < block; oy += 2) {
        for (let ox = 0; ox < block; ox += 2) {
          const i = ((by * block + oy) * width + (bx * block + ox)) * 4;
          const v = luma(rgba[i], rgba[i + 1], rgba[i + 2]);
          sum += v;
          sum2 += v * v;
          n += 1;
        }
      }
      const mean = sum / n;
      const spread = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
      const cell = by * cols + bx;
      if (mean < 22 && spread < 4) dark[cell] = 1;
      else if (spread < 1.2 && mean < 90) dark[cell] = 2;
    }
  }
  const seen = new Uint8Array(dark.length);
  const hits = [];
  let skyIgnored = 0;
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const start = by * cols + bx;
      if (!dark[start] || seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      let n = 0;
      let minX = bx;
      let maxX = bx;
      let minY = by;
      let maxY = by;
      let kind = dark[start];
      while (stack.length) {
        const p = stack.pop();
        const py = Math.floor(p / cols);
        const px = p - py * cols;
        n += 1;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        kind = Math.max(kind, dark[p]);
        const near = [
          px > 0 ? p - 1 : -1,
          px + 1 < cols ? p + 1 : -1,
          py > 0 ? p - cols : -1,
          py + 1 < rows ? p + cols : -1,
        ];
        for (const q of near) {
          if (q >= 0 && dark[q] && !seen[q]) {
            seen[q] = 1;
            stack.push(q);
          }
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const span = bw / cols;
      const touchesTop = minY === 0;
      const flatOnly = kind === 2;
      if (touchesTop && span >= 0.7 && (maxY + 1) / rows <= 0.55) {
        skyIgnored += 1;
        continue;
      }
      if (flatOnly && (span >= 0.7 || touchesTop)) {
        skyIgnored += 1;
        continue;
      }
      const area = (n * block * block) / (width * height);
      const limit = flatOnly ? 0.02 : 0.008;
      if (area >= limit && bw >= 3 && bh >= 3 && n / (bw * bh) >= 0.4) {
        hits.push({ areaFrac: Math.round(area * 10000) / 10000, kind: flatOnly ? "flat" : "black" });
      }
    }
  }
  hits.sort((a, b) => b.areaFrac - a.areaFrac);
  return { hits, skyIgnored, skipped: null };
}

export function stairCrown(rgba, width, height) {
  if (!rgba || width < MIN_SIDE || height < MIN_SIDE) return { stair: false, runs: 0, skipped: "small" };
  const y = plane(rgba, width, height);
  const top = [];
  const topRows = Math.max(4, Math.floor(height / 12));
  for (let row = 0; row < topRows; row++) {
    for (let col = 0; col < width; col += 3) top.push(y[row * width + col]);
  }
  const sky = median(top);
  const crown = new Int16Array(width);
  crown.fill(-1);
  const lo = Math.floor(height * 0.04);
  const hi = Math.floor(height * 0.78);
  for (let x = 0; x < width; x++) {
    let run = 0;
    for (let r = lo; r < hi; r++) {
      if (y[r * width + x] < sky - 22) {
        run += 1;
        if (run >= 6) {
          crown[x] = r - 5;
          break;
        }
      } else run = 0;
    }
  }
  const xs = [];
  for (let x = 0; x < width; x++) if (crown[x] >= 0) xs.push(x);
  if (xs.length < 24) return { stair: false, runs: 0, columns: xs.length, skipped: null };
  let best = [];
  let cur = [xs[0]];
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] === xs[i - 1] + 1) cur.push(xs[i]);
    else {
      if (cur.length > best.length) best = cur;
      cur = [xs[i]];
    }
  }
  if (cur.length > best.length) best = cur;
  const c = best.map((x) => crown[x]);
  let runs = 0;
  let i = 0;
  while (i < c.length) {
    let j = i;
    while (j + 1 < c.length && Math.abs(c[j + 1] - c[i]) <= 1) j += 1;
    const length = j - i + 1;
    if (length >= 5 && j + 1 < c.length) {
      const dj = Math.abs(c[j + 1] - c[i]);
      if (dj >= 4 && dj <= 16) runs += 1;
    }
    i = j + 1;
  }
  return { stair: runs >= 4, runs, columns: best.length, skipped: null };
}
