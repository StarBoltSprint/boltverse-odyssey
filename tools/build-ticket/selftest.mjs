// Proves order, stale commits, auto-reset, budget, clearance, and the happy path.
// node tools/build-ticket/selftest.mjs
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "cli.mjs");
const fixtureDir = path.join(here, "fixture");
const HEAD_SLOT = "1111111111111111111111111111111111111111";
let failed = 0;

function check(cond, message) {
  console.log(`${cond ? "PASS" : "FAIL"} ${message}`);
  if (!cond) failed += 1;
}

function run(args) {
  const proc = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  let summary = null;
  try {
    summary = JSON.parse(proc.stdout);
  } catch {
    summary = null;
  }
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr, summary };
}

function load(name) {
  return JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8"));
}

function stamp(ticket, head) {
  return JSON.parse(JSON.stringify(ticket).replaceAll(HEAD_SLOT, head));
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function git(dir, args) {
  const proc = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  if (proc.status !== 0) {
    throw new Error((proc.stderr || proc.stdout || `git ${args.join(" ")}`).trim());
  }
  return proc.stdout.trim();
}

function makeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "build-ticket-"));
  git(dir, ["init"]);
  git(dir, ["config", "user.email", "build-ticket@example.com"]);
  git(dir, ["config", "user.name", "build-ticket"]);
  writeFileSync(path.join(dir, "README"), "fixture\n");
  git(dir, ["add", "README"]);
  git(dir, ["commit", "-m", "init"]);
  return { dir, head: git(dir, ["rev-parse", "HEAD"]) };
}

function hasReason(summary, needle) {
  return Array.isArray(summary?.reasons) && summary.reasons.some((reason) => reason.includes(needle));
}

const schemaText = readFileSync(path.join(here, "schema", "ticket.v1.schema.json"), "utf8");
const schema = JSON.parse(schemaText);
const fieldNames = ["plates", "placement", "build", "gates", "play", "shots", "phone", "go"];
check(schema.properties && fieldNames.every((name) => schema.properties[name]), "schema has the eight fields");
check(schemaText.includes("lod0_tri_cap") && schemaText.includes("texture_mb_share"), "schema has budget lod0_tri_cap and texture_mb_share");
check(schema.$schema.includes("2020-12") && schema.properties.schema.const === "ticket.v1", "schema is draft 2020-12 ticket.v1");

const usage = run([]);
check(usage.status === 2 && usage.summary?.exit === 2, `bad invocation exit ${usage.status}`);

const missing = run(["validate"]);
check(missing.status === 2, `validate without a path exit ${missing.status}`);

const absent = run(["validate", path.join(fixtureDir, "no-such.json")]);
check(absent.status === 2, `missing ticket exit ${absent.status}`);

const badJson = path.join(mkdtempSync(path.join(tmpdir(), "build-ticket-json-")), "ticket.json");
writeFileSync(badJson, "{");
const bad = run(["validate", badJson]);
check(bad.status === 2, `invalid JSON exit ${bad.status}`);

const order = run([
  "validate",
  path.join(fixtureDir, "out-of-order.json"),
  "--commit",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
]);
check(order.status === 1 && order.summary?.ok === false, `out-of-order exit ${order.status}`);
check(hasReason(order.summary, "order: gates filled while plates is pending"), `out-of-order reason ${JSON.stringify(order.summary?.reasons)}`);
check(!hasReason(order.summary, "stale-commit"), "out-of-order is not a stale-commit miss");

const repo = makeRepo();
const happyPath = path.join(repo.dir, "happy.json");
writeJson(happyPath, stamp(load("happy.json"), repo.head));
const happy = run(["validate", happyPath, "--git-dir", repo.dir]);
check(happy.status === 0 && happy.summary?.ok === true, `happy path exit ${happy.status} ${happy.stderr}`);
check(happy.summary?.fields?.gates === "pass", `happy gates ${happy.summary?.fields?.gates}`);
check(happy.summary?.fields?.phone === "fps unverified", `happy phone ${happy.summary?.fields?.phone}`);
check(happy.summary?.fields?.go === "pass" && happy.summary?.reasons?.length === 0, "happy go with fps unverified");
check(happy.summary?.head === repo.head, "happy head is the temp repo HEAD");

const prefix = stamp(load("happy.json"), repo.head);
prefix.play = "pending";
prefix.shots = "pending";
prefix.phone = "pending";
prefix.go = "pending";
const prefixPath = path.join(repo.dir, "prefix.json");
writeJson(prefixPath, prefix);
const prefixRun = run(["validate", prefixPath, "--git-dir", repo.dir]);
check(prefixRun.status === 0 && prefixRun.summary?.fields?.gates === "pass", `gates pass while shots are still pending exit ${prefixRun.status} ${JSON.stringify(prefixRun.summary?.reasons)}`);

