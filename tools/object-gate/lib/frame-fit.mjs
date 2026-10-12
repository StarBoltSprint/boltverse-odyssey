// v3.2: verbatim copy of lib/probe.js silhouetteRect (probe.js runs inside the page; this copy is for selftest.mjs)
export function silhouetteRect(m, w, h, margin, mode) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, sx = 0, n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[(y * w + x) * 4] > 127) { const ty = h - 1 - y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (ty < y0) y0 = ty; if (ty > y1) y1 = ty; sx += x; n++; }
    if (x1 < 0) return null;
    let bw = (x1 - x0 + 1) * (1 + 2 * margin), bh = (y1 - y0 + 1) * (1 + 2 * margin); const a = w / h;
    if (mode === "height") bw = bh * a; else if (bw / bh > a) bh = bw / a; else bw = bh * a;
    if (bw >= w * 0.98 || bh >= h * 0.98) { if (mode !== "height" || bh >= h * 0.98) return null; }
    const cx = mode === "height" ? Math.min(w - bw / 2, Math.max(bw / 2, sx / n + 0.5)) : (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
    return { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, mode: mode || "contain" };
  }