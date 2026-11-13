# Glacier ice stills v2 (shoulder-ice + range-serac)

Two new Imagine still sets for PR 238 (branch `cursor/glacier-abyss-dawn-b27b`), to replace the wall-ice and serac arrays that column when they repeat every 0.5 m.

The PR branch was not modified. Nothing was committed, pushed, or deleted. Rejected Imagine candidates were copied into `rejects/` and also left in `raw/`.

## References and colour bars

Wall ice in the engine is `engine/webgpu/glacier/tex/glacier-ice/v1.jpg` … `v4.jpg` (loaded as `wallTex` in `glacier.js`). Seracs are `engine/webgpu/glacier/tex/serac/v1.jpg` … `v4.jpg`. Lane-snow still 3 is `engine/webgpu/glacier/tex/snow/v4.jpg`.

The four existing wall stills are far apart in colour (CIE76 12–18 between them). v3 is nearly paper grey (Lab 68.25/−0.72/−1.74), which this brief forbids. Primary shoulder-ice colour bar is therefore **glacier-ice/v1.jpg**, the clearest cool blue wall ice, plus a report against the mean of the cool wall stills (v1+v2+v4). Primary range-serac colour bar is the **mean Lab of the four existing serac stills**. All seracs must also be darker than lane snow.

| ref | file | mean Lab | mean sRGB | offline worst (overs / 78) |
| --- | --- | --- | --- | --- |
| wall v1 (primary shoulder) | `ref/glacier-ice/v1.jpg` | 68.156 / −9.996 / −16.800 | 124, 173, 196 | 6.046 (56/78) |
| wall v2 | `ref/glacier-ice/v2.jpg` | 56.299 / −7.989 / −20.068 | 85, 142, 170 | 5.414 (70/78) |
| wall v3 (paper grey, not a colour target) | `ref/glacier-ice/v3.jpg` | 68.250 / −0.717 / −1.740 | 164, 167, 170 | 5.391 (73/78) — best existing wall score, used only as the offline bar |
| wall v4 | `ref/glacier-ice/v4.jpg` | 75.531 / −2.824 / −6.750 | 174, 188, 198 | 7.008 (71/78) |
| wall mean (all four) | — | 67.059 / −5.382 / −11.339 | — | — |
| wall mean cool (v1+v2+v4) | — | 66.662 / −6.936 / −14.539 | 128, 168, 188 | — |
| serac v1 | `ref/serac/v1.jpg` | 59.540 / −3.520 / −14.569 | 122, 148, 170 | 4.550 (29/78) |
| serac v2 | `ref/serac/v2.jpg` | 64.294 / −0.517 / −12.260 | 143, 158, 178 | 6.574 (42/78) |
| serac v3 | `ref/serac/v3.jpg` | 68.263 / −1.605 / −15.217 | 147, 169, 194 | 3.683 (30/78) — best existing serac score, used as the offline bar |
| serac v4 | `ref/serac/v4.jpg` | 65.096 / −3.146 / −9.257 | 143, 162, 175 | 5.059 (16/78) |
| serac mean (primary serac) | — | 64.298 / −2.197 / −12.826 | 139, 159, 179 | — |
| lane snow v4 | `ref/snow/v4.jpg` | 72.575 / −1.233 / −7.519 | 169, 179, 192 | 3.175 (2/78) (from the snow-v2 calibration) |

Pass rules, same method as snow-v2:

- Native Imagine size ≥ 1024×1024, square, no upscale, crop-resize, stretch, or resample of the deliverable. Imagine returned JPEG; deliverables are lossless PNG of those pixels (no wrap on these eight — seams were already close to the interior gradient, and an offset wrap did not help the banded rejects).
- CIE76 of mean Lab ≤ 10 vs the primary bar above.
- Offline `tools/precheck_atlas.py` worst `grid_peak` at or under the best existing still of that set (shoulder ≤ 5.391, serac ≤ 3.683). As with snow, this offline peak is **not** the official chase gate of 1.5.
- 4×4 eye: no plates, slabs, ridges, stripes, columns, or a clear repeating landmark.

