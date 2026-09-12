#!/usr/bin/env node
// Fixture: at-sill prompts name no-punch floor placement; spawn/lane stay off that stack.
// Side refs prefer hung moss PASS sill stills. example-at-* are swapped moss copies.
// IGNORE tiny ~0.18 crop like bolt-back 0.53. Never send example-at-*-tiny.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HALL_LAW,
  sillStillLine,
  stillRefLine,
  stillRefOrder,
  sillTeacherRel,
  spawnStillLine,
  walkClipLine,
} from "./imagine-hooks.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function must(ok, msg) {
  if (!ok) {
    console.error("FAIL  " + msg);
    process.exit(1);
  }
  console.log("PASS  " + msg);
}

const teacherA = sillTeacherRel(root, "atA");
const teacherB = sillTeacherRel(root, "atB");
const atB = [sillStillLine("B"), stillRefLine("atB", true, teacherB)].join(" ");
const atA = [sillStillLine("A"), stillRefLine("atA", true, teacherA)].join(" ");

for (const [name, p] of [
  ["atB", atB],
  ["atA", atA],
]) {
  must(/STONE FLOOR/.test(p), name + " feet-on-floor");
  must(/punch-sill/.test(p), name + " names punch-sill");
  must(/0\.35–0\.40|0\.35-0\.40/.test(p), name + " sill band 0.35–0.40");
  must(/top < 0\.46/.test(p), name + " crown below mid-frame");
  must(/official SEUIL teacher/.test(p), name + " official SEUIL teacher");
  must(/IGNORE a tiny ~0\.18 crop/.test(p) && /IGNORE bolt-back ~0\.53/.test(p), name + " ignore tiny 0.18 like bolt-back 0.53");
  must(/example-at-\*-tiny/.test(p), name + " never copy archived tinies");
  must(/0\.53 is illegal/.test(p), name + " ignore bolt-back crop");
  must(/NEVER sit/.test(p) && /NEVER 3\/4/.test(p) && /muzzle HIDDEN/.test(p), name + " sit/yaw/face still banned");
  must(/NEVER mid-hall/.test(p) && /NEVER spawn/.test(p) && /NEVER center/.test(p), name + " mid-hall/spawn-cx banned");
  must(/already AT the sill\/threshold/.test(p), name + " already AT the sill/threshold");
  must(/NOT mid-hall/.test(p) && /NOT spawn center/.test(p), name + " NOT mid-hall, NOT spawn center");
  must(/THRESHOLD/.test(p) && /sill lip/.test(p), name + " paws on sill lip");
  must(/Do not leave him at center spawn/.test(p) && /Do not grow him in place/.test(p), name + " edit is a move, not a grow");
}

must(teacherA === "packs/moss/stills/at-a.jpg", "prefer hung moss PASS at-A as side ref");
must(teacherB === "packs/moss/stills/at-b.jpg", "prefer hung moss PASS at-B as side ref");
must(stillRefOrder("atB", true, root).join(",") === "spawn,bolt-back.jpg,packs/moss/stills/at-b.jpg", "atB+spawn edits spawn then moss PASS sill");
must(stillRefOrder("atA", true, root).join(",") === "spawn,bolt-back.jpg,packs/moss/stills/at-a.jpg", "atA+spawn edits spawn then moss PASS sill");
must(stillRefOrder("atB", true).join(",") === "spawn,bolt-back.jpg,lock/example-at-b.jpg", "atB lock fallback is swapped example-at-b");
must(stillRefOrder("atA", true).join(",") === "spawn,bolt-back.jpg,lock/example-at-a.jpg", "atA lock fallback is swapped example-at-a");
must(!String(stillRefOrder("atA", true, root)).includes("tiny"), "live atA does not send archived tiny");
must(!String(stillRefOrder("atB", true, root)).includes("tiny"), "live atB does not send archived tiny");
must(stillRefOrder("spawn", false).join(",") === "bolt-back.jpg,example-spawn.jpg", "spawn ref order unchanged");
must(stillRefLine("spawn", true) === "", "spawn has no sill ref lecture");

function energyOk(p, name) {
  must(/oval OR RECT|oval or RECT|Oval or RECT/.test(p), name + " oval|RECT energy OK");
  must(/never wood|Never wood|NEVER wood/.test(p), name + " never wood");
  must(/chrome UI/.test(p), name + " never chrome UI");
  must(
    !/Never oval|never oval|not ovals|stay RECT \(never oval\)|do not copy door shape|RECT grammar/.test(p),
    name + " does not ban oval shape",
  );
}

energyOk(HALL_LAW, "HALL_LAW");
energyOk(spawnStillLine(), "spawnStillLine");
energyOk(walkClipLine(), "walkClipLine");
energyOk(atA, "atA");
energyOk(atB, "atB");
must(/Do not FAIL oval shape/.test(atA) && /Do not FAIL oval shape/.test(atB), "sill refs: do not FAIL oval shape");
must(/preferred-ok/.test(HALL_LAW) && /preferred-ok/.test(spawnStillLine()), "oval preferred-ok");

console.log("IMAGINE-HOOKS PASS");
