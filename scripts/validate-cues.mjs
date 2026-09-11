#!/usr/bin/env node
/**
 * Cue sheet honesty. Laws: CUES.md.
 *   node scripts/validate-cues.mjs films/forest-calm-2.cues.json
 *   node scripts/validate-cues.mjs palettes/forest-palette.json
 * Exit 0 = Hang-able charts (empty cues = ok / L.na).
 * Inventing JSON before the mp4 = do not run this.
 */

import { readFileSync } from "node:fs";

const KINDS = new Set(["pose", "lean", "fork", "seuil"]);
const SIDES = new Set(["A", "B", "pose"]);
const CUE_MIN = 0.22;
const CUE_MAX = 0.55;
const GAP_MIN = 0.6;
const GAP_PRACTICE = 0.8;
const RHO_GLOW_MAX = 0.45;
const N_MAX = 3;

function fail(code, extra) {
  console.log("FAIL " + code + (extra ? " " + extra : ""));
  process.exit(1);
}

function checkSheet(sheet, label) {
  const duration = Number(sheet.duration);
  const cues = Array.isArray(sheet.cues) ? sheet.cues : [];
  if (!(duration > 0)) fail("cue.duration", label);
  if (cues.length > N_MAX) fail("cue.count", label + " N=" + cues.length);

  const sorted = [...cues].sort((a, b) => a.on - b.on);
  let lit = 0;
  let prevOn = -Infinity;
  let prevOff = -Infinity;

  for (const c of sorted) {
    const on = Number(c.on);
    const off = Number(c.off);
    const w = off - on;
    if (!KINDS.has(c.kind)) fail("cue.kind", c.id || label);
    if (!SIDES.has(c.side)) fail("cue.side", c.id || label);
    if (!(0 <= on && on < off && off <= duration + 1e-6)) {
      fail("cue.window", (c.id || label) + " " + on + "-" + off);
    }
    if (w < CUE_MIN || w > CUE_MAX) fail("cue.width", (c.id || label) + " " + w);
    if (on - prevOn < GAP_MIN) fail("cue.gap", c.id || label);
    if (on < prevOff) fail("cue.overlap", c.id || label);
    if (on - prevOn < GAP_PRACTICE && prevOn !== -Infinity) {
      console.log("WARN cue.gap_practice " + (c.id || label) + " " + (on - prevOn));
    }
    prevOn = on;
    prevOff = off;
    lit += w;
  }

  const rho = duration > 0 ? lit / duration : 0;
  if (rho > RHO_GLOW_MAX) fail("cue.farm_glow", label + " " + rho.toFixed(3));
  if (!cues.length) console.log("PASS " + (sheet.plateId || label) + " L.na");
  else console.log("PASS " + (sheet.plateId || label) + " N=" + cues.length);
}

const path = process.argv[2];
if (!path) fail("cue.file", "path required");
const raw = JSON.parse(readFileSync(path, "utf8"));

if (raw.drawers) {
  for (const tier of Object.keys(raw.drawers)) {
    for (const p of raw.drawers[tier]) {
      checkSheet(
        {
          plateId: p.id,
          duration: p.duration,
          cues: p.cues || [],
        },
        p.id,
      );
    }
  }
} else {
  checkSheet(raw, raw.plateId || path);
}

process.exit(0);