`engine/webgpu/glacier/test-still-columns.mjs` (chase, block at 1.5) was not run: the stills are not wired into the engine, and this brief does not allow editing the PR tree.

## shoulder-ice (4 stills)

Straight-on ice wall faces, matte cool blue-grey, fine cracks, not paper grey, not chrome.

Contact sheet of the four 4×4 previews (each preview is a BOX downsample of the tiled native 4096 px image):

`/workspace/glacier-review/ice-stills-v2/shoulder-ice/shoulder-ice-contact-tile4x4.jpg`

| id | file | CIE76 vs wall v1 (vs cool mean) | offline column worst (overs) | 4×4 eye | verdict |
| --- | --- | --- | --- | --- | --- |
| shoulder-ice-0 | [shoulder-ice-0.png](shoulder-ice/shoulder-ice-0.png) | 4.969 (2.950) | 1.864 (7/78) | even, no grid or columns; nearly featureless — barely any visible fine cracks | **PASS** (best colour; **flag: nearly featureless**) |
| shoulder-ice-1 | [shoulder-ice-1.png](shoulder-ice/shoulder-ice-1.png) | 6.847 (4.686) | 1.886 (5/78) | even white hairline crackle, no grid or bands | **PASS** |
| shoulder-ice-2 | [shoulder-ice-2.png](shoulder-ice/shoulder-ice-2.png) | 8.405 (8.718) | 1.810 (4/78) | even denser white crackle, no grid or bands; a little paler / more blue | **PASS** (best offline; soft: slightly pale) |
| shoulder-ice-3 | [shoulder-ice-3.png](shoulder-ice/shoulder-ice-3.png) | 8.243 (6.643) | 4.560 (21/78) | even visible hairline craquelure, no blotch grid, no bands (replaces the gen-04 blotch-grid fail) | **PASS** (replacement; offline higher than siblings, still under the 5.391 bar) |

All four are well under the best existing wall offline worst (5.391), and also under snow still 3’s offline worst (3.175).

4×4 previews: `shoulder-ice/shoulder-ice-0-tile4x4.jpg` … `shoulder-ice-3-tile4x4.jpg`.

---

### shoulder-ice-0

- **Prompt:** A square tileable photograph of a glacier ice wall seen straight on at eye level, orthographic, edge to edge, no sky. Real dense glacier ice, muted cool blue-grey with a cyan undertone, sRGB 124 174 196. Only a tight even field of tiny irregular fractures, like fine craquelure in matte ice, the same texture everywhere, no preferred direction. No white sparkles, no glitter, no bright dots, no chrome, no gloss. No mottled clouds, no large light or dark patches, no long cracks, no strata, no stripes. Dead-flat softbox light, top of the frame is the same brightness as the bottom, no vignette. Seamless when repeated four times. About half a metre of ice wall.
- **Ref images used:** `ref/ice/v3.jpg` (even engine ice still, for grain and lighting; colour still judged against glacier-ice/v1).
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap, no resample)
- **sha256:** `8b8cfef8efd09684414beeb74cfada595400a7094f132bac086241321c3f4df2`
- **Column score (offline precheck worst / 78 views):** 1.864 at heading 165°, offset (0.07, 1.3); 7/78 over 1.5.
- **CIE76 mean Lab vs wall v1:** 4.969 (pass ≤10). Vs wall cool mean: 2.950. Mean Lab L=69.038 a=−5.351 b=−15.273. Mean sRGB 141, 173, 196.
- **Low-freq:** inner rowSwing 3.48, colSwing 3.25. Raw wrap-edge ratios 0.83 / 0.85.
- **Eye, 4×4:** Clean, no visible tile joint, no columns, no plates, no bands. Kept, but flagged: at 4×4 the craquelure almost disappears — nearly featureless, barely any visible fine cracks.
- **Verdict:** PASS, with a flag that it is nearly featureless

### shoulder-ice-1