function judge(fileName) {
  const file = path.join(repo.dir, fileName);
  writeJson(file, stamp(load(fileName), repo.head));
  return { file, result: run(["validate", file, "--git-dir", repo.dir]) };
}

const tris = judge("over-budget-tris.json");
check(tris.result.status === 1 && tris.result.summary?.fields?.gates === "fail", `over-budget tris exit ${tris.result.status} gates ${tris.result.summary?.fields?.gates}`);
check(hasReason(tris.result.summary, "budget: lod0_tris 25001 > lod0_tri_cap 25000"), `over-budget tris reason ${JSON.stringify(tris.result.summary?.reasons)}`);
check(!hasReason(tris.result.summary, "order:"), "over-budget tris is not an order miss");

const texture = judge("over-budget-texture.json");
check(texture.result.status === 1 && texture.result.summary?.fields?.gates === "fail", `over-budget texture exit ${texture.result.status}`);
check(hasReason(texture.result.summary, "budget: texture_mb 12.01 > texture_mb_share 12"), `over-budget texture reason ${JSON.stringify(texture.result.summary?.reasons)}`);

const headroom = judge("clearance-headroom.json");
check(headroom.result.status === 1 && headroom.result.summary?.fields?.gates === "fail", `clearance headroom exit ${headroom.result.status}`);
check(hasReason(headroom.result.summary, "clearance: headroom_m 2.19 < 2.2"), `clearance headroom reason ${JSON.stringify(headroom.result.summary?.reasons)}`);

const ground = judge("clearance-ground.json");
check(ground.result.status === 1 && ground.result.summary?.fields?.gates === "fail", `clearance ground exit ${ground.result.status}`);
check(hasReason(ground.result.summary, "clearance: ground_m 0.01 !== 0"), `clearance ground reason ${JSON.stringify(ground.result.summary?.reasons)}`);

const staleFile = path.join(repo.dir, "stale-shots.json");
const staleBody = stamp(load("stale-shots.json"), repo.head);
writeJson(staleFile, staleBody);
const stale = run(["validate", staleFile, "--git-dir", repo.dir]);
const staleAfter = JSON.parse(readFileSync(staleFile, "utf8"));
check(stale.status === 1 && stale.summary?.fields?.gates === "refused", `stale shots exit ${stale.status} gates ${stale.summary?.fields?.gates}`);
check(hasReason(stale.summary, "stale-commit: shots") && hasReason(stale.summary, "gates: refused"), `stale shots reasons ${JSON.stringify(stale.summary?.reasons)}`);
check(stale.summary?.reset?.length === 0 && staleAfter.gates.status === "pass", "stale shots does not auto-reset when build.commit is HEAD");
check(staleAfter.shots.commit === "2222222222222222222222222222222222222222", "stale shots commit left in the file");

const resetBody = stamp(load("happy.json"), repo.head);
const resetFile = path.join(repo.dir, "reset.json");
writeJson(resetFile, resetBody);
writeFileSync(path.join(repo.dir, "README"), "fixture\nnext\n");
git(repo.dir, ["add", "README"]);
git(repo.dir, ["commit", "-m", "next"]);
const head2 = git(repo.dir, ["rev-parse", "HEAD"]);
check(head2 !== repo.head, "second commit moved HEAD");
const reset = run(["validate", resetFile, "--git-dir", repo.dir]);
const resetAfter = JSON.parse(readFileSync(resetFile, "utf8"));
check(reset.status === 1, `auto-reset exit ${reset.status} ${JSON.stringify(reset.summary?.reasons)}`);
check(reset.summary?.reset?.join(",") === "gates,play,shots,phone", `auto-reset list ${JSON.stringify(reset.summary?.reset)}`);
check(resetAfter.gates === "pending" && resetAfter.play === "pending" && resetAfter.shots === "pending" && resetAfter.phone === "pending", "auto-reset wrote gates/play/shots/phone pending");
check(JSON.stringify(resetAfter.plates) === JSON.stringify(resetBody.plates), "auto-reset kept plates");
check(JSON.stringify(resetAfter.placement) === JSON.stringify(resetBody.placement), "auto-reset kept placement");
check(resetAfter.build.commit === repo.head, "auto-reset kept build.commit");
check(resetAfter.go.executed_by === "Director", "auto-reset did not wipe go");
check(hasReason(reset.summary, "stale-commit: build") && hasReason(reset.summary, "gates: refused"), `auto-reset refuses gates ${JSON.stringify(reset.summary?.reasons)}`);

