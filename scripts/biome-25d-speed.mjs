#!/usr/bin/env node
/**
 * 2.5D biome post-cook: SAME SPEED match + ambient-tint helpers.
 * Law: COOK-BIOME-25D.md. Not hall. Not COOKLANE. PathGen HOLD.
 *
 *   node scripts/biome-25d-speed.mjs biomes-25d/<style>
 *   node scripts/biome-25d-speed.mjs --analyze biomes-25d/<style>
 *   node scripts/biome-25d-speed.mjs --selftest
 *
 * NOT a constant per-plate playbackRate.
 * Imagine-side target = COOK-BIOME-25D.md SPEED REF (plate-1 KEEP prompt + plate-empty-keep.mp4).
 * This file is the post-cook filet only — do not invent speed here.
 * Imagine can slow/speed mid-clip. Match plate-1 KEEP with a smoothed rate(t):
 *   sample ground-parallax every SAMPLE_DT=0.1s on plate1 (ref) and plate N (meas)
 *   rate(t) = clamp(ref/meas, 1.0, 1.6) then smooth
 *   long stretch of raw > 1.6 → recook travelling. Never 2×+.
 *
 * PLAYER STUB (bolt-hybrid play/ — do not scaffold a grok.me here):
 *   pictureTime = video.currentTime
 *   rate = rateAt(plate.rateCurve, pictureTime)   // curve sampled every 0.1s
 *   video.playbackRate = rate                     // LIVE ≥10Hz from pictureTime
 *   stride(pictureTime, rate)                     // gait follows both — never legs alone
 *   every ~0.1s (~10Hz): sample lower-third ground+haze → softMultiply card (light wrap)
 *   identityGuard: luma stays high — NOT grey/black morph, NOT a new dog
 *
 * Expected paths when Build plates land (asteroid typical first style):
 *   biomes-25d/<style>/films/plate-empty-keep.mp4   ← optical-flow KEEP ref
 *   biomes-25d/<style>/films/plate-1.mp4            ← playable KEEP / ref fallback
 *   biomes-25d/<style>/films/plate-2.mp4 … plate-4.mp4
 * --analyze also accepts loose mp4 paths (P1 KEEP + P2–P4) wherever they live.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const RATE_MIN = 1.0;
export const RATE_MAX = 1.6;
export const RATE_TYPICAL_LO = 1.3;
export const RATE_TYPICAL_HI = 1.5;
/** Sample + adapt cadence (seconds). Law is 0.1s — not the old 0.25–0.5 band. */
export const SAMPLE_DT = 0.1;
/** Player must apply live rateAt from pictureTime at least this often (10–15Hz OK). */
export const LIVE_RATE_DT = 0.1;
export const LIVE_RATE_HZ_MIN = 10;
export const SMOOTH_WIN = 3;
/** Consecutive seconds of raw>1.6 that force recook (a lone spike may clamp). */
export const RECOOK_STRETCH_S = 1.5;
export const KEEP_REL = "films/plate-empty-keep.mp4";
/** Ambient tint blend cadence — same stack as speed SAMPLE_DT (was ~4Hz / 250ms). */
export const TINT_DT = 0.1;
export const TINT_HZ = 10;
export const TINT_LUMA_FLOOR = 180;

export const TINT_LAW = {
  hz: TINT_HZ,
  dt: TINT_DT,
  region: "lower-third ground + haze",
  mode: "soft-multiply",
  identity: "full-white coat forever — light wrap only, never grey/black morph",
};

const FRAME_W = 160;
const FRAME_H = 90;

export function plateRel(n) {
  return "films/plate-" + n + ".mp4";
}

export function matchRate(ref, measured) {
  const r = Number(ref);
  const m = Number(measured);
  if (!(r > 0) || !(m > 0) || !Number.isFinite(r) || !Number.isFinite(m)) {
    return { rate: null, recook: true, raw: null, reason: "no travel" };
  }
  const raw = r / m;
  if (raw > RATE_MAX) {
    return { rate: RATE_MAX, recook: true, raw, reason: "need >1.6 — recook travelling" };
  }
  const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, raw));
  return { rate, recook: false, raw, reason: "" };
}

export function sampleTravel(series, t) {
  if (!series || !series.length) return 0;
  if (t <= series[0].t) return series[0].travel;
  const last = series[series.length - 1];
  if (t >= last.t) return last.travel;
  for (let i = 1; i < series.length; i++) {
    if (t <= series[i].t) {
      const a = series[i - 1];
      const b = series[i];
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.travel + (b.travel - a.travel) * u;
    }
  }
  return last.travel;
}

export function rateAt(curve, t) {
  if (!curve || !curve.length) return 1;
  if (t <= curve[0].t) return curve[0].rate;
  const last = curve[curve.length - 1];
  if (t >= last.t) return last.rate;
  for (let i = 1; i < curve.length; i++) {
    if (t <= curve[i].t) {
      const a = curve[i - 1];
      const b = curve[i];
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return a.rate + (b.rate - a.rate) * u;
    }
  }
  return last.rate;
}