- **Prompt:** A square tileable close-up of a glacier ice wall face, camera straight on at eye level, orthographic, edge to edge. Real muted glacier ice colour, cool grey-blue, about sRGB 124 174 196, not neon, not chalk, not beige. Fine even crystalline grain with very small irregular cracks only, no large features. Matte dry ice, no sparkle, no chrome, no specular dots. Flat even light with no top-to-bottom gradient and no vignette. Seamless when placed in a four by four grid, no repeating band. About half a metre across.
- **Ref images used:** `ref/ice/v2.jpg`.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `99691d3bbb6ce563684a0f12a8c5dc4d4002ed3f1324d9136c9aaa315f6aa6e5`
- **Column score:** 1.886 at heading 120°, offset (0.13, 0.37); 5/78 over 1.5.
- **CIE76 vs wall v1:** 6.847 (pass). Vs cool mean: 4.686. Mean Lab L=66.667 a=−3.357 b=−17.564. Mean sRGB 137, 165, 193.
- **Low-freq:** inner rowSwing 4.14, colSwing 5.13. Seam ratios 1.02 / 1.07.
- **Eye, 4×4:** Clean white hairline crackle, no grid, no bands, no columns.
- **Verdict:** PASS

### shoulder-ice-2

- **Prompt:** A square tileable close-up of a muted cool blue-grey glacier ice wall, camera straight on at eye level, orthographic, edge to edge, no sky. Colour about sRGB 124 174 196, real dense glacier ice, not neon, not chalk. Fine even crystalline grain and a tight irregular crackle of very small fractures, no large features, no sparkle, no chrome, no cloudy mottling. Dead flat even light: top edge, bottom edge and centre are the same brightness, absolutely no top-to-bottom gradient and no vignette, so tiling does not make horizontal bands. Seamless in a four by four grid. About half a metre across.
- **Ref images used:** the already-passing `raw/shoulder-ice-gen-08.jpg` (same family as shoulder-ice-1), as a lighting/texture lock.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `1abadc443e4486167d8487b4163d75458967e1bb937de47881cce65a21fed8e3`
- **Column score:** 1.810 at heading 0°, offset (0.5, 0.1); **4/78** over 1.5. Best offline of the four.
- **CIE76 vs wall v1:** 8.405 (pass). Vs cool mean: 8.718. Vs mean of all four wall stills: 10.252 (just over that secondary number; primary bars pass). Mean Lab L=73.144 a=−3.762 b=−19.430. Mean sRGB 150, 183, 215. A little paler and more blue than wall v1; within 10 of v1 and of the cool mean.
- **Low-freq:** inner rowSwing 5.56, colSwing 7.25. Seam ratios 1.01 / 1.16.
- **Eye, 4×4:** Even denser white crackle than shoulder-ice-1, no grid or bands.
- **Verdict:** PASS, with a soft on paler / cooler colour

### shoulder-ice-3

Replacement for the first shoulder-ice-3 (`raw/shoulder-ice-gen-04.jpg`, also `rejects/replaced/shoulder-ice-3-gen-04-FAILED.png`). The old still’s numbers passed, but in 4×4 the blotches clearly repeated as a tile grid. It was moved to `rejects/replaced/`, not deleted.

- **Prompt:** A square tileable close-up of a muted cool blue-grey glacier ice wall, camera straight on at eye level, orthographic, edge to edge, no sky. Colour about sRGB 124 174 196, real dense glacier ice, not neon, not chalk. Clearly visible fine hairline cracks and a tight irregular craquelure, the cracks are fine but obvious, spread evenly over the whole square, no empty smooth regions, no large blotches, no cloudy patches, no sparkle clusters, no chrome. Dead flat even light: top edge, bottom edge and centre are the same brightness, no vertical gradient, no vignette, so tiling does not make horizontal bands or a repeating blotch cell. Seamless in a four by four grid. About half a metre across.
- **Ref images used:** `ref/ice/v2.jpg`.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap, no resample)
- **sha256:** `6b3bb27170f90d3ac7af93a72657d88bd4e02abccb3cd65076a16ed72f63e00e`
- **Column score:** 4.560 at heading 105°, offset (0.5, 0.1); 21/78 over 1.5. Higher than the other three shoulder stills (1.81–2.81), but under the existing wall bar (5.391).
- **CIE76 vs wall v1:** 8.243 (pass). Vs cool mean: 6.643. Vs mean of all four wall stills: 8.978. Mean Lab L=63.533 a=−3.695 b=−19.421. Mean sRGB 125, 157, 188.
- **Low-freq:** inner rowSwing 2.81, colSwing 3.03. Seam ratios 0.73 / 0.75. first-vs-last luma 0.30 (flattest lighting of the shoulder set).
- **Eye, 4×4:** No blotch grid, no bands, no columns. Fine hairline craquelure is clearly visible on the native 1024 still and in a 2×2 of native pixels; it reads finer in the 1024 4×4 preview because the cracks are thin. Evenly spread, no large patches.
- **Verdict:** PASS (replacement)

