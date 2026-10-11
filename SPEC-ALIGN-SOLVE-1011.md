# Align-solve tool step — render-vs-key metrics + vanishing-point camera + CMA-ES search (11 Oct)

Source: /workspace/arch-research-1008/q32-answer.md (Grok chat Q32; SmiR approved this build order). Read it first.
Why: both key-matching jobs keep failing on geometry, not on "AI understanding":
- Facade (steps/fusion-fix5-1011/REPORT.md + numbers.json): FAIL. Gate alignment hero 0.09 / 30 m 0.09 / 8 m 0.14 / side 0.21, key-camera software align 0.57; relief only on -z (0.59 m); tower floats 74 m; the 8 m and side software frames were EMPTY (yaw hack); play view shows a second slab and a scrambled key projection.
- Placement (branch cursor/placement-key-1011, steps/placement-key2-1011/REPORT.md + summary.json): FAIL, weighted silhouette IoU ~0.38 vs bar 0.75.
Q32's answer: build the core trio first — (1) automatic render-vs-key metrics, (2) line detection + vanishing points + horizon -> exact camera, (3) black-box parameter search (CMA-ES) — then apply to both jobs.

Local commits only on this branch. NO new Imagine generation (zero Imagine calls). Live tree untouched. Never push, merge to main, or reset --hard. Grok vision only if strictly needed (< $0.10; log in learn/quota-log.md). Licences: OpenCV (Apache-2.0), NumPy/SciPy, scikit-image, Open3D (MIT), `cmaes` (MIT, `pip install cmaes`). MoGe-2 (MIT) is the default depth model; DA V2 Large only for internal comparison, never in shipped output. No nvdiffrast. Record every model/lib licence in the tool README.

## FIRST STEP
`git merge cursor/placement-key-1011` into this branch (brings tools/placement-from-key and the foundation pieces). Resolve conflicts keeping BOTH sides for learn/* logs; for code keep both features working. Run existing selftests (imagine-to-3d, object-gate, grok-native, placement-from-key), commit the merge, then continue.

## Build (shared module, used by BOTH tools — run the tools, extend them, never a hand recipe)
Create `tools/common/align/` (or `tools/align-solve/` imported by both; no copied code):
1. **metrics.py — render vs key**: inputs = a render (RGB + object mask, optional depth) and the key crop + SAM2 mask. Outputs: soft silhouette IoU, edge Chamfer (Canny/structured edges + distance transform, symmetric, in px and normalised), edge precision/recall at 2 px, optional colour residual (Lab), plus heatmap jpgs. One function `score(render, key, masks, weights) -> dict` and a CLI. This becomes THE alignment number reported by imagine-to-3d, placement-from-key and the object gate's relief/texture alignment row (gate keeps its bar 0.70 and stays blocking; say in the README which metric the gate reads).
2. **camera.py — single-image camera solve**: LSD / FastLineDetector (fall back to cv2.createLineSegmentDetector or a pure-skimage probabilistic Hough if ximgproc is missing — cv2 here is 5.0.0 without ximgproc), RANSAC clustering into 1–3 orthogonal vanishing points (Manhattan prior), horizon line, then FOV (focal), pitch, roll, yaw; camera height + ground plane from MoGe-2 metric depth (dominant-plane RANSAC on ground pixels). Output a camera.json (intrinsics + extrinsics, units m) usable by three.js staging AND Blender. Selftest on a synthetic rendered box scene with known camera (recover FOV within 2°, pitch within 1°).
3. **search.py — CMA-ES parameter search**: wrapper on `cmaes` (MIT) with bounds, early stop, parallel evaluation of a population, seedable, logs every trial to jsonl. Objective = weighted silhouette IoU + edge Chamfer (+ small colour term). SciPy L-BFGS-B / differential evolution as fallback. Each trial must use a CHEAP renderer (software/offscreen raster of the silhouette + edges, no full Blender) so hundreds of trials fit in minutes; full render only for the best candidates.

## Apply
A. **Facade** (`tools/imagine-to-3d/auto.py --method fusion5 --solve-camera --search cmaes` or equivalent flag): key camera from camera.py (replace the yaw hack — 8 m and side frames must contain the tower), then CMA-ES over the parametric tower params (outline taper/bite/cap, position, yaw, scale, height, texture offset, relief scale per feature box) maximising the metrics vs the key crop. Fix grounding with the MoGe ground plane (float must be ~0). Keep every SmiR rule: relief only under painted features of the exact Imagine image, never invented; textures at native res; dense triangles near the player, phone budget respected. Rebuild + run gate5.
B. **Placement** (`tools/placement-from-key`): same camera.json, then CMA-ES per object over position (x,z), yaw, scale, height from MoGe ground, maximising per-object silhouette IoU + Chamfer vs SAM2 masks; keep depth order. Re-render the staging (16x9 + phone).

## Blocking pass
- Facade: alignment >= 0.70 on EVERY view (key, hero, 30 m, 8 m, side) with the new metric, relief >= 0.3 m on features and non-zero on every visible axis, grounding float < 0.5 m, gate5 zero fails, phone budget passes.
- Placement: weighted silhouette IoU >= 0.75, correct depth order, no floating/sinking objects.
- Camera selftest passes; metric + search selftests pass.
If a target is missed, still finish the tools, report honest numbers BEFORE vs AFTER for each lever (camera alone, then + search), and stop. Max 3 search rounds per job.

## Report — steps/align-solve-1011/REPORT.md (+ numbers.json)
Honest PASS/FAIL per job. Table: metric per view before (fusion-fix5 / placement-key2) vs after camera solve vs after CMA-ES. Solved camera (FOV, pitch, roll, height) + VP overlay jpg. Trials count, seconds per stage, cost. Sheets: `sheet-16x9.jpg` AND `sheet-phone.jpg` (phone portrait play render beside key-city3 crop — REQUIRED) for the facade, and `placement-sheet-phone.jpg` for placement. If the facade passes the gate, run the automatic dataset export (dataset/i23d/...). Append the lesson to learn/failures.md or a recipe in learn/recipes/ (ALWAYS IMPROVE), update tools READMEs. Commit locally.
