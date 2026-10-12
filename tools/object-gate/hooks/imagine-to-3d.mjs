// Imagine-to-3D final stage: generated object -> object-gate -> (FAIL) automatic fix loop -> re-gate -> export on PASS only.
//
//   import { gateAndFix } from "tools/object-gate/hooks/imagine-to-3d.mjs";
//   const res = await gateAndFix({ scene: "staging/scene.yaml", object: "mesa", fix: async (plan) => {...}, exportFn: async () => {...} });
//
// CLI (for the Python pipeline):
//   node tools/object-gate/hooks/imagine-to-3d.mjs --scene staging/scene.yaml --object mesa \
//        --fix-cmd "python3 imagine-to-3d/fix.py {plan}" --export-cmd "python3 imagine-to-3d/package.py ..." [--max-rounds 3]
//   {plan} is replaced by the path of fix-plan.json (machine-readable actions built from the FAIL rows).
//   Exit 0 = PASS and exported. Exit 1 = still FAIL after the rounds (nothing exported). Exit 3 = needs a human/vision step.
import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadScene, gateScene, checkId } from "../gate.mjs";
import { withKeyCompare } from "../key-compare.mjs";
import { FIX_ACTIONS, applyFailureFields } from "../lib/failure.mjs";

/** FAIL row -> fix action the pipeline can run without asking. `auto: false` = needs a review (vision/owner). */
export { FIX_ACTIONS };

function failureItem(row, extra) {
  const stamped = applyFailureFields({ ...row, id: row.id || checkId(row.check || ""), status: "FAIL" });
  return {
    ...extra,
    id: stamped.id,
    check: stamped.check,
    detail: row.detail,
    hints: row.hints,
    status: "FAIL",
    failing_face_ids: stamped.failing_face_ids,
    world_position: stamped.world_position,
    suggested_fix: stamped.suggested_fix,
  };
}

export function fixPlan(report) {
  const items = [];
  for (const o of report.objects || []) for (const r of o.rows || []) if (r.status === "FAIL") {
    const a = FIX_ACTIONS.find((f) => f.re.test(r.check)) || { action: "manual", auto: false, what: "no automatic fix known" };
    items.push(failureItem(r, { object: o.id, action: a.action, auto: a.auto, what: a.what }));
  }
  for (const r of (report.keyCompare && report.keyCompare.rows) || []) if (r.status === "FAIL") {
    const a = FIX_ACTIONS.find((f) => f.re.test(r.check)) || { action: "manual", auto: false, what: "no automatic fix known" };
    items.push(failureItem(r, { object: "key-compare:" + (r.element || "*"), action: a.action, auto: a.auto, what: a.what }));
  }
  for (const r of report.runtime || []) if (r.status === "FAIL") {
    const action = /shader/.test(r.check) ? "fix-shader" : "fix-runtime";
    items.push(failureItem(r, { object: "*", action, auto: true, what: undefined }));
  }
  for (const item of items) if (!item.what) item.what = item.suggested_fix;
  return { verdict: report.verdict, report: report.out, items };
}

/**
 * gateAndFix({ scene, object, fix, exportFn, maxRounds=3, maxSameDefect=2, url, out })
 * fix(plan) must apply the auto actions (regenerate plates, re-bake, re-place) and resolve when the staging page serves
 * the new object. Same defect failing twice -> stop (workflow §2: stop after 2 attempts at the same defect).
 */
export async function gateAndFix({ scene, object, fix, exportFn, maxRounds = 3, maxSameDefect = 2, url, out, fast = false, log = console.log }) {
  const sc = typeof scene === "string" ? loadScene(scene) : scene;
  const base = resolve(out || join(sc.dir, "out", "i23d-" + new Date().toISOString().replace(/[:.]/g, "-")));
  const seen = new Map(); const rounds = [];
  for (let round = 1; round <= maxRounds; round++) {
    const rep = await withKeyCompare(await gateScene(sc, { url, out: join(base, "round-" + round), only: object ? [object] : null, fast, log }), sc, { log });
    const plan = fixPlan(rep); rounds.push({ round, verdict: rep.verdict, fails: plan.items.length, report: rep.out });
    writeFileSync(join(rep.out, "fix-plan.json"), JSON.stringify(plan, null, 2));
    if (rep.verdict === "PASS") {
      if (exportFn) await exportFn(rep);
      return { status: "PASS", exported: !!exportFn, rounds };
    }
    const human = plan.items.filter((i) => !i.auto);
    const auto = plan.items.filter((i) => i.auto);
    for (const i of auto) seen.set(i.object + "|" + i.check, (seen.get(i.object + "|" + i.check) || 0) + 1);
    const stuck = auto.filter((i) => seen.get(i.object + "|" + i.check) >= maxSameDefect + 1);
    if (!auto.length || stuck.length || round === maxRounds || !fix) {
      return { status: human.length && !auto.length ? "NEEDS_REVIEW" : "FAIL", exported: false, rounds, stuck: stuck.map((i) => i.check), review: human.map((i) => i.check), plan: join(rep.out, "fix-plan.json") };
    }
    await fix(plan, join(rep.out, "fix-plan.json"));
  }
}

// ------------------------------------------------------------------ CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2); const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : true;
  if (!o.scene) { console.error("usage: imagine-to-3d.mjs --scene S --object ID [--fix-cmd CMD] [--export-cmd CMD] [--max-rounds N] [--url U] [--fast]"); process.exit(2); }
  const res = await gateAndFix({
    scene: o.scene, object: o.object, url: o.url, out: o.out, fast: !!o.fast, maxRounds: Number(o["max-rounds"] || 3),
    fix: o["fix-cmd"] ? async (_plan, file) => { execSync(String(o["fix-cmd"]).replace("{plan}", file), { stdio: "inherit" }); } : null,
    exportFn: o["export-cmd"] ? async () => { execSync(String(o["export-cmd"]), { stdio: "inherit" }); } : null,
  });
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.status === "PASS" ? 0 : res.status === "NEEDS_REVIEW" ? 3 : 1);
}
