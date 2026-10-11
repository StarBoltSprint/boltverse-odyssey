# SPEC-UNREAL-LOOK-1011 — "Unreal-level render" tools for every biome (phone)

Owner request (SmiR, 11 Oct 08:11 Paris): build the Unreal-look tools now, reusable and automatic, wired into the biome pipeline so every biome gets them.
Sources (read first): /workspace/arch-research-1008/q27-answer.md (ranking by impact per ms, S20 FE / Adreno 650); tools/lighting/light_key.py + docs/METHOD/lighting-atmosphere.md (existing lighting/atmosphere module); docs/METHOD/key-compare-and-consistency.md + tools/imagine-to-3d (key-compare, PR #195 — this branch is cursor/key-compare-gate + new commits); tools/perf (fps overlay/stats, v62 mode B phone budget); docs/METHOD/sky*.md.

## Order (each feature = its own tool module, its own on/off flag, its own fps measurement)
1. Filmic grade + bloom: ACES vs AgX tone mapping (pick by key-compare), low-res bloom (half or quarter res, threshold on sun/ring/emissives only), a 3D LUT DERIVED FROM THE KEY IMAGE (no hand-picked colours), auto-fitted by key-compare (exposure, LUT strength, bloom strength/threshold chosen by minimising key-compare distance on the key view).
2. Baked lighting + bounce: lightmap/AO bake path (Blender Cycles bake to a second UV channel `uv2`/lightMap, or into albedo when simpler), fixed sun from light_key.py. Imagine-edit relight path for warm sand bounce: the tool WRITES imagine-requests (prompt, source image, target surface) but GENERATES NONE.
3. Imagine 360 sky as environment: equirect pano -> PMREMGenerator -> scene.environment; envMap/envMapIntensity on metal and glass materials only; seamless-pano check (left/right edge seam delta, pole pinch) that rejects a bad pano. If no Imagine 360 pano exists yet, derive a temporary env from the existing Imagine sky assets and add a 360-pano request to the request list (do not generate).
4. Height fog tinted from the key (colour sampled from the key horizon/haze by the tool; height falloff; cheap shader chunk, not volumetric).
5. Soft shadows: static shadows + AO baked (from step 2); a small PCFSoftShadowMap (<=1024) only for moving objects (player, NPCs, drones); shadowMap.autoUpdate=false / castShadow off for static meshes; fixed neutral dark shadows.
6. Imagine fog and god-ray sprites aimed at the sun (billboards/additive cards oriented from the sun direction of light_key.py), with an overdraw budget (measured, capped; sprites culled/merged to stay within it). Sprite textures must come from existing Imagine assets or be listed as requests (not generated).

## Hard rules
- Every pixel from Imagine: no hand-typed colour constants in the new code/configs; all colours/tints are sampled from Imagine images (key, sky, plates). Add an AUTOMATIC check (script + selftest) that scans the new modules/configs for hex/rgb literals and colour constants and fails if any is not derived from an image (allow-list only neutral black/white math constants with a comment).
- Shadows: fixed neutral dark (no coloured shadows).
- Phone budget: v62 mode B (tools/perf). Measure fps for baseline and after each feature with the same camera path (headless/emulated phone size 1080x2400 dpr-capped as in tools/perf); report fps delta per feature; total must stay within the v62 mode B budget; any feature that breaks it ships OFF by default with the reason.
- No live swap: never edit /workspace/zb-preview-1008/index.html or any live file. Staging only: a COPY of Zone B at /workspace/zb-preview-1008/unreal-look-1011/ (served by the tunnel at https://ensures-berry-corpus-iowa.trycloudflare.com/unreal-look-1011/ via :8996). Each feature toggleable by URL flag (e.g. ?look=0 / ?grade=0&bake=0...) so before/after is one page.
- Do NOT touch /workspace/grokcli/wt/tower-vision-1010 or /workspace/zb-tower-fusion-1011 (another step is running there).
- Imagine: generate NOTHING. Write /workspace/zb-unreal-look-1011/imagine-requests.json (each: id, purpose, feature, source image, prompt, count; status NEEDS_APPROVAL) with the total count. Keep it minimal (target <= 6 for Zone B).
- Never push, merge, or reset --hard. Commit locally on cursor/unreal-look-1011.

## Pipeline wiring
- tools/look/ (or similar) with one entry point that, given a biome dir (key image, sky assets, light_key json), produces look.json (grade/LUT/bloom/fog/env/shadow params) + LUT png + bake outputs, and a runtime module the biome client loads. Hook it into the biome pipeline step that already runs the lighting module so every biome gets it automatically. Selftests for each module.
- docs/METHOD/unreal-look.md: method, order, rules, budgets, how to run for a new biome; link from tools.md / lighting-atmosphere.md.

## Gates (honest)
G1 colour-literal check passes. G2 key-compare distance on the key view improves (or not worse) vs baseline, numbers reported. G3 fps within v62 mode B budget with all default-on features; per-feature delta table. G4 seamless-pano check result. G5 no live file changed (diff of /workspace/zb-preview-1008 outside unreal-look-1011/ is empty). G6 selftests pass.

## Deliverables in /workspace/zb-unreal-look-1011/
REPORT.md (what is done / not done, gates table, fps delta per feature, key-compare numbers, request count, Grok Build credit/time if visible), sheet-phone.jpg (before/after at phone size: key view + one mid + one close, look off vs on, plus per-feature strip if cheap), imagine-requests.json, PROGRESS.md (Paris times). Look at the sheet yourself and say honestly whether it reads closer to the key/"Unreal" or not.