## range-serac (4 stills)

Straight-on broken serac faces, matte dusk blue-grey, darker than lane snow, no repeating strata.

Contact sheet:

`/workspace/glacier-review/ice-stills-v2/range-serac/range-serac-contact-tile4x4.jpg`

| id | file | CIE76 vs serac mean (vs serac v1, vs snow v4) | offline column worst (overs) | 4×4 eye | verdict |
| --- | --- | --- | --- | --- | --- |
| range-serac-0 | [range-serac-0.png](range-serac/range-serac-0.png) | 4.731 (7.330, 11.160) | 1.923 (8/78) | even fine chipped ice, no grid, no shelves, no columns | **PASS** (best colour and broken relief) |
| range-serac-1 | [range-serac-1.png](range-serac/range-serac-1.png) | 8.300 (8.669, 14.796) | 2.521 (12/78) | even frosty grain, no grid or bands; slightly more cyan | **PASS** |
| range-serac-2 | [range-serac-2.png](range-serac/range-serac-2.png) | 5.081 (6.865, 12.074) | 2.396 (9/78) | even small chipped serac relief like range-serac-0, no bands or tile grid (replaces the gen-11 flat/banded fail) | **PASS** (replacement) |
| range-serac-3 | [range-serac-3.png](range-serac/range-serac-3.png) | 8.005 (3.644, 17.131) | 2.238 (12/78) | even rough grain, no tile grid or columns; mild diagonal grain | **PASS** (soft: grain direction) |

All four are under the best existing serac offline worst (3.683), and all are darker than lane snow (L 56–67 vs 72.6; CIE76 vs snow 11–17). Early rubble/block attempts tiled as a wallpaper of unique chunks and were rejected, even when colour was close.

4×4 previews: `range-serac/range-serac-0-tile4x4.jpg` … `range-serac-3-tile4x4.jpg`.

---

### range-serac-0

- **Prompt:** Photorealistic square seamless texture of a dusk blue-grey glacier serac face, shot straight on at eye level, orthographic wall, not top-down, filling the frame. This is a continuous matte ice wall with fine-scale broken relief, like weathered compact glacier ice that has chipped and crazed, not a heap of ice cubes, not rubble, not bricks, not horizontal layered strata. Shallow irregular facets and fine cracks packed evenly, each only a centimetre or two, no large unique form. Colour about sRGB 139 159 179, mid lightness, cooler and duskier than snow, not pale chalk, not paper grey, not chrome. Even softbox light, identical brightness in every corner, no shadows that tile as bands, no specular highlights. Tileable without a visible 4 by 4 repeat. Half a metre across.
- **Ref images used:** a solid sRGB 139 159 179 chip (`ref/chips/serac-mean-srgb.png`) plus `ref/ice/v1.jpg` for even ice grain. Colour still judged against the serac-mean Lab.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `f727741b4d03a74ccc0930f7d123324716f6cc7559eef58801cddd54fe08e592`
- **Column score:** 1.923 at heading 75°, offset (0.5, 0.1); 8/78 over 1.5. Best offline of the four.
- **CIE76 vs serac mean:** 4.731 (pass). Vs serac v1: 7.330. Vs snow v4: 11.160 (darker, as required). Mean Lab L=66.590 a=−4.152 b=−16.474. Mean sRGB 136, 166, 191.
- **Low-freq:** inner rowSwing 7.81, colSwing 4.22. Seam ratios 1.16 / 1.15.
- **Eye, 4×4:** Clean fine chips, no unique repeating block, no shelves, no columns, no strata.
- **Verdict:** PASS

