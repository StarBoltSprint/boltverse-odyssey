/**
 * Pixel measurements on a captured framebuffer.
 * Heuristics are named in the report. They do not draw anything.
 */

export function luma(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Flat near-black rectangles (unkeyed missing textures).
 * A night sky that is a full-width band touching the top is ignored.
 * Textured dark pixels (high local variance, or luma above the cutoff) are ignored.
 */
export function blackRectangles(rgba, width, height, opts = {}) {
  const block = opts.block ?? 8;
  const lumaCut = opts.lumaCut ?? 16;
  const stdCut = opts.stdCut ?? 3.5;
  const chromaCut = opts.chromaCut ?? 12;
  const minAreaFrac = opts.minAreaFrac ?? 0.012;
  const cols = Math.floor(width / block);
  const rows = Math.floor(height / block);
  const dark = new Uint8Array(cols * rows);
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      let sum = 0;
      let sum2 = 0;
      let chroma = 0;
      let n = 0;
      const x0 = bx * block;
      const y0 = by * block;
      for (let oy = 0; oy < block; oy += 2) {
        for (let ox = 0; ox < block; ox += 2) {
          const i = ((y0 + oy) * width + (x0 + ox)) * 4;
          const r = rgba[i];
          const g = rgba[i + 1];
          const b = rgba[i + 2];
          const y = luma(r, g, b);
          sum += y;
          sum2 += y * y;
          chroma += Math.max(r, g, b) - Math.min(r, g, b);
          n++;
        }
      }
      const mean = sum / n;
      const variance = Math.max(0, sum2 / n - mean * mean);
      const std = Math.sqrt(variance);
      if (mean < lumaCut && std < stdCut && chroma / n < chromaCut) dark[by * cols + bx] = 1;
    }
  }
  const seen = new Uint8Array(cols * rows);
  const hits = [];
  let skyIgnored = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const s = y * cols + x;
      if (!dark[s] || seen[s]) continue;
      const stack = [s];
      seen[s] = 1;
      let n = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (stack.length) {
        const p = stack.pop();
        const py = Math.floor(p / cols);
        const px = p - py * cols;
        n++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (px > 0 && dark[p - 1] && !seen[p - 1]) {
          seen[p - 1] = 1;
          stack.push(p - 1);
        }
        if (px + 1 < cols && dark[p + 1] && !seen[p + 1]) {
          seen[p + 1] = 1;
          stack.push(p + 1);
        }
        if (py > 0 && dark[p - cols] && !seen[p - cols]) {
          seen[p - cols] = 1;
          stack.push(p - cols);
        }
        if (py + 1 < rows && dark[p + cols] && !seen[p + cols]) {
          seen[p + cols] = 1;
          stack.push(p + cols);
        }
      }
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      const fill = n / (bw * bh);
      const areaFrac = (n * block * block) / (width * height);
      const span = bw / cols;
      const touchesTop = minY === 0;
      const sky =
        touchesTop && span >= 0.7 && (maxY + 1) / rows <= 0.55 && fill >= 0.8;
      if (sky) {
        skyIgnored++;
        continue;
      }
      if (areaFrac >= minAreaFrac && fill >= 0.82 && bw >= 3 && bh >= 3) {
        hits.push({
          areaFrac: round(areaFrac),
          fill: round(fill),
          x: minX * block,
          y: minY * block,
          w: bw * block,
          h: bh * block,
        });
      }
    }
  }
  hits.sort((a, b) => b.areaFrac - a.areaFrac);
  return { hits, skyIgnored, heuristic: true };
}

/**
 * Obvious periodic repetition on the ground band (left and right of the hero).
 * Pearson autocorrelation. Flat colour is not repetition.
 */
