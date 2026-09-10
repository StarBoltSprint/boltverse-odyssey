#!/usr/bin/env node
// Floor-1 corridor. Imagine still lives in Grok chat; this file is the order + exit.
// usage: node scripts/cook-room.mjs dusk
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const slot = String(process.argv[2] || "")
  .toLowerCase()
  .trim();
if (!SLOTS.includes(slot)) {
  console.log("FAIL not in catalog");
  console.log(STOCK);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "packs", slot);
mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });

const jsonPath = join(dir, "room.json");
if (!existsSync(jsonPath)) {
  const skeleton = {
    id: slot,
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
  writeFileSync(jsonPath, JSON.stringify(skeleton, null, 2) + "\n");
}

const stills = ["stills/spawn.jpg", "stills/at-a.jpg", "stills/at-b.jpg"];
const films = [
  "films/breath-spawn.mp4",
  "films/breath-a.mp4",
  "films/breath-b.mp4",
  "films/walk-spawn-a.mp4",
  "films/walk-spawn-b.mp4",
];
const missing = [...stills, ...films].filter((f) => !existsSync(join(dir, f)));
if (missing.length) {
  console.log("COOK " + slot + " — Grok: fill in order, no wait, no Enter. Cap 2.");
  console.log("1 spawn still → smoke");
  console.log("2 atA atB from spawn → smoke");
  console.log("3 five films one by one → smoke");
  console.log("4 encode mute 720x1280");
  console.log("5 node scripts/validate-pack.mjs packs/" + slot);
  console.log("missing: " + missing.join(", "));
  console.log(STOCK);
  process.exit(2);
}

const py = join(root, "scripts", "validate-pack.py");
const r = spawnSync("python3", [py, dir], { encoding: "utf8" });
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) {
  console.log("FAIL validate");
  console.log(STOCK);
  process.exit(1);
}
console.log("PASS " + PLAYER + slot);
process.exit(0);
