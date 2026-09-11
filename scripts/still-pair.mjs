#!/usr/bin/env node
// Still-pair gate. SSIM the hall, PCA/NCC the back — not a skeleton.
// matchPose(a,b,edge) → { ok, why[] }
// See STILL-PAIR.md. Hang only if ok.

export const GW = 180;
export const GH = 320;

const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

function lum(buf, i) {
  return (buf[i * 3] * 3 + buf[i * 3 + 1] * 4 + buf[i * 3 + 2]) >> 3;
}

function gray(buf, w, h) {
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = lum(buf, i);
  return g;
}

function boxBlur(g, w, h, r = 1) {
  const o = new Float64Array(g.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += g[yy * w + xx];
          n++;
        }
      }
      o[y * w + x] = s / n;
    }
  }
  return o;
}

function ssim(a, b) {
  const n = a.length;
  if (!n) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let va = 0, vb = 0, cv = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    va += da * da;
    vb += db * db;
    cv += da * db;
  }
  va /= n;
  vb /= n;
  cv /= n;
  return ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

function hallGray(g, w, h) {
  const y1 = Math.floor(h * 0.55);
  const out = new Float64Array(w * y1);
  for (let y = 0; y < y1; y++) out.set(g.subarray(y * w, (y + 1) * w), y * w);
  return boxBlur(out, w, y1, 1);
}

function dogMask(buf, w, h) {
  const vis = new Uint8Array(w * h);
  const y0 = Math.floor(h * 0.28);
  for (let y = y0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      vis[i] = mn > 145 && mx - mn < 60 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(w * h);
  let best = [];
  const flood = (sx, sy) => {
    const st = [[sx, sy]];
    const pts = [];
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < y0 || x >= w || y >= y1) continue;
      const i = y * w + x;
      if (seen[i] || !vis[i]) continue;
      seen[i] = 1;
      pts.push(x, y);
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return pts;
  };
  for (let y = y0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (vis[y * w + x] && !seen[y * w + x]) {
        const p = flood(x, y);
        if (p.length > best.length) best = p;
      }
  const n = (best.length / 2) | 0;
  if (n < 8) return null;
  let minX = w, minY = h, maxX = 0, maxY = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const x = best[i * 2], y = best[i * 2 + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    sx += x;
    sy += y;
  }
  const cx = sx / n, cy = sy / n;
  let xx = 0, xy = 0, yy = 0;
  for (let i = 0; i < n; i++) {
    const dx = best[i * 2] - cx, dy = best[i * 2 + 1] - cy;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
  const vx = Math.cos(theta), vy = Math.sin(theta);
  const axisFromVert = (Math.acos(Math.min(1, Math.abs(vy))) * 180) / Math.PI;
  return {
    n,
    minX,
    minY,
    maxX,
    maxY,
    cx,
    cy,
    h: maxY - minY + 1,
    w: maxX - minX + 1,
    axisFromVert,
    blobs: 1,
  };
}

/** Cream connected blob for bboxH/H. White-only mask misses legs. */
export function creamHeight(buf, w, h) {
  const vis = new Uint8Array(w * h);
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.floor(h * 0.88); // floor ice/path is cream — not the dog
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const luma = (r * 3 + g * 4 + b) >> 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      vis[i] = luma > 105 && r >= g - 8 && r >= b - 8 && sat < 100 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(w * h);
  let best = { n: 0, h: 0 };
  const flood = (sx, sy) => {
    const st = [[sx, sy]];
    let minX = w, minY = h, maxX = 0, maxY = 0, n = 0;
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < y0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (seen[i] || !vis[i]) continue;
      seen[i] = 1;
      n++;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return { n, minX, minY, maxX, maxY, h: (maxY - minY + 1) / h, w: (maxX - minX + 1) / w };
  };
  for (let y = y0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (vis[y * w + x] && !seen[y * w + x]) {
        const b = flood(x, y);
        if (b.n > 80 && b.w < 0.45 && b.h > 0.12 && b.h < 0.55 && b.n > best.n) best = b;
      }
  return best.n ? best.h : 0;
}

/** Center x of cream blob, 0..1. null if no dog. */
export function creamPlace(buf, w, h) {
  const vis = new Uint8Array(w * h);
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.floor(h * 0.88);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const luma = (r * 3 + g * 4 + b) >> 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      vis[i] = luma > 105 && r >= g - 8 && r >= b - 8 && sat < 100 ? 1 : 0;
    }
  }
  const seen = new Uint8Array(w * h);
  let best = { n: 0 };
  const flood = (sx, sy) => {
    const st = [[sx, sy]];
    let minX = w, maxX = 0, minY = h, maxY = 0, n = 0, sxn = 0;
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < y0 || x >= w || y >= y1) continue;
      const i = y * w + x;
      if (seen[i] || !vis[i]) continue;
      seen[i] = 1;
      n++;
      sxn += x;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return { n, cx: n ? sxn / n / w : 0.5, h: (maxY - minY + 1) / h, w: (maxX - minX + 1) / w };
  };
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < w; x++)
      if (vis[y * w + x] && !seen[y * w + x]) {
        const b = flood(x, y);
        if (b.n > 80 && b.w < 0.45 && b.h > 0.12 && b.n > best.n) best = b;
      }
  return best.n ? best : null;
}


