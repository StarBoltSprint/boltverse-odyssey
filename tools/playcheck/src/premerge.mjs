#!/usr/bin/env node
/**
 * Quick check before a details or polish branch lands on a gate.
 * 1. Rock discs must miss hard-object walk passages.
 * 2. Playcheck unit tests, without the long ruin walk.
 * --full adds the ruin walk (openings, hangar, camera shake).
 * --resume skips a stage already marked done. Default progress is /tmp.
 * --selftest uses a synthetic manifest and exits 0.
 * --audit prints the passage row only.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRocks, hitsPassage, passagesFromRuin } from "../../rocks/passages.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAY = path.resolve(HERE, "..");
const ROOT = path.resolve(PLAY, "../..");
const UNIT = [
  "src/pixels.test.mjs",
  "src/checks.test.mjs",
  "src/frames.test.mjs",
  "src/billboard.test.mjs",
  "src/perf.test.mjs",
  "src/renderlint.test.mjs",
  "src/organic.test.mjs",
  "src/streaming.test.mjs",
  "src/passages.test.mjs",
];

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function loadJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function passageAudit(ruinsPath, rocksPath) {
  const ruins = loadJson(ruinsPath);
  const rocks = loadJson(rocksPath);
  const passages = passagesFromRuin(ruins);
  const hits = auditRocks(rocks, passages);
  return { passages: passages.length, hits };
}

function selftest() {
  const ruins = {
    collider: { bodyRadiusM: 0.3 },
    objects: [
      {
        id: "gate",
        frame: "gate",
        x: 0,
        z: 0,
        yaw: 0,
        openingBoxM: [-2, 2, 0, 6],
        bounds: { min: [-4, 0, -2], max: [4, 8, 2] },
      },
    ],
  };
  const passages = passagesFromRuin(ruins);
  const rocks = {
    types: { stone: { kind: "hull", objectSize: [2, 1, 2] } },
    instances: [
      { id: "in", type: "stone", x: 0, z: 0, scale: 1, collider: true },
      { id: "out", type: "stone", x: 40, z: 0, scale: 1, collider: true },
    ],
  };
  const hits = auditRocks(rocks, passages);
  if (hits.length !== 1 || hits[0].id !== "in") {
    console.error("FAIL premerge selftest " + JSON.stringify(hits));
    process.exit(1);
  }
  if (hitsPassage(40, 0, 0.5, passages)) {
    console.error("FAIL a clear point was inside the opening");
    process.exit(1);
  }
  console.log("PASS premerge selftest");
}

function readProgress(file) {
  if (!existsSync(file)) return { done: [], rows: [] };
  return loadJson(file);
}

function writeProgress(file, state) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2) + "\n");
}

function runNode(files) {
  const proc = spawnSync(process.execPath, ["--test", ...files], {
    cwd: PLAY,
    encoding: "utf8",
    timeout: 180000,
  });
  return { status: proc.status, tail: (proc.stdout || "").split("\n").slice(-8).join("\n") + (proc.stderr || "").slice(-400) };
}

function main() {
  if (process.argv.includes("--selftest")) {
    selftest();
    return;
  }
  const ruinsPath = arg("--ruins", path.join(ROOT, "packs/zone-a/src/ruins/manifest.json"));
  const rocksPath = arg("--rocks", path.join(ROOT, "packs/zone-a/src/rocks/manifest.json"));
  const progressPath = arg("--progress", "/tmp/playcheck-premerge-progress.json");
  const resume = process.argv.includes("--resume");
  const auditOnly = process.argv.includes("--audit");
  const full = process.argv.includes("--full");
  const stages = ["passages"];
  if (!auditOnly) stages.push("unit");
  if (full) stages.push("ruinwalk");
  const state = resume ? readProgress(progressPath) : { done: [], rows: [] };
  const done = new Set(state.done || []);
  let failed = false;
  for (const stage of stages) {
    if (done.has(stage)) {
      console.log("skip " + stage);
      continue;
    }
    console.log("run " + stage);
    let row;
    if (stage === "passages") {
      const audit = passageAudit(ruinsPath, rocksPath);
      row = {
        id: stage,
        result: audit.hits.length ? "FAIL" : "PASS",
        passages: audit.passages,
        hits: audit.hits.slice(0, 12),
        hitCount: audit.hits.length,
      };
      console.log(row.result + " passages " + audit.hits.length + " of " + audit.passages);
    } else if (stage === "unit") {
      const ran = runNode(UNIT);
      row = { id: stage, result: ran.status === 0 ? "PASS" : "FAIL", tail: ran.tail };
      console.log(row.result + " unit");
    } else {
      const ran = runNode(["src/ruinwalk.test.mjs"]);
      row = { id: stage, result: ran.status === 0 ? "PASS" : "FAIL", tail: ran.tail };
      console.log(row.result + " ruinwalk");
    }
    if (row.result !== "PASS") failed = true;
    state.rows = (state.rows || []).filter((item) => item.id !== stage).concat(row);
    state.done = (state.done || []).filter((item) => item !== stage).concat(stage);
    state.left = stages.filter((item) => !state.done.includes(item));
    writeProgress(progressPath, state);
  }
  const left = stages.filter((item) => !(state.done || []).includes(item));
  console.log("Done: " + (state.done || []).join(", "));
  console.log("Left: " + (left.length ? left.join(", ") : "none"));
  console.log(failed ? "FAIL premerge" : "PASS premerge");
  process.exit(failed ? 1 : 0);
}

main();