export function smoothRates(rates, win = SMOOTH_WIN) {
  const w = Math.max(1, win | 0);
  return rates.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = i - Math.floor(w / 2); k <= i + Math.floor(w / 2); k++) {
      if (k < 0 || k >= rates.length) continue;
      s += rates[k];
      n++;
    }
    return s / n;
  });
}

export function sampleTimes(tEnd, dt = SAMPLE_DT) {
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  const end = Math.max(0, Number(tEnd) || 0);
  const n = Math.max(1, Math.round(end / step));
  const times = [];
  for (let i = 0; i <= n; i++) times.push(Math.min(end, i * step));
  if (times[times.length - 1] < end - 1e-9) times.push(end);
  return times;
}

export function recookStretches(raws, dt = SAMPLE_DT, max = RATE_MAX, minStretch = RECOOK_STRETCH_S) {
  const out = [];
  let run = 0;
  let start = -1;
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  for (let i = 0; i < raws.length; i++) {
    const raw = Number(raws[i]);
    if (Number.isFinite(raw) && raw > max) {
      if (start < 0) start = i;
      run += step;
    } else {
      if (start >= 0 && run + 1e-9 >= minStretch) {
        out.push({ t0: start * step, t1: i * step, seconds: run });
      }
      run = 0;
      start = -1;
    }
  }
  if (start >= 0 && run + 1e-9 >= minStretch) {
    out.push({ t0: start * step, t1: raws.length * step, seconds: run });
  }
  return out;
}

export function stretchNeedsRecook(raws, dt = SAMPLE_DT, max = RATE_MAX, minStretch = RECOOK_STRETCH_S) {
  return recookStretches(raws, dt, max, minStretch).length > 0;
}

export function curveStats(curve) {
  const rates = (curve || []).map((p) => Number(p.rate)).filter((r) => Number.isFinite(r));
  if (!rates.length) return { mean: null, min: null, max: null, n: 0 };
  const sum = rates.reduce((s, r) => s + r, 0);
  return {
    mean: sum / rates.length,
    min: Math.min(...rates),
    max: Math.max(...rates),
    n: rates.length,
  };
}

/**
 * Build smoothed rate(t) that matches plate-1 KEEP continuously.
 * series = [{ t, travel }, ...]  (same metric; resampled every SAMPLE_DT=0.1s)
 * Align by normalized time t/T.
 */
export function buildRateCurve(refSeries, measSeries, dt = SAMPLE_DT) {
  if (!refSeries?.length || !measSeries?.length) {
    return { ok: false, recook: true, reason: "no travel series", curve: [], raws: [] };
  }
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  const refT = Math.max(1e-6, refSeries[refSeries.length - 1].t);
  const measT = Math.max(1e-6, measSeries[measSeries.length - 1].t);
  const points = [];
  const raws = [];
  for (const t of sampleTimes(measT, step)) {
    const ref = sampleTravel(refSeries, (t / measT) * refT);
    const travel = sampleTravel(measSeries, t);
    const m = matchRate(ref, travel);
    raws.push(m.raw);
    points.push({
      t,
      travel,
      ref,
      raw: m.raw,
      rate: m.rate == null ? RATE_MAX : m.rate,
    });
  }
  const stretches = recookStretches(
    raws.map((r) => (r == null ? Infinity : r)),
    step,
  );
  if (stretches.length) {
    return {
      ok: false,
      recook: true,
      reason: "speed.recook long stretch >1.6 — recook travelling",
      curve: points,
      raws,
      stretches,
    };
  }
  const smoothed = smoothRates(
    points.map((p) => p.rate),
    SMOOTH_WIN,
  );
  const curve = points.map((p, i) => ({
    t: p.t,
    rate: Math.min(RATE_MAX, Math.max(RATE_MIN, smoothed[i])),
    travel: p.travel,
    ref: p.ref,
  }));
  const stats = curveStats(curve);
  return { ok: true, recook: false, reason: "", curve, raws, stretches: [], mean: stats.mean };
}

/** Player stub: live playbackRate from pictureTime. Call ≥10Hz (every LIVE_RATE_DT). Gait uses both. */
export function applyLiveRate(video, curve) {
  const pictureTime = Number(video && video.currentTime) || 0;
  const rate = rateAt(curve, pictureTime);
  if (video) video.playbackRate = rate;
  return { pictureTime, rate };
}

export function pictureTime(currentTime, rate, rateOnElement = true) {
  const t = Number(currentTime) || 0;
  const r = Number(rate) || 1;
  return rateOnElement ? t : t * r;
}

export function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

export function softMultiply(card, ambient, amount = 0.28) {
  const a = Math.min(0.45, Math.max(0, Number(amount) || 0));
  const mix = (c, p) => c * (1 - a) + ((c * p) / 255) * a;
  return {
    r: mix(card.r, ambient.r),
    g: mix(card.g, ambient.g),
    b: mix(card.b, ambient.b),
  };
}

