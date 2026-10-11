# Align-solve

Shared by `tools/imagine-to-3d` and `tools/placement-from-key`. Neither tool copies this code.

## What the object gate reads

`tools/imagine-to-3d/checks/relief_align.overlap` calls `metrics.score`. The gate row reads `overlap`. That field is `alignment`: the minimum of Canny edge precision and edge recall at 2 px. The bar stays 0.70 and the row stays blocking. `precisionRelief` is edge precision. `precisionTexture` is edge recall.

## Pieces

- `metrics.py` — `score(render, key, masks, weights)`. Soft silhouette IoU, symmetric edge Chamfer (px and normalised by the diagonal), edge precision/recall at 2 px, optional Lab residual, heatmap jpgs. `strict_score` adds the blocking structure score: outline components, solidity, row-run count, and hole fraction against the key crop; row-profile FFT stripe energy; edge-component count; edge-orientation histogram. `alignment` stays in the result and does not raise `strict`. A Grok vision yes/no (`vision='ask'`, cached by image hash) caps a no under 0.70. The call is logged. One call per view.
- `camera.py` — LSD via `cv2.createLineSegmentDetector` (OpenCV 5 has no `ximgproc`). RANSAC vanishing points, horizon, FOV, pitch, roll, yaw. Ground height from a metric depth plane (MoGe-2 when a depth map is not passed). `camera.json` is Y-up, camera looks down −Z, metres. Usable by three.js and by Blender.
- `search.py` — CMA-ES (`cmaes`, MIT) in the unit box, bounds, early stop, parallel population, jsonl log. SciPy differential evolution, then L-BFGS-B, if CMA-ES is missing. Trials use the caller's cheap raster.
- `apply_facade.py` / `apply_placement.py` — the two jobs. No new Imagine calls.
- `relief.py` — painted MoGe residual along the vertex normal. Stretch uses the 99th percentile of real edges, then a 6 px blur on a 720-row key. `plate_is_side_view` rejects the photometric relight set (same camera; left/right name the light) and any plate whose NCC against the key is above 0.40. Those pixels are not projected onto a side axis.
- `symmetry.py` — mirror and 180° scores on a mask. A pass drops degrees of freedom.
- `sunlight.py` — cast-shadow sun via ray-plane on y = 0. Same heading as `geom.dir_to_heading`.
- `stepcache.py` — sha256 cache of a stage, plus nearest library params.
- `orchestrator.py` — process pool, per-job budget, plateau stop, jsonl.
- `refine.py` — pose-only last pass. PyTorch3D (BSD) when it imports. This environment has no wheel (CPython 3.13), so the labelled backend is `scipy-fallback`. Relief is not a variable.
- `three_project.mjs` — the three.js half of the box selftest.

## Licences

| Piece | Licence |
| --- | --- |
| OpenCV | Apache-2.0 |
| NumPy | BSD-3-Clause |
| SciPy | BSD-3-Clause |
| scikit-image | BSD-3-Clause |
| cmaes | MIT |
| MoGe-2 | MIT (default depth) |
| Depth Anything V2 Large | Apache-2.0 (internal comparison only, never shipped output) |
| SAM2 | Apache-2.0 (masks already on disk) |
| Open3D | MIT (not installed here; the ground plane is a NumPy SVD RANSAC) |

| PyTorch3D | BSD-3-Clause (differentiable refine when installed; not installed on this interpreter) |

No nvdiffrast. The SciPy fallback is named `scipy-fallback` in `refine.backend()`.
