#!/usr/bin/env node
// Official hall cook. Stills + films = imagine-hooks only. Not chat Imagine UI.
//   node scripts/cook-room.mjs moss --dry-run
//   COOK_DEBUG=1 node scripts/cook-room.mjs dusk
//   export XAI_API_KEY=... && node scripts/cook-room.mjs moss
//   node scripts/cook-room.mjs moss --force
// Hung PASS stills/films are reused. --force / COOK_FORCE=1 recooks.

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
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
  out("HANG BLOCKED");
  out(STOCK);
  process.exit(1);
}

function failLine(stdout) {
  const lines = String(stdout || "").split("\n");
  return (
    lines.find((l) => l.startsWith("FAIL")) ||
    lines.find((l) => /SMOKE FAIL/.test(l)) ||
    null
  );
}

function dropPlate(rel) {
  const p = join(dir, rel);
  if (existsSync(p)) unlinkSync(p);
}

function refuseKeep(rel, reason) {
  out("KEEP REFUSED  " + rel + "  " + (reason || "smoke FAIL"));
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

function smokeReport(rel, kind) {
  const r = runNode("smoke-pack.mjs", [join(dir, rel), "--kind", kind]);
  const stdout = r.stdout || "";
  if (debug || r.status !== 0) process.stdout.write(stdout);
  return {
    ok: r.status === 0,
    stdout,
    rule: failLine(stdout) || (r.status === 0 ? null : "smoke " + rel),
  };
}

function smoke(rel, kind) {
  return smokeReport(rel, kind).ok;
}

function smokeStills() {
  const r = runNode("smoke-pack.mjs", [dir, "--stills-only"]);
  const stdout = r.stdout || "";
  process.stdout.write(stdout);
  return {
    ok: r.status === 0,
    stdout,
    rule: failLine(stdout) || (r.status === 0 ? null : "still-pair"),
  };
}

function has(rel) {
  return existsSync(join(dir, rel));
}

function reuse(rel, kind) {
  if (force) return false;
  if (!has(rel)) return false;
  const s = smokeReport(rel, kind);
  if (!s.ok) refuseKeep(rel, s.rule);
  return s.ok;
}

function plan(rel, kind) {
  if (force) return "cook " + rel + " (--force)";
  if (!has(rel)) return "cook " + rel + " (missing)";
  const s = smokeReport(rel, kind);
  if (s.ok) return "skip " + rel + " (exists + smoke PASS)";
  return "cook " + rel + " (exists + smoke FAIL — KEEP refused)";
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
  fail((err && err.message ? err.message : label) + " — cap 2. No chat Imagine fallback.");
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
  out("oval|RECT energy rifts — never wood, never chrome UI. STANDING — sit / face / 3/4 / punch-sill cannot PASS.");
  out(force ? "--force: recook even if hung PASS" : "default: reuse hung PASS stills + films");
  out(has("room.json") ? "keep room.json" : "write skeleton room.json");
  let skipStills = 0;
  let skipFilms = 0;
  let needLive = false;
  for (const [rel, kind] of stillJobs) {
    const line = plan(rel, kind);
    if (line.startsWith("skip ")) skipStills++;
    else needLive = true;
    out(line);
  }
  if (!force && skipStills === stillJobs.length) out("skip still phase — 3 hung stills PASS");
  if (has("stills/spawn.jpg") && (has("stills/at-a.jpg") || has("stills/at-b.jpg"))) {
    const pair = smokeStills();
    out(pair.ok ? "skip still-pair (spawn↔sill Δh/H + sit/yaw PASS)" : "cook stills (still-pair FAIL — KEEP refused)");
    if (!pair.ok) needLive = true;
  }
  for (const [rel, kind] of filmJobs) {
    const line = plan(rel, kind);
    if (line.startsWith("skip ")) skipFilms++;
    else needLive = true;
    out(line);
  }
  if (!force && skipFilms === filmJobs.length) out("skip film phase — 5 hung films PASS");
  if (needLive) {
    out("LIVE NEEDS XAI_API_KEY — refuse cook without it. No chat Imagine fallback.");
    out("gel-breath / FAIL walk = HANG BLOCKED, not a preview KEEP.");
  }
  out("then validate-pack + smoke-pack → " + PLAYER + slot);
  process.exit(0);
}

const needLive = [...stillJobs, ...filmJobs].some(([rel, kind]) => {
  if (force) return true;
  if (!has(rel)) return true;
  return !smoke(rel, kind);
});
if (needLive && !process.env.XAI_API_KEY) {
  fail("XAI_API_KEY missing — refuse cook. No chat Imagine fallback.");
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });
mkdirSync(join(dir, ".kitchen"), { recursive: true });
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
    const s = smokeReport("stills/spawn.jpg", "still-spawn");
    if (!s.ok) {
      refuseKeep("stills/spawn.jpg", s.rule);
      throw new Error(s.rule || "smoke spawn");
    }
  });
  stillCooked++;
}
if (debug) out("stills written spawn");