export function luma(rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

export function identityGuard(rgb, floor = TINT_LUMA_FLOOR) {
  const y = luma(rgb);
  if (y >= floor) return { ...rgb, pulled: false, luma: y };
  const k = floor / Math.max(1, y);
  return {
    r: Math.min(255, rgb.r * k),
    g: Math.min(255, rgb.g * k),
    b: Math.min(255, rgb.b * k),
    pulled: true,
    luma: floor,
  };
}

/** Player stub: soft-multiply + identity guard. Call every TINT_DT (~0.1s / 10Hz). */
export function applyLiveTint(card, ambient, amount = 0.28) {
  return identityGuard(softMultiply(card, ambient, amount));
}

export function tintHealth(series, card = { r: 250, g: 250, b: 250 }) {
  if (!series?.length) return { ok: false, reason: "no tint samples", n: 0, hz: TINT_HZ, dt: TINT_DT };
  let pulled = 0;
  let greyRisk = 0;
  let lumaSum = 0;
  let minLuma = 255;
  for (const s of series) {
    const ambient = { r: s.r, g: s.g, b: s.b };
    const rawWrap = softMultiply(card, ambient);
    if (luma(rawWrap) < TINT_LUMA_FLOOR) greyRisk++;
    const wrapped = identityGuard(rawWrap);
    lumaSum += wrapped.luma;
    if (wrapped.luma < minLuma) minLuma = wrapped.luma;
    if (wrapped.pulled) pulled++;
  }
  const span = series.length > 1 ? series[series.length - 1].t - series[0].t : 0;
  const dt = span > 0 ? span / (series.length - 1) : TINT_DT;
  const hz = dt > 0 ? 1 / dt : TINT_HZ;
  return {
    ok: minLuma >= TINT_LUMA_FLOOR,
    reason: minLuma >= TINT_LUMA_FLOOR ? "" : "wrap would read grey/black — identityGuard pulled",
    n: series.length,
    hz,
    dt,
    meanLuma: lumaSum / series.length,
    minLuma,
    pulled,
    greyRisk,
    identity: TINT_LAW.identity,
  };
}

function framesToSeries(buf, dt) {
  const frame = FRAME_W * FRAME_H;
  const n = Math.floor(buf.length / frame);
  if (n < 2) throw new Error("too few frames to measure travel");
  const series = [];
  for (let i = 1; i < n; i++) {
    let sad = 0;
    const a = (i - 1) * frame;
    const b = i * frame;
    for (let p = 0; p < frame; p++) sad += Math.abs(buf[a + p] - buf[b + p]);
    series.push({ t: i * dt, travel: sad / frame });
  }
  return series;
}

function ffmpegGray(mp4, fps) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      mp4,
      "-vf",
      `fps=${fps},crop=iw:ih*0.18:0:ih*0.74,scale=${FRAME_W}:${FRAME_H},format=gray`,
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 48 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error("ffmpeg travel measure failed");
  return r.stdout;
}

/** Ground-parallax samples every dt seconds (law SAMPLE_DT=0.1). */
export function measureTravelSeries(mp4, dt = SAMPLE_DT) {
  if (!mp4 || !existsSync(mp4)) throw new Error("no plate " + (mp4 || ""));
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  return framesToSeries(ffmpegGray(mp4, 1 / step), step);
}

export function measureTravel(mp4) {
  const series = measureTravelSeries(mp4, SAMPLE_DT);
  return series.reduce((s, p) => s + p.travel, 0) / series.length;
}

function ffmpegRgb(mp4, fps) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      mp4,
      "-vf",
      `fps=${fps},crop=iw:ih*0.18:0:ih*0.74,scale=${FRAME_W}:${FRAME_H},format=rgb24`,
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 48 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error("ffmpeg tint measure failed");
  return r.stdout;
}

/** Lower-third ground+haze mean RGB every dt seconds (law TINT_DT=0.1 / ~10Hz). */
export function measureTintSeries(mp4, dt = TINT_DT) {
  if (!mp4 || !existsSync(mp4)) throw new Error("no plate " + (mp4 || ""));
  const step = Number(dt) > 0 ? Number(dt) : TINT_DT;
  const buf = ffmpegRgb(mp4, 1 / step);
  const pix = FRAME_W * FRAME_H;
  const frame = pix * 3;
  const n = Math.floor(buf.length / frame);
  if (n < 1) throw new Error("too few frames to sample tint");
  const series = [];
  for (let i = 0; i < n; i++) {
    let r = 0;
    let g = 0;
    let b = 0;
    const off = i * frame;
    for (let p = 0; p < pix; p++) {
      r += buf[off + p * 3];
      g += buf[off + p * 3 + 1];
      b += buf[off + p * 3 + 2];
    }
    const rgb = { r: r / pix, g: g / pix, b: b / pix };
    series.push({ t: i * step, ...rgb, luma: luma(rgb) });
  }
  return series;
}

export function safeTintHealth(mp4, dt = TINT_DT) {
  try {
    return tintHealth(measureTintSeries(mp4, dt));
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : "tint skip", n: 0, hz: TINT_HZ, dt: TINT_DT };
  }
}

function onesCurve(series, dt = SAMPLE_DT) {
  const tEnd = series?.length ? series[series.length - 1].t : 0;
  return sampleTimes(tEnd, dt).map((t) => ({
    t,
    rate: 1,
    travel: sampleTravel(series, t),
    ref: sampleTravel(series, t),
  }));
}

