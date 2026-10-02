# Failure log

Append-only. Add a new entry at the bottom. Do not rewrite an old entry to hide a miss. If a guard changes, add a new entry that cites the old one.

`feedback/` has no dated report. The only file there is [`feedback/README.md`](../feedback/README.md) (law [`biome/docs/66-tool-feedback-loop.md`](../biome/docs/66-tool-feedback-loop.md)). The entries below are taken from docs and commits already in this repo. Nothing here is a reconstructed prompt or a guessed measurement.

A search of the tree and `git log --all -S silhouetteFit` found no field named `silhouetteFit`. The fit measure that was added is `silhouetteIoU` in `tools/walkaround/primitive.py`.

## How to append

```markdown
### YYYY-MM-DD — <defect in a few words>

| | |
| --- | --- |
| Take | |
| Defect | |
| Root cause | |
| Fix | |
| Guard | command, row, and the number that fails |
| Sources | commits and files |
```

Leave a field blank when the repo does not say it. Do not fill it.

### 2026-09-30 — orbit views cooked without a silhouette lock

| | |
| --- | --- |
| Take | Doc 60 test 4. Not a numbered zone take. |
| Defect | Views of one object grew lobes on the sides and back. The set was not one object. |
| Root cause | The views were cooked with no silhouette lock against a single starting still. Eight consistent views are not an Imagine feature (a multi-image edit takes at most 5 sources). |
| Fix | Start from one sharp still (V0). Cook each next view, every 45°, as an Imagine image edit from that still and the previous view. Lock area within ±15% and height within ±8% of the neighbors. Reject a view that is not the same object as V0. No turntable video. |
| Guard | `python3 tools/objsheet/sheet.py` rows Adjacent (area ±15%, height ±8%), Opposite (width ±15%, height ±8%), Guide IoU ≥ 0.97 when a guide exists, Hull keep (any horizontal view under 0.70, or the mean under 0.80). Sample `tools/objsheet/samples/inconsistent` FAILs when two yaws are a different tall shape. `tools/assetcheck` kind `turntable` row `morph` FAILs a frame that moves area more than 15%, height more than 8%, or silhouette IoU under 0.75. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) test 4 table and the KEEP method (commit `594deac`, PR #125). [`biome/docs/64-imagine-build-limits.md`](../biome/docs/64-imagine-build-limits.md) section C (commit `93c6ef0`, PR #140). [`tools/objsheet/README.md`](../tools/objsheet/README.md) (commit `a40f9c6`, PR #133). [`tools/assetcheck/README.md`](../tools/assetcheck/README.md). |

### 2026-10-01 — ring and circle layouts that the player cannot see

| | |
| --- | --- |
| Take | Take 8, 2026-10-01. |
| Defect | The edge ring was empty in the play view. Ground at 18 m with no ring. An invisible stop at 17.07 m, heading 333°. No visible gate at 238°. The validator had printed ALL PASS. A circle collider the size of the ring radius is the same class of fault: the hero stops on a wall that has no stones. |
| Root cause | Every check compared the layout file to itself. Hulls existed in the data, on the debug map, and in the colliders, and were not drawn. The console also had WebGL `texSubImage3D` `INVALID_OPERATION` (an array-texture upload that does not match its `texStorage3D` allocation draws nothing). |
| Fix | Judge the framebuffer of the play view. A collider centred on the zone whose radius matches `edge_ring.radius_m` is a ring wall, not a stop. `edge_ring.radius_m` is the placement centreline. Generate the file with `tools/layout`; do not hand-place the ring. |
| Guard | `tools/playcheck/run` rows `ring_closed`, `collider_eq_visual`, `layout_rendered`, `stops_visible`, `gate`, `webgl_errors`. The committed fixture `tools/playcheck/sample/take8/report.md` FAILs those rows (`ring_closed` renderMiss=35, `collider_eq_visual` bad=8, `gate` pixels=0). `python3 tools/layout/layout.py check` row `collider_eq_visual` counts `ring_wall` and fails. `tools/layout/sample/broken/NOTES.md` records a visual gap of 104° at 42.5° and an invisible stop at 17.37 m on seed 11. That sample is the same class of fault as the phone (a gap on the order of 103°, a stop on the order of 17 m). It is not a replay of the phone log. |
| Sources | [`biome/docs/63-layout-file-and-validator.md`](../biome/docs/63-layout-file-and-validator.md) critical lesson. [`biome/docs/62-open-world-zones-process.md`](../biome/docs/62-open-world-zones-process.md) take 8 FAIL. Commits `2983aef` (PR #130), `d7bb4cb` (PR #132), `5740ab9` (PR #134). [`tools/layout/README.md`](../tools/layout/README.md). [`tools/playcheck/README.md`](../tools/playcheck/README.md). |

### 2026-10-02 — nearest sampling on world textures

| | |
| --- | --- |
| Take | Take 10c, branch `take10c`, commit `ef19dda`. |
| Defect | World stills and video uploads were sampled with `NEAREST`. The picture aliases. Mipmaps were never built. |
| Root cause | `packs/zone-a/play/play.js` at that commit sets `TEXTURE_MIN_FILTER` and `TEXTURE_MAG_FILTER` to `NEAREST` on the world stills and on the Bolt and gate video uploads (around lines 135, 345, and 361). The same pair on the object-ID buffer (around line 107) is the one place `NEAREST` is allowed. The file does not call `generateMipmap` and does not set `LINEAR_MIPMAP_LINEAR`. That play file is not on `main`; the law cites the commit. |
| Fix | Stills use `LINEAR_MIPMAP_LINEAR` and `generateMipmap`. Ground anisotropy up to 8. Video textures use `LINEAR`. |
| Guard | `tools/playcheck` row `render_source` (rule `nearest_world`). Same scan without a browser: `node tools/playcheck/src/renderlint.mjs <play.js>`. Law 65 rule 4. |
| Sources | [`biome/docs/65-render-quality.md`](../biome/docs/65-render-quality.md) counter-example, commit `c2c753d` (PR #141). Source lines confirmed at `ef19dda:packs/zone-a/play/play.js`. [`tools/playcheck/src/renderlint.mjs`](../tools/playcheck/src/renderlint.mjs). |

### 2026-10-01 — silhouette hull blobs thin parts

| | |
| --- | --- |
| Take | Walk-around hull. Doc 62 names the blobby case. No separate phone take number is stored for a thin-part miss. |
| Defect | A 7-of-8 silhouette vote keeps the mass the views agree on. A thin part (a cannon, an antenna, a spur) that most views do not cover disappears, and the solid reads as a blob. Disagreeing views shrink the carve toward a blob and the hull-keep fraction falls. |
| Root cause | The occupancy vote is an intersection, not a union. A 3-voxel opening is only flagged. The tool does not cook that part and does not cut it out by itself. Parity voxelization of a fitted primitive can also miss a thin solid. |
| Fix | Supply the thin part as a `subObjects` entry with its own views, a joint, and an axis. The parent voxels past the joint are cleared and the part mesh is attached. When a rigid turntable exists and the default hull is too blobby, `--shape photogrammetry` is the opt-in. A box or a vertical cylinder uses `--shape primitive`; IoU is the fit measure, and a mean under 0.50 fails without switching methods. Surface nets (`c07c039`) replaced the chopped voxel surface. They did not replace the occupancy vote. |
| Guard | `tools/objsheet` Hull keep: any horizontal view under 0.70, or the mean under 0.80, or the volume collapses. `tools/walkaround` `qc/report.json` → `protrusions` (bbox and a suggested joint; a flag is not a PASS). Primitive stats field `silhouetteIoU.mean`; below 0.50 the report's `ok` is false (`tools/walkaround/primitive.py`). There is no `silhouetteFit` field. |
| Sources | [`biome/docs/62-open-world-zones-process.md`](../biome/docs/62-open-world-zones-process.md) steps 2 and 4, and the sentence that photogrammetry is for a hull that is too blobby. [`tools/walkaround/README.md`](../tools/walkaround/README.md) sub-objects and protrusions. [`tools/objsheet/README.md`](../tools/objsheet/README.md) hull keep. Commits `ab8d1dc` (PR #127), `c07c039` (PR #131), `a40f9c6` (PR #133), `7c9e419` (PR #138). |

### 2026-09-29 — a sky or hull video that drifts inside the frame

| | |
| --- | --- |
| Take | Relief plate 0, and the Void Orbit ship prototype. |
| Defect | An Imagine video used as the texture drifts, then the loop snaps back to frame 0. Asking Imagine to pan returned a dolly. Crossfading two cooks of one heading ghosted a second hull. |
| Root cause | The generator does not hold the subject still. Movement was pixels inside the picture instead of the camera or the group. |
| Fix | One locked frame (plate 0 is frame index 12, MAE 0 against `assets/relief/plate0.png`). Extend by image-to-image slices. Hard-paste pixels already kept. Do not ask Imagine to pan. The 360° ring copies columns 0..31 onto the last 32 columns (seam MAE 0) and maps that width to exactly 360°. The ship skin is stills. Top and nose were image-to-image from the flank so the design matches. A drifting ship video is forbidden. |
| Guard | `python3 tools/assetcheck/check.py` kind `backdrop` (width above 4096 must be split; vertical magnification > 1 fails; horizontal wrap uses the tile seam limits, ratio > 2.2 and absolute seam > 12). Kind `loop` fails seam MAE > 8, seam p95 > 28, or flow > 2 px. The relief outpaint itself is judged by overlap MAE (accepted about 0.02–3.5) and plate MAE 0, written in the doc, not by a second tool. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) plate 0, T2, T2b, test 2d (commits `05a86ee` PR #123, `ad09768` PR #124, `594deac` PR #125). [`tools/relief/README.md`](../tools/relief/README.md). [`biome/docs/57-void-orbit-ship-relief.md`](../biome/docs/57-void-orbit-ship-relief.md) sections 2 and "What held" (commit `c83f082`). [`biome/docs/64-imagine-build-limits.md`](../biome/docs/64-imagine-build-limits.md) section D. |

### 2026-10-01 — one ground still frozen to the camera

| | |
| --- | --- |
| Take | Rocky Clearing attempt 1. Take 3 is the KEEP that replaced it. |
| Defect | A single ring or relief still upscales after about 4 cm of travel, so the ground froze: the HUD distance changed and the image did not. The HUD magnification was 0.406. The claimed figure was 0.990. |
| Root cause | One still cannot tile a walk. Pinning it to the camera to avoid the upscale leaves the floor stuck to the lens. |
| Fix | World-locked top-down Imagine tiles, about 0.90 m, at least 4 variants, on an invisible height relief. Take 3 phone QC read magnification 0.979 on the HUD and on the phone. |
| Guard | `tools/assetcheck` kind `tile` (seam ratio, exposure delta > 18, contrast ratio > 1.75, magnification > 1). `tools/layout` row `mag` against `view.mag_max` (1.0). `tools/playcheck` rows `mag` and `mag_max`. A HUD number that does not match the claim is a FAIL even when a tool has not run. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) walkable ground, attempt 1. [`biome/docs/61-free-clearing-walk.md`](../biome/docs/61-free-clearing-walk.md) take 3 KEEP (commit `e4ba55e`, PR #129). |
