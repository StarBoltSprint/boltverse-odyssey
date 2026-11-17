# Run 33 round 3 — dark row and the open lat

Not a KEEP. Not live. Not merged. Draft stays draft.

## Root cause of the dark row

The round-2 t=30 crease is one pixel at screen row 548, left edge. The mat buffer there is horizon (mat 8, sun dot 0) between a lit wall above and lit snow below. Those pixels are the short side fins: a constant-z face aimed at the camera, so it faces away from the sun (sun z is negative). Mean dip of that run is 39.7 at the gate threshold. It is not a sky row and not a post blur.

`dark-row-gate.mjs` scans y 0.30H–0.55H. A 1–3 px band fails when every row in the band is more than 32 luma below both neighbours, in a run of at least 8 (one-pixel gaps count). X=32 is that t=30 run. The round-2 still is `fixture-r2-t30.jpg` and it fails. The six new stills and all 41 chase frames pass.

## What closed the row

The fins are gone. Ice cliffs sit just outside the reachable lat (inner edge `corridorHalf + 3`), from z=-240 to z=-1360, 6 m cells so a near face is not a sheet. One massif spans x=-2400..2400 at z=-4660, past the course end (`z1` = -4500). Both use the horizon material: serac plus crust, hex triplanar, mip bias 1. Nothing is fog, a sky mix, or a distance colour.

Walls that pinch into the lat are slid out, so a level look down the run reaches the massif. The wall foot that was a sloped unlit lip is retagged as snow and lit with an up normal; long edges are split so it is not a cap. The cliff faces the camera and therefore faces away from the sun. Its shade normal takes part of the sun direction, so the edge is ice rather than a black seam. The horizon gate still reads the geometric normal.

## Gates

| Check | Round 2 | Round 3 | Bar |
| --- | --- | --- | --- |
| corridor hits | 0 | 0 | 0 |
| horizon_closed mcam 0 / 0.9 / 1.57 | 0.8866 / 1 / 1 | 0.9848 / 1 / 1 | ≥ 0.98 |
| graze at mcam 0 | 0.0097 | 0 | (counts 0) |
| right shoulder drop | 0.104 m | 0.104 m | ≤ 0.40 m |
| near sheets / caps | 0 / 0 | 0 / 0 | 0 |
| CPU triangles | 194290 | 196051 | ≤ 197000 |
| page triangles | 194922 | 196682 | |
| draws | 9 | 9 | ≤ 12 |
| texel | PASS | PASS | 2048 px/m, stretch ≤ 1.3 |
| dark-row, new stills and chase | t=30 fails | all pass; fixture fails | X = 32 |
| Bolt centre / card | x=360, 1.15 m | x=360.00, 1.15 m | unchanged |

`chase.mp4` is 720×1280, 41 frames, 8.2 s, 5 fps, t=22 s through t=30 s. Bolt mean x is 360.00.

## Tonemap — still FAIL, not tuned

Exposure, AgX, and the spec cap were not touched. PR 239 round 4 owns the grade. Against the same gamma key (`run32-hdr/before`):

| Check | Round 3 | Limit |
| --- | --- | --- |
| 11.70 s snow p50 vs the crust still | 0.6574 vs 0.7082, delta 0.0508 | 0.05 |
| 24 s frame p99 | delta 0.0671 | 0.05 |
| 30 s grey_bright | 0.1298 | < 0.15 |
| 24 s grey_bright | 0.1429 | < 0.15 |

The 11.70 s snow miss is about 0.001, the same miss as round 2. The 24 s p99 miss grew from 0.0507 to 0.0671: the ice now fills pixels that were brighter in the key. That is not a grade change. Keyscore 94.65 (floor 85.84). CIE76 snow 3.47–5.47, ice 5.86–7.06, all under 10. Clip and crush 0. No KEEP.