### range-serac-1

- **Prompt:** Photorealistic square seamless close-up of a vertical dusk glacier serac wall, eye-level, straight on, orthographic, full bleed, no sky. A continuous face of compact matte ice with fine-scale broken relief: shallow irregular chips and short ragged fractures packed evenly, each only a centimetre or two, no unique landmark block, no rubble heap, no cobbles, no stacked horizontal strata, no shelves, no columns. Colour is medium dusk blue-grey, sRGB 139 159 179, Lab lightness 64, a little greyer and duskier than bright cyan ice, darker than pale packed snow, not paper grey, not chalk white, not dark slate, not chrome. Even softbox, top equals bottom, no gradient, no gloss. Tiles in a 4 by 4 grid with no visible repeating shape. Half a metre of ice face.
- **Ref images used:** `ref/chips/serac-mean-srgb.png` and `ref/ice/v3.jpg`.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `9084ca78c6deba88a73761a54e0457aa28894356a7cca767bb185ae175641139`
- **Column score:** 2.521 at heading 75°, offset (0, 0); 12/78 over 1.5.
- **CIE76 vs serac mean:** 8.300 (pass). Vs serac v1: 8.669. Vs snow v4: 14.796. Mean Lab L=65.825 a=−7.257 b=−19.226. Mean sRGB 123, 165, 194. A little more cyan than the dusk-grey mean; within 10.
- **Low-freq:** inner rowSwing 3.98, colSwing 3.73. Seam ratios 0.96 / 0.99.
- **Eye, 4×4:** Even frosty grain, no grid or bands.
- **Verdict:** PASS

### range-serac-2

Replacement for the first range-serac-2 (`raw/range-serac-gen-11.jpg`, also `rejects/replaced/range-serac-2-gen-11-FAILED.png`). The old still’s numbers passed, but by eye it was almost flat, with faint horizontal bands and no broken serac form. It was moved to `rejects/replaced/`, not deleted.

- **Prompt:** Photorealistic square seamless close-up of a vertical dusk glacier serac wall, eye-level, straight on, orthographic, full bleed, no sky. A continuous face of compact matte ice with small broken serac relief clearly visible: shallow irregular chips and short ragged fractures packed evenly, each only a centimetre or two, like weathered chipped glacier ice, not a smooth flat frost wall, not a pile of large unique blocks, not cobbles, not stacked horizontal strata. Colour MUST stay mid dusk blue-grey, sRGB 139 159 179, Lab lightness 64, the same mid brightness as a medium cloudy ice face, only slightly duskier than pale packed snow, NOT navy, NOT charcoal, NOT slate, NOT dark grey, do not darken the reference. Texture density and brightness are identical in the top third, the middle, and the bottom third of the frame, no vertical gradient, no rougher band, no vignette, no gloss, no chrome. Must tile in a 4 by 4 grid with no visible repeating shape, no horizontal bands, no blotch grid. Half a metre of ice face.
- **Ref images used:** `ref/chips/serac-mean-srgb.png` and the already-passing `range-serac/range-serac-0.png`.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `e45bf10de961ce148497a4f8aa55ce8863d52ffa48f881f2e50dc81bfb841070`
- **Column score:** 2.396 at heading 105°, offset (0, 0); 9/78 over 1.5. Under the existing serac bar (3.683), in the same range as range-serac-0/1/3.
- **CIE76 vs serac mean:** 5.081 (pass). Vs serac v1: 6.865. Vs snow v4: 12.074 (darker, as required). Mean Lab L=65.869 a=−4.768 b=−16.917. Mean sRGB 132, 164, 190.
- **Low-freq:** inner rowSwing 8.66, colSwing 4.25. Seam ratios 1.31 / 1.26. first-vs-last luma 4.89; top256 vs bot256 only ~1.6 luma (similar family to range-serac-0).
- **Eye, 4×4:** Small broken chip relief in the same family as range-serac-0, packed evenly, no unique repeating block, no shelves, no columns, no blotch grid, no clear horizontal bands.
- **Verdict:** PASS (replacement)

### range-serac-3