export function listPlateRels(dir) {
  const films = join(dir, "films");
  if (!existsSync(films)) return [];
  return readdirSync(films)
    .filter((f) => /^plate-\d+\.mp4$/i.test(f))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map((f) => "films/" + f);
}

export function resolveKeepRel(dir) {
  if (existsSync(join(dir, KEEP_REL))) return KEEP_REL;
  const plates = listPlateRels(dir);
  return plates[0] || null;
}

export function expectedPaths(dir) {
  return {
    keep: join(dir, KEEP_REL),
    plates: [1, 2, 3, 4].map((n) => join(dir, plateRel(n))),
  };
}

export function buildPlaylist({ style, files, seriesList, travels, dt = SAMPLE_DT }) {
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  const list =
    seriesList ||
    (travels || []).map((travel, i) => [{ t: 0, travel }, { t: 1, travel: travels[i] }]);
  if (!list.length) return { ok: false, reason: "no series", plates: [], sampleDt: step };
  const plates = [];
  const refSeries = list[0];
  for (let i = 0; i < files.length; i++) {
    if (i === 0) {
      const curve = onesCurve(refSeries, step);
      plates.push({
        id: "plate-1",
        file: files[0],
        playbackRate: 1,
        rateCurve: curve,
        match: "KEEP reference — rate(t)=1",
      });
      continue;
    }
    const built = buildRateCurve(refSeries, list[i], step);
    if (!built.ok) {
      return { ok: false, reason: built.reason || files[i], plates, refTravel: refSeries, sampleDt: step };
    }
    plates.push({
      id: "plate-" + (i + 1),
      file: files[i],
      playbackRate: built.mean,
      rateCurve: built.curve,
      match: "live rate(t) — playbackRate is mean summary only",
    });
  }
  return {
    ok: true,
    law: "COOK-BIOME-25D",
    match: "rate(t) live — not a constant per-plate playbackRate",
    style,
    sampleDt: step,
    liveRateDt: LIVE_RATE_DT,
    tintDt: TINT_DT,
    tintHz: TINT_HZ,
    plates,
    tint: TINT_LAW,
    player: "bolt-hybrid play/ — do not publish a new grok.me",
  };
}

export function writePlaylist(dir, playlist) {
  const dest = join(dir, "playlist.json");
  writeFileSync(dest, JSON.stringify(playlist, null, 2) + "\n");
  return dest;
}

function plateIdFromRel(rel, i) {
  const s = String(rel || "");
  if (/plate-empty-keep\.mp4$/i.test(s)) return "keep";
  const m = s.match(/plate-(\d+)/i);
  return m ? "plate-" + m[1] : "plate-" + (i + 1);
}

export function analyzeSeriesList({ style, files, seriesList, refFile, dt = SAMPLE_DT }) {
  const step = Number(dt) > 0 ? Number(dt) : SAMPLE_DT;
  const rows = [];
  const refSeries = seriesList && seriesList[0];
  for (let i = 0; i < (files || []).length; i++) {
    const file = files[i];
    const id = plateIdFromRel(file, i);
    const series = seriesList[i];
    if (i === 0 && (!refFile || refFile === file)) {
      const curve = onesCurve(series, step);
      const stats = curveStats(curve);
      rows.push({
        id,
        file,
        keep: true,
        match: true,
        recook: false,
        reason: "KEEP reference — rate(t)=1",
        mean: 1,
        min: 1,
        max: 1,
        n: stats.n,
        stretches: [],
        rateCurve: curve,
      });
      continue;
    }
    const built = buildRateCurve(refSeries, series, step);
    const stats = curveStats(built.ok ? built.curve : built.curve);
    const stretches = built.stretches || recookStretches(
      (built.raws || []).map((r) => (r == null ? Infinity : r)),
      step,
    );
    const inBand =
      stats.n > 0 &&
      stats.min >= RATE_MIN - 1e-9 &&
      stats.max <= RATE_MAX + 1e-9;
    rows.push({
      id,
      file,
      keep: false,
      match: !!(built.ok && inBand && !stretches.length),
      recook: !!built.recook || stretches.length > 0,
      reason: built.reason || "",
      mean: stats.mean,
      min: stats.min,
      max: stats.max,
      n: stats.n,
      stretches,
      rateCurve: built.curve,
    });
  }
  return {
    ok: rows.length > 0 && rows.every((p) => p.match),
    style,
    sampleDt: step,
    liveRateDt: LIVE_RATE_DT,
    tintDt: TINT_DT,
    tintHz: TINT_HZ,
    rateMin: RATE_MIN,
    rateMax: RATE_MAX,
    ref: refFile || (files && files[0]) || KEEP_REL,
    plates: rows,
  };
}

