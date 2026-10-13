// A/B a docs/METHOD recipe against one learn/proposals overlay.
// The recipe file is read and hashed. This module never writes it.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "../..");
export const SCHEMA = "recipe-improve-comparison/1";
export const PROVEN_SCHEMA = "recipe-improve-proven/1";
export const PASS_POINTS = 2;
export const WARN_POINTS = 1;
export const FAIL_POINTS = 0;

const SHOT_VIEWS = ["key", "45°", "grazing", "8 m", "3 m up"];
const HARD = new Set(["PASS", "FAIL", "WARN"]);

let perfRowsFn = null;

export function ensureJsYaml() {
  const dest = join(ROOT, "tools/object-gate/node_modules/js-yaml");
  if (existsSync(dest)) return;
  const src = "/usr/share/nodejs/js-yaml";
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });
  symlinkSync(src, dest);
}

export async function loadPerfRows() {
  if (perfRowsFn) return perfRowsFn;
  ensureJsYaml();
  const mod = await import(pathToFileURL(join(ROOT, "tools/object-gate/gate.mjs")).href);
  if (typeof mod.perfRows !== "function") throw new Error("object-gate gate.mjs has no perfRows export");
  perfRowsFn = mod.perfRows;
  return perfRowsFn;
}

export function recipeFile(root, id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`recipe id must be a METHOD stem, got ${id}`);
  }
  const file = join(root, "docs/METHOD", `${id}.md`);
  if (!existsSync(file)) throw new Error(`no docs/METHOD/${id}.md`);
  return file;
}

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

export function sha256File(file) {
  return sha256(readFileSync(file));
}

function outsideMethod(root, target) {
  const method = resolve(root, "docs/METHOD");
  const abs = resolve(target);
  if (abs === method || abs.startsWith(method + sep)) {
    throw new Error(`refusing to write under docs/METHOD: ${abs}`);
  }
}

export function assertLearnTarget(root, target) {
  outsideMethod(root, target);
}

function resolveExisting(fromFile, value, root) {
  if (typeof value !== "string" || !value.trim()) throw new Error("path is empty");
  if (isAbsolute(value) && existsSync(value)) return value;
  const beside = resolve(dirname(fromFile), value);
  if (existsSync(beside)) return beside;
  const fromRoot = resolve(root, value);
  if (existsSync(fromRoot)) return fromRoot;
  throw new Error(`missing file ${value} (from ${fromFile})`);
}

function loadJsonRef(fromFile, value, root) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  const file = resolveExisting(fromFile, value, root);
  return JSON.parse(readFileSync(file, "utf8"));
}

function loadPathList(fromFile, values, root) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("inputs.plates must list at least one file");
  return values.map((value) => {
    const file = resolveExisting(fromFile, value, root);
    return { path: relative(root, file) || file, sha256: sha256File(file) };
  });
}

export function loadInputs(file, root = ROOT) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (raw.schema !== "recipe-improve-inputs/1") throw new Error("inputs schema must be recipe-improve-inputs/1");
  if (!raw.recipe) throw new Error("inputs.recipe is required");
  const kit = resolveExisting(file, raw.kit, root);
  const scene = resolveExisting(file, raw.scene, root);
  const viewport = raw.viewport || [412, 915];
  if (!Array.isArray(viewport) || viewport.length !== 2) throw new Error("inputs.viewport must be [w, h]");
  return {
    file: relative(root, file) || file,
    recipe: raw.recipe,
    plates: loadPathList(file, raw.plates, root),
    kit: { path: relative(root, kit) || kit, sha256: sha256File(kit) },
    scene: { path: relative(root, scene) || scene, sha256: sha256File(scene) },
    viewport,
    params: raw.params && typeof raw.params === "object" ? { ...raw.params } : {},
    objectGate: loadJsonRef(file, raw.objectGate, root),
    shotSheet: raw.shotSheet == null ? null : loadJsonRef(file, raw.shotSheet, root),
    shotSheetPath: raw.shotSheet == null || typeof raw.shotSheet !== "string" ? null : resolveExisting(file, raw.shotSheet, root),
    perfReport: raw.perfReport == null ? null : loadJsonRef(file, raw.perfReport, root),
  };
}

