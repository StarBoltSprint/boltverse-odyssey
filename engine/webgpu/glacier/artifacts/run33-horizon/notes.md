# Run 33 round 4 — follow horizon

Not a KEEP. Not live. Not merged. Draft stays draft.

The level mcam row (y=640) is snow in the follow frame. Round 3 closed that row and left the peach sky open between the walls. The pictures are the gate now.

## Gates added first

`follow-horizon-gate.mjs`

- Sky window: ground-connected skyline, centre band, fraction of sky between the side rim and the centre closure. Fail above 0.12. Round-3 t=24 is 0.757, t=30 is 0.860. Both fail. The six new stills are 0.000–0.024.
- Crest stairs: axis-aligned plateaus of at least 8 px with a jump of at least 6, two in a row. Round-3 t=24 has 2 steps, t=30 has 6. Both fail. The new stills have 0 or 1.
- Dark-row (unchanged, X=32): `fixture-r2-t30.jpg` still fails. The six new stills pass. Chase: 40 of 41 frames pass. t=24.6 (`f_0013`) fails, run 9, mean dip 45.5.

The follow gate reads the mat buffer (`material 5` = sky). A colour-only chase frame is not that measurement. The six stills carry `-mat.png`.

## What changed

`keepWallsOut` is gone. That slide was what flattened the canyon into a snow lot. The walls and the right-hand ridge are the original mesh again.

The 6 m flat cliff cells are gone. They were the stair-steps and the beige card. The sun-facing shade normal is gone with them.

The gap down the run is a row of the same serac-range teeth as the existing ice (`addRange`), tagged wall so the corridor gate does not see them and the level row hits a face inside 160 m (dither cover 1). Crest is the range tooth, not a flat grid. A thin horizon massif sits past z=-4500. Horizon albedo is glacier-ice mixed with serac, snow only on a real cap. Exposure and AgX were not touched.

## Numbers

| Check | Round 3 | Round 4 | Bar |
| --- | --- | --- | --- |
| corridor hits | 0 | 0 | 0 |
| horizon_closed mcam 0 / 0.9 / 1.57 | 0.9848 / 1 / 1 | 1 / 1 / 1 | ≥ 0.98 |
| follow sky-window, six stills | t=24 0.757, t=30 0.860 | 0.000–0.024 | ≤ 0.12 |
| crest stairs, t=24 / t=30 | 2 / 6 | 0 / 0 | < 2 |
| CPU / page triangles | 196051 / 196682 | 196234 / 196866 | ≤ 197000 CPU |
| draws | 9 | 9 | ≤ 12 |
| texel | PASS | PASS | 2048 px/m |
| Bolt / card | x=360, 1.15 m | x=360.00, 1.15 m | unchanged |

`chase.mp4` is 720×1280, 41 frames, 8.2 s, 5 fps, t=22 s through t=30 s.

## Tonemap — FAIL, not tuned

| Check | Round 4 | Limit |
| --- | --- | --- |
| 11.70 s snow p50 | 0.6574 vs 0.7082, delta 0.0508 | 0.05 |
| 24 s frame p99 | delta 0.0680 | 0.05 |
| 30 s frame p99 | delta 0.0653 | 0.05 |
| grey_bright, six stills | 0.023–0.054 | < 0.15 |
| CIE76 ice | 12.86–13.42 | ≤ 10 |
| CIE76 snow | 3.47–5.47 | ≤ 10 |
| keyscore | 91.22 | ≥ 85.84 |

The snow p50 miss is the same 0.001 as round 2. Ice dE76 went from about 7 to about 13 because the new teeth fill the frame with lit wall ice. That is not an exposure change. Clip and crush stay 0.

## Still open

The 3× crops (`crops/t24-ice-3x.jpg`, `crops/t30-ice-3x.jpg`) still show the glacier-ice repeat on the large faces between the teeth. The tooth edges read as the existing wedges. The big facets do not. One chase frame (t=24.6) still has a 9 px dark run. No KEEP.