export function analyzePlaylistJson(playlist) {
  const plates = (playlist && playlist.plates) || [];
  const rows = plates.map((p, i) => {
    const stats = curveStats(p.rateCurve);
    const keep = i === 0 || /KEEP/.test(p.match || "");
    const inBand =
      stats.n > 0 &&
      stats.min >= RATE_MIN - 1e-9 &&
      stats.max <= RATE_MAX + 1e-9;
    return {
      id: p.id || plateIdFromRel(p.file, i),
      file: p.file,
      keep,
      match: !!(inBand && (keep || stats.max <= RATE_MAX)),
      recook: !inBand,
      reason: keep ? "KEEP reference — rate(t)=1 (playlist)" : "playlist rateCurve (raw n/a)",
      mean: keep ? 1 : stats.mean,
      min: keep ? 1 : stats.min,
      max: keep ? 1 : stats.max,
      n: stats.n,
      stretches: [],
      rateCurve: p.rateCurve,
    };
  });
  return {
    ok: rows.length > 0 && rows.every((p) => p.match),
    style: playlist && playlist.style,
    sampleDt: Number(playlist && playlist.sampleDt) || SAMPLE_DT,
    liveRateDt: LIVE_RATE_DT,
    tintDt: Number(playlist && playlist.tintDt) || TINT_DT,
    tintHz: Number(playlist && playlist.tintHz) || TINT_HZ,
    rateMin: RATE_MIN,
    rateMax: RATE_MAX,
    ref: (plates[0] && plates[0].file) || KEEP_REL,
    source: "playlist.json",
    plates: rows,
  };
}

function fmt(n) {
  if (n == null || !Number.isFinite(Number(n))) return "n/a";
  return Number(n).toFixed(3);
}

export function formatAnalyze(report) {
  const lines = [];
  if (!report) return "ANALYZE FAIL no report";
  if (report.missing) {
    lines.push("ANALYZE no plates yet — asteroid KEEP + later plates not in-repo");
    lines.push(
      "SAMPLE_DT=" +
        SAMPLE_DT +
        " RATE " +
        RATE_MIN.toFixed(1) +
        "–" +
        RATE_MAX.toFixed(1) +
        " TINT " +
        TINT_HZ +
        "Hz/" +
        TINT_DT +
        "s",
    );
    lines.push("expected ref:    " + report.expected.keep);
    lines.push("expected plates: " + report.expected.plates.join(" "));
    return lines.join("\n");
  }
  const tag = report.ok ? "MATCH" : "RECOOK";
  const tintHz = Number(report.tintHz) || TINT_HZ;
  const tintDt = Number(report.tintDt) || TINT_DT;
  lines.push(
    "ANALYZE " +
      (report.style || "") +
      " " +
      tag +
      " SAMPLE_DT=" +
      report.sampleDt +
      " RATE " +
      Number(report.rateMin).toFixed(1) +
      "–" +
      Number(report.rateMax).toFixed(1) +
      " live≥" +
      LIVE_RATE_HZ_MIN +
      "Hz TINT " +
      tintHz +
      "Hz/" +
      tintDt +
      "s",
  );
  lines.push("ref: " + report.ref + (report.source ? " (" + report.source + ")" : ""));
  for (const p of report.plates || []) {
    const stretches = (p.stretches || [])
      .map((s) => s.t0.toFixed(1) + "–" + s.t1.toFixed(1) + "s")
      .join(",");
    const recookBit = p.recook
      ? " recook" + (stretches ? " stretch " + stretches + " raw>1.6" : "")
      : "";
    const tint = p.tint;
    const tintBit = tint
      ? "  tint " +
        (tint.ok ? "OK" : "PULL") +
        " " +
        Math.round(Number(tint.hz) || tintHz) +
        "Hz luma=" +
        fmt(tint.meanLuma) +
        " pulled=" +
        (tint.pulled || 0)
      : "";
    lines.push(
      p.id +
        "  " +
        (p.match ? "MATCH" : "RECOOK") +
        "  mean=" +
        fmt(p.mean) +
        " min=" +
        fmt(p.min) +
        " max=" +
        fmt(p.max) +
        " n=" +
        (p.n || 0) +
        recookBit +
        (p.keep ? "  KEEP" : "") +
        tintBit,
    );
  }
  return lines.join("\n");
}

function attachTint(report, absFiles) {
  if (!report || !report.plates) return report;
  report.tintDt = TINT_DT;
  report.tintHz = TINT_HZ;
  report.plates.forEach((p, i) => {
    const abs = absFiles[i] || p.file;
    if (abs && existsSync(abs)) p.tint = safeTintHealth(abs, TINT_DT);
  });
  return report;
}

export function analyzeDir(dir, style) {
  const plates = listPlateRels(dir);
  const keep = resolveKeepRel(dir);
  const playlistPath = join(dir, "playlist.json");
  if (!plates.length && !keep) {
    if (existsSync(playlistPath)) {
      try {
        const playlist = JSON.parse(readFileSync(playlistPath, "utf8"));
        return analyzePlaylistJson(playlist);
      } catch {
        /* fall through to missing */
      }
    }
    return {
      ok: false,
      missing: true,
      style,
      sampleDt: SAMPLE_DT,
      tintDt: TINT_DT,
      tintHz: TINT_HZ,
      expected: expectedPaths(dir),
    };
  }
  const files = [];
  const seriesList = [];
  const absFiles = [];
  const refRel = keep || plates[0];
  files.push(refRel);
  absFiles.push(join(dir, refRel));
  seriesList.push(measureTravelSeries(join(dir, refRel), SAMPLE_DT));
  for (const rel of plates) {
    if (rel === refRel) continue;
    files.push(rel);
    absFiles.push(join(dir, rel));
    seriesList.push(measureTravelSeries(join(dir, rel), SAMPLE_DT));
  }
  return attachTint(
    analyzeSeriesList({ style, files, seriesList, refFile: refRel, dt: SAMPLE_DT }),
    absFiles,
  );
}

