#!/usr/bin/env node
// Timer, not Imagine. Floor 1 only.
//   node scripts/cook-room.mjs moss --dry-run
//   COOK_DEBUG=1 node scripts/cook-room.mjs dusk
// imagineStill / imagineClip throw until wired. Until then: --dry-run only.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SLOTS = [
  "moss",
  "ember",
  "dusk",
  "asteroid",
  "frost",
  "ivy",
  "ash",
  "tide",
  "ember-deep",
  "gold",
];
const STOCK = "https://boltverse-odyssey.grok.me/";
const PLAYER = "https://boltverse-odyssey.grok.me/r/";
const STILLS = ["stills/spawn.jpg", "stills/at-a.jpg", "stills/at-b.jpg"];
const FILMS = [
  "films/breath-spawn.mp4",
  "films/breath-a.mp4",
  "films/breath-b.mp4",
  "films/walk-spawn-a.mp4",
  "films/walk-spawn-b.mp4",
];

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const debug = process.env.COOK_DEBUG === "1";
const slot = String(argv.find((a) => !a.startsWith("--")) || "")
  .toLowerCase()
  .trim();

function out(line) {
  console.log(line);
}

function fail(rule) {
  if (rule) out("FAIL " + rule);
  out(STOCK);
  process.exit(1);
}

function run(bin, args) {
  return spawnSync(bin, args, { encoding: "utf8" });
}

/** Wire to Imagine. Walks: first AND last distinct. Breath: first = last. */
async function imagineStill(_args) {
  throw new Error("imagineStill not wired — use --dry-run");
}
async function imagineClip(_args) {
  throw new Error("imagineClip not wired — use --dry-run");
}

function skeleton(id) {
  return {
    id,
    format: 1,
    open: "breath-spawn",
    plate: "720x1280",
    aspect: "9:16",
    camera: "lock-off",
    chrome: "none",
    auth: false,
    database: false,
    PACK: 1,
    stills: { spawn: STILLS[0], atA: STILLS[1], atB: STILLS[2] },
    clips: {
      "breath-spawn": { file: FILMS[0], act: "breath", loop: true, required: true },
      "breath-A": { file: FILMS[1], act: "breath", loop: true, required: true },
      "breath-B": { file: FILMS[2], act: "breath", loop: true, required: true },
      "walk-spawn-A": { file: FILMS[3], act: "walk", loop: false, required: true },
      "walk-spawn-B": { file: FILMS[4], act: "walk", loop: false, required: true },
    },
    edges: [
      { from: "spawn", tap: "A", clip: "walk-spawn-A" },
      { from: "spawn", tap: "B", clip: "walk-spawn-B" },
      { from: "atA", tap: "A", clip: null, act: "stay" },
      { from: "atB", tap: "B", clip: null, act: "stay" },
    ],
    ENTER: {},
  };
}

function queue(slot) {
  return [
    "1 slot " + slot + " in catalog",
    "2 packs/" + slot + "/ + room.json (ENTER empty)",
    "3 spawn still → smoke (cap 2)",
    "4 atA atB from that spawn → smoke (cap 2)",
    "5 five films one by one → smoke",
    "6 breath FAIL×2 → ffmpeg loop still",
    "7 walk FAIL×2 → stock",
    "8 validate-pack + smoke-pack",
    "9 stdout " + PLAYER + slot + " or stock",
    "no A↔B, no Enter, no wait",
  ];
}

if (!SLOTS.includes(slot)) fail("not in catalog");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "packs", slot);
const scripts = join(root, "scripts");

if (dry) {
  out("COOK " + slot + " dry-run");
  for (const line of queue(slot)) out(line);
  process.exit(0);
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });
writeFileSync(join(dir, "room.json"), JSON.stringify(skeleton(slot), null, 2) + "\n");
if (debug) out("stills dir ready (no stdin wait)");

function smokeFile(rel, kind) {
  const file = join(dir, rel);
  const r = run("node", [join(scripts, "smoke-pack.mjs"), file, "--kind", kind]);
  process.stdout.write(r.stdout || "");
  return r.status === 0;
}

function validate() {
  const py = join(scripts, "validate-pack.py");
  const a = run("python3", [py, dir]);
  process.stdout.write(a.stdout || "");
  const b = run("node", [join(scripts, "smoke-pack.mjs"), dir]);
  process.stdout.write(b.stdout || "");
  return a.status === 0 && b.status === 0;
}

function ffmpegLoop(stillRel, destRel) {
  const still = join(dir, stillRel);
  const dest = join(dir, destRel);
  const r = run("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-i",
    still,
    "-t",
    "6",
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    dest,
  ]);
  return r.status === 0 && existsSync(dest);
}

const missing = [...STILLS, ...FILMS].filter((f) => !existsSync(join(dir, f)));
if (missing.length) {
  try {
    await imagineStill({ slot, pose: "spawn" });
  } catch (e) {
    out("COOK " + slot);
    for (const line of queue(slot)) out(line);
    out(String(e.message || e));
    out("missing: " + missing.join(", "));
    fail("hooks not wired");
  }
}

if (!validate()) fail("validate");
out("PASS " + PLAYER + slot);
process.exit(0);
