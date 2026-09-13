#!/usr/bin/env node
// COOK/LOCK — SmiR KEEP seals + at-A teacher drop.
// Ice-cathedral KEEP (Imagine Agent):
//   hall-stills/seal/spawn-ice.jpg + at-a-ice.jpg + at-b-ice.jpg
//   → lock/SEAL-spawn.jpg + lock/SEAL-at-a.jpg + lock/SEAL-at-b.jpg
// Frozen pose+décor for this ice hall until SmiR reseals.
// cook-room SKIPS imagineStill for spawn / at-A / at-B when those SEAL files exist.
// Smoke still runs. Soft KEEP banned. Agent remains the STYLE stills path for future styles (never video).
//
// Legacy at-A teacher drop (first hit wins unless argv given):
//   hall-stills/seal/at-a-ice.jpg
//   hall-stills/smir-ata-teacher.jpeg
//   hall-stills/smir-ata-teacher.jpg
//   lock/incoming/smir-ata-teacher.jpeg
//
//   node scripts/install-lock-ata.mjs --dry-run
//   node scripts/install-lock-ata.mjs [path]
//
// Teacher / KEEP must be standing BACK at the teal L or gold R sill.
// Oval|RECT energy OK (PR #6). Never install the archived tiny anti-teacher
// from a non-owner path. Does not cook. Does not hang. No new grok.me.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEST_REL = "lock/example-at-a.jpg";
export const DEST_B_REL = "lock/example-at-b.jpg";
export const SEAL_REL = "lock/SEAL-at-a.jpg";
export const SEAL_A_REL = "lock/SEAL-at-a.jpg";
export const SEAL_B_REL = "lock/SEAL-at-b.jpg";
export const SEAL_SPAWN_REL = "lock/SEAL-spawn.jpg";
export const DEST_SPAWN_REL = "lock/example-spawn.jpg";
export const TINY_REL = "lock/example-at-a-tiny.jpg";
export const TINY_B_REL = "lock/example-at-b-tiny.jpg";
export const ICE_A_REL = "hall-stills/seal/at-a-ice.jpg";
export const ICE_B_REL = "hall-stills/seal/at-b-ice.jpg";
export const ICE_SPAWN_REL = "hall-stills/seal/spawn-ice.jpg";
export const DROP_RELS = [
  ICE_A_REL,
  "hall-stills/smir-ata-teacher.jpeg",
  "hall-stills/smir-ata-teacher.jpg",
  "lock/incoming/smir-ata-teacher.jpeg",
];
export const DROP_B_RELS = [ICE_B_REL];
export const DROP_SPAWN_RELS = [ICE_SPAWN_REL];

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, "..");

function sha1(p) {
  return createHash("sha1").update(readFileSync(p)).digest("hex");
}

