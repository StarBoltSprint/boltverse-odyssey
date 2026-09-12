#!/usr/bin/env node
// COOK/LOCK — drop SmiR's at-A teacher into lock/example-at-a.jpg
// Owner option A: also write lock/SEAL-at-a.jpg (frozen official sill still).
//
// Expected attachment / drop path (first hit wins unless argv given):
//   hall-stills/smir-ata-teacher.jpeg
//   hall-stills/smir-ata-teacher.jpg
//   lock/incoming/smir-ata-teacher.jpeg
//
//   node scripts/install-lock-ata.mjs --dry-run
//   node scripts/install-lock-ata.mjs [path]
//
// Teacher must be standing BACK toward teal L, gold visible.
// Oval|RECT energy OK (PR #6). Never install the archived tiny anti-teacher
// from a non-owner path. Owner drop at hall-stills/ is the seal source.
//
// Packs may copy lock/example-at-a.jpg (or lock/SEAL-at-a.jpg) to
// stills/at-a.jpg when Smoke place is acceptable OR when owner seals
// (SEAL_ATA=1 or lock/SEAL-at-a.jpg present). cook-room then SKIPS
// imagineStill for at-A. Never regenerate at-A from scratch.
// Does not cook. Does not hang. No new grok.me.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEST_REL = "lock/example-at-a.jpg";
export const SEAL_REL = "lock/SEAL-at-a.jpg";
export const TINY_REL = "lock/example-at-a-tiny.jpg";
export const DROP_RELS = [
  "hall-stills/smir-ata-teacher.jpeg",
  "hall-stills/smir-ata-teacher.jpg",
  "lock/incoming/smir-ata-teacher.jpeg",
];

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, "..");

function sha1(p) {
  return createHash("sha1").update(readFileSync(p)).digest("hex");
}

export function findDrop(repo, override) {
  if (override) {
    const abs = override.startsWith("/") ? override : join(repo, override);
    return existsSync(abs) ? abs : null;
  }
  for (const rel of DROP_RELS) {
    const abs = join(repo, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

export function lockAtaStatus(repo) {
  const drop = findDrop(repo);
  const dest = join(repo, DEST_REL);
  const tiny = join(repo, TINY_REL);
  const hasDrop = Boolean(drop);
  const hasDest = existsSync(dest);
  const destIsTiny = hasDest && existsSync(tiny) && sha1(dest) === sha1(tiny);
  const note = hasDrop
    ? "COOK/LOCK  drop present — node scripts/install-lock-ata.mjs → " + DEST_REL + " + " + SEAL_REL
    : "COOK/LOCK  drop missing — put SmiR at-A teacher (standing BACK toward teal L, gold visible) at hall-stills/smir-ata-teacher.jpeg then node scripts/install-lock-ata.mjs. Packs may copy " +
      DEST_REL +
      " to stills/at-a.jpg when Smoke place is acceptable OR when owner seals. Oval|RECT energy OK.";
  return {
    dropRel: drop ? relative(repo, drop) : null,
    destRel: DEST_REL,
    sealRel: SEAL_REL,
    hasDrop,
    hasDest,
    destIsTiny,
    note,
  };
}

/** Owner freeze: SEAL_ATA=1 or lock/SEAL-at-a.jpg. Skip imagineStill at-A. */
export function sealAtaStatus(repo, env = process.env) {
  const sealPath = join(repo, SEAL_REL);
  const examplePath = join(repo, DEST_REL);
  const envOn = String(env.SEAL_ATA || "") === "1";
  const hasSealFile = existsSync(sealPath);
  const sealed = envOn || hasSealFile;
  let srcRel = null;
  if (hasSealFile) srcRel = SEAL_REL;
  else if (envOn && existsSync(examplePath)) srcRel = DEST_REL;
  const note = sealed
    ? "SEALED at-A = frozen; do not Imagine new at-A pose. cook-room copies " +
      (srcRel || SEAL_REL + "|" + DEST_REL) +
      " → packs/<slot>/stills/at-a.jpg after spawn PASS. No imagineStill at-A."
    : "at-A unsealed — imagineStill may cook pose/taille. SEAL_ATA=1 or " +
      SEAL_REL +
      " freezes the owner pose.";
  return { sealed, srcRel, hasSealFile, envOn, note };
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

/** Copy sealed / example teacher onto a pack still (720×1280). Never Imagine. */
export function copySealedAta(repo, destAbs, srcRel) {
  const rel = srcRel || sealAtaStatus(repo).srcRel;
  if (!rel) throw new Error("SEALED at-A source missing — need " + SEAL_REL + " or " + DEST_REL);
  const src = join(repo, rel);
  if (!existsSync(src)) throw new Error("SEALED at-A source missing: " + rel);
  encodePlate(src, destAbs);
  return destAbs;
}

export function isOwnerDrop(repo, srcPath) {
  if (!srcPath) return false;
  const abs = resolve(srcPath);
  return DROP_RELS.some((rel) => resolve(join(repo, rel)) === abs);
}

export function installLockAta(repo, srcPath) {
  const dest = join(repo, DEST_REL);
  const tiny = join(repo, TINY_REL);
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("COOK/LOCK  no drop file — expected hall-stills/smir-ata-teacher.jpeg");
  }
  const ownerDrop = isOwnerDrop(repo, srcPath);
  const matchesTiny = existsSync(tiny) && sha1(srcPath) === sha1(tiny);
  if (matchesTiny && !ownerDrop) {
    throw new Error("COOK/LOCK REFUSED  source is lock/example-at-a-tiny.jpg (anti-teacher ~0.18). Will not overwrite.");
  }
  encodePlate(srcPath, dest);
  if (existsSync(tiny) && sha1(dest) === sha1(tiny) && !ownerDrop) {
    throw new Error("COOK/LOCK REFUSED  encoded dest matches archived tiny — not installed");
  }
  const seal = join(repo, SEAL_REL);
  copyFileSync(dest, seal);
  return dest;
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry-run");
  const given = argv.find((a) => !a.startsWith("--"));
  const st = lockAtaStatus(defaultRoot);
  console.log(st.note);
  console.log("COOK/LOCK  dest " + DEST_REL + (st.hasDest ? " present" : " MISSING"));
  console.log("COOK/LOCK  seal " + SEAL_REL + (existsSync(join(defaultRoot, SEAL_REL)) ? " present" : " MISSING"));
  if (st.destIsTiny) console.log("COOK/LOCK  dest currently equals archived tiny — do not send it");
  console.log("COOK/LOCK  drop slots: " + DROP_RELS.join(" | "));
  console.log(sealAtaStatus(defaultRoot).note);
  if (dry) {
    console.log(st.hasDrop ? "COOK/LOCK  would install " + st.dropRel + " → " + DEST_REL + " + " + SEAL_REL : "COOK/LOCK  nothing to install");
    process.exit(0);
  }
  const src = findDrop(defaultRoot, given);
  try {
    const dest = installLockAta(defaultRoot, src);
    console.log("COOK/LOCK  installed " + relative(defaultRoot, dest));
    console.log("COOK/LOCK  sealed " + SEAL_REL);
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
