# Tower sides fix — 11 Oct

Verdict: FAIL

Two mesh builds. Stop. Bars were not loosened and the mesh was not squashed. Placement was not moved. Zero new Imagine. `face-left-REJECTED.jpg` was not opened. Nothing was written under `dataset/i23d`.

The solid stays watertight (9796 tris, 0 open, 0 non-manifold). Float stays 0.00 m. Side bodies are the native plates (body ΔE 0). Ortho Lab ΔE versus each face's own plate is under 10. Gate5 is 7 FAIL. No view reaches strict 0.70 with a vision yes.

## Plates, opened before the build

| File | What it shows | Ladder | Used |
| --- | --- | --- | --- |
| `face-front-1024.jpg` 720×1280 | Broad glass elevation on a light-grey field. Concrete pier on the viewer's right. Sheared crown. Two damage bands. Thin base. | no | yes, +z, native crop 449×1205, 6.932 px/m |
| `face-right-1024.jpg` 1008×1792 | Narrow stone side. Hanging cables left of centre. Glass sliver on the viewer's right. Damage near the crown and mid-height. | no (cables, not rails) | yes, +x, native crop 605×1744, 10.033 px/m |
| `face-left-1024.jpg` 1008×1792 | The right plate mirrored. Cables on the viewer's right, glass on the viewer's left. Crop NCC versus the flipped right crop is 1.0. Recorded as mirrored right. | no | yes, −x, same native crop |
| back (−z) | `face-right-1024.jpg` mirrored again. Same rule as the left. No new Imagine. | no | yes, crop 605×1744, 10.033 px/m |
| `face-back-1024.jpg` 1008×1792 | A second front. Pier on the viewer's right, glass dominant, same family as the front. Best sheet NCC is front 0.801. | no | no. Not a skin |
| `view-top.jpg` | A worm's-eye elevation, not a roof plan. The crown is in frame. The footprint is not. | no | no. `view_top_projected` false. +y is a native roof-edge band of the front plate, one fill colour, canvas 319×279 at the front's 6.932 px/m, no resample |
| `face-left-REJECTED.jpg` | not opened | | |

## Pale sides

Root cause: `reinhard()` shifted the whole side image onto the front edge's Lab mean. The stone body left its plate. The material was already unlit `MeshBasicMaterial` (`toneMapped: false`, sRGB map, `readRT` sRGB). It was not a second lighting path.

Fix, in `grade_strip`: Reinhard runs on a copy. Only n=12 columns blend. Body ΔE is 0.0 on left, right, and back. The 12 px strip is still far from the front on the right edge (ΔE 40.171 → 38.659). That strip is not the face. It was not graded again.

Ortho Lab ΔE, CIE76 of mean Lab, same conversion as the object gate, bar < 10. Plate is the graded crop that was packed (body identical to the native plate):

| Face | Capture | ΔE | Capture L\* | Plate L\* |
| --- | --- | --- | --- | --- |
| +z | ortho-front | 1.16 | 31.68 | 32.69 |
| +z | face-z | 0.94 | 33.45 | 32.69 |
| +x | ortho-side | 1.85 | 39.86 | 41.68 |
| +x | face-x | 0.35 | 42.02 | 41.68 |
| −x | face-mx (no separate ortho row) | 6.59 | 35.44 | 41.68 |
| −z | face-mz (no separate ortho row) | 3.30 | 38.51 | 41.68 |

Hires had side face-x 40.59 and ortho-side 43.15 (capture L\* 81.9 vs plate 41.7). Front then was 7.73 / 9.81 and stays under 10 (now 0.94 / 1.16).

Play versus the key crop is report-only: deltaE 11.41, object Lab 30, 1.3, −1.3, key 34.9, 11.4, 0.6.

## Visible px/m = 0 was a measuring bug

Hires printed 0 because the 8 m tiles were scored flat and the estimator returned 0, and because `faceCaptures` was called with two Playwright arguments (one argument only). The albedo-8m camera was also a different shot from `cap-visible-8m`.

The estimator now returns `S/kmax` as an upper bound when inside tiles exist and none pass the energy test (`coarserThanEstimator`), and the four face cameras run. Both numbers are real. Neither meets 154.6. `needPxPerM` was not changed.

