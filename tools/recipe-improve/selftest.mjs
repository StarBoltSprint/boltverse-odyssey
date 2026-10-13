#!/usr/bin/env node
// Proves reject-on-blocking-regression, reject-on-tie, adopt-when-strictly-better, and that logs are written.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { applyPatchText, recipeFile, sha256File } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const cli = join(here, "cli.mjs");
const inputs = join(here, "fixtures/ground-inputs.json");
let failed = 0;

function check(cond, message) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

function hashMethod() {
  const dir = join(root, "docs/METHOD");
  const files = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else files.push(path);
    }
  };
  walk(dir);
  const hash = createHash("sha256");
  for (const path of files) {
    hash.update(relative(dir, path));
    hash.update(readFileSync(path));
  }
  return hash.digest("hex");
}

function run(id, proposal) {
  return spawnSync(process.execPath, [cli, "--recipe", "ground", "--inputs", inputs, "--proposal", proposal, "--id", id], {
    cwd: root,
    encoding: "utf8",
  });
}

function readLog(id) {
  const jsonPath = join(root, "learn/recipe-improve", `${id}.json`);
  const mdPath = join(root, "learn/recipe-improve", `${id}.md`);
  check(existsSync(jsonPath), `${id} json log missing`);
  check(existsSync(mdPath), `${id} md log missing`);
  if (!existsSync(jsonPath) || !existsSync(mdPath)) return { json: null, md: "", jsonPath, mdPath };
  return {
    json: JSON.parse(readFileSync(jsonPath, "utf8")),
    md: readFileSync(mdPath, "utf8"),
    jsonPath,
    mdPath,
  };
}

const methodBefore = hashMethod();
const groundBefore = sha256File(recipeFile(root, "ground"));
const skyBefore = sha256File(recipeFile(root, "sky"));

for (const id of ["selftest-reject-regression", "selftest-reject-tie", "selftest-adopt"]) {
  for (const ext of [".json", ".md"]) {
    const path = join(root, "learn/recipe-improve", `${id}${ext}`);
    if (existsSync(path)) unlinkSync(path);
  }
}
const provenPath = join(root, "learn/proposals/ground-relief-pass.proven.json");
if (existsSync(provenPath)) unlinkSync(provenPath);

const regression = run("selftest-reject-regression", join(root, "learn/proposals/ground-quality-drop.json"));
check(regression.status === 0, `regression cli exit ${regression.status} ${regression.stderr}`);
const regressionLog = readLog("selftest-reject-regression");
if (regressionLog.json) {
  check(regressionLog.json.decision === "keep_current", `regression decision ${regressionLog.json.decision}`);
  check(regressionLog.json.because === "blocking_regression", `regression because ${regressionLog.json.because}`);
  check(regressionLog.json.scores.variant.points > regressionLog.json.scores.current.points, `regression score should be higher variant=${regressionLog.json.scores.variant.points} current=${regressionLog.json.scores.current.points}`);
  check(regressionLog.json.scores.variant.points === 30 && regressionLog.json.scores.current.points === 28, `regression points ${regressionLog.json.scores.current.points} -> ${regressionLog.json.scores.variant.points}`);
  check(regressionLog.json.blockingRegressions.some((key) => key.includes("perf.quality-kept")), `regression keys ${regressionLog.json.blockingRegressions.join(",")}`);
  check(regressionLog.json.provenFile == null, "regression wrote a proven file");
  check(regressionLog.json.inputs.sameInputs === true, "regression inputs diverged");
  check(regressionLog.json.inputs.plates.length === 2, "regression plates");
  check(regressionLog.md.includes("keep_current") && regressionLog.md.includes("Per-check diff") && regressionLog.md.includes("Inputs"), "regression md");
  check(regressionLog.json.perf.current === "perfRows" && regressionLog.json.perf.variant === "perfRows", "regression perfRows");
}
check(!existsSync(join(root, "learn/proposals/ground-quality-drop.proven.json")), "regression proven file exists");

