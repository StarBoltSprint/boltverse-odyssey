# Week-2 — 2026-10-11

Verdict: **FAIL** facade, **FAIL** placement. Tools finished. Bars missed. No dataset export. No new Imagine image. Vision cost $0.

## Camera (one key, both jobs)

`key-city3.jpg`, method `constrained-focal`, fallback false. FOV 88°, align pitch +7.67° (look down), three.js pitch −7.67°, roll +0.17°, horizon row 309 (dune-sky, sun row), eye height 1.77 m from the MoGe ground plane. Vanishing points 3, lines 1399. The orthogonal-pair focal is still empty, so the grid scored by `metrics.py` with the depth prior (90°) is the solve. The old FOV 40° fallback and the facade FOV 117° / pitch −30° are not used.

Overlays: `facade/vp-overlay.jpg`, `placement/vp-overlay.jpg`.

## Facade

| View | align-solve before | Part 0 camera-only and after search |
| --- | --- | --- |
| key | 0.3342 | 0.7040 |
| hero | 0.3727 | 0.7056 |
| 30 m | 0.3635 | 0.7365 |
| 8 m | 0.0000 | 0.7045 |
| side | 0.0000 | 0.7431 |

Three CMA-ES rounds (48 trials, 25.5 s) did not raise the worst view above the camera-only minimum 0.704, so that pose was kept. Relief from the painted MoGe residual: −z 2.02 m, stretch gain 0.81, max move 2.02 m, 92395 vertices. +x / −x / +z thickness stays 0. Those axes gain area because the front triangles tilt, and the relight plates are the same camera, so no side pixel paints a ridge. Browser float was not remeasured on this mesh. gate5 was not run: `tower-hero-vision-scene.yaml` points at the existing tower3 page, not this mesh. Phone budget of the mesh is the fusion-fix5 figure (264684 tris, texMB 9.38).

Sheets: `sheet-phone.jpg`, `sheet-16x9.jpg`.

## Placement

| | IoU |
| --- | --- |
| align-solve framebuffer | 0.3763, then 0.2859 after the FOV 40° search |
| camera-only software boxes | 0.1714 |
| after 3 rounds, software boxes | 0.3007 (1188 trials, 65.9 s) |
| software boxes at the shot camera | 0.2705 |
| staging framebuffer | 0.3226, skyTop 0.2675 |

The shot camera is x −51.115, y 8.58 (terrain + eye), z 9.63, yaw 78°, pitch −7.67°, fov 88°. The known-box selftest of `geom.Cam` against three.js is IoU 1.0000 (bar ±0.03). The box IoU and the framebuffer IoU are different masks, so they are not the same number. Staging layout was restored after the shot. Live `main.mjs` was not edited.

Sheet: `placement-sheet-phone.jpg`.

## Week-2 levers

- Symmetry on the hero mask, cropped to its box: mirror x 0.43, mirror y 0.56, rot180 0.37. No axis locks. dof_drop 0.
- Cast-shadow sun (ray-plane, height 22.35 m from the placed row): azimuth 70.1°, elevation 70.0°. Current key sun is azimuth 113.8°, elevation 6.3°. The shadow tip is a dark neighbour, not a long cast shadow, so this direction was not written into the staging biome. Record: `sun.json`.
- Cache: second call with the same image hash does not recompute (`stepcache.py`). Nearest library row is the selftest `tower-b`.
- Orchestrator: process pool, plateau stop, jsonl. Selftest job `a` stopped at trial 5 of 6.
- Differentiable refine: PyTorch3D does not import on CPython 3.13. Backend `scipy-fallback`. Pose only, relief_edited false. Not a fourth search on the facade, because the three rounds already ran and the keeper held the camera-only pose.

## Selftest

`python3 tools/common/align/selftest.py` → PASS (metrics, camera, constrained focal, three.js box, painted relief, CMA-ES, symmetry, sun, cache, orchestrator, scipy pose refine).

## Not done

Placement framebuffer 0.32 is under 0.75. Facade side-axis relief is 0. Browser float and gate5 were not remeasured on this mesh. No `dataset/i23d` export.
