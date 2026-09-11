#!/usr/bin/env node
/**
 * Lane cook. NOT cook-room. 10 reels, 0 atA.
 *   node scripts/cook-biome.mjs forest --dry-run
 *   export XAI_API_KEY=... && node scripts/cook-biome.mjs forest
 *
 * Cues stay []. After this script: scrub on/off, smokeL, then coming: false.
 * FAIL cap 2 on a required plate (decay) → whole kit stays coming. No kind:sprint door.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

function loopSame(tier) {
  return tier === "calm" || tier === "decay";
}

function queue() {
  const lines = [
    "cook-biome " + id + " — NOT cook-room, 0 atA",
    pal.identity + " (shared lock, not cooked)",
  ];
  for (const p of plates) {
    const law = loopSame(p.tier)
      ? "Law 0 first=last " + p.still
      : "Law 0 first " + p.still + " → last " + p.stillEnd;
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

for (const p of plates) {
  const stillA = join(dir, p.still);
  const stillB = join(dir, p.stillEnd);
  const dest = join(dir, p.file);
  const ok = await cap2(p.id, async () => {
    await imagineStill({
      root,
      slot: id,
      pose: "spawn",
      dest: stillA,
    });
    if (!loopSame(p.tier) && p.stillEnd !== p.still) {
      await imagineStill({
        root,
        slot: id,
        pose: "spawn",
        dest: stillB,
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
