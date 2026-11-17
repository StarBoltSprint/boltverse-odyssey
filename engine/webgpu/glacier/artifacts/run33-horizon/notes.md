# Run 33 — horizon ring, shoulder, slabs

Not a KEEP. Not live. Not merged. Draft PR only.

## After the fix

The eye-level row at the t=30 chase eye is closed by a world-fixed slope, material `horizon` (id 8). That material is outside the LOD dither, samples serac and crust/snow with hex triplanar at mip bias 1, and uses the existing aniso-16 sampler. No new plate. `horizon_plate_missing` was not raised.

| Check | Before | After | Bar |
| --- | --- | --- | --- |
| horizon_closed mcam 0 / 0.9 / 1.57 | 0.926 / 1 / 1 | 0.9986 / 1 / 1 | ≥ 0.98 |
| right shoulder drop | 2.862 m | 0.104 m | ≤ 0.40 m |
| near vertical snow/horizon sheets | 1167 | 0 | 0 |
| near flat caps | 366 | 0 | 0 |
| CPU triangles | 195634 | 199266 | ≤ 200000 |
| page triangles | 195818 | 199898 | ≤ 200000 |
| draws | 9 | 9 | ≤ 12 |
| texel | PASS 2048 | PASS, stretch 1.28 | 2048, stretch ≤ 1.3 |
| Bolt x | 360 | 360 | centred |
| card | 1.15 m | 1.15 m | unchanged |

The page count sits 632 above the CPU count. Both are under 200000. The ground step loop uses `Math.sin`, and the browser and Node do not take the same number of rows.

`chase.mp4` is 720×1280, 8 s, 5 fps, 40 frames, from t=22 s to t=30 s. Stills are in `after/`. Tags match PR #239: 51, 5567, 79, 117, 24, 30.

## Tonemap — FAIL, limits not moved

`tonemap-gate.json`. Keyscore 94.14, floor 85.84. CIE76 snow 3.47–5.47, ice 6.39–8.24, all under 10. Clip and crush 0.

Three checks miss, each by a few thousandths:

| Check | Result | Limit |
| --- | --- | --- |
| 11.70 s snow p50 vs the crust still | 0.657 vs 0.708, delta 0.051 | 0.05 |
| 24 s frame p99 vs the gamma key | delta 0.0526 | 0.05 |
| 30 s grey_bright | 0.154 | < 0.15 |

The grade, exposure, and ice spec cap were not touched. Filling the right-hand ditch moved the snow median at 11.70 s by about 0.004. The berm that closes the horizon covers some of the bright sky tail at 24 s and shifts which ice faces are in the 30 s frame.

## Still open

The berms at z=-340 and z=-560 cross the canyon. They are what the eye-level ray hits, so the old one-pixel crest is gone in the t=30 chase, and the replacement is a wide slope rather than a broken skyline. A run that reaches those z values meets the slope. Wall ice is still sampled at mip bias 4, so the near spires can still read soft. The lane snow in the foreground is still the existing snow fetch. No KEEP.