export function loadProposal(file, root = ROOT) {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  if (raw.schema !== "recipe-proposal/1") throw new Error("proposal schema must be recipe-proposal/1");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.id || "")) throw new Error("proposal id is required");
  if (raw.kind !== "param" && raw.kind !== "patch") throw new Error("proposal kind must be param or patch");
  if (raw.proven === true) throw new Error("an input proposal is not proven; the tool sets proven on a win");
  const params = raw.params && typeof raw.params === "object" ? { ...raw.params } : {};
  let patchText = null;
  if (raw.kind === "patch") {
    patchText = typeof raw.patch === "string" ? raw.patch : readFileSync(resolveExisting(file, raw.patchFile, root), "utf8");
    if (!patchText.includes("---") || !patchText.includes("+++")) throw new Error("patch proposal needs a unified diff");
  }
  const has = (key) => Object.prototype.hasOwnProperty.call(raw, key);
  return {
    file: relative(root, file) || file,
    id: raw.id,
    recipe: raw.recipe,
    kind: raw.kind,
    summary: String(raw.summary || ""),
    params,
    patchText,
    objectGate: has("objectGate") ? loadJsonRef(file, raw.objectGate, root) : undefined,
    shotSheet: has("shotSheet") ? (raw.shotSheet == null ? null : loadJsonRef(file, raw.shotSheet, root)) : undefined,
    shotSheetPath: has("shotSheet") && typeof raw.shotSheet === "string" ? resolveExisting(file, raw.shotSheet, root) : undefined,
    perfReport: has("perfReport") ? (raw.perfReport == null ? null : loadJsonRef(file, raw.perfReport, root)) : undefined,
  };
}

export function applyPatchText(original, diffText) {
  const dir = mkdtempSync(join(tmpdir(), "recipe-improve-patch-"));
  const src = join(dir, "original.md");
  const out = join(dir, "variant.md");
  const diff = join(dir, "change.diff");
  writeFileSync(src, original);
  writeFileSync(diff, diffText.endsWith("\n") ? diffText : `${diffText}\n`);
  const before = sha256File(src);
  const proc = spawnSync("patch", ["-o", out, "--forward", "--batch", src, diff], { encoding: "utf8" });
  if (sha256File(src) !== before) throw new Error("patch rewrote the source copy");
  if (proc.status !== 0 || !existsSync(out)) {
    throw new Error((proc.stderr || proc.stdout || "patch failed").trim());
  }
  return readFileSync(out, "utf8");
}

export function unifiedAppend(relPath, original, addition) {
  const dir = mkdtempSync(join(tmpdir(), "recipe-improve-diff-"));
  const a = join(dir, "a.md");
  const b = join(dir, "b.md");
  const base = original.endsWith("\n") ? original : `${original}\n`;
  writeFileSync(a, base);
  writeFileSync(b, base + addition);
  const proc = spawnSync("diff", ["-u", "--label", `a/${relPath}`, "--label", `b/${relPath}`, a, b], { encoding: "utf8" });
  if (proc.status === 0) throw new Error("proposal diff is empty");
  if (proc.status !== 1) throw new Error((proc.stderr || "diff failed").trim());
  return proc.stdout;
}

function weight(status) {
  if (status === "PASS") return PASS_POINTS;
  if (status === "WARN") return WARN_POINTS;
  if (status === "FAIL" || status === "MISSING") return FAIL_POINTS;
  throw new Error(`status ${status} is not PASS, WARN, FAIL, or MISSING`);
}

function sheetRows(sheet) {
  if (!sheet) return [];
  if (sheet.schema !== "objsheet-shot-verdict/1") throw new Error("shot sheet schema must be objsheet-shot-verdict/1");
  if (!Array.isArray(sheet.cells) || sheet.cells.length !== SHOT_VIEWS.length) throw new Error("shot sheet needs the five views");
  const rows = [];
  const verdict = String(sheet.verdict || "");
  rows.push(shotRow("shot/verdict", verdict, verdict === "KEEP" ? [] : [`verdict ${verdict}`]));
  SHOT_VIEWS.forEach((view, index) => {
    const cell = sheet.cells[index];
    if (!cell || cell.view !== view) throw new Error(`shot sheet view ${view} is out of order`);
    rows.push(shotRow(`shot/${view}`, cell.status, cell.defects || []));
  });
  return rows;
}