export function floorRepeat(rgba, width, height, opts = {}) {
  const y0 = Math.floor(height * (opts.y0 ?? 0.6));
  const y1 = Math.floor(height * (opts.y1 ?? 0.86));
  const strips = [
    [Math.floor(width * 0.02), Math.floor(width * 0.46)],
    [Math.floor(width * 0.54), Math.floor(width * 0.98)],
  ];
  let worst = { periodic: false, peak: 0, lag: 0, stddev: 0, heuristic: true };
  const stepY = Math.max(1, Math.floor((y1 - y0) / 5));
  for (let y = y0; y < y1; y += stepY) {
    for (const [x0, x1] of strips) {
      const sig = [];
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        sig.push(luma(rgba[i], rgba[i + 1], rgba[i + 2]));
      }
      const stat = autocorrPeak(sig);
      if (stat.peak > worst.peak) worst = { ...stat, heuristic: true };
    }
  }
  return worst;
}

export function autocorrPeak(sig) {
  const n = sig.length;
  if (n < 16) return { periodic: false, peak: 0, lag: 0, stddev: 0 };
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sig[i];
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) {
    const d = sig[i] - mean;
    v += d * d;
  }
  const stddev = Math.sqrt(v / n);
  let mad = 0;
  for (let i = 1; i < n; i++) mad += Math.abs(sig[i] - sig[i - 1]);
  mad /= n - 1;
  if (stddev < 10) return { periodic: false, peak: 0, lag: 0, stddev: round(stddev), mad: round(mad) };
  const minLag = 4;
  const maxLag = Math.max(minLag, Math.floor(n / 2.2));
  const corrs = [];
  let peak = 0;
  let lag = 0;
  for (let k = minLag; k <= maxLag; k++) {
    const c = pearson(sig, k, mean);
    corrs.push(c);
    if (c > peak) {
      peak = c;
      lag = k;
    }
  }
  const sorted = corrs.slice().sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const prominence = peak - median;
  const half = lag > 8 ? pearson(sig, Math.max(minLag, Math.floor(lag / 2)), mean) : 0;
  const second = lag * 2 <= n - 8 ? pearson(sig, lag * 2, mean) : 0;
  // A smooth ramp correlates at a short lag and stays positive at the half-period.
  // A checker or tiled floor goes negative at the half-period, even when cells are
  // wide enough that neighbouring pixels mostly match (low mad).
  const periodic =
    peak >= 0.8 &&
    prominence >= 0.22 &&
    (half <= -0.35 || (second >= 0.62 && mad >= 12));
  return {
    periodic,
    peak: round(peak),
    lag,
    stddev: round(stddev),
    half: round(half),
    second: round(second),
    prominence: round(prominence),
    mad: round(mad),
  };
}

function pearson(sig, lag, mean) {
  const n = sig.length - lag;
  let num = 0;
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < n; i++) {
    const a = sig[i] - mean;
    const b = sig[i + lag] - mean;
    num += a * b;
    d1 += a * a;
    d2 += b * b;
  }
  const den = Math.sqrt(d1 * d2);
  return den > 1e-6 ? num / den : 0;
}

export function round(n) {
  return Math.round(n * 1000) / 1000;
}

export function decodeIds(objectIds) {
  if (!objectIds || !objectIds.b64 || !objectIds.width || !objectIds.height) return null;
  const buf = Buffer.from(objectIds.b64, "base64");
  const count = objectIds.width * objectIds.height;
  if (buf.length < count * 2) return null;
  const copy = new Uint8Array(count * 2);
  copy.set(buf.subarray(0, count * 2));
  const data = new Uint16Array(copy.buffer);
  const labels = objectIds.labels || [];
  return { width: objectIds.width, height: objectIds.height, labels, data };
}

