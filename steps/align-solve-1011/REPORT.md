# Align-solve — 11 Oct

Both jobs **FAIL** the blocking pass. The shared tools are in `tools/common/align/` and their selftest passes. No new Imagine call. Vision cost **0**. Dataset `dataset/i23d` was not exported.

The object gate reads `overlap` from `checks/relief_align.overlap`. That value is `alignment` in `tools/common/align/metrics.py`: the minimum of Canny edge precision and recall at 2 px. The bar stays 0.70 and the row stays blocking.

## Facade

| View | Before (fusion-fix5 round 2, dense jpg) | Camera only (stride 12) | After 3× CMA-ES (stride 12) |
| --- | --- | --- | --- |
| key | 0.3342 | 0.8242 | 0.7333 |
| hero | 0.3727 | 0.8820 | 0.7746 |
| 30 m | 0.3635 | 0.9524 | 0.7749 |
| 8 m | 0.0 (empty) | 0.6894 | 0.7067 |
| side | 0.0 (empty) | 0.9557 | 0.8198 |

Solved camera on the facade key: FOV **117.0°**, pitch **−30.4°**, roll **0°**, yaw **−74.4°**, height **none** (no ground depth was passed). 1320 lines, 3 vanishing points. Overlay: `facade/vp-overlay.jpg`.

8 m and side now contain the tower (4643 and 2127 pixels at 360×202). A ~120 m radius does not fit at 8 m, so that view is the closest full-tower frame, about **126 m**. Key / hero / 30 m / side distances are about 88–95 m.

CMA-ES: 3 rounds, 48 trials, seeds 0–2, about 10 s a round. Best move was yaw −11.8°, scale 1.05, relief scale 0.51, texture shift (−5.8, +17.5) px. Search did not raise the key score over the camera-only frame.

Relief axes on the posed mesh: **−z 2.08 m**, **+x / −x / +z = 0**. Nothing was invented on the other axes. Local base is seated at Y = 0. The old **74 m** float is the staged world instance and was not remeasured in the browser. gate5 was not re-run. Phone budget is the fusion-fix5 mesh: 264684 tris, texMB 9.38, previously passed. A tight key crop (FOV 42°, stride 6) scores alignment **0.727**.

Verdict **FAIL**: relief is still one axis, the browser grounding row and gate5 were not re-shot, and the 8 m camera-only frame is 0.689.

Sheets: `sheet-16x9.jpg`, `sheet-phone.jpg` (portrait raster beside `key-city3`).

## Placement

| Lever | Placed IoU (tower / spire / mesa) |
| --- | --- |
| Before, framebuffer, placement-key2 round 1 | 0.3763 |
| Camera only, software boxes | 0.0281 |
| After 3× CMA-ES, software boxes | 0.4516 |
| After search, staging framebuffer 1280×720 | 0.2859 |

The city solve found 1314 lines and 3 vanishing points, then rejected the focal length and fell back to FOV **40°**, pitch **0°**, roll **0°**, eye **0.63 m**. World yaw stayed 78°. Overlay: `placement/vp-overlay.jpg`. That fallback is why the camera-only boxes miss the masks.

CMA-ES: 912 trials, 3 rounds, under 1 s of search after the 4.8 s solve. Software inversions after search: **10**. The staging shot on `127.0.0.1:8997` scored **0.2859**, below the kept 0.3763, with sky still in the top of the frame (skyTop 0.41). Staging layout and mesa params were put back to the placed-r1 seats after that shot. The live tree was not written. Wreck and arch stay TODO.

Verdict **FAIL**. Sheet: `placement-sheet-phone.jpg`.

## Cost

| Stage | Seconds |
| --- | --- |
| Facade camera + 3 search rounds + final raster | about 45 (run) + 19 (fine rescore) |
| Placement camera + search + two staging shots | 46 |
| Vision USD | 0 |

## Stop

Three search rounds per job. No fourth fusion mesh. No fourth placement search. The next gain is a city vanishing-point solve that does not fall back, and relief under the painted features on more than one axis. Neither is another loop of this search.
