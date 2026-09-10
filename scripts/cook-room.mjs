#!/usr/bin/env node
// Timer + xAI hooks. Floor 1. Tap never cooks.
//   node scripts/cook-room.mjs moss --dry-run
//   COOK_DEBUG=1 node scripts/cook-room.mjs dusk
//   export XAI_API_KEY=... && node scripts/cook-room.mjs moss

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { imagineStill, imagineClip } from "./imagine-hooks.mjs";

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

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const debug = process.env.COOK_DEBUG === "1";
const slot = String(argv.find((a) => !a.startsWith("--")) || "")
  .toLowerCase()
  .trim();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "packs", slot);
const scripts = join(root, "scripts");

function out(s) {
  console.log(s);
}
function fail(rule) {
  if (rule) out("FAIL " + rule);
  out(STOCK);
  process.exit(1);
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
    stills: {
      spawn: "stills/spawn.jpg",
      atA: "stills/at-a.jpg",
      atB: "stills/at-b.jpg",
    },
    clips: {
      "breath-spawn": { file: "films/breath-spawn.mp4", act: "breath", loop: true, required: true },
      "breath-A": { file: "films/breath-a.mp4", act: "breath", loop: true, required: true },
      "breath-B": { file: "films/breath-b.mp4", act: "breath", loop: true, required: true },
      "walk-spawn-A": { file: "films/walk-spawn-a.mp4", act: "walk", loop: false, required: true },
      "walk-spawn-B": { file: "films/walk-spawn-b.mp4", act: "walk", loop: false, required: true },
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

function queue() {
  return [
    "1 slot " + slot,
    "2 packs/" + slot + " room.json ENTER empty",
    "3 spawn still → smoke cap 2",
    "4 atA atB from spawn → smoke cap 2",
    "5 five films one by one",
    "6 breath FAIL×2 → loop still ONLY if still PASS size, then smoke the loop; loop FAIL → stock",
    "7 walk FAIL×2 → stock",
    "8 validate-pack + smoke-pack",
    "9 " + PLAYER + slot,
  ];
}

function runNode(file, args) {
  return spawnSync("node", [join(scripts, file), ...args], { encoding: "utf8" });
}

function smoke(rel, kind) {
  const r = runNode("smoke-pack.mjs", [join(dir, rel), "--kind", kind]);
  if (debug) process.stdout.write(r.stdout || "");
  return r.status === 0;
}

function ffmpegLoop(stillRel, destRel) {
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      join(dir, stillRel),
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
      join(dir, destRel),
    ],
    { encoding: "utf8" },
  );
  return r.status === 0;
}

async function cap2(label, fn) {
  let err;
  for (let i = 0; i < 2; i++) {
    try {
      await fn();
      return true;
    } catch (e) {
      err = e;
      if (debug) out(label + " try " + (i + 1) + " " + e.message);
    }
  }
  out(String(err && err.message ? err.message : err));
  fail(label);
}

if (!SLOTS.includes(slot)) fail("not in catalog");

if (dry) {
  out("COOK " + slot + " dry-run");
  for (const l of queue()) out(l);
  process.exit(0);
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });
writeFileSync(join(dir, "room.json"), JSON.stringify(skeleton(slot), null, 2) + "\n");
if (debug) out("stills written — no wait");

const spawnStill = join(dir, "stills/spawn.jpg");
const atA = join(dir, "stills/at-a.jpg");
const atB = join(dir, "stills/at-b.jpg");

await cap2("spawn", async () => {
  await imagineStill({ root, slot, pose: "spawn", dest: spawnStill });
  if (!smoke("stills/spawn.jpg", "still-spawn")) throw new Error("smoke spawn size");
});
if (debug) out("stills written spawn");

await cap2("atA", async () => {
  await imagineStill({ root, slot, pose: "atA", dest: atA, spawnPath: spawnStill });
  if (!smoke("stills/at-a.jpg", "still-atA")) throw new Error("smoke atA");
});
await cap2("atB", async () => {
  await imagineStill({ root, slot, pose: "atB", dest: atB, spawnPath: spawnStill });
  if (!smoke("stills/at-b.jpg", "still-atB")) throw new Error("smoke atB");
});
if (debug) out("stills written");

const breaths = [
  ["films/breath-spawn.mp4", spawnStill, "stills/spawn.jpg"],
  ["films/breath-a.mp4", atA, "stills/at-a.jpg"],
  ["films/breath-b.mp4", atB, "stills/at-b.jpg"],
];
for (const [rel, still, stillRel] of breaths) {
  let ok = false;
  for (let i = 0; i < 2; i++) {
    try {
      await imagineClip({ root, slot, kind: "breath", first: still, dest: join(dir, rel) });
      if (!smoke(rel, "breath")) throw new Error("smoke breath");
      ok = true;
      break;
    } catch (e) {
      if (debug) out(rel + " " + e.message);
    }
  }
  if (!ok) {
    // Gel = decay, not PASS. Only if the still already passed size.
    if (!ffmpegLoop(stillRel, rel)) fail("breath " + rel);
    if (!smoke(rel, "breath")) fail("breath loop smoke " + rel);
    out("breath gel " + rel + " (decay — not a living breath PASS)");
  }
}

const walks = [
  ["films/walk-spawn-a.mp4", spawnStill, atA],
  ["films/walk-spawn-b.mp4", spawnStill, atB],
];
let walkOk = 0;
for (const [rel, first, last] of walks) {
  let ok = false;
  for (let i = 0; i < 2; i++) {
    try {
      await imagineClip({
        root,
        slot,
        kind: "walk",
        first,
        last,
        dest: join(dir, rel),
      });
      if (!smoke(rel, "walk")) throw new Error("smoke walk");
      ok = true;
      break;
    } catch (e) {
      if (debug) out(rel + " " + e.message);
    }
  }
  if (ok) walkOk++;
}
if (walkOk < 2) fail("walk");

const v = spawnSync("python3", [join(scripts, "validate-pack.py"), dir], { encoding: "utf8" });
process.stdout.write(v.stdout || "");
if (v.status !== 0) fail("validate");
const s = runNode("smoke-pack.mjs", [dir]);
process.stdout.write(s.stdout || "");
if (s.status !== 0) fail("smoke-pack");

out("PASS " + PLAYER + slot);
process.exit(0);
