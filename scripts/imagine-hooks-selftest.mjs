#!/usr/bin/env node
// Fixture: at-sill prompts name no-punch floor placement; spawn/lane stay off that stack.
// Side refs prefer hung moss PASS sill stills — never lock/example-at-* (oval + tiny + sit).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sillStillLine, stillRefLine, stillRefOrder, sillTeacherRel } from "./imagine-hooks.mjs";

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
  must(/NEVER copy lock\/example-at/.test(p), name + " never send oval+tiny example-at-*");
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
must(stillRefOrder("atB", true).join(",") === "spawn,bolt-back.jpg,lock/sill-at-b.jpg", "atB lock official fallback");
must(stillRefOrder("atA", true).join(",") === "spawn,bolt-back.jpg,lock/sill-at-a.jpg", "atA lock official fallback");
must(!stillRefOrder("atA", true, root).includes("example-at-a.jpg"), "live atA does not send example-at-a");
must(!stillRefOrder("atB", true, root).includes("example-at-b.jpg"), "live atB does not send example-at-b");
must(stillRefOrder("spawn", false).join(",") === "bolt-back.jpg,example-spawn.jpg", "spawn ref order unchanged");
must(stillRefLine("spawn", true) === "", "spawn has no sill ref lecture");

console.log("IMAGINE-HOOKS PASS");
