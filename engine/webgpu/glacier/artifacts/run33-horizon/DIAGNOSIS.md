# Run 33 — horizon, right drop, grey slabs

Diagnosis only. No mesh change in this commit. Not a KEEP. The numbers are from the run 32 stills (PR #239, gamma key in `before/`, AgX in `after/`) and from a CPU raster of the same world the page draws.

`node horizon-gate.mjs` on this commit exits FAIL. Limits below are the bar for the fix. They are not lowered.

## What the captures show

Same route as run 32. Speed 7, accel 9, third-person follow. 720×1280.

The thin dark row is real, and it is not the sky pass. On `run31/frames/t30.jpg` and `run32-hdr/before/t30.jpg`, screen row 512 is the only row with a long run of pixels darker than both vertical neighbours (133 px and 124 px, x about 2–518). AgX in `after/t30.jpg` leaves 58 of those pixels. Other times move the row (t=24 sits near y=427–435). It is world geometry, not a fixed post line.

The mat buffer (`before/t30-mat.png`, material id in R, untonemapped) at that row is wall (mat 6) and fall (mat 1), with black only where a later read is the clear colour. The sky shader in mat mode is cyan `(175, 255, 255)`. The row is not sky.

A level look from the t=30 eye `(-7.88, 1.55, -203.61)` puts the geometric horizon on screen row 640. Raster of the world draw:

| mcam yaw | closed | sky | grazing edge | front materials |
| --- | --- | --- | --- | --- |
| 0 | 0.9257 | 0 | 0.0167 | wall, fall, snow |
| 0.9 | 1 | 0 | 0 | wall, fall, all nearer than 25 m |
| 1.57 | 1 | 0 | 0 | wall, about 22 m |

Closed means the pixel survives the existing LOD dither. Fall and arch (`0.5 < m < 2.5`) and wall and mountain (`5.5 < m < 7.5`) discard with `cover = smoothstep(460, 160, dist)`. Snow does not. At yaw 0 the p90 hit is 318 m, so those wall and fall pixels are expected holes. The snow hits are the three `addHorizonRidge` sheets (z = -520, -980, -1700, 18 m thick, `MAT.snow`). Their normals are horizontal, so the crest is a grazing edge (`|n·v| < 0.08`). Burying the foot does not move the crest. That is the line run 31 could not shift.

The right-hand drop is the ground sheet, not an empty draw. `floorH` cuts a crevasse on positive lat, which is camera-right for this route (`cr ≈ +X`). From z=-40 to z=-400 the ditch is 2.37–2.86 m below the lane, worst 2.862 m at z=-116, lat 5.5. It is in every chase frame because the crevasse runs the length of the route.

The flat grey slabs near the chase are snow triangles, world draw, `MAT.snow`:

- 1167 faces with `|ny| < 0.25` and an edge over 10 m. These are the horizon-ridge sheets. `sampleSnow` is planar xz, so a vertical face has no texture change down the face. The mip is one grey sample.
- 366 faces with `ny > 0.8` and an edge over 12 m, centroid z > -700. These are `addPlateau` and the coarse far ground. Edges on the plateau reach hundreds of metres (worst snow edge in the mesh is 922 m). One quad shades as one plane.

Serac ranges (`MAT.mountain`) cover 0 pixels of the t=24 and t=30 chase. They are not the slabs in these stills. Wall ice is a separate flat read (mip bias 4 in `albedoOf`) and stays on that path. This fix does not retint it.

No silhouette plate is required. `tex/serac/v1–v4.jpg`, `tex/snow/v1–v4.jpg`, and the crust set already on the snow array (`tex/snow-v2` plus `tex/crust/v4.jpg`) are the Imagine tiles. They are native 1024. `horizon_plate_missing` is not raised. The 1280×720 plates stay unused.

## Pass / fail

`engine/webgpu/glacier/horizon-gate.mjs`

| Check | Now | Pass |
| --- | --- | --- |
| horizon_closed at mcam 0, 0.9, 1.57 | 0.9257, 1, 1 | each ≥ 0.98 |
| right shoulder drop, z=-40…-400, lat 2…12 | 2.862 m | ≤ 0.40 m |
| near vertical snow sheets (z > -700, edge > 10 m, \|ny\| < 0.25) | 1167 | 0 |
| near flat snow caps (z > -700, edge > 12 m, ny > 0.8) | 366 | 0 |

horizon_closed is measured on the eye-level row at the t=30 chase eye, look yaw = mcam, target at eye height. A sky pixel counts 0. A grazing face (`|n·v| < 0.08`) counts 0. A dithered material counts `smoothstep(460, 160, dist)`. Snow counts 1. Phone tris stay ≤ 200000 and draws ≤ 12. Texel floor stays 2048 px/m. Tonemap limits stay as in `tonemap-limits.json`.
