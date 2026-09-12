#!/usr/bin/env node
// Fixture: at-sill prompts name no-punch floor placement; spawn/lane stay off that stack.
import { sillStillLine, stillRefLine, stillRefOrder } from "./imagine-hooks.mjs";

function must(ok, msg) {
  if (!ok) {
    console.error("FAIL  " + msg);
    process.exit(1);
  }
  console.log("PASS  " + msg);
}

const atB = [sillStillLine("B"), stillRefLine("atB", true)].join(" ");
const atA = [sillStillLine("A"), stillRefLine("atA", true)].join(" ");

for (const [name, p] of [
  ["atB", atB],
  ["atA", atA],
]) {
  must(/STONE FLOOR/.test(p), name + " feet-on-floor");
  must(/punch-sill/.test(p), name + " names punch-sill");
  must(/0\.35–0\.40|0\.35-0\.40/.test(p), name + " sill band 0.35–0.40");
  must(/top < 0\.46/.test(p), name + " crown below mid-frame");
  must(/IGNORE its oval/.test(p), name + " ignore example oval + tiny scale");
  must(/0\.53 is illegal/.test(p), name + " ignore bolt-back crop");
  must(/NEVER sit/.test(p) && /NEVER 3\/4/.test(p) && /muzzle HIDDEN/.test(p), name + " sit/yaw/face still banned");
}

must(stillRefOrder("atB", true).join(",") === "spawn,bolt-back.jpg,example-at-b.jpg", "atB+spawn edits spawn first");
must(stillRefOrder("atA", true).join(",") === "spawn,bolt-back.jpg,example-at-a.jpg", "atA+spawn edits spawn first");
must(stillRefOrder("spawn", false).join(",") === "bolt-back.jpg,example-spawn.jpg", "spawn ref order unchanged");
must(stillRefLine("spawn", true) === "", "spawn has no sill ref lecture");

console.log("IMAGINE-HOOKS PASS");
