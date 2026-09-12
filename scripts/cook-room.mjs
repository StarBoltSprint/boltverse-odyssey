#!/usr/bin/env node
// Official hall cook. Stills + films = imagine-hooks only. Not chat Imagine UI.
//   node scripts/cook-room.mjs moss --dry-run
//   COOK_DEBUG=1 node scripts/cook-room.mjs dusk
//   export XAI_API_KEY=... && node scripts/cook-room.mjs moss
//   node scripts/cook-room.mjs moss --force
// Hung PASS stills/films are reused. --force / COOK_FORCE=1 recooks.

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
const force = argv.includes("--force") || process.env.COOK_FORCE === "1";
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

function runNode(file, args) {
  return spawnSync("node", [join(scripts, file), ...args], { encoding: "utf8" });
}

function smoke(rel, kind) {
  const r = runNode("smoke-pack.mjs", [join(dir, rel), "--kind", kind]);
  if (debug) process.stdout.write(r.stdout || "");
  return r.status === 0;
}

function has(rel) {
  return existsSync(join(dir, rel));
}

function reuse(rel, kind) {
  if (force) return false;
  if (!has(rel)) return false;
  return smoke(rel, kind);
}

function plan(rel, kind) {
  if (force) return "cook " + rel + " (--force)";
  if (!has(rel)) return "cook " + rel + " (missing)";
  if (smoke(rel, kind)) return "skip " + rel + " (exists + smoke PASS)";
  return "cook " + rel + " (exists + smoke FAIL)";
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

const stillJobs = [
  ["stills/spawn.jpg", "still-spawn"],
  ["stills/at-a.jpg", "still-atA"],
  ["stills/at-b.jpg", "still-atB"],
];
const filmJobs = [
  ["films/breath-spawn.mp4", "breath"],
  ["films/breath-a.mp4", "breath"],
  ["films/breath-b.mp4", "breath"],
  ["films/walk-spawn-a.mp4", "walk"],
  ["films/walk-spawn-b.mp4", "walk"],
];

if (!SLOTS.includes(slot)) fail("not in catalog");

if (dry) {
  out("COOK " + slot + " dry-run");
  out("hooks only — no chat Imagine UI");
  out(force ? "--force: recook even if hung PASS" : "default: reuse hung PASS stills + films");
  out(has("room.json") ? "keep room.json" : "write skeleton room.json");
  let skipStills = 0;
  let skipFilms = 0;
  for (const [rel, kind] of stillJobs) {
    const line = plan(rel, kind);
    if (line.startsWith("skip ")) skipStills++;
    out(line);
  }
  if (!force && skipStills === stillJobs.length) out("skip still phase — 3 hung stills PASS");
  for (const [rel, kind] of filmJobs) {
    const line = plan(rel, kind);
    if (line.startsWith("skip ")) skipFilms++;
    out(line);
  }
  if (!force && skipFilms === filmJobs.length) out("skip film phase — 5 hung films PASS");
  out("then validate-pack + smoke-pack → " + PLAYER + slot);
  process.exit(0);
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });
const roomPath = join(dir, "room.json");
if (!existsSync(roomPath)) {
  writeFileSync(roomPath, JSON.stringify(skeleton(slot), null, 2) + "\n");
} else if (debug) {
  out("keep room.json");
}
if (debug) out("stills written — no wait");

const spawnStill = join(dir, "stills/spawn.jpg");
const atA = join(dir, "stills/at-a.jpg");
const atB = join(dir, "stills/at-b.jpg");

let stillCooked = 0;
if (reuse("stills/spawn.jpg", "still-spawn")) {
  out("skip stills/spawn.jpg (exists + smoke PASS)");
} else {
  await cap2("spawn", async () => {
    await imagineStill({ root, slot, pose: "spawn", dest: spawnStill });
    if (!smoke("stills/spawn.jpg", "still-spawn")) throw new Error("smoke spawn size");
  });
  stillCooked++;
}
if (debug) out("stills written spawn");

if (reuse("stills/at-a.jpg", "still-atA")) {
  out("skip stills/at-a.jpg (exists + smoke PASS)");
} else {
  await cap2("atA", async () => {
    await imagineStill({ root, slot, pose: "atA", dest: atA, spawnPath: spawnStill });
    if (!smoke("stills/at-a.jpg", "still-atA")) throw new Error("smoke atA");
  });
  stillCooked++;
}
if (reuse("stills/at-b.jpg", "still-atB")) {
  out("skip stills/at-b.jpg (exists + smoke PASS)");
} else {
  await cap2("atB", async () => {
    await imagineStill({ root, slot, pose: "atB", dest: atB, spawnPath: spawnStill });
    if (!smoke("stills/at-b.jpg", "still-atB")) throw new Error("smoke atB");
  });
  stillCooked++;
}
if (stillCooked === 0) out("skip still phase — 3 hung stills PASS");
if (debug) out("stills written");

const breaths = [
  ["films/breath-spawn.mp4", spawnStill, "stills/spawn.jpg", "spawn"],
  ["films/breath-a.mp4", atA, "stills/at-a.jpg", "atA"],
  ["films/breath-b.mp4", atB, "stills/at-b.jpg", "atB"],
];
let filmCooked = 0;
for (const [rel, still, stillRel, pose] of breaths) {
  if (reuse(rel, "breath")) {
    out("skip " + rel + " (exists + smoke PASS)");
    continue;
  }
  filmCooked++;
  let ok = false;
  for (let i = 0; i < 2; i++) {
    try {
      await imagineClip({
        root,
        slot,
        kind: "breath",
        first: still,
        last: still,
        dest: join(dir, rel),
        seconds: 6,
        pose,
      });
      if (!smoke(rel, "breath")) throw new Error("smoke breath");
      ok = true;
      break;
    } catch (e) {
      if (debug) out(rel + " " + e.message);
    }
  }
  if (!ok) {
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
let walkNeeded = 0;
for (const [rel, first, last] of walks) {
  if (reuse(rel, "walk")) {
    out("skip " + rel + " (exists + smoke PASS)");
    walkOk++;
    continue;
  }
  walkNeeded++;
  filmCooked++;
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
        seconds: 10,
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
if (walkNeeded > 0 && walkOk < 2) fail("walk");
if (filmCooked === 0) out("skip film phase — 5 hung films PASS");

const v = spawnSync("python3", [join(scripts, "validate-pack.py"), dir], { encoding: "utf8" });
process.stdout.write(v.stdout || "");
if (v.status !== 0) fail("validate");
const s = runNode("smoke-pack.mjs", [dir]);
process.stdout.write(s.stdout || "");
if (s.status !== 0) fail("smoke-pack");

out("PASS " + PLAYER + slot);
process.exit(0);
