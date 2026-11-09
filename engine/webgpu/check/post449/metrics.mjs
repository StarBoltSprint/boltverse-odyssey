// Pixel metrics for the TAA / SSGI candidate. Linear luma, not the tonemapped jpeg.

export function decodeLuma(b64, w, h) {
  const bin = Buffer.from(b64, 'base64');
  if (bin.byteLength !== w * h * 4) throw new Error(`luma bytes ${bin.byteLength} != ${w * h * 4}`);
  return { w, h, data: new Float32Array(bin.buffer, bin.byteOffset, w * h) };
}

export function mean(data) {
  let s = 0;
  for (let i = 0; i < data.length; i++) s += data[i];
  return data.length ? s / data.length : 0;
}

// Temporal variance weighted by the spatial gradient of the mean image,
// so flat stone does not hide the thin joints.
export function edgeVariance(frames) {
  const { w, h } = frames[0];
  const n = frames.length;
  const N = w * h;
  const sum = new Float64Array(N);
  const sum2 = new Float64Array(N);
  for (const f of frames) {
    for (let i = 0; i < N; i++) { sum[i] += f.data[i]; sum2[i] += f.data[i] * f.data[i]; }
  }
  let acc = 0, wsum = 0, edge = 0, eN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const mu = sum[i] / n;
      const vari = Math.max(0, sum2[i] / n - mu * mu);
      const gx = (sum[i + 1] - sum[i - 1]) / n;
      const gy = (sum[i + w] - sum[i - w]) / n;
      const g = Math.hypot(gx, gy);
      acc += vari * g;
      wsum += g;
      edge += g;
      eN++;
    }
  }
  return { variance: wsum > 1e-8 ? acc / wsum : 0, edge: eN ? edge / eN : 0 };
}

// Wake = pixels inside the card's rectangle a few frames ago and outside it now.
// Centre = mean luma inside the card. Edge = the card's left columns.
function clipCard(card, w, h) {
  if (!card) return null;
  const x0 = Math.max(0, Math.floor(card.x0));
  const y0 = Math.max(0, Math.floor(card.y0));
  const x1 = Math.min(w - 1, Math.ceil(card.x1));
  const y1 = Math.min(h - 1, Math.ceil(card.y1));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  return { x0, y0, x1, y1 };
}

export function ghostStats(frames) {
  const bgSamples = [];
  for (const f of frames) {
    for (let y = 0; y < f.h; y += 4) bgSamples.push(f.data[y * f.w + 2]);
  }
  bgSamples.sort((a, b) => a - b);
  const bg = bgSamples[bgSamples.length >> 1] || 0;
  let wake = 0, wakeN = 0;
  const lag = 3;
  for (let i = lag; i < frames.length; i++) {
    const prev = frames[i - lag], cur = frames[i];
    const a = clipCard(prev.card, cur.w, cur.h);
    const b = clipCard(cur.card, cur.w, cur.h);
    if (!a || !b) continue;
    for (let y = a.y0; y <= a.y1; y++) for (let x = a.x0; x <= a.x1; x++) {
      if (x >= b.x0 - 2 && x <= b.x1 + 2 && y >= b.y0 - 2 && y <= b.y1 + 2) continue;
      wake += cur.data[y * cur.w + x];
      wakeN++;
    }
  }
  const centres = [];
  const edges = [];
  for (const f of frames) {
    const b = clipCard(f.card, f.w, f.h);
    if (!b) continue;
    let cs = 0, cn = 0, es = 0, en = 0;
    const cx0 = (b.x0 + b.x1) >> 1, cy0 = (b.y0 + b.y1) >> 1;
    for (let y = cy0 - 2; y <= cy0 + 2; y++) for (let x = cx0 - 2; x <= cx0 + 2; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      cs += f.data[y * f.w + x]; cn++;
    }
    for (let y = b.y0 + 2; y <= b.y1 - 2; y++) for (let x = b.x0; x < b.x0 + 3 && x <= b.x1; x++) {
      es += f.data[y * f.w + x]; en++;
    }
    if (cn) centres.push(cs / cn);
    if (en) edges.push(es / en);
  }
  const vof = (a) => {
    if (a.length < 2) return 0;
    const m = a.reduce((s, v) => s + v, 0) / a.length;
    return a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length;
  };
  return {
    bg, wake: wakeN ? wake / wakeN : bg, wakeN,
    centre: centres.length ? centres.reduce((s, v) => s + v, 0) / centres.length : 0,
    centreVar: vof(centres),
    edgeVar: vof(edges),
  };
}