export function findDrop(repo, override, rels = DROP_RELS) {
  if (override) {
    const abs = override.startsWith("/") ? override : join(repo, override);
    return existsSync(abs) ? abs : null;
  }
  for (const rel of rels) {
    const abs = join(repo, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

function tinyRelForDest(destRel) {
  if (destRel === DEST_B_REL || destRel === SEAL_B_REL) return TINY_B_REL;
  return TINY_REL;
}

export function lockAtaStatus(repo) {
  const drop = findDrop(repo);
  const dest = join(repo, DEST_REL);
  const tiny = join(repo, TINY_REL);
  const hasDrop = Boolean(drop);
  const hasDest = existsSync(dest);
  const destIsTiny = hasDest && existsSync(tiny) && sha1(dest) === sha1(tiny);
  const iceA = existsSync(join(repo, ICE_A_REL));
  const iceB = existsSync(join(repo, ICE_B_REL));
  const iceSpawn = existsSync(join(repo, ICE_SPAWN_REL));
  const note = iceA && iceB && iceSpawn
    ? "COOK/LOCK  Imagine Agent KEEP ice seals present — node scripts/install-lock-ata.mjs → " +
      SEAL_SPAWN_REL +
      " + " +
      SEAL_A_REL +
      " + " +
      SEAL_B_REL +
      " (frozen pose+décor until SmiR reseals)"
    : iceA && iceB
    ? "COOK/LOCK  Imagine Agent KEEP ice seals present — node scripts/install-lock-ata.mjs → " +
      SEAL_A_REL +
      " + " +
      SEAL_B_REL +
      " (frozen pose+décor until SmiR reseals)"
    : hasDrop
      ? "COOK/LOCK  drop present — node scripts/install-lock-ata.mjs → " + DEST_REL + " + " + SEAL_A_REL
      : "COOK/LOCK  drop missing — put Imagine Agent KEEP ice stills at " +
        ICE_SPAWN_REL +
        " + " +
        ICE_A_REL +
        " + " +
        ICE_B_REL +
        " then node scripts/install-lock-ata.mjs. Frozen pose+décor until SmiR reseals. Agent remains the STYLE stills path for future styles (never video). Oval|RECT energy OK.";
  return {
    dropRel: drop ? relative(repo, drop) : null,
    destRel: DEST_REL,
    sealRel: SEAL_A_REL,
    sealBRel: SEAL_B_REL,
    sealSpawnRel: SEAL_SPAWN_REL,
    hasDrop,
    hasDest,
    destIsTiny,
    iceA,
    iceB,
    iceSpawn,
    note,
  };
}

/** Owner freeze: SEAL=1 / SEAL_ATA=1 / SEAL_ATB=1 or lock/SEAL-at-*.jpg. Skip imagineStill. */
export function sealSillStatus(repo, pose, env = process.env) {
  const isA = pose === "atA" || pose === "A" || pose === "still-atA";
  const sealRel = isA ? SEAL_A_REL : SEAL_B_REL;
  const destRel = isA ? DEST_REL : DEST_B_REL;
  const iceRel = isA ? ICE_A_REL : ICE_B_REL;
  const sealPath = join(repo, sealRel);
  const destPath = join(repo, destRel);
  const icePath = join(repo, iceRel);
  const envAll = String(env.SEAL || "") === "1";
  const envOne = isA ? String(env.SEAL_ATA || "") === "1" : String(env.SEAL_ATB || "") === "1";
  const envOn = envAll || envOne;
  const hasSealFile = existsSync(sealPath);
  const sealed = envOn || hasSealFile;
  let srcRel = null;
  if (hasSealFile) srcRel = sealRel;
  else if (existsSync(icePath)) srcRel = iceRel;
  else if (envOn && existsSync(destPath)) srcRel = destRel;
  const side = isA ? "at-A" : "at-B";
  const note = sealed
    ? "SEALED " +
      side +
      " = frozen KEEP; do not Imagine new " +
      side +
      " pose. cook-room copies " +
      (srcRel || sealRel) +
      " → packs/<slot>/stills/" +
      (isA ? "at-a" : "at-b") +
      ".jpg after spawn PASS. No imagineStill. Smoke still runs. Soft KEEP banned."
    : side +
      " unsealed — imagineStill may cook pose/taille. SEAL=1 / SEAL_AT" +
      (isA ? "A" : "B") +
      "=1 or " +
      sealRel +
      " freezes the owner KEEP.";
  return { sealed, srcRel, hasSealFile, envOn, sealRel, destRel, iceRel, note, pose: isA ? "atA" : "atB" };
}

export function sealAtaStatus(repo, env = process.env) {
  return sealSillStatus(repo, "atA", env);
}

export function sealAtbStatus(repo, env = process.env) {
  return sealSillStatus(repo, "atB", env);
}

/** Owner freeze: SEAL=1 / SEAL_SPAWN=1 or lock/SEAL-spawn.jpg. Skip imagineStill. */
export function sealSpawnStatus(repo, env = process.env) {
  const sealRel = SEAL_SPAWN_REL;
  const iceRel = ICE_SPAWN_REL;
  const sealPath = join(repo, sealRel);
  const icePath = join(repo, iceRel);
  const envOn = String(env.SEAL || "") === "1" || String(env.SEAL_SPAWN || "") === "1";
  const hasSealFile = existsSync(sealPath);
  const sealed = envOn || hasSealFile;
  let srcRel = null;
  if (hasSealFile) srcRel = sealRel;
  else if (existsSync(icePath)) srcRel = iceRel;
  const note = sealed
    ? "SEALED spawn = frozen KEEP; do not Imagine new spawn pose. cook-room copies " +
      (srcRel || sealRel) +
      " → packs/<slot>/stills/spawn.jpg. No imagineStill. Smoke still runs. Soft KEEP banned."
    : "spawn unsealed — imagineStill may cook pose. SEAL=1 / SEAL_SPAWN=1 or " +
      sealRel +
      " freezes the owner KEEP.";
  return {
    sealed,
    srcRel,
    hasSealFile,
    envOn,
    sealRel,
    destRel: DEST_SPAWN_REL,
    iceRel,
    note,
    pose: "spawn",
  };
}

export function encodePlate(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const vf = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
  const tmp = dest + ".ata-tmp.jpg";
  const r = spawnSync("ffmpeg", ["-y", "-i", src, "-vf", vf, tmp], { encoding: "utf8" });
  if (r.status !== 0) {
    if (existsSync(tmp)) unlinkSync(tmp);
    throw new Error("ffmpeg plate failed — COOK/LOCK cannot encode teacher");
  }
  copyFileSync(tmp, dest);
  unlinkSync(tmp);
}

/** Copy sealed KEEP onto a pack still (720×1280). Never Imagine. */
export function copySealedSill(repo, destAbs, srcRel) {
  if (!srcRel) throw new Error("SEALED still source missing — need lock/SEAL-*.jpg");
  const src = join(repo, srcRel);
  if (!existsSync(src)) throw new Error("SEALED sill source missing: " + srcRel);
  encodePlate(src, destAbs);
  return destAbs;
}

export function copySealedAta(repo, destAbs, srcRel) {
  const rel = srcRel || sealAtaStatus(repo).srcRel;
  if (!rel) throw new Error("SEALED at-A source missing — need " + SEAL_A_REL + " or " + DEST_REL);
  return copySealedSill(repo, destAbs, rel);
}

export function isOwnerDrop(repo, srcPath) {
  if (!srcPath) return false;
  const abs = resolve(srcPath);
  const rels = [...DROP_RELS, ...DROP_B_RELS, ...DROP_SPAWN_RELS];
  return rels.some((rel) => resolve(join(repo, rel)) === abs);
}

function refuseTiny(repo, srcPath, destRel) {
  const tiny = join(repo, tinyRelForDest(destRel));
  if (!srcPath || !existsSync(srcPath)) return;
  const ownerDrop = isOwnerDrop(repo, srcPath);
  const matchesTiny = existsSync(tiny) && sha1(srcPath) === sha1(tiny);
  if (matchesTiny && !ownerDrop) {
    throw new Error("COOK/LOCK REFUSED  source is " + tinyRelForDest(destRel) + " (anti-teacher ~0.18). Will not overwrite.");
  }
}

export function installLockAta(repo, srcPath) {
  const dest = join(repo, DEST_REL);
  const tiny = join(repo, TINY_REL);
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("COOK/LOCK  no drop file — expected " + ICE_A_REL + " or hall-stills/smir-ata-teacher.jpeg");
  }
  refuseTiny(repo, srcPath, DEST_REL);
  encodePlate(srcPath, dest);
  if (existsSync(tiny) && sha1(dest) === sha1(tiny) && !isOwnerDrop(repo, srcPath)) {
    throw new Error("COOK/LOCK REFUSED  encoded dest matches archived tiny — not installed");
  }
  const seal = join(repo, SEAL_A_REL);
  copyFileSync(dest, seal);
  return dest;
}

export function installLockAtb(repo, srcPath) {
  const dest = join(repo, DEST_B_REL);
  const tiny = join(repo, TINY_B_REL);
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("COOK/LOCK  no drop file — expected " + ICE_B_REL);
  }
  refuseTiny(repo, srcPath, DEST_B_REL);
  encodePlate(srcPath, dest);
  if (existsSync(tiny) && sha1(dest) === sha1(tiny) && !isOwnerDrop(repo, srcPath)) {
    throw new Error("COOK/LOCK REFUSED  encoded dest matches archived tiny — not installed");
  }
  copyFileSync(dest, join(repo, SEAL_B_REL));
  return dest;
}

/** Install ice SPAWN KEEP → lock/SEAL-spawn.jpg only. Never overwrite example-spawn. */
export function installLockSpawn(repo, srcPath) {
  const dest = join(repo, SEAL_SPAWN_REL);
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("COOK/LOCK  no drop file — expected " + ICE_SPAWN_REL);
  }
  encodePlate(srcPath, dest);
  return dest;
}

