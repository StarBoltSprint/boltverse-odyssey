#!/usr/bin/env node
/**
 * 2.5D biome post-cook: SAME SPEED match + ambient-tint helpers.
 * Law: COOK-BIOME-25D.md. Not hall. Not COOKLANE. PathGen HOLD.
 *
 *   node scripts/biome-25d-speed.mjs biomes-25d/<style>
 *   node scripts/biome-25d-speed.mjs --selftest
 *
 * Plate 1 KEEP = ground-parallax reference.
 * playbackRate(n) = clamp(ref / travel(n), 1.0, 1.6)
 * Need >1.6 → recook travelling. Never smash 2×+.
 *
 * PLAYER STUB (bolt-hybrid play/ — do not scaffold a grok.me here):
 *   video.playbackRate = plate.playbackRate
 *   pictureTime = video.currentTime          // element rate already applied
 *   // if rate is outside the element: pictureTime = currentTime * plate.playbackRate
 *   stride(pictureTime)                     // never speed legs alone
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
    return { rate: null, recook: true, raw, reason: "need >1.6 — recook travelling" };
  }
  const rate = Math.min(RATE_MAX, Math.max(RATE_MIN, raw));
  return { rate, recook: false, raw, reason: "" };
}

/** Plate clock Bolt gait must follow. Never speed legs without this. */
export function pictureTime(currentTime, rate, rateOnElement = true) {
  const t = Number(currentTime) || 0;
  const r = Number(rate) || 1;
  return rateOnElement ? t : t * r;
}

export function clamp01(n) {
  return Math.min(1, Math.max(0, Number(n) || 0));
}

/** Soft Multiply toward ambience. amount cap 0.45 = wrap, not a new dog. */
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

/** Pull wrap back toward white if it would read grey / black. */
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

/**
 * Ground-parallax proxy: lower-third ground band, mean abs frame-delta.
 * Same metric on every plate. ffmpeg required when an mp4 is passed.
 */
export function measureTravel(mp4) {
  if (!mp4 || !existsSync(mp4)) throw new Error("no plate " + (mp4 || ""));
  const r = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      mp4,
      "-vf",
      `fps=6,crop=iw:ih*0.18:0:ih*0.74,scale=${FRAME_W}:${FRAME_H},format=gray`,
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 48 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error("ffmpeg travel measure failed");
  const buf = r.stdout;
  const frame = FRAME_W * FRAME_H;
  const n = Math.floor(buf.length / frame);
  if (n < 2) throw new Error("too few frames to measure travel");
  let acc = 0;
  for (let i = 1; i < n; i++) {
    let sad = 0;
    const a = (i - 1) * frame;
    const b = i * frame;
    for (let p = 0; p < frame; p++) sad += Math.abs(buf[a + p] - buf[b + p]);
    acc += sad / frame;
  }
  return acc / (n - 1);
}

export function buildPlaylist({ style, files, travels }) {
  const ref = travels[0];
  const plates = [];
  for (let i = 0; i < files.length; i++) {
    if (i === 0) {
      plates.push({ id: "plate-1", file: files[0], travel: travels[0], playbackRate: 1 });
      continue;
    }
    const m = matchRate(ref, travels[i]);
    if (m.recook) {
      return { ok: false, reason: "speed.recook " + (m.reason || files[i]), plates, refTravel: ref };
    }
    plates.push({
      id: "plate-" + (i + 1),
      file: files[i],
      travel: travels[i],
      playbackRate: m.rate,
    });
  }
  return {
    ok: true,
    law: "COOK-BIOME-25D",
    style,
    refTravel: ref,
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
  const travels = files.map((rel) => measureTravel(join(dir, rel)));
  const playlist = buildPlaylist({ style, files, travels });
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
  must(matchRate(10, 10 / 1.7).recook === true, ">1.6 → recook, do not smash");
  must(matchRate(10, 0).recook === true, "zero travel → recook");
  must(pictureTime(4, 1.4, true) === 4, "element rate: pictureTime = currentTime");
  must(pictureTime(4, 1.4, false) === 5.6, "external rate: pictureTime = currentTime * rate");
  const wrapped = softMultiply({ r: 250, g: 250, b: 250 }, { r: 80, g: 140, b: 200 }, 0.3);
  must(luma(wrapped) > 150, "softMultiply keeps a bright coat");
  const guarded = identityGuard({ r: 40, g: 40, b: 40 });
  must(guarded.pulled && luma(guarded) >= 180, "identityGuard pulls grey/black back to white");
  const built = buildPlaylist({ style: "asteroid", files: ["films/plate-1.mp4", "films/plate-2.mp4"], travels: [12, 8] });
  must(built.ok && built.plates[0].playbackRate === 1, "playlist plate-1 rate 1.0");
  must(built.plates[1].playbackRate === 1.5, "playlist plate-2 12/8 = 1.5");
  const smash = buildPlaylist({ style: "x", files: ["a", "b"], travels: [12, 4] });
  must(!smash.ok && /recook/.test(smash.reason), "12/4 = 3 → speed.recook");
  must(TINT_LAW.hz === 4 && /light wrap/.test(TINT_LAW.identity), "tint law 4×/s light wrap");
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
    console.log("PLAYLIST " + join(dir, "playlist.json"));
    for (const p of playlist.plates) {
      console.log(p.id + " travel " + p.travel.toFixed(3) + " rate " + p.playbackRate);
    }
    process.exit(0);
  } catch (e) {
    console.log("FAIL " + (e && e.message ? e.message : e));
    process.exit(1);
  }
}
