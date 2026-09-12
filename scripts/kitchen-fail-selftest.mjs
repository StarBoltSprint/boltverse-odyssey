#!/usr/bin/env node
// Fixture: FAIL save never lands in stills/films; enlarge only for under-size sill.
// Ember FAIL×2 shrink evidence: 0.19+sit+face / 0.16+sit (PR #7 teacher) and 0.19–0.21 / 0.20–0.21+sit (#4).
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  EMBER_SHRINK,
  canEnlargeSill,
  dropHungPlate,
  failSaveRel,
  nextSillAttempt,
  parseSillBand,
  saveFailPlate,
} from "./kitchen-fail.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function must(ok, msg) {
  if (!ok) {
    console.error("FAIL  " + msg);
    process.exit(1);
  }
  console.log("PASS  " + msg);
}

must(failSaveRel("stills/at-a.jpg", "still-atA", 1) === ".kitchen/fail/still-atA-1.jpg", "failSaveRel still-atA-1.jpg");
must(failSaveRel("stills/at-b.jpg", "still-atB", 2) === ".kitchen/fail/still-atB-2.jpg", "failSaveRel still-atB-2.jpg");
must(failSaveRel("stills/spawn.jpg", "still-spawn", 1) === ".kitchen/fail/still-spawn-1.jpg", "failSaveRel still-spawn");
must(failSaveRel("films/walk-spawn-a.mp4", "walk", 1) === ".kitchen/fail/walk-walk-spawn-a-1.mp4", "failSaveRel walk");
must(failSaveRel("films/breath-a.mp4", "breath", 2) === ".kitchen/fail/breath-breath-a-2.mp4", "failSaveRel breath");
must(!failSaveRel("stills/at-a.jpg", "still-atA", 1).startsWith("stills/"), "fail path is not stills/");
must(!failSaveRel("films/walk-spawn-a.mp4", "walk", 1).startsWith("films/"), "fail path is not films/");

const ember1 = "FAIL  at-a.jpg gate.size @ still (gate.size sill-band 0.19 want 0.35-0.40 (FAIL <0.28 or >0.45); gate.sit aspect 1.80; identity.face muzzle 14)";
const ember2 = "FAIL  at-a.jpg gate.size @ still (gate.size sill-band 0.16 want 0.35-0.40; gate.sit aspect 1.70)";
const after4a = "FAIL  at-a.jpg gate.size @ still (gate.size sill-band 0.21 want 0.35-0.40)";
const after4b = "FAIL  at-b.jpg gate.size @ still (gate.size sill-band 0.20 want 0.35-0.40; gate.sit)";
must(parseSillBand(ember1) === 0.19, "parse ember try1 0.19");
must(parseSillBand(ember2) === 0.16, "parse ember try2 0.16");
must(EMBER_SHRINK[0] === 0.16 && EMBER_SHRINK[1] === 0.21, "EMBER_SHRINK 0.16–0.21");
must(canEnlargeSill(ember1), "ember try1 0.19+sit+face → enlarge");
must(canEnlargeSill(ember2), "ember try2 0.16+sit → enlarge");
must(canEnlargeSill(after4a), "after #4 at-A 0.21 → enlarge");
must(canEnlargeSill(after4b), "after #4 at-B 0.20+sit → enlarge");
must(canEnlargeSill("gate.size sill-band 0.18 want 0.35-0.40"), "0.18 teacher shrink → enlarge");
must(!canEnlargeSill("gate.place spawn-cx 0.50 (mid-hall ≠ seuil)"), "mid-hall / gate.place → not enlarge");
must(!canEnlargeSill("gate.size punch-sill top 0.40"), "punch-sill → not enlarge");
must(!canEnlargeSill("gate.size punch-in 0.56"), "punch-in → not enlarge");
must(!canEnlargeSill("gate.sit aspect 1.80"), "sit-only in-band → not enlarge (need under-size)");
must(!canEnlargeSill("gate.size sill-band 0.10 want 0.35-0.40"), "too small / no-dog → not enlarge");
must(!canEnlargeSill("gate.size sill-band 0.32 want 0.35-0.40"), "WARN band ≥0.28 → not enlarge");

