#!/usr/bin/env node
// FAIL plates stay in .kitchen/fail/ for debug. Never stills/ or films/. Never Hang.
// at-A/at-B under-size (~0.16–0.21) → enlarge-only second step (FAIL jpg = image).

import { copyFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Live ember after PR #7 teacher: 0.19+sit+face / 0.16+sit. After #4: 0.19–0.21 / 0.20–0.21+sit. */
export const EMBER_SHRINK = [0.16, 0.21];
/** creamHeight below this is no-dog / unusable — do not enlarge. */
export const SILL_ENLARGE_MIN = 0.12;
/** still-pair SILL_FAIL[0] — hard under-size. */
export const SILL_ENLARGE_MAX = 0.28;

export function failSaveRel(rel, kind, n) {
  const ext = /\.mp4$/i.test(rel) ? "mp4" : "jpg";
  const k = String(kind || "");
  const stem =
    k === "still-atA" || k === "still-atB" || k === "still-spawn"
      ? k
      : (k || "plate") + "-" + basename(rel).replace(/\.[^.]+$/, "");
  return `.kitchen/fail/${stem}-${Number(n) || 1}.${ext}`;
}

export function saveFailPlate(dir, rel, kind, n) {
  const src = join(dir, rel);
  if (!existsSync(src)) return null;
  const destRel = failSaveRel(rel, kind, n);
  const dest = join(dir, destRel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return destRel;
}

export function dropHungPlate(dir, rel) {
  const p = join(dir, rel);
  if (existsSync(p)) unlinkSync(p);
}

export function parseSillBand(rule) {
  const m = String(rule || "").match(/sill-band\s+(\d+\.\d+)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Under-size sill FAIL (~0.16–0.21, hard < 0.28) may enlarge even if sit/face.
 * Mid-hall / gate.place / punch-sill / punch-in = fresh recook, not enlarge.
 */
export function canEnlargeSill(rule) {
  const text = String(rule || "");
  if (/gate\.place/.test(text)) return false;
  if (/punch-sill|punch-in/.test(text)) return false;
  const h = parseSillBand(text);
  if (h == null) return false;
  if (h < SILL_ENLARGE_MIN || h >= SILL_ENLARGE_MAX) return false;
  return true;
}

/**
 * Cap: 1 fresh + 1 enlarge, or 2 enlarge if the disk plate is already an under-size FAIL.
 * Mid-hall / other hard FAILs stay 2 fresh.
 */
export function nextSillAttempt({ fresh = 0, enlarge = 0, lastRule = null } = {}) {
  const f = Number(fresh) || 0;
  const e = Number(enlarge) || 0;
  if (f + e >= 2) return "stop";
  if (canEnlargeSill(lastRule) && e < 2) return "enlarge";
  if (f < 1) return "fresh";
  if (f < 2 && !canEnlargeSill(lastRule)) return "fresh";
  return "stop";
}