export function countLabels(ids) {
  const counts = new Map();
  if (!ids) return counts;
  for (let i = 0; i < ids.data.length; i++) {
    const v = ids.data[i];
    const label = ids.labels[v] || "";
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

export function windowCount(ids, label, x0, y0, x1, y1) {
  if (!ids) return { n: 0, window: 0 };
  const xA = Math.max(0, Math.floor(ids.width * x0));
  const xB = Math.min(ids.width, Math.ceil(ids.width * x1));
  const yA = Math.max(0, Math.floor(ids.height * y0));
  const yB = Math.min(ids.height, Math.ceil(ids.height * y1));
  let n = 0;
  let window = 0;
  const idx = ids.labels.indexOf(label);
  for (let y = yA; y < yB; y++) {
    for (let x = xA; x < xB; x++) {
      window++;
      const v = ids.data[y * ids.width + x];
      if (idx >= 0 ? v === idx : ids.labels[v] === label) n++;
    }
  }
  return { n, window };
}

export function windowCountAny(ids, labels, x0, y0, x1, y1) {
  if (!ids) return { n: 0, window: 0, by: {} };
  const want = new Set(labels);
  const xA = Math.max(0, Math.floor(ids.width * x0));
  const xB = Math.min(ids.width, Math.ceil(ids.width * x1));
  const yA = Math.max(0, Math.floor(ids.height * y0));
  const yB = Math.min(ids.height, Math.ceil(ids.height * y1));
  let n = 0;
  let window = 0;
  const by = {};
  for (let y = yA; y < yB; y++) {
    for (let x = xA; x < xB; x++) {
      window++;
      const label = ids.labels[ids.data[y * ids.width + x]] || "";
      if (want.has(label)) {
        n++;
        by[label] = (by[label] || 0) + 1;
      }
    }
  }
  return { n, window, by };
}

/** Connected components of one label. */
export function components(ids, label, minArea = 4) {
  if (!ids) return [];
  const idx = ids.labels.indexOf(label);
  if (idx < 0) return [];
  const w = ids.width;
  const h = ids.height;
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let i = 0; i < ids.data.length; i++) {
    if (seen[i] || ids.data[i] !== idx) continue;
    const stack = [i];
    seen[i] = 1;
    let n = 0;
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && !seen[p - 1] && ids.data[p - 1] === idx) {
        seen[p - 1] = 1;
        stack.push(p - 1);
      }
      if (x + 1 < w && !seen[p + 1] && ids.data[p + 1] === idx) {
        seen[p + 1] = 1;
        stack.push(p + 1);
      }
      if (y > 0 && !seen[p - w] && ids.data[p - w] === idx) {
        seen[p - w] = 1;
        stack.push(p - w);
      }
      if (y + 1 < h && !seen[p + w] && ids.data[p + w] === idx) {
        seen[p + w] = 1;
        stack.push(p + w);
      }
    }
    if (n >= minArea) out.push(n);
  }
  return out;
}

/**
 * Do the colour pixels under this label look like a real drawn object?
 * Flat black, or a flat match to the ground sample, does not.
 * Textured pixels with their own variance do.
 */
export function colorVisible(rgba, width, height, ids, label) {
  if (!ids) return { visible: false, samples: 0, reason: "no-id-buffer" };
  const idx = ids.labels.indexOf(label);
  if (idx < 0) return { visible: false, samples: 0, reason: "label-absent" };
  const ground = sampleUnlabeled(rgba, width, height, ids);
  const pts = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((ids.width * ids.height) / 800)));
  for (let y = 0; y < ids.height; y += stride) {
    for (let x = 0; x < ids.width; x += stride) {
      if (ids.data[y * ids.width + x] !== idx) continue;
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) / ids.width) * width));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) / ids.height) * height));
      const i = (sy * width + sx) * 4;
      pts.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
      if (pts.length >= 80) break;
    }
    if (pts.length >= 80) break;
  }
  if (pts.length < 8) return { visible: false, samples: pts.length, reason: "too-few-pixels" };
  let mr = 0;
  let mg = 0;
  let mb = 0;
  for (const p of pts) {
    mr += p[0];
    mg += p[1];
    mb += p[2];
  }
  mr /= pts.length;
  mg /= pts.length;
  mb /= pts.length;
  let varSum = 0;
  for (const p of pts) {
    varSum += (p[0] - mr) ** 2 + (p[1] - mg) ** 2 + (p[2] - mb) ** 2;
  }
  const std = Math.sqrt(varSum / pts.length / 3);
  const meanL = luma(mr, mg, mb);
  const flatBlack = meanL < 14 && std < 5;
  let groundDiff = 999;
  if (ground) {
    groundDiff = (Math.abs(mr - ground[0]) + Math.abs(mg - ground[1]) + Math.abs(mb - ground[2])) / 3;
  }
  const visible = !flatBlack && (std >= 8 || groundDiff >= 14);
  return {
    visible,
    samples: pts.length,
    std: round(std),
    groundDiff: round(groundDiff),
    meanL: round(meanL),
    reason: visible ? "drawn" : flatBlack ? "flat-black" : "matches-ground",
  };
}