function shotRow(key, raw, defects) {
  const upper = String(raw || "").toUpperCase();
  const status = upper === "KEEP" ? "PASS" : "FAIL";
  const listed = Array.isArray(defects) ? defects.filter((item) => String(item).trim()) : [];
  return {
    key,
    status,
    raw: upper || "MISSING",
    detail: listed.length ? listed.join("; ") : upper,
  };
}

function gateRows(report) {
  if (!report || typeof report !== "object") throw new Error("object-gate report is missing");
  const rows = [];
  const runtime = Array.isArray(report.runtime) ? report.runtime : [];
  runtime.forEach((row, index) => {
    if (String(row.id || "").startsWith("perf.")) return;
    rows.push(gateRow(`runtime/${row.id || row.check || index}`, row));
  });
  const objects = Array.isArray(report.objects) ? report.objects : [];
  objects.forEach((object) => {
    const objectId = object.id || "object";
    (object.rows || []).forEach((row, index) => {
      if (String(row.id || "").startsWith("perf.")) return;
      const id = row.id || row.check || String(index);
      const element = row.element ? `/${row.element}` : "";
      rows.push(gateRow(`object/${objectId}/${id}${element}`, row));
    });
  });
  if (!rows.length) throw new Error("object-gate report has no rows");
  return rows;
}

function gateRow(key, row) {
  const status = String(row.status || "");
  if (status !== "INFO" && !HARD.has(status)) throw new Error(`${key} status ${status} is not PASS, FAIL, WARN, or INFO`);
  return { key, status, raw: status, detail: String(row.detail || row.check || "") };
}

function perfMeasuredRows(perfRows, perfReport, viewport) {
  const holder = { runtime: [] };
  perfRows(holder, perfReport, viewport);
  return holder.runtime.map((row) => gateRow(`perf/${row.id}`, row));
}

export function measureArm(perfRows, arm) {
  const rows = [
    ...gateRows(arm.objectGate),
    ...perfMeasuredRows(perfRows, arm.perfReport, arm.viewport),
    ...sheetRows(arm.shotSheet),
  ];
  const byKey = new Map();
  for (const row of rows) {
    if (byKey.has(row.key)) throw new Error(`duplicate check ${row.key}`);
    byKey.set(row.key, row);
  }
  return byKey;
}

function intakeSheet(root, sheetPath, sheet) {
  if (!sheet) return null;
  let file = sheetPath;
  let tmp = null;
  if (!file) {
    tmp = mkdtempSync(join(tmpdir(), "recipe-improve-shot-"));
    file = join(tmp, "shot-verdict.json");
    writeFileSync(file, JSON.stringify(sheet, null, 2));
  }
  const proc = spawnSync("python3", [join(root, "tools/objsheet/verdict.py"), "intake", "--sheet", file], {
    cwd: root,
    encoding: "utf8",
  });
  const stdout = (proc.stdout || "").trim();
  const stderr = (proc.stderr || "").trim();
  if (proc.status !== 0 && proc.status !== 1) {
    throw new Error(`shot-sheet intake failed: ${stderr || stdout || proc.status}`);
  }
  const keep = sheet.verdict === "KEEP";
  if (keep && proc.status !== 0) throw new Error(`shot sheet says KEEP but intake refused: ${stderr || stdout}`);
  if (!keep && proc.status !== 1) throw new Error(`shot sheet is ${sheet.verdict} but intake allowed it: ${stdout}`);
  return { exit: proc.status, stdout, stderr };
}

function isRegression(current, variant) {
  if (variant === "FAIL" && current !== "FAIL") return true;
  if (variant === "MISSING" && current === "PASS") return true;
  return false;
}

function delta(current, variant, regressed) {
  if (regressed) return "regressed";
  if (current === variant) return "same";
  if (weight(variant) > weight(current)) return "improved";
  return "lower";
}

