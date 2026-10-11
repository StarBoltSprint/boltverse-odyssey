# Scene-strict — 2026-10-11

Verdict: **FAIL** facade, **FAIL** placement. Bars were not loosened.

## Facade

Week-2 alignment (min of Canny precision and recall) was 0.704–0.743. That number is not the bar any more. `strict_score` re-scored those renders. Vision answered no on each of the five views and capped the score. Cost $0.011433. Cache: `steps/scene-strict-1011/vision-cache`. Log: `vision.jsonl`.

| View | Week-2 alignment | Strict before and after |
| --- | --- | --- |
| key | 0.704 | 0.0421 |
| hero | 0.7056 | 0.3073 |
| 30 m | 0.7365 | 0.000 |
| 8 m | 0.7045 | 0.000 |
| side | 0.7431 | 0.2501 |

The phone-sheet Grok crop and the MoGe-2 crop are both strict 0.0 (stripe). There is no new facade raster: the fusion mesh was not rebuilt, so these strict numbers are the after as well. Selftest: striped sheet and fragmented MoGe fail; the key crop itself and a clean extruded hero mask pass (`python3 tools/common/align/selftest.py`).

Side plates on disk are `/workspace/grok-native-1011/imagine/relight-left.jpg`, `relight-right.jpg`, `relight-top.jpg`, `relight-front.jpg`. `plate_is_side_view` is false for all four. Left and right name the light in `tools/grok-native/normals.py`, not a face. Nothing was projected onto +x, −x, or +z.

Relief on the glb the browser loads (`kc-staging/zb-tower3/objects1/vision/tower.glb`, fusion-fix5 round 2):

| Axis | Metres |
| --- | --- |
| +x | 0 |
| −x | 0 |
| +z | 0 |
| −z | 0.591 |

Week-2’s software pose reported −z 2.017 m and did not write a new glb. `fusion.py` still calls `dav2-large`. This step did not ship relief through that function, so the call was left as it is.

`tower-hero-vision-scene.yaml` now opens `index-fusion.html?visionKey=1` on port 8996. gate5 exit 1. 12 FAIL rows out of 21:

- UV stretch ≤ 1.3 — −z 7.846, +z 7.846, −y 99, −x 99
- scene self-report vs measured — claims 5.89 px/m; measured 0.1 px/m
- repetition (capture autocorrelation) — face x peak 0.9418
- visible px/m — no steep surface at 4/5/3/6/7/8/2.5 m; worst +x 0.1 px/m
- approach morph 300→10 m — min IoU 0.045
- shadow cast — 0 ground pixels
- grounding — worst float 44.83 m at 458.5, −507.5
- facade relief ≥ 0.3 m — +x 0 −x 0 +z 0 −z 0.591
- proportions — h/w 1.91 (want 3–5), d/w 0.25 (want 0.45–0.70)
- relief-texture alignment — hero 0.153, 30 m 0.153, 8 m 0.2281, side 0.1747
- checklist camera framed — close 1.7%, low-portrait 0.9%, far 24.7%, ortho-front 48.2% black, ortho-side 18.9% black
- key checklist — wedge, ladder, chrome, damage, sand all recorded FAIL

Full log: `steps/scene-strict-1011/gate-stdout.txt`. Report: `gate/report.md`.

Browser grounding after a rigid seat (`tower-fusion.mjs`, live `main.mjs` not edited). The instance was 60.393 m low of the median dune under the AABB, so the base now sits at Y 4.27 m (median ground 4.27, samples 1.812–9.002). The probe still finds one column at 458.5, −507.5 where the field is a pit and the air is **44.834 m**. Dropping the whole mesh another 44 m would bury the body in the median dune. That shift was not applied. Bar is float &lt; 0.5 m. Result FAIL. Week-2 had not remeasured; the earlier gate figure was 74.233 m.

Hero mesh phone budget, unchanged from fusion-fix5: 264684 triangles, 1 draw call, 9.38 MB, pass. That is the hero alone.

No `dataset/i23d` export.

Sheets: `sheet-phone.jpg` and `sheet-16x9.jpg` are the week-2 facade sheets (same mesh). `placement-sheet-phone.jpg` is the new staging phone beside `key-city3.jpg`.

## Placement

The shot stands in the terrain-key2 heightfield (not rebaked). Avenue axis from the cross-track trough: axis 72°, look 252° (ahead score 11.903 vs back 8.765). Stored bake yaw 78° was recorded and not copied. Seat of the valley search is −53.879, 9.434. FOV 88°, pitch −7.674° in three.js, eye 1.77 m, roll 0.17°.

CMA-ES on the real framebuffer, 3 rounds, 13 evaluations, 316.4 s. The loss picked `r0-2`: camera −52.905, 10.856, yaw 248.53°, eye Y 2.70.

| Bar | Result |
| --- | --- |
| Weighted silhouette IoU ≥ 0.75 | 0.2909 |
| Depth inversions vs MoGe-2 | 14 (list in `placement-numbers.json`) |
| Sky top 45% within 0.1 of the key | render 0.3676, key 0.5741, delta 0.2065 |
| Phone draw calls ≤ 12 | 17 (`passes.scene.calls`) |
| Float / sink ≤ 0.5 m | 0.409 m |

Week-2 framebuffer was IoU 0.3226 and skyTop 0.2675, draw calls 22, camera yaw 78° facing the cliff page. This shot is the keyed dune avenue with towers on both sides in the wide frame. The phone frame of the chosen trial cuts the right blade to a sliver, and the mask IoU stays near 0.29. Towers are instanced already. Hiding meshes to reach 12 draws was not done.

Layout left on `/workspace/kc-staging/zb`. Backup of the previous layout: `steps/scene-strict-1011/backup/`.

## Tools

- `tools/common/align/metrics.py` — `strict_score`. Old `score()` body unchanged.
- `tools/common/align/relief.py` — `plate_is_side_view`.
- `tools/common/align/apply_scene.py` — framebuffer CMA-ES on the terrain page.
- `tools/terrain-from-key/staging/main.mjs` — seat flush, scene draw-call count, fov and roll from the URL.
- `tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml` — fusion page.
- `kc-staging/zb-tower3/tower-fusion.mjs` — median-dune Y seat. Not live `main.mjs`.