| Measure | px/m |
| --- | --- |
| Official gate row, cover 1, dist 8, screen 309.3, zoom fov 20.95, camera [90.88, 9.33, −78.7], 20 inside tiles, 0 tiles past kmax | upper bound **18.9** vs 154.6 |
| +z face capture, cover 0.91, screen 85.8 | 50.8 |
| −z face capture, cover 0.51 | 57.0 |
| +x face capture, cover 0.56 | 53.8 |
| −x face capture, cover 0.67 | 46.5 |
| Plate sampling (not the screen) | +z 7.3, +x 10.4, −z 10.45, −x 10.37, +y 8.22 |

154.6 is unreachable from these native plates without an upscale. No upscale was done.

`plates not downscaled` printed PASS with "original 163×419" while the served atlas is 2583×1744. The manifest source is `key-crop.jpg`, not the 1008×1792 side files. The row compares the atlas to that key crop. It does not prove the side plates were the compared originals. The bar was not loosened.

## Before vs after

Before is `steps/hires-tower-1011`. After is this glb, sha256 `1470bd7b4c972992e9320544036463dc92712f72766918508a1d2e3ddc554726` (installed copy matches). Hero and 30 m are different files.

| View | Hires strict (vision no) | Hires raw | After raw | After with vision | Vision |
| --- | --- | --- | --- | --- | --- |
| key (`ready-540x1200`) | 0.69 | 0.8916 | 0.8905 | 0.69 | no, $0.002749 |
| hero | 0.0 | 0.0 | 0.8741 | 0.69 | no, $0.002741 |
| 30 m | 0.0 (same png as hero) | 0.0 | 0.7857 | 0.69 | no, $0.002098 |
| 8 m | 0.69 (albedo black, vision not called) | 0.8992 | 0.8334 | 0.69 | no, $0.001776 |
| side | 0.69 | 0.915 | 0.5 | 0.5 | no, $0.002121 |

Vision total **$0.011484**. Five calls, one round, under $0.10. Cache `steps/tower-sides-fix-1011/vision-cache`. Log `steps/tower-sides-fix-1011/vision.ndjson`. A vision no caps strict at 0.69 and does not raise it. Side raw is already 0.5, so the cap does not move it. Every view fails the 0.70 bar that also needs a vision yes.

Alignment (relief row, cameras now differ): hero 0.1501, 30 m 0.2488, 8 m 0 (too few edges), side 0.1027. Bar wants high overlap. FAIL. Not rebuilt.

## Geometry

| | Plate | Mesh | Bar |
| --- | --- | --- | --- |
| h/w | 3.8 | 3.777 | 3–5, inside |
| d/w | foot 0.86 | 0.874 (size 46.024 × 173.821 × 40.211; gate prints 0.87) | 0.45–0.70, FAIL |

Proposal for SmiR, not applied: relax the d/w bar to the plate foot, about 0.86. The mesh was not squashed. `spec.proportions` in the scene yaml was not edited.

Relief, gate metres: +x 2.7, −x 2.709, +z 0.457, −z 0.234. The row PASSes. −z is non-zero because MoGe-2 ran on the mirrored right plate. Builder per-metre spans: front 0.685, left 0.403, back 0.630, right 0.531. Crispness PASS (planes 8 / 8 / 4 / 6).

UV stretch p95. Attempt 1 mapped each mask row across its full width: +z 1.639, +x 1.727, −z 2.009, −x 1.793, +y 2.078, −y 1.017. Attempt 2 crops each row to 1.22 times the isotropic pixel span, centred, no resample: +z 1.516, +x 1.429, −z 1.701, −x 1.539, +y 2.056 (99.4 m² of tilted wall classed +y), −y 1.017 (flat cap, 1698 m²). Still over 1.3 on +z, +x, −z, −x, +y. The leftover is shear between rows plus relief tilt, not the 1.22 factor alone. Two attempts used. Stop. No third unwrap.

Float: 0.00 m at (88.5, −98.5). The runtime still seats on the max of a 5×5 `surfaceHeight` patch. No terrain tile was edited. `meta.cameraSpace` stays ignored when `right` / `up` / `toward` / `origin` exist.

## Shadow