if (reuse("stills/at-a.jpg", "still-atA")) {
  out("skip stills/at-a.jpg (exists + smoke PASS)");
} else {
  await cap2("atA", async () => {
    await imagineStill({ root, slot, pose: "atA", dest: atA, spawnPath: spawnStill });
    const s = smokeReport("stills/at-a.jpg", "still-atA");
    if (!s.ok) {
      refuseKeep("stills/at-a.jpg", s.rule);
      throw new Error(s.rule || "smoke atA");
    }
    const pair = smokeStills();
    if (!pair.ok) {
      refuseKeep("stills/at-a.jpg", pair.rule);
      throw new Error(pair.rule || "still-pair atA");
    }
  });
  stillCooked++;
}
if (reuse("stills/at-b.jpg", "still-atB")) {
  out("skip stills/at-b.jpg (exists + smoke PASS)");
} else {
  await cap2("atB", async () => {
    await imagineStill({ root, slot, pose: "atB", dest: atB, spawnPath: spawnStill });
    const s = smokeReport("stills/at-b.jpg", "still-atB");
    if (!s.ok) {
      refuseKeep("stills/at-b.jpg", s.rule);
      throw new Error(s.rule || "smoke atB");
    }
    const pair = smokeStills();
    if (!pair.ok) {
      refuseKeep("stills/at-b.jpg", pair.rule);
      throw new Error(pair.rule || "still-pair atB");
    }
  });
  stillCooked++;
}
if (stillCooked === 0) out("skip still phase — 3 hung stills PASS");
const stillGate = smokeStills();
if (!stillGate.ok) fail(stillGate.rule || "still-pair — sit / yaw / Δh/H. Do not Hang.");
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
  let lastRule = "smoke breath";
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
      const s = smokeReport(rel, "breath");
      if (!s.ok) {
        lastRule = s.rule || "smoke breath";
        refuseKeep(rel, lastRule);
        dropPlate(rel);
        throw new Error(lastRule);
      }
      ok = true;
      break;
    } catch (e) {
      lastRule = e && e.message ? e.message : lastRule;
      if (debug) out(rel + " " + lastRule);
    }
  }
  if (!ok) {
    dropPlate(rel);
    const gelRel = join(".kitchen", rel.replace(/^films\//, "gel-"));
    mkdirSync(join(dir, ".kitchen"), { recursive: true });
    ffmpegLoop(stillRel, gelRel);
    refuseKeep(rel, lastRule + " → breath.gel");
    fail(
      "breath.gel " +
        rel +
        " — " +
        lastRule +
        ". Living breath FAIL×2. Gel is decay in .kitchen/, not Hang-ready. No chat Imagine fallback.",
    );
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
  let lastRule = "smoke walk";
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
      const s = smokeReport(rel, "walk");
      if (!s.ok) {
        lastRule = s.rule || "smoke walk";
        refuseKeep(rel, lastRule);
        dropPlate(rel);
        throw new Error(lastRule);
      }
      ok = true;
      break;
    } catch (e) {
      lastRule = e && e.message ? e.message : lastRule;
      if (debug) out(rel + " " + lastRule);
    }
  }
  if (ok) walkOk++;
  else {
    dropPlate(rel);
    refuseKeep(rel, lastRule);
    fail(
      lastRule +
        " — walk FAIL×2. FAIL walk is not a preview KEEP. Tap stays. No chat Imagine fallback.",
    );
  }
}
if (walkNeeded > 0 && walkOk < 2) fail("walk — both edges required. No soft KEEP.");
if (filmCooked === 0) out("skip film phase — 5 hung films PASS");

const v = spawnSync("python3", [join(scripts, "validate-pack.py"), dir], { encoding: "utf8" });
process.stdout.write(v.stdout || "");
if (v.status !== 0) fail(failLine(v.stdout) || "validate");
const s = runNode("smoke-pack.mjs", [dir]);
process.stdout.write(s.stdout || "");
if (s.status !== 0) fail(failLine(s.stdout) || "smoke-pack — not Hang-ready");

out("PASS " + PLAYER + slot);
process.exit(0);
