# Align-solve

Shared by `tools/imagine-to-3d` and `tools/placement-from-key`. Neither tool copies this code.

## What the object gate reads

`tools/imagine-to-3d/checks/relief_align.overlap` calls `metrics.score`. The gate row reads `overlap`. That field is `alignment`: the minimum of Canny edge precision and edge recall at 2 px. The bar stays 0.70 and the row stays blocking. `precisionRelief` is edge precision. `precisionTexture` is edge recall.

## Pieces

- `metrics.py` — `score(render, key, masks, weights)`. Soft silhouette IoU, symmetric edge Chamfer (px and normalised by the diagonal), edge precision/recall at 2 px, optional Lab residual, heatmap jpgs.
- `camera.py` — LSD via `cv2.createLineSegmentDetector` (OpenCV 5 has no `ximgproc`). RANSAC vanishing points, horizon, FOV, pitch, roll, yaw. Ground height from a metric depth plane (MoGe-2 when a depth map is not passed). `camera.json` is Y-up, camera looks down −Z, metres. Usable by three.js and by Blender.
- `search.py` — CMA-ES (`cmaes`, MIT) in the unit box, bounds, early stop, parallel population, jsonl log. SciPy differential evolution, then L-BFGS-B, if CMA-ES is missing. Trials use the caller's cheap raster.
- `apply_facade.py` / `apply_placement.py` — the two jobs. No new Imagine calls.

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

No nvdiffrast.
