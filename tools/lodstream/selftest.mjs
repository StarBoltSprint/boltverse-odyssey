// Proves the bad fixtures fail and the good tiny fixture passes.
// node tools/lodstream/selftest.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gateDocument, loadManifest, triangleCount } from "./gate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "gate.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lodstream-"));
let failed = 0;

function check(cond, message) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

function row(report, name) {
  return report.rows.find((item) => item.name === name);
}

function runCli(id) {
  const manifest = path.join(here, "fixtures", id, "manifest.json");
  const out = path.join(tmp, `${id}.json`);
  const proc = spawnSync(process.execPath, [cli, "--manifest", manifest, "--out", out], { encoding: "utf8" });
  let report = null;
  if (fs.existsSync(out)) report = JSON.parse(fs.readFileSync(out, "utf8"));
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr, report, out };
}

const good = runCli("good");
check(good.status === 0, `good fixture exit ${good.status} stderr=${good.stderr}`);
check(good.report && good.report.verdict === "PASS", "good fixture verdict");
check(good.report && good.report.pass === true, "good fixture pass");
check(row(good.report, "outline-15m")?.pass === true && row(good.report, "outline-15m").value === 0, "good 15 m diff is not 0");
check(row(good.report, "outline-40m")?.pass === true && row(good.report, "outline-40m").value === 0, "good 40 m diff is not 0");
check(good.report.outline.every((item) => item.hitPx > 0), "good silhouette is empty");
check(good.report.outline.every((item) => item.views.every((view) => Math.abs(view.distanceM - item.distanceM) < 1e-6)), "switch distance was not applied");
check(good.report.triangles.lod0 === 13 && good.report.triangles.lod1 === 12 && good.report.triangles.lod2 === 12, `good tris ${JSON.stringify(good.report.triangles)}`);
check(row(good.report, "lod0-tris")?.pass === true && row(good.report, "lod0-tris").limit === 80000, "good lod0 budget");
check(row(good.report, "lod-monotone")?.pass === true, "good monotone");
check(row(good.report, "texture-native")?.pass === true && row(good.report, "texture-mipmaps")?.pass === true, "good textures");
check(good.report.schema === "lodstream-report/1" && good.report.for.includes("playcheck") && good.report.for.includes("library"), "report intake tags");
check(good.report.playcheck.outlineDiffPx["15"] === 0 && good.report.playcheck.outlineDiffPx["40"] === 0, "playcheck block");

const outline = runCli("outline-diff");
check(outline.status === 1, `outline-diff exit ${outline.status} stderr=${outline.stderr}`);
check(outline.report && outline.report.verdict === "FAIL", "outline-diff verdict");
check(row(outline.report, "outline-15m")?.pass === false && row(outline.report, "outline-15m").value > 0, `outline-diff 15 m diffPx=${row(outline.report, "outline-15m")?.value}`);
check(row(outline.report, "outline-40m")?.pass === true && row(outline.report, "outline-40m").value === 0, `outline-diff 40 m should match, diffPx=${row(outline.report, "outline-40m")?.value}`);
check(row(outline.report, "lod0-tris")?.pass === true, "outline-diff should not fail the budget");

const budget = runCli("over-budget");
check(budget.status === 1, `over-budget exit ${budget.status} stderr=${budget.stderr}`);
check(budget.report && budget.report.verdict === "FAIL", "over-budget verdict");
check(budget.report.triangles.lod0 === 80001, `over-budget lod0=${budget.report.triangles.lod0}`);
check(row(budget.report, "lod0-tris")?.pass === false && row(budget.report, "lod0-tris").limit === 80000, "over-budget row");
check(row(budget.report, "outline-15m")?.value === 0 && row(budget.report, "outline-40m")?.value === 0, "pad triangles changed the silhouette");
check(row(budget.report, "lod-monotone")?.pass === true, "over-budget monotone");

const mips = runCli("missing-mipmaps");
check(mips.status === 1, `missing-mipmaps exit ${mips.status} stderr=${mips.stderr}`);
check(mips.report && mips.report.verdict === "FAIL", "missing-mipmaps verdict");
check(row(mips.report, "texture-mipmaps")?.pass === false, "missing-mipmaps row");
check(row(mips.report, "texture-native")?.pass === true, "missing-mipmaps should keep native size");
check(row(mips.report, "outline-15m")?.pass === true, "missing-mipmaps should keep the outline");

const { doc, baseDir } = loadManifest(path.join(here, "fixtures", "good", "manifest.json"));
const heavy = structuredClone(doc);
heavy.id = "coarser-heavier";
const box = JSON.parse(fs.readFileSync(path.join(here, "fixtures", "meshes", "box.json"), "utf8"));
const heavier = structuredClone(box);
heavier.indices = box.indices.concat(box.indices);
heavy.lods = [
  { level: 0, mesh: box },
  { level: 1, mesh: box },
  { level: 2, mesh: heavier },
];
const heavyReport = gateDocument(heavy, baseDir);
check(heavyReport.pass === false && row(heavyReport, "lod-monotone")?.pass === false, "coarser LOD with more tris passed");
check(heavyReport.triangles.lod2 === 24 && heavyReport.triangles.lod1 === 12, "coarser counts");

const small = structuredClone(doc);
small.id = "native-small";
small.textures = [{ id: "albedo", nativePx: [512, 512], mipmaps: true, source: "imagine" }];
const smallReport = gateDocument(small, baseDir);
check(smallReport.pass === false && row(smallReport, "texture-native")?.pass === false, "512 px plate passed");
check(row(smallReport, "texture-mipmaps")?.pass === true, "512 px plate should still have mipmaps");

const tight = structuredClone(doc);
tight.id = "tight-budget";
tight.profile = { id: "tight", lod0Max: 10 };
const tightReport = gateDocument(tight, baseDir);
check(tightReport.pass === false && row(tightReport, "lod0-tris")?.limit === 10 && row(tightReport, "lod0-tris")?.pass === false, "profile lod0Max was ignored");

const counted = triangleCount(JSON.parse(fs.readFileSync(path.join(here, "fixtures", "meshes", "box-budget.json"), "utf8")));
check(counted === 80001, `pad count ${counted}`);

const usage = spawnSync(process.execPath, [cli], { encoding: "utf8" });
check(usage.status === 2, `usage exit ${usage.status}`);

if (failed) {
  console.error(`FAIL lodstream selftest ${failed}`);
  process.exit(1);
}

const g15 = row(good.report, "outline-15m");
const o15 = row(outline.report, "outline-15m");
console.log(`good exit=0 tris=${good.report.triangles.lod0},${good.report.triangles.lod1},${good.report.triangles.lod2} diffPx15=${g15.value} diffPx40=${row(good.report, "outline-40m").value} hitPx15=${good.report.outline[0].hitPx} hitPx40=${good.report.outline[1].hitPx}`);
console.log(`outline-diff exit=1 diffPx15=${o15.value} diffPx40=${row(outline.report, "outline-40m").value}`);
console.log(`over-budget exit=1 lod0=${budget.report.triangles.lod0} limit=80000`);
console.log(`missing-mipmaps exit=1 texture-mipmaps=false`);
console.log(`coarser-heavier FAIL lod2=${heavyReport.triangles.lod2} lod1=${heavyReport.triangles.lod1}`);
console.log(`native-small FAIL 512`);
console.log(`tight-budget FAIL lod0Max=10`);
console.log("PASS lodstream selftest");