/** Ground colour from pixels the ID buffer did not claim, so an object cannot be compared to itself. */
function sampleUnlabeled(rgba, width, height, ids) {
  const pts = [];
  const y0 = Math.floor(ids.height * 0.5);
  const step = Math.max(1, Math.floor(ids.width / 28));
  for (let y = y0; y < ids.height && pts.length < 24; y += step) {
    for (let x = 0; x < ids.width && pts.length < 24; x += step) {
      if (ids.data[y * ids.width + x] !== 0) continue;
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) / ids.width) * width));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) / ids.height) * height));
      const i = (sy * width + sx) * 4;
      pts.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }
  if (pts.length < 6) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pts) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  return [r / pts.length, g / pts.length, b / pts.length];
}

/** Neighbour luma jumps inside fog-labelled pixels. High fraction = hard streaks. */
export function fogStreakFrac(rgba, width, height, ids) {
  if (!ids) return { frac: 0, samples: 0 };
  const idx = ids.labels.indexOf("fog");
  if (idx < 0) return { frac: 0, samples: 0 };
  let samples = 0;
  let hard = 0;
  const stride = Math.max(1, Math.floor(ids.width / 40));
  for (let y = 1; y < ids.height - 1; y += stride) {
    for (let x = 1; x < ids.width - 1; x += stride) {
      if (ids.data[y * ids.width + x] !== idx) continue;
      const sx = Math.min(width - 2, Math.floor(((x + 0.5) / ids.width) * width));
      const sy = Math.min(height - 2, Math.floor(((y + 0.5) / ids.height) * height));
      const i = (sy * width + sx) * 4;
      const j = (sy * width + sx + 1) * 4;
      const dl = Math.abs(luma(rgba[i], rgba[i + 1], rgba[i + 2]) - luma(rgba[j], rgba[j + 1], rgba[j + 2]));
      samples++;
      if (dl > 70) hard++;
      if (samples >= 200) break;
    }
    if (samples >= 200) break;
  }
  return { frac: samples ? round(hard / samples) : 0, samples, hard };
}

export function backdropMag(backdrop) {
  if (!backdrop) return { mag: null, reason: "no-backdrop-metrics" };
  const sourceW = Number(backdrop.sourceW);
  const sourceH = Number(backdrop.sourceH);
  const screenW = Number(backdrop.screenW);
  const screenH = Number(backdrop.screenH);
  const fov = Number(backdrop.fovDeg);
  if (!(sourceW > 0) || !(screenW > 0) || !(fov > 0)) {
    return { mag: null, reason: "incomplete-backdrop-metrics", sourceW, sourceH, screenW, screenH, fov };
  }
  const slice = sourceW * (fov / 360);
  const magW = screenW / slice;
  const magH = sourceH > 0 && screenH > 0 ? screenH / sourceH : 0;
  return {
    mag: round(Math.max(magW, magH)),
    magW: round(magW),
    magH: round(magH),
    slice: round(slice),
    sourceW,
    sourceH,
    screenW,
    screenH,
    fov,
  };
}