must(nextSillAttempt({ fresh: 0, enlarge: 0, lastRule: null }) === "fresh", "start → fresh");
must(nextSillAttempt({ fresh: 1, enlarge: 0, lastRule: ember1 }) === "enlarge", "fresh under-size → enlarge");
must(nextSillAttempt({ fresh: 1, enlarge: 1, lastRule: ember1 }) === "stop", "1 fresh + 1 enlarge → stop");
must(nextSillAttempt({ fresh: 0, enlarge: 0, lastRule: ember2 }) === "enlarge", "disk FAIL under-size → enlarge first");
must(nextSillAttempt({ fresh: 0, enlarge: 1, lastRule: ember2 }) === "enlarge", "2 enlarge path");
must(nextSillAttempt({ fresh: 0, enlarge: 2, lastRule: ember2 }) === "stop", "2 enlarge → stop");
must(nextSillAttempt({ fresh: 1, enlarge: 0, lastRule: "gate.place spawn-cx 0.50" }) === "fresh", "mid-hall → 2nd fresh");
must(nextSillAttempt({ fresh: 2, enlarge: 0, lastRule: "gate.place spawn-cx 0.50" }) === "stop", "2 fresh → stop");

const tmp = mkdtempSync(join(tmpdir(), "kitchen-fail-"));
try {
  mkdirSync(join(tmp, "stills"), { recursive: true });
  mkdirSync(join(tmp, "films"), { recursive: true });
  const src = join(root, "lock/example-at-a-tiny.jpg");
  const hung = join(tmp, "stills/at-a.jpg");
  copyFileSync(src, hung);
  const savedRel = saveFailPlate(tmp, "stills/at-a.jpg", "still-atA", 1);
  must(savedRel === ".kitchen/fail/still-atA-1.jpg", "saveFailPlate rel");
  const savedAbs = join(tmp, savedRel);
  must(existsSync(savedAbs), "FAIL jpg written under .kitchen/fail/");
  must(existsSync(hung), "save copies — does not Hang or delete until drop");
  dropHungPlate(tmp, "stills/at-a.jpg");
  must(!existsSync(hung), "drop removes stills/at-a.jpg");
  must(existsSync(savedAbs), "FAIL debug copy remains after drop");
  must(!existsSync(join(tmp, "films", "at-a.jpg")), "never wrote films/");
  must(readFileSync(savedAbs).equals(readFileSync(src)), "fail bytes = source plate");

  writeFileSync(join(tmp, "films/walk-spawn-a.mp4"), "not-a-real-mp4");
  const walkRel = saveFailPlate(tmp, "films/walk-spawn-a.mp4", "walk", 1);
  dropHungPlate(tmp, "films/walk-spawn-a.mp4");
  must(walkRel === ".kitchen/fail/walk-walk-spawn-a-1.mp4", "walk fail rel");
  must(existsSync(join(tmp, walkRel)), "walk FAIL saved to .kitchen/fail/");
  must(!existsSync(join(tmp, "films/walk-spawn-a.mp4")), "walk FAIL dropped from films/");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

const dry = spawnSync("node", [join(root, "scripts/cook-room.mjs"), "moss", "--dry-run"], { encoding: "utf8" });
if (dry.status !== 0) {
  console.error("FAIL  moss dry-run exit " + dry.status + "\n" + dry.stdout + dry.stderr);
  process.exit(1);
}
must(/fail-save/.test(dry.stdout) && /\.kitchen\/fail/.test(dry.stdout), "dry-run mentions fail-save → .kitchen/fail");
must(/enlarge/.test(dry.stdout) && /0\.16–0\.21|0\.16-0\.21/.test(dry.stdout), "dry-run mentions enlarge under-size 0.16–0.21");
must(/1 fresh \+ 1 enlarge/.test(dry.stdout) && /2 enlarge/.test(dry.stdout), "dry-run names cap 1 fresh + 1 enlarge / 2 enlarge");
must(/Never Hang FAIL|never Hang/.test(dry.stdout), "dry-run: never Hang FAIL");
must(/hooks only/.test(dry.stdout), "dry-run still hooks only");
must(/oval\|RECT/.test(dry.stdout), "dry-run still oval|RECT");

console.log("KITCHEN-FAIL PASS");