const tie = run("selftest-reject-tie", join(root, "learn/proposals/ground-param-tie.json"));
check(tie.status === 0, `tie cli exit ${tie.status} ${tie.stderr}`);
const tieLog = readLog("selftest-reject-tie");
if (tieLog.json) {
  check(tieLog.json.decision === "keep_current", `tie decision ${tieLog.json.decision}`);
  check(tieLog.json.because === "tie", `tie because ${tieLog.json.because}`);
  check(tieLog.json.scores.variant.points === tieLog.json.scores.current.points, `tie points ${tieLog.json.scores.current.points} vs ${tieLog.json.scores.variant.points}`);
  check(tieLog.json.scores.current.points === 28, `tie score ${tieLog.json.scores.current.points}`);
  check(tieLog.json.blockingRegressions.length === 0, "tie reported a regression");
  check(tieLog.json.applied.variantParams.label === "same-gates", "tie params were not applied");
  check(JSON.stringify(tieLog.json.applied.baselineParams) === "{}", "tie baseline params");
  check(tieLog.json.provenFile == null, "tie wrote a proven file");
  check(tieLog.md.includes("Decision: keep_current") && tieLog.md.includes("Because: tie"), "tie md");
  check(tieLog.json.shotIntake.current.exit === 0 && tieLog.json.shotIntake.current.stdout.includes("ALLOW KEEP"), "tie shot intake");
}
check(!existsSync(join(root, "learn/proposals/ground-param-tie.proven.json")), "tie proven file exists");

const adopt = run("selftest-adopt", join(root, "learn/proposals/ground-relief-pass.json"));
check(adopt.status === 0, `adopt cli exit ${adopt.status} ${adopt.stderr}`);
const adoptLog = readLog("selftest-adopt");
check(existsSync(provenPath), "adopt proven file missing");
if (adoptLog.json && existsSync(provenPath)) {
  const proven = JSON.parse(readFileSync(provenPath, "utf8"));
  check(adoptLog.json.decision === "adopt_variant", `adopt decision ${adoptLog.json.decision}`);
  check(adoptLog.json.because === "strictly_better", `adopt because ${adoptLog.json.because}`);
  check(adoptLog.json.scores.variant.points === 30 && adoptLog.json.scores.current.points === 28, `adopt points ${adoptLog.json.scores.current.points} -> ${adoptLog.json.scores.variant.points}`);
  check(adoptLog.json.blockingRegressions.length === 0, `adopt regressions ${adoptLog.json.blockingRegressions.join(",")}`);
  check(adoptLog.json.methodEdited === false, "adopt flagged methodEdited");
  check(adoptLog.json.applied.baselineTextSha256 === adoptLog.json.applied.variantTextSha256, "adopt rewrote recipe text");
  check(proven.proven === true && proven.methodEdited === false, "proven flags");
  check(proven.decision === "adopt_variant" && proven.params.reliefMinM === 0.3, "proven params");
  check(typeof proven.patch === "string" && proven.patch.includes("docs/METHOD/ground.md") && proven.patch.includes("ground-relief-pass"), "proven patch");
  check(adoptLog.md.includes("adopt_variant") && adoptLog.md.includes("Proven"), "adopt md");
  check(adoptLog.json.shotIntake.variant.exit === 0, "adopt shot intake");
  const relief = adoptLog.json.checks.find((row) => row.key === "object/ground/geometry.relief");
  check(relief && relief.current === "FAIL" && relief.variant === "PASS" && relief.delta === "improved", `relief row ${JSON.stringify(relief)}`);
}

const bad = spawnSync(process.execPath, [cli, "--recipe", "not-a-recipe", "--inputs", inputs, "--proposal", join(root, "learn/proposals/ground-param-tie.json"), "--id", "nope"], {
  cwd: root,
  encoding: "utf8",
});
check(bad.status === 2, `unknown recipe exit ${bad.status}`);

let patched = "";
try {
  patched = applyPatchText("# Title\n\nline\n", "--- a/x.md\n+++ b/x.md\n@@ -1,3 +1,4 @@\n # Title\n \n line\n+extra\n");
} catch (error) {
  check(false, `applyPatchText threw ${error.message}`);
}
check(patched.includes("extra"), "in-memory patch did not apply");
check(sha256File(recipeFile(root, "ground")) === groundBefore, "ground.md bytes changed");
check(sha256File(recipeFile(root, "sky")) === skyBefore, "sky.md bytes changed");
check(hashMethod() === methodBefore, "docs/METHOD tree changed");

if (failed) {
  console.error(`FAIL recipe-improve selftest ${failed}`);
  process.exit(1);
}
console.log("PASS recipe-improve selftest reject-on-regression reject-on-tie adopt-when-strictly-better logs-written");
