#!/usr/bin/env node
/**
 * 2.5D biome post-cook: SAME SPEED match + ambient-tint helpers.
 * Law: COOK-BIOME-25D.md. Not hall. Not COOKLANE. PathGen HOLD.
 *
 *   node scripts/biome-25d-speed.mjs biomes-25d/<style>
 *   node scripts/biome-25d-speed.mjs --selftest
 *
 * NOT a constant per-plate playbackRate.
 * Imagine-side target = COOK-BIOME-25D.md SPEED REF (plate-1 KEEP prompt + plate-empty-keep.mp4).
 * This file is the post-cook filet only — do not invent speed here.
 * Imagine can slow/speed mid-clip. Match plate-1 KEEP with a smoothed rate(t):
 *   sample ground-parallax every 0.25–0.5s on plate1 (ref) and plate N (meas)
 *   rate(t) = clamp(ref/meas, 1.0, 1.6) then smooth
 *   long stretch of raw > 1.6 → recook travelling. Never 2×+.
 *
 * PLAYER STUB (bolt-hybrid play/ — do not scaffold a grok.me here):
 *   pictureTime = video.currentTime
 *   rate = rateAt(plate.rateCurve, pictureTime)
 *   video.playbackRate = rate              // LIVE from pictureTime
 *   stride(pictureTime, rate)              // gait follows both — never legs alone
 *   every ~250ms: sample lower-third ground+haze → softMultiply card (light wrap)
 *   identityGuard: luma stays high — NOT grey/black morph, NOT a new dog
 */
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const RATE_MIN = 1.0;
export const RATE_MAX = 1.6;
export const RATE_TYPICAL_LO = 1.3;
export const RATE_TYPICAL_HI = 1.5;
/** Sample cadence (seconds). Law band is 0.25–0.5. */
export const SAMPLE_DT = 0.4;
export const SAMPLE_DT_MIN = 0.25;
export const SAMPLE_DT_MAX = 0.5;
export const SMOOTH_WIN = 3;
/** Consecutive seconds of raw>1.6 that force recook (a lone spike may clamp). */
export const RECOOK_STRETCH_S = 1.5;

export const TINT_LAW = {
  hz: 4,
  region: "lower-third ground + haze",
  mode: "soft-multiply",
  identity: "full-white coat forever — light wrap only, never grey/black morph",
};

const FRAME_W = 160;
const FRAME_H = 90;

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