const objectGate = stamp(load("happy.json"), head2);
objectGate.gates.object_gate = { tool: "object-gate", verdict: "FAIL" };
for (const name of ["build", "gates", "play", "shots", "phone"]) {
  if (objectGate[name] && typeof objectGate[name] === "object") objectGate[name].commit = head2;
}
const objectGateFile = path.join(repo.dir, "object-gate-fail.json");
writeJson(objectGateFile, objectGate);
const objectGateRun = run(["validate", objectGateFile, "--git-dir", repo.dir]);
check(objectGateRun.status === 1 && objectGateRun.summary?.fields?.gates === "fail" && hasReason(objectGateRun.summary, "object_gate: FAIL"), `object_gate FAIL exit ${objectGateRun.status} ${JSON.stringify(objectGateRun.summary?.reasons)}`);

const blankDir = mkdtempSync(path.join(tmpdir(), "build-ticket-blank-"));
const blankFile = path.join(blankDir, "ticket.json");
const init = run(["init", blankFile, "--object", "fixture-pillar"]);
check(init.status === 0 && init.summary?.ok === true, `init exit ${init.status}`);
const blank = JSON.parse(readFileSync(blankFile, "utf8"));
check(fieldNames.every((name) => blank[name] === "pending"), "init leaves every field pending");
const blankValidate = run(["validate", blankFile, "--commit", repo.head]);
check(blankValidate.status === 0, `blank ticket exit ${blankValidate.status}`);

const refusedSet = run([
  "set-field",
  blankFile,
  "gates",
  "--json",
  JSON.stringify(stamp(load("happy.json"), repo.head).gates),
  "--commit",
  repo.head,
]);
const afterRefuse = JSON.parse(readFileSync(blankFile, "utf8"));
check(refusedSet.status === 1 && hasReason(refusedSet.summary, "order: cannot set gates"), `set-field out of order exit ${refusedSet.status} ${JSON.stringify(refusedSet.summary?.reasons)}`);
check(afterRefuse.gates === "pending", "set-field did not write gates");

const sunkGround = stamp(load("clearance-ground.json"), head2);
sunkGround.placement.ground_m = 0.5;
sunkGround.gates.clearance.measured.ground_m = 0;
for (const name of ["build", "gates"]) sunkGround[name].commit = head2;
const sunkGroundFile = path.join(repo.dir, "placement-ground.json");
writeJson(sunkGroundFile, sunkGround);
const sunkGroundRun = run(["validate", sunkGroundFile, "--git-dir", repo.dir]);
check(sunkGroundRun.status === 1 && sunkGroundRun.summary?.fields?.gates === "fail" && hasReason(sunkGroundRun.summary, "clearance: placement.ground_m 0.5 !== 0"), `placement ground_m exit ${sunkGroundRun.status} ${JSON.stringify(sunkGroundRun.summary?.reasons)}`);

const badPlates = JSON.parse(readFileSync(blankFile, "utf8"));
const badSet = run(["set-field", blankFile, "plates", "--json", "5", "--commit", repo.head]);
const afterBadSet = JSON.parse(readFileSync(blankFile, "utf8"));
check(badSet.status === 1 && hasReason(badSet.summary, "schema:"), `set-field schema reject exit ${badSet.status}`);
check(JSON.stringify(afterBadSet.plates) === JSON.stringify(badPlates.plates), "set-field schema reject does not write");

const platesSet = run([
  "set-field",
  blankFile,
  "plates",
  "--json",
  JSON.stringify(load("happy.json").plates),
  "--commit",
  repo.head,
]);
check(platesSet.status === 0 && platesSet.summary?.fields?.plates === "pass", `set-field plates exit ${platesSet.status} ${JSON.stringify(platesSet.summary?.reasons)}`);

const schemaBad = stamp(load("happy.json"), head2);
schemaBad.plates = 5;
const schemaBadFile = path.join(repo.dir, "schema-bad.json");
writeJson(schemaBadFile, schemaBad);
const schemaBadRun = run(["validate", schemaBadFile, "--git-dir", repo.dir]);
check(schemaBadRun.status === 1 && hasReason(schemaBadRun.summary, "schema:"), `schema reject exit ${schemaBadRun.status} ${JSON.stringify(schemaBadRun.summary?.reasons)}`);

if (failed) {
  console.error(`selftest FAIL ${failed}`);
  process.exit(1);
}
console.log("selftest PASS");