/** Install ice KEEP seals when hall-stills/seal/*-ice.jpg exist. Spawn → SEAL-spawn only. */
export function installIceSeals(repo) {
  const spawn = findDrop(repo, null, DROP_SPAWN_RELS);
  const a = findDrop(repo, null, [ICE_A_REL]);
  const b = findDrop(repo, null, [ICE_B_REL]);
  const out = { spawn: null, atA: null, atB: null };
  if (spawn) out.spawn = installLockSpawn(repo, spawn);
  if (a) out.atA = installLockAta(repo, a);
  if (b) out.atB = installLockAtb(repo, b);
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry-run");
  const given = argv.find((a) => !a.startsWith("--"));
  const st = lockAtaStatus(defaultRoot);
  console.log(st.note);
  console.log("COOK/LOCK  dest " + DEST_REL + (st.hasDest ? " present" : " MISSING"));
  console.log("COOK/LOCK  seal " + SEAL_SPAWN_REL + (existsSync(join(defaultRoot, SEAL_SPAWN_REL)) ? " present" : " MISSING"));
  console.log("COOK/LOCK  seal " + SEAL_A_REL + (existsSync(join(defaultRoot, SEAL_A_REL)) ? " present" : " MISSING"));
  console.log("COOK/LOCK  seal " + SEAL_B_REL + (existsSync(join(defaultRoot, SEAL_B_REL)) ? " present" : " MISSING"));
  if (st.destIsTiny) console.log("COOK/LOCK  dest currently equals archived tiny — do not send it");
  console.log(
    "COOK/LOCK  drop slots: " +
      DROP_SPAWN_RELS.join(" | ") +
      " | " +
      DROP_RELS.join(" | ") +
      " | " +
      DROP_B_RELS.join(" | "),
  );
  console.log(sealSpawnStatus(defaultRoot).note);
  console.log(sealAtaStatus(defaultRoot).note);
  console.log(sealAtbStatus(defaultRoot).note);
  if (dry) {
    const ice = st.iceSpawn || st.iceA || st.iceB;
    console.log(
      ice
        ? "COOK/LOCK  would install ice KEEP → " + SEAL_SPAWN_REL + " + " + SEAL_A_REL + " + " + SEAL_B_REL
        : st.hasDrop
          ? "COOK/LOCK  would install " + st.dropRel + " → " + DEST_REL + " + " + SEAL_A_REL
          : "COOK/LOCK  nothing to install",
    );
    process.exit(0);
  }
  try {
    const ice = installIceSeals(defaultRoot);
    if (ice.spawn || ice.atA || ice.atB) {
      if (ice.spawn) console.log("COOK/LOCK  sealed " + SEAL_SPAWN_REL);
      if (ice.atA) console.log("COOK/LOCK  sealed " + SEAL_A_REL);
      if (ice.atB) console.log("COOK/LOCK  sealed " + SEAL_B_REL);
      process.exit(0);
    }
    const src = findDrop(defaultRoot, given);
    const dest = installLockAta(defaultRoot, src);
    console.log("COOK/LOCK  installed " + relative(defaultRoot, dest));
    console.log("COOK/LOCK  sealed " + SEAL_A_REL);
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
