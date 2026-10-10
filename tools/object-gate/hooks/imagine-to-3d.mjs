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
import { loadScene, gateScene } from "../gate.mjs";

/** FAIL row -> fix action the pipeline can run without asking. `auto: false` = needs a review (vision/owner). */
export const FIX_ACTIONS = [
  { re: /^native Imagine px\/m/, action: "plate-sections", auto: true, what: "split the surface into sections; one crop-sourced full-res Imagine edit per section (no tiling, no upscale)" },
  { re: /^visible px\/m/, action: "plate-sections", auto: true, what: "cut the surface into more sections so each native 1024x1024 Imagine plate covers at most ~6.6 m (phone sharpness from 8 m); one shared plate set per type is fine" },
  { re: /^repetition \(visible\): identical/, action: "spread-plates", auto: true, what: "section LUT / more pool layers / flips so the same plate pixels never appear within 30 m" },
  { re: /^repetition \(visible\): neighbours/, action: "spread-plates", auto: true, what: "neighbouring copies (< 7 m) get different plate windows or a mirrored set, or move apart" },
  { re: /^repetition \(UV\)/, action: "unique-plates", auto: true, what: "UV each section 0..1 once; no plate repeats on a surface" },
  { re: /^repetition \(capture/, action: "unique-plates", auto: true, what: "remove visible tiling; second Imagine variant + low-frequency mask if needed" },
  { re: /^UV stretch/, action: "reunwrap", auto: true, what: "surface-aware UV, equal metres per texel on both axes" },
  { re: /^plates not downscaled/, action: "restore-native", auto: true, what: "copy the Imagine output byte-for-byte (package.py already does), no resize" },
  { re: /^texture filtering/, action: "texture-params", auto: true, what: "mipmaps + LinearMipmapLinear + anisotropy = renderer max" },
  { re: /^texture roles/, action: "declare-roles", auto: true, what: "write every texture's role in the object spec" },
  { re: /^approach morph/, action: "single-silhouette-lod", auto: true, what: "LOD1 = decimated LOD0 with the same cuts (or no swap); crossfade" },
  { re: /^shadow world-fixed/, action: "static-shadow", auto: true, what: "static world-fixed shadow map over all casters" },
  { re: /^shadow colour/, action: "shadow-tint", auto: true, what: "neutral dark shadow multiply, fix the lookup" },
  { re: /^shadow cast/, action: "cast-shadow", auto: true, what: "castShadow on every LOD, ground receives" },
  { re: /^grounding/, action: "sink", auto: true, what: "sink below the lowest footprint corner + base fill + drift" },
  { re: /^mesh sealed/, action: "heal-manifold", auto: true, what: "weld, drop coincident faces, cap loops" },
  { re: /^facade relief/, action: "add-relief", auto: true, what: "model relief from the key crop (fins/ledges/bays or strata)" },
  { re: /^proportions/, action: "rescale", auto: true, what: "scale the solid to the spec ratios in Blender" },
  { re: /^effects/, action: "imagine-fx-texture", auto: true, what: "sample the effect colour/alpha from an Imagine plate" },
  { re: /^key checklist: every item/, action: "verify-captures", auto: false, what: "Grok vision / owner reviews the capture sheet next to the key crop and records pass/fail per item" },
  { re: /^key checklist written|^key crop present/, action: "write-checklist", auto: false, what: "write the per-object checklist from the key crop" },
];

export function fixPlan(report) {
  const items = [];
  for (const o of report.objects) for (const r of o.rows) if (r.status === "FAIL") {
    const a = FIX_ACTIONS.find((f) => f.re.test(r.check)) || { action: "manual", auto: false, what: "no automatic fix known" };
    items.push({ object: o.id, id: r.id, check: r.check, action: a.action, auto: a.auto, what: a.what, detail: r.detail, hints: r.hints });
  }
  for (const r of report.runtime) if (r.status === "FAIL") items.push({ object: "*", id: r.id, check: r.check, action: /shader/.test(r.check) ? "fix-shader" : "fix-runtime", auto: true, detail: r.detail, hints: r.hints });
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
    const rep = await gateScene(sc, { url, out: join(base, "round-" + round), only: object ? [object] : null, fast, log });
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
