#!/usr/bin/env node
/**
 * Imagine-only 2.5D empty plates. NOT cook-room. NOT cook-biome (that bakes Bolt).
 *   node scripts/cook-biome-25d.mjs <style> --dry-run
 *   export XAI_API_KEY=... && node scripts/cook-biome-25d.mjs <style>
 *
 * Style = any décor word. Rails = COOK-BIOME-25D.md (9:16, 8–12s, lock-off,
 * travel baked, ZERO path, ZERO Bolt, last(n) = first(n+1), playbackRate 1.0–1.2).
 * Hall stays separate. Do not Hang on boltverse-odyssey.grok.me.
 */
import { existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { imagineEmptyStill, imagineClip } from "./imagine-hooks.mjs";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const force = argv.includes("--force") || process.env.COOK_FORCE === "1";
const debug = process.env.COOK_DEBUG === "1";
const id = String(argv.find((a) => !a.startsWith("--")) || "")
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-|-$/g, "");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "biomes-25d", id);
const SECONDS = 10;

function out(s) {
  console.log(s);
}
function fail(rule) {
  out("FAIL " + (rule || id));
  out("HANG BLOCKED — 2.5D empty-plate job, not hall /r/");
  process.exit(1);
}

if (!id) fail("need a style word — any décor (asteroid, ember, city, …)");

const paint1 =
  id +
  " biome sprint corridor, atmospheric haze, CLEAR empty center, ZERO luminous path, ZERO dog";
const paint2 =
  id +
  " grade — futuristic city emerging from haze, distant domes / spires / neon, CLEAR empty center, ZERO path, ZERO dog";

function extractLast(mp4, dest) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-sseof",
      "-0.12",
      "-i",
      mp4,
      "-frames:v",
      "1",
      "-vf",
      "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
      dest,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error("extract last failed");
}

function queue() {
  return [
    "cook-biome-25d " + id + " — NOT cook-room, NOT cook-biome (no Bolt in plate)",
    "rails 9:16 · " + SECONDS + "s · lock-off · travel baked · ZERO path · ZERO Bolt · playbackRate 1.0–1.2",
    "Law 0 plate 1 first+last distinct (emptyPlate imagineClip last_frame)",
    "CHAIN last(1) file IS first(2) — extract last frame, do not recut",
    "plate 2 = same speed + city from haze + CLEAR center",
    "PathGen HOLD (no neon CSS). Obstacles later (t, lane).",
    "drop films → bolt-hybrid play/public/biomes/" + id + "/films/  (not packs/)",
  ];
}

if (dry) {
  out("COOK biome-25d " + id + " dry-run");
  for (const l of queue()) out(l);
  out("PLATES " + id + " 2 empty clips / not hung on hall");
  process.exit(0);
}

if (!process.env.XAI_API_KEY) {
  out("XAI_API_KEY missing — use --dry-run");
  fail("no key");
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });
mkdirSync(join(dir, ".kitchen", "fail"), { recursive: true });

async function cap2(label, fn) {
  let err;
  for (let i = 0; i < 2; i++) {
    try {
      await fn();
      return true;
    } catch (e) {
      err = e;
      if (debug) out(label + " try " + (i + 1) + " " + (e.message || e));
    }
  }
  out(String(err && err.message ? err.message : err));
  return false;
}

const still1a = join(dir, "stills", "plate-1-first.jpg");
const still1b = join(dir, "stills", "plate-1-last.jpg");
const film1 = join(dir, "films", "plate-1.mp4");
const still2a = join(dir, "stills", "plate-2-first.jpg");
const still2b = join(dir, "stills", "plate-2-last.jpg");
const film2 = join(dir, "films", "plate-2.mp4");

const skip1 = !force && existsSync(film1);
const skip2 = !force && existsSync(film2) && existsSync(still2a);

if (skip1) out("reuse " + film1);
else {
  const ok = await cap2("plate-1", async () => {
    await imagineEmptyStill({ dest: still1a, paint: paint1, plate: "1" });
    await imagineEmptyStill({ dest: still1b, paint: paint1, plate: "1", fromPath: still1a });
    await imagineClip({
      root,
      slot: id,
      kind: "walk",
      emptyPlate: true,
      paint: paint1,
      pose: "1",
      first: still1a,
      last: still1b,
      dest: film1,
      seconds: SECONDS,
    });
    extractLast(film1, still1b);
    out("CHAIN lock plate-1 last frame → stills/plate-1-last.jpg");
  });
  if (!ok) fail("plate-1");
}

if (!existsSync(still1b)) fail("plate-1 last frame missing — cannot stitch plate 2");

if (skip2) out("reuse " + film2);
else {
  const ok = await cap2("plate-2", async () => {
    copyFileSync(still1b, still2a);
    out("CHAIN copy plate-1 last → plate-2 first (not a new establishing still)");
    await imagineEmptyStill({ dest: still2b, paint: paint2, plate: "2", fromPath: still2a });
    await imagineClip({
      root,
      slot: id,
      kind: "walk",
      emptyPlate: true,
      paint: paint2,
      pose: "2",
      first: still2a,
      last: still2b,
      dest: film2,
      seconds: SECONDS,
    });
    extractLast(film2, still2b);
    out("CHAIN lock plate-2 last frame → stills/plate-2-last.jpg");
  });
  if (!ok) fail("plate-2");
}

out("PLATES " + id + " 2 empty clips");
out("drop → bolt-hybrid play/public/biomes/" + id + "/films/");
out("PathGen HOLD · playbackRate 1.0–1.2 only · hall stays separate");
process.exit(0);
