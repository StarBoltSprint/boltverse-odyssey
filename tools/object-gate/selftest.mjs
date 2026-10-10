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
const spec0 = () => ({});
let fails = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}\t${m}`); if (!c) fails++; };

for (const f of readdirSync(join(HERE, "profiles")).filter((f) => !f.startsWith("_"))) {
  const p = loadProfile(f.replace(".yaml", ""));
  ok(p.checks && p.checks.length && p.texel.minPxPerM >= 64 && p.texel.nearPxPerM >= p.texel.minPxPerM, `profile ${f}: checks ${p.checks.length}, px/m ${p.texel.minPxPerM}/${p.texel.nearPxPerM}`);
}
// stable API surface used by the imagine-to-3d modules (classify/views/coarse/pbr/compare/fixloop/keyvideo); see API.md
ok(/^1\./.test(API_VERSION) && [gateObject, gateScene, resolveObject, gateAndFix, fixPlan].every((f) => typeof f === "function") && Array.isArray(FIX_ACTIONS), `API ${API_VERSION} exports present`);
{
  const { scoreVisible, screenPxPerM } = await import("./gate.mjs");
  const tb = loadProfile("building").texel; const R = loadProfile("building").repetition;
  ok(tb.policy === "visible" && tb.minViewM === 8, "texel policy visible, from 8 m (SmiR 20:19)");
  const need = screenPxPerM(tb, { renderPixelRatio: 1.5, fovDeg: 58 }, 8);
  ok(Math.abs(need - 154.6) < 0.5, `phone 1080x2400 @ pr 1.5, fov 58: ${need.toFixed(1)} px/m at 8 m`);
  const rows = [{ inst: "a#0", cls: "+z", texW: 1024, texH: 1024, samplingPxPerM: 160, repeats: 1 }, { inst: "a#0", cls: "-z", texW: 1024, texH: 1024, samplingPxPerM: 100, repeats: 3 }];
  const fp = [{ inst: "a#0", x: 0, z: 0, hw: 10, hd: 10 }, { inst: "a#1", x: 25, z: 0, hw: 10, hd: 10 }, { inst: "a#2", x: 100, z: 0, hw: 10, hd: 10 }];
  const v = scoreVisible(tb, R, { renderPixelRatio: 1.5, fovDeg: 58, source: "test" }, rows, [], fp);
  ok(!v.rows[0].pass && v.perSurface[0].ok && !v.perSurface[1].ok, "visible px/m: 160 passes, 100 fails at 8 m");
  ok(!v.rows[1].pass && /10\.2 m/.test(v.rows[1].detail), "plate tiling every 10.2 m < 30 m fails");
  ok(!v.rows[2].pass && /a#0 \/ a#1 5\.0 m/.test(v.rows[2].detail), "neighbours 5 m apart share plates -> FAIL");
  const v2 = scoreVisible(tb, R, { renderPixelRatio: 1.5, fovDeg: 58, source: "test" }, [{ inst: "a#0", cls: "-y", texW: 1024, texH: 1024, samplingPxPerM: 0, repeats: 1 }, rows[0]], [], [{ inst: "a-lod0", x: 0, z: 0, hw: 10, hd: 10 }, { inst: "a-lod1", x: 0, z: 0, hw: 10, hd: 10 }]);
  ok(v2.rows[0].pass && v2.rows[2].pass, "-y faces ignored; LOD levels of one copy are not neighbours");
  const v3 = scoreVisible(tb, R, { renderPixelRatio: 1.5, fovDeg: 58, source: "test" }, rows, [], fp, spec0(), { ok: true, visiblePxPerM: 140, screenPxPerM: 309, distM: 8, tiles: 40, p25PxPerM: 120 });
  const v4 = scoreVisible(tb, R, { renderPixelRatio: 1.5, fovDeg: 58, source: "test" }, [rows[1]], [], fp, spec0(), { ok: true, visiblePxPerM: 170, screenPxPerM: 309, distM: 8, tiles: 40, p25PxPerM: 150 });
  ok(!v3.rows[0].pass && v4.rows[0].pass && checkId(v3.rows[0].check) === "texel.visible-px-per-m", "render-measured visible px/m decides the row (140 FAIL, 170 PASS), same row id");
  ok(tb.visibleMeasure === "render" && tb.renderHeadroom === 2, "profile: visibleMeasure render, headroom 2");
  ok(checkId(v.rows[0].check) === "texel.visible-px-per-m" && checkId(v.rows[1].check) === "repetition.visible-radius" && checkId(v.rows[2].check) === "repetition.visible-neighbours", "visible row ids");
}
{
  const { loadedLiveFiles } = await import("./gate.mjs");
  const L = loadedLiveFiles(["http://127.0.0.1:8996/", "http://127.0.0.1:8996/main.mjs?v=54", "http://127.0.0.1:8996/mesas/mesaA.json?v=8", "https://cdn.x/y.js", "data:x"], "http://127.0.0.1:8996/", "/x");
  ok(L.has("index.html") && L.has("main.mjs") && L.has("mesas/mesaA.json") && L.size === 3, "live guard watches only the files the live page loads");
}
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
{ // phone perf rows (docs/METHOD/phone-perf.md)
  const { perfRows } = await import("./gate.mjs");
  const run = (pr) => { const r = { runtime: [] }; perfRows(r, pr, [412, 915]); return r.runtime; };
  const good = run({ canvasRatio: 2, dpr: 3, cap: 2, adaptive: true, skyOrder: 2, groundOrder: 1, maxOpaqueOrder: 0, skyDepthTest: true });
  ok(good.length === 4 && good.every((x) => x.status === "PASS") && good.every((x) => x.id.startsWith("perf.")), "perf rows PASS on the v59 report shape");
  const bad = run({ canvasRatio: 3, dpr: 3, cap: 2, adaptive: false, skyOrder: 0, groundOrder: 0, maxOpaqueOrder: 0, skyDepthTest: true });
  ok(bad.filter((x) => x.status === "FAIL").length === 4, "perf rows FAIL: full-DPR canvas, sky first, ground first, no adaptive");
  const none = run(null);
  ok(none.length === 1 && none[0].status === "INFO" && none[0].id === "perf.report", "page without __perfReport: INFO only");
}
console.log(fails ? `FAIL ${fails}` : "PASS selftest");
process.exit(fails ? 1 : 0);