export function stretchNeedsRecook(raws, dt = SAMPLE_DT, max = RATE_MAX, minStretch = RECOOK_STRETCH_S) {
  let run = 0;
  for (const raw of raws) {
    if (Number(raw) > max) {
      run += dt;
      if (run + 1e-9 >= minStretch) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/**
 * Build smoothed rate(t) that matches plate-1 KEEP continuously.
 * series = [{ t, travel }, ...]  (same metric, ~0.25–0.5s)
 * Align by normalized time t/T.
 */
export function buildRateCurve(refSeries, measSeries, dt = SAMPLE_DT) {
  if (!refSeries?.length || !measSeries?.length) {
    return { ok: false, recook: true, reason: "no travel series", curve: [], raws: [] };
  }
  const refT = Math.max(1e-6, refSeries[refSeries.length - 1].t);
  const measT = Math.max(1e-6, measSeries[measSeries.length - 1].t);
  const points = [];
  const raws = [];
  for (const s of measSeries) {
    const ref = sampleTravel(refSeries, (s.t / measT) * refT);
    const m = matchRate(ref, s.travel);
    raws.push(m.raw);
    points.push({
      t: s.t,
      travel: s.travel,
      ref,
      raw: m.raw,
      rate: m.rate == null ? RATE_MAX : m.rate,
    });
  }
  if (stretchNeedsRecook(raws.map((r) => (r == null ? Infinity : r)), dt)) {
    return {
      ok: false,
      recook: true,
      reason: "speed.recook long stretch >1.6 — recook travelling",
      curve: points,
      raws,
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
  const mean = curve.reduce((s, p) => s + p.rate, 0) / curve.length;
  return { ok: true, recook: false, reason: "", curve, raws, mean };
}

/** Player stub: live playbackRate from pictureTime. Gait uses both. */
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

export function identityGuard(rgb, floor = 180) {
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

/** Ground-parallax samples ~every dt seconds (0.25–0.5). */
export function measureTravelSeries(mp4, dt = SAMPLE_DT) {
  if (!mp4 || !existsSync(mp4)) throw new Error("no plate " + (mp4 || ""));
  const step = Math.min(SAMPLE_DT_MAX, Math.max(SAMPLE_DT_MIN, Number(dt) || SAMPLE_DT));
  return framesToSeries(ffmpegGray(mp4, 1 / step), step);
}

export function measureTravel(mp4) {
  const series = measureTravelSeries(mp4, SAMPLE_DT);
  return series.reduce((s, p) => s + p.travel, 0) / series.length;
}

function onesCurve(series) {
  return (series || []).map((s) => ({ t: s.t, rate: 1, travel: s.travel, ref: s.travel }));
}

export function buildPlaylist({ style, files, seriesList, travels }) {
  const list =
    seriesList ||
    (travels || []).map((travel, i) => [{ t: 0, travel }, { t: 1, travel: travels[i] }]);
  if (!list.length) return { ok: false, reason: "no series", plates: [] };
  const plates = [];
  const refSeries = list[0];
  for (let i = 0; i < files.length; i++) {
    if (i === 0) {
      const curve = onesCurve(refSeries);
      plates.push({
        id: "plate-1",
        file: files[0],
        playbackRate: 1,
        rateCurve: curve,
        match: "KEEP reference — rate(t)=1",
      });
      continue;
    }
    const built = buildRateCurve(refSeries, list[i], SAMPLE_DT);
    if (!built.ok) {
      return { ok: false, reason: built.reason || files[i], plates, refTravel: refSeries };
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
    sampleDt: SAMPLE_DT,
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

export function matchDir(dir, style) {
  const files = ["films/plate-1.mp4", "films/plate-2.mp4"];
  const seriesList = files.map((rel) => measureTravelSeries(join(dir, rel), SAMPLE_DT));
  const playlist = buildPlaylist({ style, files, seriesList });
  if (!playlist.ok) return playlist;
  writePlaylist(dir, playlist);
  return playlist;
}

function selftest() {
  const must = (ok, msg) => {
    if (!ok) {
      console.error("FAIL  " + msg);
      process.exit(1);
    }
    console.log("PASS  " + msg);
  };
  must(matchRate(10, 10).rate === 1, "same travel → rate 1.0");
  must(matchRate(10, 20).rate === 1, "faster plate clamps to 1.0 (never slow the storm)");
  const typical = matchRate(10, 10 / 1.4);
  must(typical.rate > RATE_TYPICAL_LO - 0.05 && typical.rate < RATE_TYPICAL_HI + 0.05, "typical corrector ~1.4");
  must(typical.rate <= RATE_MAX && typical.rate >= RATE_MIN, "typical in 1.0–1.6");
  must(matchRate(10, 10 / 1.7).recook === true, ">1.6 → recook flag");
  must(matchRate(10, 0).recook === true, "zero travel → recook");
  must(pictureTime(4, 1.4, true) === 4, "element rate: pictureTime = currentTime");
  must(pictureTime(4, 1.4, false) === 5.6, "external rate: pictureTime = currentTime * rate");

  const ref = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ t: i * 0.4, travel: 10 }));
  const measSteady = ref.map((s) => ({ t: s.t, travel: 10 / 1.4 }));
  const steady = buildRateCurve(ref, measSteady, 0.4);
  must(steady.ok && Math.abs(steady.mean - 1.4) < 0.05, "steady mid-clip → ~1.4 curve");
  must(Math.abs(rateAt(steady.curve, 1.2) - 1.4) < 0.08, "rateAt mid-clip follows KEEP");

  const measDip = ref.map((s, i) => ({ t: s.t, travel: i >= 4 && i <= 6 ? 10 / 1.5 : 10 }));
  const dipped = buildRateCurve(ref, measDip, 0.4);
  must(dipped.ok, "mid-clip slow-down still OK if inside band");
  must(rateAt(dipped.curve, 2.0) > rateAt(dipped.curve, 0.4), "rate(t) rises where Imagine slowed");
  const sm = smoothRates([1, 1.6, 1, 1]);
  must(sm[1] < 1.6 && sm[1] > 1, "smooth eats a step");

  must(!stretchNeedsRecook([2, 1, 1, 1, 1], 0.4), "lone spike >1.6 does not recook");
  must(stretchNeedsRecook([2, 2, 2, 2, 1], 0.4), "long stretch >1.6 → recook");
  const measDead = ref.map((s) => ({ t: s.t, travel: 2 }));
  const dead = buildRateCurve(ref, measDead, 0.4);
  must(!dead.ok && /recook/.test(dead.reason), "10/2 = 5 for whole clip → speed.recook");

  const live = applyLiveRate({ currentTime: 2.0, playbackRate: 1 }, dipped.curve);
  must(live.pictureTime === 2 && live.rate > 1, "applyLiveRate sets rate from pictureTime");

  const built = buildPlaylist({
    style: "asteroid",
    files: ["films/plate-1.mp4", "films/plate-2.mp4"],
    seriesList: [ref, measSteady],
  });
  must(built.ok && built.match.indexOf("rate(t)") >= 0, "playlist law is rate(t), not a constant");
  must(built.plates[0].playbackRate === 1 && built.plates[0].rateCurve.length, "plate-1 curve @ 1.0");
  must(built.plates[1].rateCurve.length > 2, "plate-2 stores a curve");
  must(/live rate/.test(built.plates[1].match), "plate-2 playbackRate is summary only");

  const smash = buildPlaylist({
    style: "x",
    files: ["a", "b"],
    seriesList: [ref, measDead],
  });
  must(!smash.ok && /recook/.test(smash.reason), "dead travel → speed.recook");

  const wrapped = softMultiply({ r: 250, g: 250, b: 250 }, { r: 80, g: 140, b: 200 }, 0.3);
  must(luma(wrapped) > 150, "softMultiply keeps a bright coat");
  const guarded = identityGuard({ r: 40, g: 40, b: 40 });
  must(guarded.pulled && luma(guarded) >= 180, "identityGuard pulls grey/black back to white");
  must(TINT_LAW.hz === 4 && /light wrap/.test(TINT_LAW.identity), "tint law 4×/s light wrap");
  must(SAMPLE_DT >= SAMPLE_DT_MIN && SAMPLE_DT <= SAMPLE_DT_MAX, "sample dt in 0.25–0.5s");
  console.log("BIOME-25D-SPEED PASS");
}

const argv = process.argv.slice(2);
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain || argv.includes("--selftest")) {
  if (argv.includes("--selftest")) {
    selftest();
    process.exit(0);
  }
  const rel = String(argv.find((a) => !a.startsWith("--")) || "");
  if (!rel) {
    console.log("FAIL need biomes-25d/<style>");
    process.exit(1);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const dir = rel.startsWith("/") ? rel : join(root, rel);
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
    console.log("PLAYLIST " + join(dir, "playlist.json") + " — rate(t) live");
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