- **Prompt:** Photorealistic square seamless close-up of a vertical serac ice wall, eye-level, camera straight on, orthographic, full bleed, no sky, no text. A single continuous face of compact glacier ice, not a pile of loose blocks, not a rubble heap, not cobbles, not gravel, not stones. The surface is rough and broken only in a fine even way: shallow irregular chips, short ragged hairline fractures, a little matte frost, all similar in size and densely mixed, no piece large enough to become a landmark when the tile repeats, no unique boulder, no stacked shelves, no horizontal strata, no ladder ledges, no columns. Colour is medium dusk blue-grey, sRGB 139 159 179, Lab lightness 64, darker than pale packed snow, not paper grey, not white, not dark slate, not charcoal, not orange. Flat huge softbox, top equals bottom, no vertical gradient, no gloss, no chrome, no wet shine. Must tile in a 4 by 4 grid with no visible repeating shape or band. Half a metre of ice face.
- **Ref images used:** none (text prompt only).
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `81124fac7fdc59a9f9bddd7fdb3a92cced8bcbb54bce1d49fdfbfe2db9e4b4f7`
- **Column score:** 2.238 at heading 90°, offset (0, 0); 12/78 over 1.5. Second-best serac offline peak.
- **CIE76 vs serac mean:** 8.005 (pass). Vs serac v1: 3.644 (closest of the four to v1). Vs snow v4: 17.131. Mean Lab L=56.414 a=−3.579 b=−12.696. Mean sRGB 116, 139, 157. The duskier, darker member of the set.
- **Low-freq:** inner rowSwing 12.63, colSwing 7.66. Seam ratios 1.71 / 1.78.
- **Eye, 4×4:** Even rough grain, no tile grid, no shelves, no columns. Mild diagonal grain, like the soft passes in snow-v2-2/3, without the old seracs’ horizontal strata.
- **Verdict:** PASS, with a soft on grain direction

## Imagine calls

**29 calls** that wrote pixels in all: 12 + 2 shoulder, and 11 + 4 serac. The first delivery used 23. After an eye review failed shoulder-ice-3 (blotch grid) and range-serac-2 (flat, faint bands, no broken form), a replacement round used **6 more calls** (2 shoulder, 4 serac; cap was 4 per replacement). No failed empty calls. Nothing was deleted; the two eye-fails were moved to `rejects/replaced/`.

### shoulder-ice (12)

| call | id | result |
| --- | --- | --- |
| 1 | shoulder-ice-gen-01 | FAIL. 4×4 shows repeating horizontal bands (top-to-bottom gradient). CIE76 vs wall v1 10.577 would have been tight. |
| 2 | shoulder-ice-gen-02 | FAIL. 4×4 was even, but CIE76 vs wall v1 11.543 (too pale / less blue) and offline worst 5.961 (above the 5.391 bar). |
| 3 | shoulder-ice-gen-03 | FAIL. Colour would have passed (8.487), but 4×4 shows a repeating blotch grid. |
| 4 | shoulder-ice-gen-04 | PASS → shoulder-ice-3 |
| 5 | shoulder-ice-gen-05 | FAIL. Saturated electric blue (CIE76 25.6) and strong horizontal bands. |
| 6 | shoulder-ice-gen-06 | PASS → shoulder-ice-0 |
| 7 | shoulder-ice-gen-07 | FAIL. Colour would have passed (7.187), but a vertical slope (top−bottom ~2.8 luma) bands in 4×4. Offset wrap made a mid-tile grid and was not used. |
| 8 | shoulder-ice-gen-08 | PASS → shoulder-ice-1 |
| 9 | shoulder-ice-gen-09 | FAIL. Same banding family as gen-07 (slope-span −5.66). |
| 10 | shoulder-ice-gen-10 | FAIL. Colour would have passed (6.881), but 4×4 shows a repeating cloudy mottling. |
| 11 | shoulder-ice-gen-11 | FAIL. Texture density fades from top to bottom and bands in 4×4. Colour would have passed (5.202). |
| 12 | shoulder-ice-gen-12 | PASS → shoulder-ice-2 |

### range-serac (11)

