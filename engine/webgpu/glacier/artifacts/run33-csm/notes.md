# Run 33 — cascaded sun shadows, round 6

Not a KEEP. Not live. Not merged. Exposure was not changed. The less-equal compare, the four hardware taps, the tile clamp, and the 24 MiB atlas stay.

## Reference

The GPU shadow pass draws every non-snow triangle plus baked icicles, chunks, and drifts. Snow is the receiver. Bolt's animated card is a separate draw and is not in the raster. The reference now rasterizes that same set, in the same light projection, with the same 0.008 depth bias. The GPU side is still shadowed below 0.5. The bar stays 0.80.

Every non-snow world material was already in the old spire set. The baked props add 2,058 triangles and do not change the occlusion of the sampled snow. Side by side:

| t | full set | spire only |
| --- | --- | --- |
| 5.10 | 0.818 | 0.819 |
| 5.567 | 0.894 | 0.895 |
| 7.9 | 0.800 | 0.800 |
| 11.70 | 0.664 | 0.663 |
| 24 | 0.773 | 0.773 |
| 30 | 0.824 | 0.824 |

11.70 s and 24 s stay under 0.80. The GPU still shadows more vertices there than either raster. That gap is not a mesh the reference was skipping.

Round 2 coverage, re-scored, is still 0.999–1.000. The round 3 blocky stills, re-scored with this reference, still fail: IoU 0.693–0.839 and the 5.567 s seam is 0.086.

## Shimmer

Radii stay 23.75 m and 102.81 m. The map contributes 0 flips. The blend weight, `smoothstep(16, 32, distance to the camera)`, changes by 0.00009. No flip is in that band.

The test does not move the terrain, the runner, or a streaming origin. It reprojects each world-fixed snow vertex with the camera 4 mm away and reads the shadow image at the new pixel. Those vertices move 0.18 px on screen. A vertex sitting on a shadow edge picks up the neighbouring pixel, and the factor changes by more than 0.1. That is the whole of the 3.4% world figure (132 of 3,834). The screen edge figure is 1.8%. The test was not redefined.

## Seams

The failing pairs sit on a horizontal line across the path, which is the 16–32 m distance band seen edge-on. At 5.567 s the worst pair is shadow factor 0.09 on the near side and 0.5 on the far side, 16 px apart. That is a cascade disagreement, not a second shadow. Both maps now use one world width, the far texel (about 20 cm), instead of 8 cm against 40 cm. A wider 10–46 m band removed the 16 px pairs at two times, which fails the sample count, so the band stayed 16–32 m.

| t | seam |
| --- | --- |
| 5.10 | 0.037 |
| 5.567 | 0.056 |
| 7.9 | 6 pairs |
| 11.70 | 0.056 |
| 24 | 0.012 |
| 30 | 0.051 |

Crops are in `seam-crops/`.

## Sun

Same azimuth, 132° from −Z, behind the runner. A fresh sim for each elevation, times in order, distinct masks:

| elevation | 5.10 | 5.567 | 7.9 | 11.70 | 24 | 30 |
| --- | --- | --- | --- | --- | --- | --- |
| 30° | 0.846 | 0.320 | 0.619 | 0.879 | 0.457 | 0.798 |
| 32° | 0.845 | 0.305 | 0.609 | 0.862 | 0.443 | 0.794 |
| 34° | 0.842 | 0.296 | 0.602 | 0.843 | 0.431 | 0.790 |

34° is inside on all six. Direction `[0.6161, 0.5592, 0.5547]`. The delivered stills match: 0.832, 0.246, 0.573, 0.798, 0.378, 0.774.

## Tone map and perf

Keyscore 91.0. Snow p50 is still about 0.002 under the floor on four times. Exposure was not touched. SwiftShader at 540×960: 11.8 s/frame, 0.085 fps, 11 draws. Not a phone.
