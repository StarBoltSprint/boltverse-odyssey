# Week-2 step — fix align-solve causes, then symmetry, sun, cache/library init, orchestrator, differentiable refinement (11 Oct)

Source: /workspace/arch-research-1008/q32-answer.md (Grok chat Q32, "Week 2"; SmiR approved). Read it, then steps/align-solve-1011/REPORT.md + numbers.json + both phone sheets FIRST.
Run the tools and extend them (tools/common/align/, tools/imagine-to-3d/auto.py, tools/placement-from-key, tools/object-gate). Never a hand recipe; no copied code — import the align-solve metrics.py / camera.py / search.py.

Rules (all SmiR, binding): relief ONLY from the painted pixels of the exact Imagine image, sitting under its pixel feature, never invented or procedural-on-top. MoGe-2 (MIT) default depth; DA V2 Large internal comparison only; SAM2 ok. ZERO new Imagine generation. Textures at native res, no UV stretch > 1.3. Dense triangles near the player, cut only hidden/off-screen/far; LOD swaps keep identical silhouette. Phone budget must still pass. Local commits only on this branch; live tree untouched; never push, merge to main, or reset --hard. Grok vision only if strictly needed (< $0.10, log in learn/quota-log.md). Licences: PyTorch3D (BSD) for differentiable rendering — NEVER nvdiffrast. Record every licence in the tool READMEs.

## PART 0 — fix the diagnosed causes of the align-solve FAIL (must come first)
From REPORT.md:
1. **City camera solve falls back** (focal rejected -> FOV 40°, pitch 0, eye 0.63 m; camera-only placement IoU 0.028). Make the VP solve on key-city3 not fall back: e.g. a constrained focal search scored by metrics.py, horizon from the dune/sky line, height from the MoGe ground plane. Hunch to verify, not a fact: the facade solve's FOV 117° / pitch −30° also looks implausible for the key, and the phone sheet shows only a sliver/slab of the tower — check both cameras against the key by re-projecting, and use ONE consistent key camera for facade and placement.
2. **Software vs framebuffer mismatch**: placement 0.4516 software vs 0.2859 staging framebuffer; sky still in the top (skyTop 0.41). The cheap raster must match the three.js staging camera exactly (same intrinsics/extrinsics/aspect/near-far); add a selftest that a known box scene scores the same in both (±0.03).
3. **Relief on one axis only** (−z 2.08 m, others 0): every visible face gets relief from ITS own projected Imagine pixels (from the key and the existing Imagine views already on disk), ≥ 0.3 m on features, non-zero on every visible axis. Nothing invented where no painted feature exists — report it honestly per axis.
4. **Browser grounding + gate5 not re-shot**: re-measure float in the browser (was 74 m) and run gate5 on the result.
5. **8 m frame 0.689 camera-only**: get every view ≥ 0.70.

## PART 1 — Week-2 levers (Q32)
A. **Symmetry detection** (reflection/rotational, OpenCV/NumPy) on the tower masks/edges -> constraints for the parametric tower generator (fewer DoF in the CMA-ES search).
B. **Cast-shadow sun direction**: shadow edges + object/ground contact -> sun azimuth/elevation (ray-plane), write into the lighting module input; compare to the current sun; no hand-typed colours.
C. **Step cache + nearest library object init**: cache per (image hash, params) the expensive stages (masks, MoGe depth, camera, raster); start each search from the nearest validated library object/params. Report speed-up.
D. **Simple orchestrator**: run object jobs in parallel (process pool), per-job budget, early stop when a search loops/plateaus (no gain over N trials) — logs to jsonl.
E. **Final refinement with differentiable rendering**: PyTorch3D (BSD; torch 2.14 cpu is installed, pip install pytorch3d or build from source; if it truly cannot install, report that and use a clearly labelled SciPy fallback) — soft silhouette + edge loss, only on the best CMA-ES candidates, only on pose/params (never invents relief).

## Blocking pass (unchanged bars)
- Facade: alignment ≥ 0.70 on EVERY view (key, hero, 30 m, 8 m, side) with metrics.py, relief ≥ 0.3 m on features and non-zero on every visible axis, browser float < 0.5 m, gate5 zero fails, phone budget passes.
- Placement: weighted silhouette IoU ≥ 0.75 measured on the STAGING FRAMEBUFFER, correct depth order, no floating/sinking.
- All selftests pass (align, camera, search, raster-vs-framebuffer, symmetry, sun, orchestrator).
Max 3 search rounds per job + 1 differentiable refinement pass. If a target is missed, finish the tools, report honest numbers and stop.

## Report — steps/week2-1011/REPORT.md + numbers.json
Honest PASS/FAIL per job. Before (align-solve-1011) vs after each lever (Part 0 fixes, + symmetry, + cache/library init, + diff refinement), per view. Solved camera(s) + VP overlay. Sun direction found. Trials, seconds per stage, cache speed-up, cost. Sheets REQUIRED: `sheet-phone.jpg` (phone portrait play render beside key-city3) and `placement-sheet-phone.jpg`, plus `sheet-16x9.jpg`. If the facade passes the gate, run the dataset export (dataset/i23d/...). Append the lesson to learn/failures.md or learn/recipes/, update READMEs. Commit locally.