| call | id | result |
| --- | --- | --- |
| 1 | range-serac-gen-01 | FAIL. Too dark (CIE76 vs serac mean 19.3) and reads as cobbles / dirt, not ice. |
| 2 | range-serac-gen-02 | FAIL. Too dark (20.7) and reads as crushed stone. |
| 3 | range-serac-gen-03 | FAIL. Colour was excellent (3.736), but large unique ice blocks wallpaper in 4×4. |
| 4 | range-serac-gen-04 | FAIL. Colour passed (4.888), but large chalky blocks form an obvious 4×4 grid. |
| 5 | range-serac-gen-05 | PASS → range-serac-3 |
| 6 | range-serac-gen-06 | PASS → range-serac-0 |
| 7 | range-serac-gen-07 | PASS → range-serac-1 |
| 8 | range-serac-gen-08 | FAIL for this pack. 4×4 is even and offline 3.038 is under the bar, but CIE76 vs serac mean is 10.604 (just over 10). Vs serac v1 it would have been 7.897. Left in `raw/` and `rejects/`. |
| 9 | range-serac-gen-09 | FAIL. Colour passed (4.130), but 4×4 shows a repeating rougher-top texture band. |
| 10 | range-serac-gen-10 | FAIL. Colour passed (6.233), but first-vs-last luma 5.35 and a mild horizontal texture change in 4×4. |
| 11 | range-serac-gen-11 | PASS → range-serac-2 |

Raw Imagine JPEGs live under `raw/`. Rejects are also copied under `rejects/`. Check scripts are in `tools/` (same family as snow-v2). Precheck JSON is in `logs/`.

### Replacement round (eye review)

Director / Texture eye review rejected two stills whose numbers had passed. Failed deliverables were moved, not deleted, to `rejects/replaced/`.

| old deliverable | raw | why it failed by eye | moved to |
| --- | --- | --- | --- |
| shoulder-ice-3 | shoulder-ice-gen-04 | 4×4 blotches repeat as a visible tile-cell grid | `rejects/replaced/shoulder-ice-3-gen-04-FAILED.png` |
| range-serac-2 | range-serac-gen-11 | almost flat, faint horizontal bands, no broken serac form | `rejects/replaced/range-serac-2-gen-11-FAILED.png` |

Replacement calls:

| call | id | set | result |
| --- | --- | --- | --- |
| 24 | shoulder-ice-gen-13 | shoulder | FAIL. Visible white crackle and CIE76 7.317 would have passed, but first-vs-last luma 6.96 (slope-span −2.69) is the banding family. Left in `raw/` and `rejects/`. |
| 25 | shoulder-ice-gen-14 | shoulder | PASS → new shoulder-ice-3 |
| 26 | range-serac-gen-12 | serac | FAIL. Relief was the right family, but too dark (CIE76 vs serac mean 13.016) and 4×4 shows strong horizontal bands (slope-span 10.4). |
| 27 | range-serac-gen-13 | serac | FAIL. Much too dark (CIE76 18.386) and 4×4 bands. |
| 28 | range-serac-gen-14 | serac | PASS → new range-serac-2 |
| 29 | range-serac-gen-15 | serac | FAIL for this pack. Colour was close (4.550) and relief was right, but offline worst **4.261** is above the serac bar (3.683), and first-vs-last luma 6.36 is weaker than gen-14. Left in `raw/` and `rejects/`. |

## Notes for the next engine tip


- These files are review stills only. They are not installed in the PR tree.
- After a Core tip that points `wallTex` at the shoulder-ice set and `seracTex` at the range-serac set, the official `test-still-columns.mjs` chase (limit 1.5) still has to be run. The offline scores above are not a substitute. Snow-v2 showed that a still with offline worst 3.175 can still pass the chase near 1.3; these new stills are all under 2.9 offline.
- Ice was kept matte; no chrome. shoulder-ice-3 has fine white flecks that should be read as frost, not a polish.
- Large “broken serac” blocks were tried and rejected: they repeat as columns of the same chunk. The delivered seracs use fine-scale broken relief so a 0.5 m tile does not print a landmark.
- Disk after this work: about 15 GB free (floor was 5 GB).