export const SPAWN_BAND = [0.22, 0.32];
export const SILL_BAND = [0.35, 0.4];
export const PUNCH = 0.55;

function cropGray(g, w, x0, y0, cw, ch) {
  const o = new Float64Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const xx = Math.min(w - 1, Math.max(0, x0 + x));
      const yy = Math.min((g.length / w) | 0, Math.max(0, y0 + y));
      o[y * cw + x] = g[yy * w + xx] ?? 0;
    }
  }
  return o;
}

function ncc(t, p) {
  const n = t.length;
  if (n !== p.length || !n) return 0;
  let mt = 0, mp = 0;
  for (let i = 0; i < n; i++) {
    mt += t[i];
    mp += p[i];
  }
  mt /= n;
  mp /= n;
  let num = 0, a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const dt = t[i] - mt, dp = p[i] - mp;
    num += dt * dp;
    a += dt * dt;
    b += dp * dp;
  }
  const d = Math.sqrt(a * b);
  return d < 1e-6 ? 0 : num / d;
}

function backThumb(g, w, h, dog) {
  if (!dog) return null;
  const pad = 0.18;
  const x0 = Math.floor(dog.minX + dog.w * pad);
  const y0 = Math.floor(dog.minY + dog.h * 0.15);
  const cw = Math.max(8, Math.floor(dog.w * (1 - 2 * pad)));
  const ch = Math.max(10, Math.floor(dog.h * 0.7));
  const raw = cropGray(g, w, x0, y0, cw, ch);
  const tw = 24, th = 36;
  const o = new Float64Array(tw * th);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const sx = Math.floor((x * cw) / tw);
      const sy = Math.floor((y * ch) / th);
      o[y * tw + x] = raw[sy * cw + sx];
    }
  return o;
}

function slideNcc(thumb, g, w, h) {
  if (!thumb) return { peak: 0, peaks: 0 };
  const tw = 24, th = 36;
  const y0 = Math.floor(h * 0.55);
  const step = 6;
  let peak = -1, second = -1, px = 0, sx = 0;
  for (let y = y0; y + th < h; y += step) {
    for (let x = 4; x + tw < w - 4; x += step) {
      const p = cropGray(g, w, x, y, tw, th);
      const s = ncc(thumb, p);
      if (s > peak) {
        second = peak;
        sx = px;
        peak = s;
        px = x;
      } else if (s > second) {
        second = s;
        sx = x;
      }
    }
  }
  const far = Math.abs(px - sx) > w * 0.22;
  const peaks = peak >= 0.5 && second >= 0.5 && second > peak * 0.92 && far ? 2 : 1;
  return { peak, peaks, x: px };
}

function withers(buf, w, dog) {
  if (!dog) return { luma: 0, sat: 255 };
  let luma = 0, sat = 0, n = 0;
  const y1 = dog.minY + Math.max(2, Math.floor(dog.h * 0.22));
  for (let y = dog.minY; y < y1; y++) {
    for (let x = dog.minX; x <= dog.maxX; x++) {
      const i = y * w + x;
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      luma += (r * 3 + g * 4 + b) >> 3;
      sat += mx - mn;
      n++;
    }
  }
  return n ? { luma: luma / n, sat: sat / n } : { luma: 0, sat: 255 };
}

function edgeKind(edge) {
  const e = String(edge || "breath");
  if (e === "enter") return "enter";
  if (e.startsWith("walk")) return "walk";
  return "breath";
}

function posesOf(edge) {
  const e = String(edge || "");
  if (/breath-a|breath-b|still-at/i.test(e)) return ["sill", "sill"];
  if (/walk-a-b|walk-b-a/i.test(e)) return ["sill", "sill"];
  if (/walk-spawn|walk-a|walk-b/i.test(e)) return ["spawn", "sill"];
  if (e === "enter") return ["sill", "spawn"];
  return ["spawn", "spawn"];
}

