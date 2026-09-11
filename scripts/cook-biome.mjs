#!/usr/bin/env node
/**
 * Lane cook. NOT cook-room. 10 reels, 0 atA.
 *   node scripts/cook-biome.mjs forest --dry-run
 *   export XAI_API_KEY=... && node scripts/cook-biome.mjs forest
 *
 * CHAIN (COOKLANE.md): last(n) file IS first(n+1).
 * Do not imagineStill from bolt-back for plate 2+.
 * After each clip: extract last frame → stillEnd. Next from-station copies that file.
 * Cues stay []. After this script: scrub on/off, smokeL, then coming: false.
 * FAIL cap 2 on a required plate (decay) → whole kit stays coming. No kind:sprint door.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { imagineStill, imagineClip } from "./imagine-hooks.mjs";

const IDS = ["forest", "moss", "dusk", "ember", "asteroid"];
const ORDER = ["calm", "lean", "peak", "decay"];

const argv = process.argv.slice(2);
const dry = argv.includes("--dry-run");
const debug = process.env.COOK_DEBUG === "1";
const id = String(argv.find((a) => !a.startsWith("--")) || "")
  .toLowerCase()
  .trim();

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const palPath = join(root, "palettes", `${id}-palette.json`);
const dir = join(root, "biomes", id);

function out(s) {
  console.log(s);
}
function fail(rule) {
  out("FAIL " + (rule || id));
  out("coming");
  process.exit(1);
}

if (!IDS.includes(id)) fail("not a BiomeId");
if (!existsSync(palPath)) fail("no palettes/" + id + "-palette.json — Grok does not invent calm-2");

const pal = JSON.parse(readFileSync(palPath, "utf8"));
const plates = ORDER.flatMap((tier) =>
  (pal.drawers?.[tier] || []).map((p) => ({ ...p, tier })),
);
const byId = Object.fromEntries(plates.map((p) => [p.id, p]));

function loopSame(tier) {
  return tier === "calm" || tier === "decay";
}

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
  const lines = [
    "cook-biome " + id + " — NOT cook-room, 0 atA",
    pal.identity + " (shared lock, first station only — never 4 parallel leans)",
    "CHAIN last(n) = first(n+1). Fork he KEEPS. No wobble.",
  ];
  const hung = pal.hung || [];
  if (hung.length) {
    lines.push("hung path " + hung.join(" → "));
    for (let i = 0; i < hung.length - 1; i++) {
      const a = byId[hung[i]];
      const b = byId[hung[i + 1]];
      if (!a || !b) continue;
      if ((a.to || "C") !== (b.from || "C")) {
        lines.push("FAIL lane.station " + a.id + " to=" + a.to + " vs " + b.id + " from=" + b.from);
      }
    }
  }
  for (const p of plates) {
    const law = loopSame(p.tier)
      ? "Law 0 first=last " + p.still
      : "Law 0 first " + p.still + " → last " + p.stillEnd + "  " + (p.from || "?") + "→" + (p.to || "?");
    lines.push(
      p.tier +
        " " +
        p.id +
        " " +
        p.duration +
        "s " +
        (p.gesture || "") +
        " — " +
        law +
        " — cues []",
    );
  }
  lines.push("cap 2 per plate; decay required; FAIL → coming, no kind:sprint");
  lines.push("THEN scrub on/off + smokeL; do not guess cues in this script");
  return lines;
}

if (dry) {
  out("COOK biome " + id + " dry-run");
  for (const l of queue()) out(l);
  out("PALETTE " + id + " " + plates.length + " clips / coming");
  process.exit(0);
}

mkdirSync(join(dir, "stills"), { recursive: true });
mkdirSync(join(dir, "films"), { recursive: true });

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

const hung = pal.hung || [];
for (let i = 0; i < hung.length - 1; i++) {
  const a = byId[hung[i]];
  const b = byId[hung[i + 1]];
  if (a && b && (a.to || "C") !== (b.from || "C")) {
    fail("lane.station " + a.id + "→" + b.id);
  }
}

/** Station still path. First visit cooks from lock. Later visits COPY the last frame. */
const station = Object.create(null);

for (const p of plates) {
  const stillA = join(dir, p.still);
  const stillB = join(dir, p.stillEnd);
  const dest = join(dir, p.file);
  const from = p.from || "C";
  const to = p.to || from;
  const ok = await cap2(p.id, async () => {
    if (station[from] && existsSync(station[from])) {
      mkdirSync(dirname(stillA), { recursive: true });
      copyFileSync(station[from], stillA);
      out("CHAIN copy station " + from + " → " + p.still + " (not bolt-back)");
    } else {
      await imagineStill({
        root,
        slot: id,
        pose: "spawn",
        dest: stillA,
      });
      station[from] = stillA;
    }
    if (loopSame(p.tier)) {
      if (stillB !== stillA) copyFileSync(stillA, stillB);
    } else {
      await imagineStill({
        root,
        slot: id,
        pose: "spawn",
        dest: stillB,
        spawnPath: stillA,
      });
    }
    await imagineClip({
      root,
      slot: id,
      kind: loopSame(p.tier) ? "breath" : "walk",
      first: stillA,
      last: loopSame(p.tier) ? stillA : stillB,
      dest,
      seconds: p.duration,
      pose: p.gesture,
    });
    extractLast(dest, stillB);
    station[to] = stillB;
    out("CHAIN lock last frame → " + p.stillEnd + " station " + to);
  });
  if (!ok) {
    pal.coming = true;
    writeFileSync(join(dir, "palette.json"), JSON.stringify(pal, null, 2) + "\n");
    fail(p.required || p.tier === "decay" ? "decay required" : p.id);
  }
}

pal.coming = true;
writeFileSync(join(dir, "palette.json"), JSON.stringify(pal, null, 2) + "\n");
out("PALETTE " + id + " " + plates.length + " clips / coming");
out("cues still [] — scrub + smokeL before coming:false");
process.exit(0);