export function decide(currentMap, variantMap) {
  const keys = [...new Set([...currentMap.keys(), ...variantMap.keys()])].sort();
  const checks = [];
  const blockingRegressions = [];
  let currentPoints = 0;
  let variantPoints = 0;
  let scored = 0;
  for (const key of keys) {
    const current = currentMap.get(key);
    const variant = variantMap.get(key);
    const cStatus = current?.status || "MISSING";
    const vStatus = variant?.status || "MISSING";
    if (cStatus === "INFO" && vStatus === "INFO") {
      checks.push({ key, current: "INFO", variant: "INFO", delta: "same", detail: current?.detail || variant?.detail || "" });
      continue;
    }
    if (cStatus === "INFO" || vStatus === "INFO") {
      checks.push({
        key,
        current: cStatus,
        variant: vStatus,
        delta: "unpaired",
        detail: "one arm has no phone-perf report",
      });
      continue;
    }
    scored += 1;
    currentPoints += weight(cStatus);
    variantPoints += weight(vStatus);
    const regressed = isRegression(cStatus, vStatus);
    if (regressed) blockingRegressions.push(key);
    checks.push({
      key,
      current: current?.raw || cStatus,
      variant: variant?.raw || vStatus,
      delta: delta(cStatus, vStatus, regressed),
      detail: variant?.detail || current?.detail || "",
    });
  }
  if (!scored) throw new Error("no scored checks");
  const maxPoints = scored * PASS_POINTS;
  let decision = "keep_current";
  let because = "not_better";
  if (blockingRegressions.length) because = "blocking_regression";
  else if (variantPoints === currentPoints) because = "tie";
  else if (variantPoints > currentPoints) {
    decision = "adopt_variant";
    because = "strictly_better";
  }
  return {
    decision,
    because,
    blockingRegressions,
    checks,
    scores: {
      current: { points: currentPoints, maxPoints, rows: scored, ratio: currentPoints / maxPoints },
      variant: { points: variantPoints, maxPoints, rows: scored, ratio: variantPoints / maxPoints },
    },
  };
}

function armFrom(base, proposal, which) {
  const pick = (name) => {
    if (which === "variant" && proposal[name] !== undefined) return proposal[name];
    return base[name];
  };
  return {
    objectGate: pick("objectGate"),
    shotSheet: pick("shotSheet"),
    shotSheetPath: which === "variant" && proposal.shotSheetPath !== undefined ? proposal.shotSheetPath : base.shotSheetPath,
    perfReport: pick("perfReport"),
    viewport: base.viewport,
  };
}

export async function compareRecipes({ root = ROOT, recipe, inputs, proposal }) {
  if (inputs.recipe !== recipe) throw new Error(`inputs recipe ${inputs.recipe} != ${recipe}`);
  if (proposal.recipe !== recipe) throw new Error(`proposal recipe ${proposal.recipe} != ${recipe}`);
  const file = recipeFile(root, recipe);
  const before = readFileSync(file);
  const recipeSha = sha256(before);
  const text = before.toString("utf8");
  let variantText = text;
  if (proposal.kind === "patch") variantText = applyPatchText(text, proposal.patchText);
  const params = { ...inputs.params, ...proposal.params };
  if (sha256File(file) !== recipeSha) throw new Error("docs/METHOD changed while the overlay was applied");

  const perfRows = await loadPerfRows();
  const currentArm = armFrom(inputs, proposal, "current");
  const variantArm = armFrom(inputs, proposal, "variant");
  const currentMap = measureArm(perfRows, currentArm);
  const variantMap = measureArm(perfRows, variantArm);
  const decision = decide(currentMap, variantMap);
  const shotIntake = {
    current: intakeSheet(root, currentArm.shotSheetPath, currentArm.shotSheet),
    variant: intakeSheet(root, variantArm.shotSheetPath || (variantArm.shotSheet === currentArm.shotSheet ? currentArm.shotSheetPath : null), variantArm.shotSheet),
  };
  const relRecipe = relative(root, file);
  const comparison = {
    schema: SCHEMA,
    recipe,
    recipeFile: relRecipe,
    recipeSha256: recipeSha,
    methodEdited: false,
    proposalId: proposal.id,
    proposalFile: proposal.file,
    summary: proposal.summary,
    decision: decision.decision,
    because: decision.because,
    blockingRegressions: decision.blockingRegressions,
    inputs: {
      file: inputs.file,
      plates: inputs.plates,
      kit: inputs.kit,
      scene: inputs.scene,
      sameInputs: true,
      viewport: inputs.viewport,
    },
    applied: {
      kind: proposal.kind,
      baselineParams: inputs.params,
      variantParams: params,
      baselineTextSha256: sha256(text),
      variantTextSha256: sha256(variantText),
    },
    scores: decision.scores,
    checks: decision.checks,
    shotIntake,
    perf: {
      current: currentArm.perfReport ? "perfRows" : "absent",
      variant: variantArm.perfReport ? "perfRows" : "absent",
    },
  };
  if (sha256File(file) !== recipeSha) throw new Error("docs/METHOD changed during scoring");
  let proven = null;
  if (decision.decision === "adopt_variant") {
    const block = [
      "",
      `<!-- recipe-improve ${proposal.id} proven: true — Director folds this overlay; the tool leaves docs/METHOD unchanged -->`,
      "",
      "## Proposed param overlay",
      "",
      "```json",
      JSON.stringify({ schema: "recipe-proposal/1", id: proposal.id, recipe, proven: true, params }, null, 2),
      "```",
      "",
    ].join("\n");
    proven = {
      schema: PROVEN_SCHEMA,
      proven: true,
      decision: "adopt_variant",
      because: "strictly_better",
      recipe,
      recipeFile: relRecipe,
      recipeSha256: recipeSha,
      methodEdited: false,
      proposalId: proposal.id,
      summary: proposal.summary,
      params,
      scores: decision.scores,
      blockingRegressions: [],
      patch: unifiedAppend(relRecipe, text, block),
      note: "Director may fold this patch into docs/METHOD. recipe-improve does not apply it.",
    };
  }
  return { comparison, proven, markdown: formatMarkdown(comparison, proven) };
}

