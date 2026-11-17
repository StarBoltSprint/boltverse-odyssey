# Run 33 — cascaded sun shadows, round 3

Not a KEEP. Not live. Not merged. The pictures are for the director and the critic.

## Sun

Round 2 left the path inside the wall shadow. The sun was `[0.72, 0.28, -0.63]`, about 16° up and 49° off the run axis, firing across the canyon.

The angle was chosen by the coverage rule in `sun-criterion.json`, not by IoU or the tone map. A sun still ahead of the runner (azimuth 1°) kept the rendered path in shadow, because the spires throw their shadows back over the follow view. The comparison sampler was also painting empty shadow texels as umbra; the depth texel is the test now. The near plane of each cascade sits 240 m sun-ward of the sphere so a spire top is not clipped into a triangle that covers the map.

The chosen sun is behind the runner and 48° toward +X, at 28° elevation:

`[0.6561, 0.4695, 0.5910]`

Peach colour stays `[0.85, 0.58, 0.42]`. Exposure stays 0.32. Intensity is 0.90 so lit snow does not blow past the still key.

## Coverage gate

`coverage-limits.json`, written before this sun trial. On-screen path snow in the 720×1280 follow frame (flat snow below the spire line, Bolt card excluded) must be in shadow on at least 15% of its pixels and on less than 85%. Round 2 is the fixture and it fails (every time is 0.999–1.000).

This sun:

| t | path in shadow |
| --- | --- |
| 5.10 | 0.833 |
| 5.567 | 0.260 |
| 7.9 | 0.584 |
| 11.70 | 0.842 |
| 24 | 0.399 |
| 30 | 0.768 |

`coverage-gate.json` PASS.

## What the stills show

The path is no longer one lavender field. Lit snow sits next to blue cast bands. At 24 s the ridge keeps a lit face and a shaded face, as in `csmoff`. The contact darkens the snow under Bolt on the lit path. Shadow edges are blocky, in rectangles the size of the near shadow texel, especially in front of the dog and at 5.567 s.

## Gates that pass

- Coverage, as above. Round 2 fixture fails.
- Keyscore 91.36 (floor 85.84).
- Frame luma p1/p50/p99 within 0.05 of the run-31 gamma key. Clip 0. Grey-bright 0.09–0.12. Ice b−r about 0.11.
- Snow b−r, sun-facing, 0.079–0.091 (floor 0.03).
- Cross-camera CIE76 0.00.
- Texel gate PASS at 2048 px/m.
- Colour draws 9, shadow draws 2, total 11. Unique triangles 195634.
- Exposure 0.32.

## Gates that fail

Not lowered.

| check | result | limit |
| --- | --- | --- |
| csm_iou | 0.791, 0.828, 0.745, 0.697, 0.767, 0.812 | ≥ 0.80 |
| cascade seam | 0.032, **0.086**, 0.011, 0.049, 0.033, 0.045 | ≤ 0.03 |
| edge shimmer | 4.2% of edge pixels; 3.9% of snow vertices | ≤ 0.5% |
| snow p50 | 0.656 on 5.10, 7.9, 11.70, and 30 s; 0.711 at 24 s; 0.758 at 5.567 s | within 0.05 of 0.708 |

The 5.567 s seam is the blocky transition between the cascades. The shimmer count is high because the path now has many shadow edges, and a 4 mm camera move shifts those edges on screen. IoU is the GPU mask against the CPU light-space raster; they disagree by a few hundred snow samples on most frames.

## Perf

SwiftShader at 540×960: 13.2 s/frame, 0.076 fps. Not a phone.

## Remaining

- Shadow edges are rectangular. The near cascade is 4.5 cm texels, and at a grazing view those texels read as blocks.
- Seam, shimmer, and IoU miss the floors above.
- Shaded-snow p50 is 0.656 against a floor of 0.658 on four of the six times.
- `csm=high` was not the trial.