export function analyzeFiles(absPaths, { style, keep, dt = SAMPLE_DT } = {}) {
  const existing = (absPaths || []).filter((p) => p && existsSync(p));
  const ref = keep && existsSync(keep) ? keep : existing[0];
  if (!existing.length || !ref) {
    return {
      ok: false,
      missing: true,
      style: style || "plates",
      sampleDt: SAMPLE_DT,
      tintDt: TINT_DT,
      tintHz: TINT_HZ,
      expected: {
        keep: keep || KEEP_REL,
        plates: absPaths && absPaths.length ? absPaths : [1, 2, 3, 4].map((n) => plateRel(n)),
      },
    };
  }
  const files = [ref, ...existing.filter((p) => p !== ref)];
  const seriesList = files.map((f) => measureTravelSeries(f, dt));
  return attachTint(
    analyzeSeriesList({ style: style || "plates", files, seriesList, refFile: ref, dt }),
    files,
  );
}

export function isMp4Path(p) {
  return /\.mp4$/i.test(String(p || ""));
}

export function parseCli(argv) {
  const flags = new Set();
  const positionals = [];
  let keep = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--keep") {
      keep = argv[++i];
      continue;
    }
    if (a.startsWith("--")) {
      flags.add(a.slice(2));
      continue;
    }
    positionals.push(a);
  }
  return {
    analyze: flags.has("analyze"),
    selftest: flags.has("selftest"),
    keep,
    positionals,
  };
}

export function resolveAbs(rel, root) {
  if (!rel) return rel;
  return String(rel).startsWith("/") ? rel : join(root, rel);
}

export function matchDir(dir, style) {
  const files = listPlateRels(dir);
  const need = files.length ? files : ["films/plate-1.mp4", "films/plate-2.mp4"];
  const seriesList = need.map((rel) => measureTravelSeries(join(dir, rel), SAMPLE_DT));
  const playlist = buildPlaylist({ style, files: need, seriesList, dt: SAMPLE_DT });
  if (!playlist.ok) return playlist;
  writePlaylist(dir, playlist);
  return playlist;
}

function seriesAtDt(n, travelAt) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i * SAMPLE_DT;
    return { t, travel: travelAt(t, i) };
  });
}