Two cooks. Attempt 1 refit the contact ortho once. Attempt 2 wraps `updateProjectionMatrix` so a later city `fitStaticShadow` re-applies the tower fit (140 m down-sun, 16 m up-sun, pad 8), sets `mesh.castShadow`, adds the layer-1 caster, tint `vec3(0.40, 0.40, 0.40)`, and reticks for 12 frames. Both gates measured **0** ground pixels. `objects-t7.mjs` was not edited. Stop. The darkening is not in the albedo. Hypothesis, not a third cook: the city fit still wins the ortho, and/or the probe ignores pixels under the object mask so a footprint-only contact counts as 0, and/or the shadow map never includes the hero.

## Ladder

**FAIL, not N/A.** No plate paints a ladder. `key-compare.mjs` skips a verdict of `N/A` only. `gate.mjs` fails a checklist row whose pass is not true. There is no supported plate-evidence N/A on this row. Wedge, chrome, damage, and sand stay recorded FAIL. Those records were not re-verified with a new dHash, and old black-capture hashes were not copied forward as passes. No ladder geometry was added.

Checklist cameras, after the frame fix: close 100%, low-portrait 55.2%, far 27.1%, ortho-front 60.1%, ortho-side 60.4%. That row PASSes. It does not clear the checklist items.

## Gate5 fails (7)

URL `http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1`. Node exit 1. Full text: `steps/tower-sides-fix-1011/gate/report.md`.

- UV stretch ≤ 1.3: +z 1.516, +x 1.429, −z 1.701, −x 1.539
- visible px/m: 18.9 upper bound vs 154.6 (per-face detail about 47–57, above)
- approach morph 300→10 m: min IoU 0.911, jump at 11.3 m (0.92). IoU is above 0.8. The fail is the drop. `minIoU` 0.8 and `maxDropVsNeighbours` 0.05 were not changed. The near atlas is fully on under 15 m. Not spent as a mesh attempt
- shadow cast: 0 ground pixels
- proportions: dOverW 0.87 not in 0.45–0.70 (proposal only)
- relief-texture alignment: hero 0.1501; 30 m 0.2488; 8 m 0; side 0.1027
- key checklist: wedge, ladder, chrome, damage, sand recorded FAIL

Passed and not regressed: runtime console, shaders, HUD, title, portrait, ready cover 0.9832, canvas ratio, sky/ground order, adaptive, live preview untouched (108 files), select 1 copy, texture roles, filtering, self-report (claims 5.39, measured sampling 7.0), repetition (face z 0.4417, face x 0.2968, close 0.4764, low-portrait 0.5738, max 0.75), grounding, sealed mesh, facade relief, crispness, checklist cameras framed.

## Phone

Hero mesh: 1 draw, 9796 tris. Atlas 2583×1744. Decoded albedo + normal **34.37 MB** (2 × 2583 × 1744 × 4). Under 260 MB. The page renderInfo is 19 calls, 245253 triangles, 26 textures. The visible-px/m row fails, so the phone budget does not pass.

`sheet-phone.jpg` is the 540×1200 play frame beside the key crop. `turnaround.jpg` is four orthographic renders of the installed glb (three.js, `MeshBasicMaterial`, `toneMapped` false, `flipY` false, size about 46.02 × 173.82 × 40.21) above the plates that were painted. Front matches its plate. Left and right are the cable sides, mirrors of each other. The back render is the mirrored right plate, not `face-back-1024.jpg`.

## Attempts and time

| Attempt | What changed | Builder | Gate |
| --- | --- | --- | --- |
| 1 | native side plates, `grade_strip`, back = mirrored right, one-shot shadow refit | 62.104 s, blender 0 | crashed later on a block-scoped `render` in the relief loop. UV already over 1.3. Shadow 0 |
| 2 | isotropic UV crop; shadow wrap + 12 reticks; gate `visibleRender` hoist and one-argument `faceCaptures` | 37.003 s, blender 0 | report stamp 2026-10-11T18:50:38Z, file closed 20:59:14 CEST, about 516 s, node EXIT 1 |

The gate crash and the Playwright arity were tool bugs. They are fixed. They were not a third mesh. UV and shadow each failed twice. Stop.

`tools/preview/freeze.py` refuses a FAIL verdict. No preview was frozen. No public URL.
