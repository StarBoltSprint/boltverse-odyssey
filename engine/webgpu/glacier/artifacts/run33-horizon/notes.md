# Run 33 round 10

Not a KEEP. Not live. Not merged. Draft stays draft. Exposure and the grade were not touched.

Round 9 stays: no lattice bands, anisotropy 16, the grazing footprint, metal 0, no fog. The near tooth wall that had replaced the sky is gone.

## 1. Sky

The round-9 horizon was closed by a wall a few tens of metres out. That wall is removed. The canyon spires are the skyline again. Walls stay solid, so the level row is not a dither hole. `horizon-gate` is 0.993 / 1 / 1, corridor hits 0, sheets 0, caps 0.

The blocking gate is `skyline-key-gate.mjs`. The key is run 31, the six times in `run32-hdr/before`. Dawn-sky fraction at least 0.9 of the key, mean skyline row within 140 px, dark moon pixels in the top 360 rows at least 0.7 of the key. The round-9 fixture fails all six (sky fraction 0.08–0.20, moon 0).

| Time | Sky fraction vs key | Skyline row | Key row | Moon vs key |
| --- | --- | --- | --- | --- |
| 5.10 s | 0.387 | 73 | 114 | 0.617 |
| 5.567 s | 0.617 | 82 | 135 | 0.626 |
| 7.9 s | 0.879 | 83 | 144 | 0.619 |
| 11.70 s | 0.495 | 49 | 103 | 0.486 |
| 24 s | 0.946 | 89 | 156 | 0.879 |
| 30 s | 0.901 | 75 | 146 | 0.901 |

24 s and 30 s pass. The four earlier times have the dawn sky and the moon in the picture, and the spires fill more of the frame than the key, so the sky fraction stays under 0.9. That is a miss against the gate, not a claim that the sky is gone.

## 2. Ice structure

A 0.5 m tile at viewing distance puts a crack from the 1024 still under 4 px. The wall, spire, and horizon samples grow the tile with distance (`0.37 * dist` past 16 m) and stay at 0.5 m inside 6 m. The still is not enlarged. Texel gate PASS, glacier-ice stretch 1.28, 2048 px/m, four variants, stochastic blend.

`structure-gate.mjs`: the still's correlation length, projected by focal times tile over distance, must be at least 4 px, and the 3× crop's correlation length must sit within 2× of that. The round-9 graze crop fails (expected 0.2 px). The new wall crops at 68 m, tile 25.2 m, expected 5.0 px: t=24 crop 5.0 PASS, t=30 crop 8.0 PASS.

Mountains use the same glacier-ice sample. The blurred serac that the sun turned brown is gone.

## 3. Contact and the 24 s bank

A fan of ice runs from a tall right-hand crest down toward the lane, edges under 6 m. It does not reproduce the broad foreground snow wedge of run 31. That wedge is still missing. The hard stair and the cut-off block of the round-9 wall left with that wall.

## 4. Horizon step

Lossless PNGs. The bar stays 3.29. Do not read a pass into the four fails.

| Time | Step | Row | Bar 3.29 |
| --- | --- | --- | --- |
| 5.10 s | 4.140 | 552 | fail |
| 5.567 s | 3.353 | 533 | fail |
| 7.9 s | 5.068 | 506 | fail |
| 11.70 s | 3.520 | 538 | fail |
| 24 s | 2.281 | 492 | pass |
| 30 s | 1.928 | 505 | pass |

The 30 s line is under the bar once the near wall is gone. Four times are still over it.

## 5. Dark row

The round-2 fixture still fails (run 14, y=548). The 30 s chase is 60/60. The 24 s chase is 59/60: frame 29, t=24.967, y=460, run 9, mean dip 56.6. The 5.567 s still fails, y=532, thick 2, run 8, mean dip 47. The other five stills pass.

## Proof

Lossless PNGs are in `png/`. Chases are `chase-24s.mp4` and `chase-30s.mp4`: 720×1280, 60 frames, 2.000 s, 30 fps, CRF 16. Bolt mean x is 360.00 on both. Page tris 196812. Draws 9.

No KEEP.