function selftest() {
  const must = (ok, msg) => {
    if (!ok) {
      console.error("FAIL  " + msg);
      process.exit(1);
    }
    console.log("PASS  " + msg);
  };
  must(SAMPLE_DT === 0.1, "SAMPLE_DT=0.1");
  must(LIVE_RATE_DT === 0.1 && LIVE_RATE_HZ_MIN === 10, "live rateAt ≥10Hz / 0.1s");
  must(matchRate(10, 10).rate === 1, "same travel → rate 1.0");
  must(matchRate(10, 20).rate === 1, "faster plate clamps to 1.0 (never slow the storm)");
  const typical = matchRate(10, 10 / 1.4);
  must(typical.rate > RATE_TYPICAL_LO - 0.05 && typical.rate < RATE_TYPICAL_HI + 0.05, "typical corrector ~1.4");
  must(typical.rate <= RATE_MAX && typical.rate >= RATE_MIN, "typical in 1.0–1.6");
  must(matchRate(10, 10 / 1.7).recook === true, ">1.6 → recook flag");
  must(matchRate(10, 0).recook === true, "zero travel → recook");
  must(pictureTime(4, 1.4, true) === 4, "element rate: pictureTime = currentTime");
  must(pictureTime(4, 1.4, false) === 5.6, "external rate: pictureTime = currentTime * rate");

  const ref = seriesAtDt(40, () => 10);
  const measSteady = seriesAtDt(40, () => 10 / 1.4);
  const steady = buildRateCurve(ref, measSteady, SAMPLE_DT);
  must(steady.ok && Math.abs(steady.mean - 1.4) < 0.05, "steady mid-clip → ~1.4 curve");
  must(Math.abs(rateAt(steady.curve, 1.2) - 1.4) < 0.08, "rateAt mid-clip follows KEEP");
  must(steady.curve.length >= 20, "dense curve at 0.1s");
  const gaps = [];
  for (let i = 1; i < steady.curve.length; i++) gaps.push(steady.curve[i].t - steady.curve[i - 1].t);
  must(gaps.every((d) => Math.abs(d - SAMPLE_DT) < 0.02), "curve Δt ≈ 0.1s");

  const measDip = seriesAtDt(40, (t) => (t >= 1.6 && t <= 2.4 ? 10 / 1.5 : 10));
  const dipped = buildRateCurve(ref, measDip, SAMPLE_DT);
  must(dipped.ok, "mid-clip slow-down still OK if inside band");
  must(rateAt(dipped.curve, 2.0) > rateAt(dipped.curve, 0.4), "rate(t) rises where Imagine slowed");
  const sm = smoothRates([1, 1.6, 1, 1]);
  must(sm[1] < 1.6 && sm[1] > 1, "smooth eats a step");

  must(!stretchNeedsRecook([2, 1, 1, 1, 1], SAMPLE_DT), "lone spike >1.6 does not recook");
  must(!stretchNeedsRecook(Array(14).fill(2), SAMPLE_DT), "1.4s stretch < 1.5s — no recook");
  must(stretchNeedsRecook(Array(15).fill(2), SAMPLE_DT), "1.5s stretch >1.6 → recook");
  const measDead = seriesAtDt(40, () => 2);
  const dead = buildRateCurve(ref, measDead, SAMPLE_DT);
  must(!dead.ok && /recook/.test(dead.reason), "10/2 = 5 for whole clip → speed.recook");
  must(dead.stretches && dead.stretches.length >= 1, "dead clip lists recook stretch");

  const live = applyLiveRate({ currentTime: 2.0, playbackRate: 1 }, dipped.curve);
  must(live.pictureTime === 2 && live.rate > 1, "applyLiveRate sets rate from pictureTime");
  let ticks = 0;
  let prev = null;
  for (let t = 0; t <= 2.0 + 1e-9; t += LIVE_RATE_DT) {
    const hit = applyLiveRate({ currentTime: t, playbackRate: 1 }, dipped.curve);
    if (prev != null) must(hit.pictureTime - prev <= LIVE_RATE_DT + 1e-9, "live tick ≤0.1s");
    prev = hit.pictureTime;
    ticks++;
  }
  must(ticks >= 20, "live rateAt ticks every 0.1s across 2s");

  const built = buildPlaylist({
    style: "asteroid",
    files: ["films/plate-1.mp4", "films/plate-2.mp4"],
    seriesList: [ref, measSteady],
    dt: SAMPLE_DT,
  });
  must(built.ok && built.match.indexOf("rate(t)") >= 0, "playlist law is rate(t), not a constant");
  must(built.sampleDt === 0.1 && built.liveRateDt === 0.1, "playlist stores SAMPLE_DT=0.1");
  must(built.plates[0].playbackRate === 1 && built.plates[0].rateCurve.length, "plate-1 curve @ 1.0");
  must(built.plates[1].rateCurve.length > 2, "plate-2 stores a curve");
  must(/live rate/.test(built.plates[1].match), "plate-2 playbackRate is summary only");

  const smash = buildPlaylist({
    style: "x",
    files: ["a", "b"],
    seriesList: [ref, measDead],
    dt: SAMPLE_DT,
  });
  must(!smash.ok && /recook/.test(smash.reason), "dead travel → speed.recook");

  const report = analyzeSeriesList({
    style: "asteroid",
    files: ["films/plate-1.mp4", "films/plate-2.mp4", "films/plate-3.mp4", "films/plate-4.mp4"],
    seriesList: [ref, measSteady, measDip, measDead],
    refFile: "films/plate-1.mp4",
    dt: SAMPLE_DT,
  });
  must(report.plates.length === 4, "analyze covers P1–P4");
  must(report.plates[0].match && report.plates[0].keep, "analyze P1 KEEP match");
  must(report.plates[1].match && Math.abs(report.plates[1].mean - 1.4) < 0.08, "analyze P2 MATCH ~1.4");
  must(report.plates[2].match, "analyze P3 dip still MATCH");
  must(!report.plates[3].match && report.plates[3].recook, "analyze P4 RECOOK");
  must(report.plates[3].stretches.length >= 1, "analyze P4 lists recook stretch");
  must(!report.ok, "analyze set fails when any plate recooks");
  const printed = formatAnalyze(report);
  must(/SAMPLE_DT=0\.1/.test(printed) && /plate-4/.test(printed) && /RECOOK/.test(printed), "analyze print SAMPLE_DT=0.1 + P4 recook");
  must(/mean=/.test(printed) && /min=/.test(printed) && /max=/.test(printed), "analyze print mean/min/max");

  const missing = {
    ok: false,
    missing: true,
    style: "asteroid",
    sampleDt: SAMPLE_DT,
    expected: expectedPaths("/tmp/biomes-25d/asteroid"),
  };
  const missTxt = formatAnalyze(missing);
  must(/plate-empty-keep\.mp4/.test(missTxt) && /plate-4\.mp4/.test(missTxt), "analyze notes expected KEEP + P1–P4 paths");
  must(/RATE 1\.0–1\.6/.test(missTxt) && /RATE 1\.0–1\.6/.test(printed), "analyze print RATE 1.0–1.6");
  must(/TINT 10Hz\/0\.1s/.test(missTxt) && /TINT 10Hz\/0\.1s/.test(printed), "analyze print TINT 10Hz/0.1s");

  const wrapped = softMultiply({ r: 250, g: 250, b: 250 }, { r: 80, g: 140, b: 200 }, 0.3);
  must(luma(wrapped) > 150, "softMultiply keeps a bright coat");
  const guarded = identityGuard({ r: 40, g: 40, b: 40 });
  must(guarded.pulled && luma(guarded) >= 180, "identityGuard pulls grey/black back to white");
  must(TINT_LAW.hz === 10 && TINT_DT === 0.1 && /light wrap/.test(TINT_LAW.identity), "tint law ~10Hz / 0.1s light wrap");
  const liveTint = applyLiveTint({ r: 250, g: 250, b: 250 }, { r: 80, g: 140, b: 200 }, 0.3);
  must(luma(liveTint) >= TINT_LUMA_FLOOR, "applyLiveTint keeps white coat");
  const tintSamples = [
    { t: 0, r: 80, g: 140, b: 200 },
    { t: 0.1, r: 90, g: 150, b: 210 },
    { t: 0.2, r: 70, g: 130, b: 190 },
  ];
  const health = tintHealth(tintSamples);
  must(health.ok && Math.abs(health.hz - 10) < 1.5, "tint health ~10Hz identity OK");
  must(health.pulled === 0 && health.minLuma >= TINT_LUMA_FLOOR, "tint health does not grey the coat");
  const dark = tintHealth([{ t: 0, r: 10, g: 10, b: 10 }, { t: 0.1, r: 8, g: 8, b: 8 }]);
  must(dark.pulled >= 1 && dark.minLuma >= TINT_LUMA_FLOOR, "dark haze → identityGuard pull, luma stays high");
  report.plates[1].tint = health;
  const withTint = formatAnalyze(report);
  must(/tint OK 10Hz/.test(withTint) && /luma=/.test(withTint), "analyze print tint sampling health");

  const cli = parseCli(["--analyze", "p1.mp4", "p2.mp4", "p3.mp4", "p4.mp4", "--keep", "plate-empty-keep.mp4"]);
  must(cli.analyze && cli.keep === "plate-empty-keep.mp4" && cli.positionals.length === 4, "CLI accepts loose plate paths + --keep");
  must(cli.positionals.every(isMp4Path), "CLI plate args are mp4 paths");
  const missingFiles = analyzeFiles(
    ["missing-p1.mp4", "missing-p2.mp4"],
    { style: "asteroid", keep: "missing-keep.mp4" },
  );
  must(missingFiles.missing && /missing-keep|plate-empty-keep|missing-p1/.test(formatAnalyze(missingFiles)), "analyze files-missing still notes paths");
  console.log("BIOME-25D-SPEED PASS");
}

