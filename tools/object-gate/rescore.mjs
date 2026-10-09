#!/usr/bin/env node
// Re-score a finished gate run under the current texel policy WITHOUT re-rendering (texel.json, repetition.json and
// boxes.json are saved per object). Writes report-rescored.json / .md next to report.json; the original is kept.
//   node tools/object-gate/rescore.mjs --run out/<time> --scene specs/zone-b/scene.yaml
// Runs that predate boxes.json fall back to grounding.json (copy positions) + geometry.json (copy sizes).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadScene, toMarkdown, checkId, API_VERSION } from "./gate.mjs";
import { scoreVisible, resolveView, footprintsFromBoxes } from "./lib/visible.mjs";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const runDir = arg("--run"), scenePath = arg("--scene");
if (!runDir || !scenePath) { console.error("usage: rescore.mjs --run <dir> --scene <scene.yaml> [--report report.json]"); process.exit(2); }
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const scene = loadScene(scenePath);
const report = J(join(runDir, arg("--report") || "report.json"));
const adapter = scene.adapter ? (await import(pathToFileURL(scene.adapter).href)).default : {};
const adapterView = typeof adapter.view === "function" ? adapter.view() : adapter.view;
const REPLACED = new Set(["texel.unique-px-per-m", "repetition.uv", "texel.visible-px-per-m", "repetition.visible-radius", "repetition.visible-neighbours"]);

function footprints(od) {
  if (existsSync(join(od, "boxes.json"))) return footprintsFromBoxes(J(join(od, "boxes.json")));
  if (!existsSync(join(od, "grounding.json")) || !existsSync(join(od, "geometry.json"))) return null;
  const size = {}; for (const g of J(join(od, "geometry.json"))) for (const s of g.sizes || []) size[s.inst] = s;
  return J(join(od, "grounding.json")).map((g) => { const s = size[g.inst] || { w: 0, d: 0 }; return { inst: g.inst, x: g.at[0], z: g.at[1], hw: s.w / 2, hd: s.d / 2 }; });
}

for (const o of report.objects) {
  const spec = scene.objects.find((s) => s.id === o.id); if (!spec) continue;
  const t = spec.cfg.texel; if (t.policy !== "visible") continue;
  const od = join(runDir, o.id);
  if (!existsSync(join(od, "texel.json"))) { o.rescore = "no texel.json (object not measured in this run)"; continue; }
  const texel = J(join(od, "texel.json"));
  const rep = existsSync(join(od, "repetition.json")) ? J(join(od, "repetition.json")) : [];
  const fp = footprints(od);
  const view = resolveView(t, adapterView);
  const v = scoreVisible(t, spec.cfg.repetition, view, texel, rep, fp || [], spec);
  if (!fp) v.rows[2] = { ...v.rows[2], pass: false, detail: "copy footprints not saved in this run (no boxes.json / grounding.json): not measured" };
  for (const r of o.rows) r.id = r.id || checkId(r.check);   // runs from before API 1.1 have no row ids
  const at = o.rows.findIndex((r) => REPLACED.has(r.id));
  const kept = o.rows.filter((r) => !REPLACED.has(r.id));
  const fresh = v.rows.map((r) => ({ id: checkId(r.check), check: r.check, status: r.pass ? "PASS" : "FAIL", detail: r.detail, hints: r.pass ? [] : r.hints }));
  kept.splice(at < 0 ? kept.length : Math.min(at, kept.length), 0, ...fresh);
  o.rows = kept;
  // the self-report row compares the scene's claim with the measured px/m of the active policy
  const sr = o.rows.find((r) => r.id === "texel.self-report"); const m = sr && /scene claims ([\d.]+) px\/m/.exec(sr.detail);
  if (m && texel.length) {
    const claim = +m[1], meas = Math.min(...texel.map((r) => r.samplingPxPerM)), ok = claim <= meas * t.selfReportTolerance;
    Object.assign(sr, { status: ok ? "PASS" : "FAIL", detail: `scene claims ${+claim.toFixed(1)} px/m; measured visible (sampling) ${+meas.toFixed(1)} px/m (policy visible)`, hints: ok ? [] : sr.hints });
  }
  o.verdict = o.rows.some((r) => r.status === "FAIL") ? "FAIL" : "PASS";
  writeFileSync(join(od, "visible.json"), JSON.stringify({ view, perSurface: v.perSurface }, null, 1));
}
report.verdict = [...report.runtime, ...report.objects.flatMap((o) => o.rows)].some((r) => r.status === "FAIL") ? "FAIL" : "PASS";
report.rescored = { at: new Date().toISOString(), apiVersion: API_VERSION, policy: "visible (SmiR 2026-10-09 20:19)" };
writeFileSync(join(runDir, "report-rescored.json"), JSON.stringify(report, null, 2));
writeFileSync(join(runDir, "report-rescored.md"), toMarkdown(report));
for (const o of report.objects) console.log(`${o.id}: ${o.verdict} (${o.rows.filter((r) => r.status === "FAIL").length} FAIL / ${o.rows.length})`, o.rescore || "");
console.log("verdict", report.verdict);
