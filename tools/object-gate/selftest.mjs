// Offline self-test (no browser): profiles, specs, repetition analyzer, fix plan. Exit 0 = PASS.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProfile, loadScene, toMarkdown, API_VERSION, listProfiles, checkId, CHECK_IDS, gateObject, gateScene, resolveObject } from "./gate.mjs";
import { gateAndFix, FIX_ACTIONS } from "./hooks/imagine-to-3d.mjs";
import { fixPlan } from "./hooks/imagine-to-3d.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}\t${m}`); if (!c) fails++; };

for (const f of readdirSync(join(HERE, "profiles")).filter((f) => !f.startsWith("_"))) {
  const p = loadProfile(f.replace(".yaml", ""));
  ok(p.checks && p.checks.length && p.texel.minPxPerM >= 64 && p.texel.nearPxPerM >= p.texel.minPxPerM, `profile ${f}: checks ${p.checks.length}, px/m ${p.texel.minPxPerM}/${p.texel.nearPxPerM}`);
}
// stable API surface used by the imagine-to-3d modules (classify/views/coarse/pbr/compare/fixloop/keyvideo); see API.md
ok(/^1\./.test(API_VERSION) && [gateObject, gateScene, resolveObject, gateAndFix, fixPlan].every((f) => typeof f === "function") && Array.isArray(FIX_ACTIONS), `API ${API_VERSION} exports present`);
ok(listProfiles().join(",") === "building,creature,effect,ice,prop,rock,terrain,vegetation,vehicle", `listProfiles: ${listProfiles().join(" ")}`);
ok(checkId("native Imagine px/m (plates only, unique pixels)") === "texel.unique-px-per-m" && checkId("live preview untouched during the gate run") === "runtime.live-untouched" && new Set(CHECK_IDS.map((c) => c[1])).size === CHECK_IDS.length, "stable check ids unique");
ok(loadProfile("building").geometry.minReliefM === 0.3 && loadProfile("rock").geometry.maxOpenEdges === null, "profile inheritance + overrides");
const sc = loadScene(join(HERE, "specs/zone-b/scene.yaml"));
ok(sc.objects.length === 7 && sc.objects.every((o) => o.cfg && o.select && o.select.names), `zone-b scene: ${sc.objects.length} object specs resolve`);
ok(sc.objects.filter((o) => o.type !== "effect").every((o) => (o.textures || []).some((t) => t.role === "plate")), "every non-effect spec declares at least one plate");

// repetition analyzer: a tiled Imagine-like texture must FAIL, a unique one must PASS (building maxPeak)
const dir = mkdtempSync(join(tmpdir(), "og-"));
execFileSync("python3", ["-c", `
import numpy as np; from PIL import Image, ImageFilter
r=np.random.default_rng(7)
def nat(h,w):
    a=sum(np.asarray(Image.fromarray((r.random((h,w))*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s))).astype(float) for s in (1,3,8))
    return (255*(a-a.min())/(a.max()-a.min())).astype(np.uint8)
Image.fromarray(np.tile(nat(96,96),(6,4))).save("${dir}/tiled.png")
Image.fromarray(nat(576,384)).save("${dir}/unique.png")
`]);
const rep = (f) => JSON.parse(execFileSync("python3", [join(HERE, "lib/analyze.py"), "repetition", JSON.stringify({ img: join(dir, f), rect: [0, 0, 384, 576] })], { encoding: "utf8" }));
const maxPeak = loadProfile("building").repetition.maxPeak;
const t = rep("tiled.png"), u = rep("unique.png");
ok(t.peak > maxPeak, `tiled texture peak ${t.peak} > ${maxPeak} (lag ${t.lagPx})`);
ok(u.peak < maxPeak, `unique texture peak ${u.peak} < ${maxPeak}`);

// fix plan: FAIL rows map to automatic actions
const fake = { verdict: "FAIL", out: dir, runtime: [{ check: "shader compile 412x915", status: "FAIL", detail: "x", hints: [] }],
  objects: [{ id: "tower", rows: [
    { check: "native Imagine px/m (plates only, unique pixels)", status: "FAIL", detail: "15 px/m", hints: [] },
    { check: "grounding (no floating)", status: "FAIL", detail: "0.4 m", hints: [] },
    { check: "key checklist: every item verified on a current capture", status: "FAIL", detail: "", hints: [] },
    { check: "UV stretch <= 1.3", status: "PASS", detail: "", hints: [] }] }] };
const plan = fixPlan(fake);
ok(plan.items.length === 4 && plan.items[0].action === "plate-sections" && plan.items[1].action === "sink" && plan.items[2].auto === false && plan.items[3].action === "fix-shader", "fix plan actions");
ok(toMarkdown({ ...fake, url: "u", adapter: "a", startedAt: "t", objects: fake.objects.map((o) => ({ ...o, verdict: "FAIL", files: {} })) }).includes("| tower | undefined | FAIL |"), "markdown renders");
console.log(fails ? `FAIL ${fails}` : "PASS selftest");
process.exit(fails ? 1 : 0);