export function formatMarkdown(comparison, proven) {
  const { scores } = comparison;
  const lines = [
    `# recipe-improve ${comparison.recipe} vs ${comparison.proposalId}`,
    "",
    `Decision: ${comparison.decision}`,
    `Because: ${comparison.because}`,
    `Score current: ${scores.current.points}/${scores.current.maxPoints}`,
    `Score variant: ${scores.variant.points}/${scores.variant.maxPoints}`,
    `Blocking regressions: ${comparison.blockingRegressions.length ? comparison.blockingRegressions.join(", ") : "0"}`,
    "",
    "## Inputs",
    "",
    `Recipe file: ${comparison.recipeFile}`,
    `Recipe sha256: ${comparison.recipeSha256}`,
    `Plates: ${comparison.inputs.plates.map((plate) => plate.path).join(", ")}`,
    `Kit: ${comparison.inputs.kit.path}`,
    `Scene: ${comparison.inputs.scene.path}`,
    `Same inputs: ${comparison.inputs.sameInputs}`,
    `Perf: current ${comparison.perf.current}, variant ${comparison.perf.variant}`,
    "",
    "## Params",
    "",
    `Kind: ${comparison.applied.kind}`,
    `Baseline: ${JSON.stringify(comparison.applied.baselineParams)}`,
    `Variant: ${JSON.stringify(comparison.applied.variantParams)}`,
    "",
    "## Per-check diff",
    "",
    "| Check | Current | Variant | Delta |",
    "| --- | --- | --- | --- |",
  ];
  for (const check of comparison.checks) {
    lines.push(`| ${check.key} | ${check.current} | ${check.variant} | ${check.delta} |`);
  }
  lines.push("");
  if (proven) {
    lines.push("## Proven", "");
    lines.push("A proven patch was emitted for Director. docs/METHOD was not edited.");
    lines.push("");
  }
  return lines.join("\n");
}

export function writeComparison(root, { id, learnDir, comparison, proven, markdown }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`bad comparison id ${id}`);
  const dir = resolve(root, learnDir, "recipe-improve");
  assertLearnTarget(root, dir);
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, `${id}.json`);
  const mdPath = join(dir, `${id}.md`);
  assertLearnTarget(root, jsonPath);
  assertLearnTarget(root, mdPath);
  const body = { ...comparison, id, provenFile: null };
  let provenPath = null;
  if (proven) {
    const provenDir = resolve(root, learnDir, "proposals");
    assertLearnTarget(root, provenDir);
    mkdirSync(provenDir, { recursive: true });
    provenPath = join(provenDir, `${proven.proposalId}.proven.json`);
    assertLearnTarget(root, provenPath);
    proven.comparison = relative(root, jsonPath);
    writeFileSync(provenPath, `${JSON.stringify(proven, null, 2)}\n`);
    body.provenFile = relative(root, provenPath);
  }
  writeFileSync(jsonPath, `${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(mdPath, markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  return { jsonPath, mdPath, provenPath };
}