function usage() {
  console.log("FAIL need biomes-25d/<style> or plate mp4 paths");
  console.log("  node scripts/biome-25d-speed.mjs biomes-25d/<style>");
  console.log("  node scripts/biome-25d-speed.mjs --analyze biomes-25d/<style>");
  console.log("  node scripts/biome-25d-speed.mjs --analyze plate-1.mp4 plate-2.mp4 plate-3.mp4 plate-4.mp4");
  console.log("  node scripts/biome-25d-speed.mjs --analyze --keep plate-empty-keep.mp4 plate-2.mp4 plate-3.mp4 plate-4.mp4");
  console.log("  node scripts/biome-25d-speed.mjs --selftest");
  console.log("expected: films/plate-empty-keep.mp4 (ref) + films/plate-1.mp4 … plate-4.mp4");
}

const argv = process.argv.slice(2);
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain || argv.includes("--selftest")) {
  if (argv.includes("--selftest")) {
    selftest();
    process.exit(0);
  }
  const cli = parseCli(argv);
  const rel = String(cli.positionals[0] || "");
  if (!rel) {
    usage();
    process.exit(1);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  if (cli.analyze) {
    try {
      const mp4s = cli.positionals.filter(isMp4Path).map((p) => resolveAbs(p, root));
      const report = mp4s.length
        ? analyzeFiles(mp4s, {
            style: "plates",
            keep: cli.keep ? resolveAbs(cli.keep, root) : undefined,
          })
        : analyzeDir(resolveAbs(rel, root), rel.replace(/\/$/, "").split("/").pop());
      console.log(formatAnalyze(report));
      if (report.missing) process.exit(0);
      process.exit(report.ok ? 0 : 1);
    } catch (e) {
      console.log("FAIL " + (e && e.message ? e.message : e));
      process.exit(1);
    }
  }
  const dir = resolveAbs(rel, root);
  const style = rel.replace(/\/$/, "").split("/").pop();
  if (!existsSync(join(dir, "films", "plate-1.mp4"))) {
    console.log("FAIL no " + join(dir, "films/plate-1.mp4"));
    process.exit(1);
  }
  try {
    const playlist = matchDir(dir, style);
    if (!playlist.ok) {
      console.log("FAIL " + playlist.reason);
      process.exit(1);
    }
    console.log("PLAYLIST " + join(dir, "playlist.json") + " — rate(t) live SAMPLE_DT=" + SAMPLE_DT);
    for (const p of playlist.plates) {
      const n = (p.rateCurve || []).length;
      console.log(p.id + " curve " + n + " mean " + Number(p.playbackRate).toFixed(3));
    }
    process.exit(0);
  } catch (e) {
    console.log("FAIL " + (e && e.message ? e.message : e));
    process.exit(1);
  }
}
