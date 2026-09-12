#!/usr/bin/env node
// COOK/LOCK — drop SmiR's at-A teacher into lock/example-at-a.jpg
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
// Oval|RECT energy OK (PR #6). Never install the archived tiny anti-teacher.
// Does not cook. Does not hang. No new grok.me.

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const DEST_REL = "lock/example-at-a.jpg";
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
    ? "COOK/LOCK  drop present — node scripts/install-lock-ata.mjs → " + DEST_REL
    : "COOK/LOCK  drop missing — put SmiR at-A teacher (standing BACK toward teal L, gold visible) at hall-stills/smir-ata-teacher.jpeg then node scripts/install-lock-ata.mjs. imagineStill atA already prefers lock/example-at-a.jpg as side ref. Oval|RECT energy OK. copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.";
  return {
    dropRel: drop ? relative(repo, drop) : null,
    destRel: DEST_REL,
    hasDrop,
    hasDest,
    destIsTiny,
    note,
  };
}

function encodePlate(src, dest) {
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

export function installLockAta(repo, srcPath) {
  const dest = join(repo, DEST_REL);
  const tiny = join(repo, TINY_REL);
  if (!srcPath || !existsSync(srcPath)) {
    throw new Error("COOK/LOCK  no drop file — expected hall-stills/smir-ata-teacher.jpeg");
  }
  if (existsSync(tiny) && sha1(srcPath) === sha1(tiny)) {
    throw new Error("COOK/LOCK REFUSED  source is lock/example-at-a-tiny.jpg (anti-teacher ~0.18). Will not overwrite.");
  }
  encodePlate(srcPath, dest);
  if (existsSync(tiny) && sha1(dest) === sha1(tiny)) {
    throw new Error("COOK/LOCK REFUSED  encoded dest matches archived tiny — not installed");
  }
  return dest;
}

function main() {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry-run");
  const given = argv.find((a) => !a.startsWith("--"));
  const st = lockAtaStatus(defaultRoot);
  console.log(st.note);
  console.log("COOK/LOCK  dest " + DEST_REL + (st.hasDest ? " present" : " MISSING"));
  if (st.destIsTiny) console.log("COOK/LOCK  dest currently equals archived tiny — do not send it");
  console.log("COOK/LOCK  drop slots: " + DROP_RELS.join(" | "));
  if (dry) {
    console.log(st.hasDrop ? "COOK/LOCK  would install " + st.dropRel : "COOK/LOCK  nothing to install");
    process.exit(0);
  }
  const src = findDrop(defaultRoot, given);
  try {
    const dest = installLockAta(defaultRoot, src);
    console.log("COOK/LOCK  installed " + relative(defaultRoot, dest));
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