function bandCheck(h, pose, why, warns) {
  if (!h) return;
  if (h >= PUNCH) why.push(`gate.size punch-in ${h.toFixed(2)}`);
  else if (pose === "spawn" && (h < 0.18 || h > 0.36)) why.push(`gate.size spawn-band ${h.toFixed(2)}`);
  else if (pose === "sill" && h < 0.28) warns.push(`gate.size sill-band ${h.toFixed(2)} want 0.35-0.40`);
  else if (pose === "sill" && h > 0.45) why.push(`gate.size sill-band ${h.toFixed(2)}`);
}

const T = {
  breath: { hall: 0.55, dh: 0.11, yaw: 32, dcx: 0.08, ncc: 0.38 },
  walk: { hall: 0.45, dh: 0.12, yaw: 32, dcx: 0.22, ncc: 0.34 },
  enter: { hall: 0.12, dh: 0.14, yaw: 32, dcx: 0.35, ncc: 0.3 },
};

/**
 * a, b: rgb24 w*h*3
 * edge: breath | walk | walk-spawn-A | walk-spawn-B | enter
 */
export function matchPose(a, b, edge, dims = { w: GW, h: GH }) {
  const w = dims.w, h = dims.h;
  let why = [];
  const kind = edgeKind(edge);
  const t = T[kind] || T.breath;

  const ga = gray(a, w, h);
  const gb = gray(b, w, h);
  const hall = ssim(hallGray(ga, w, h), hallGray(gb, w, h));
  const warns = [];
  if (kind !== "enter" && hall < t.hall) {
    const msg = `gate.rig hallSSIM ${hall.toFixed(2)}`;
    if (dims.warnHall) warns.push(msg);
    else why.push(msg);
  }

  const [poseA, poseB] = posesOf(edge);
  const ha = creamHeight(a, w, h);
  const hb = creamHeight(b, w, h);
  bandCheck(ha, poseA, why, warns);
  bandCheck(hb, poseB, why, warns);

  const da = dogMask(a, w, h);
  const db = dogMask(b, w, h);
  if (!da) why.push("gate.place no-dog-a");
  if (!db) why.push("gate.place no-dog-b");
  if (da && db) {
    const dh = Math.abs(da.h / h - db.h / h);
    if (dh > t.dh) why.push(`gate.size Δh/H ${dh.toFixed(2)}`);
    if (da.axisFromVert > t.yaw) why.push(`gate.yaw a ${da.axisFromVert.toFixed(0)}°`);
    if (db.axisFromVert > t.yaw) why.push(`gate.yaw b ${db.axisFromVert.toFixed(0)}°`);
    const dcx = (db.cx - da.cx) / w;
    const abs = Math.abs(dcx);
    const leftOk = /walk.*-a$/i.test(edge) || /spawn-a/i.test(edge);
    const rightOk = /walk.*-b$/i.test(edge) || /spawn-b/i.test(edge);
    if (kind === "walk" && leftOk && dcx <= 0.02 && abs < t.dcx + 0.12) {
      /* drift left OK */
    } else if (kind === "walk" && rightOk && dcx >= -0.02 && abs < t.dcx + 0.12) {
      /* drift right OK */
    } else if (kind !== "enter" && abs > t.dcx) {
      why.push(`gate.place Δcx/W ${dcx.toFixed(2)}`);
    }
  }

  const thumb = backThumb(ga, w, h, da);
  const slid = slideNcc(thumb, gb, w, h);
  if (slid.peaks >= 2 && hall < 0.85) why.push("gate.clone 2-ncc-peaks");
  if (slid.peak < t.ncc) why.push(`gate.ncc ${slid.peak.toFixed(2)}`);

  const wa = withers(a, w, da);
  const wb = withers(b, w, db);
  if (wa.luma < 90 || wb.luma < 90) why.push("gate.fur dark");
  if (wa.sat > 90 && wa.luma < 130) why.push("gate.fur wash-a");

  // Breath vapor inflates creamHeight (~0.01–0.03). If hall + feet are frozen,
  // a small Δh is fog, not a step. Punch-in / place / yaw still FAIL.
  if (kind === "breath" && why.length) {
    const fog = why.filter((w) => w.startsWith("gate.size Δh/H"));
    const rest = why.filter((w) => !w.startsWith("gate.size Δh/H"));
    const nums = fog.map((w) => Number((w.match(/(\d+\.\d+)/) || [])[1]));
    if (rest.length === 0 && fog.length && nums.every((d) => d > 0 && d <= 0.14)) {
      warns.push(...fog.map((w) => w + " vapor"));
      why = [];
    }
  }

  return {
    ok: why.length === 0,
    why,
    warn: warns,
    hall,
    ncc: slid.peak,
    yawA: da?.axisFromVert,
    yawB: db?.axisFromVert,
  };
}
