# Run 33 — cascaded sun shadows, round 7

Not a KEEP. Not live. Not merged. Exposure was not changed. The compare fix, the 24 MiB atlas, the 34° sun, the 16–32 m band, and the shared ~20 cm filter stay.

## 1. What the extra GPU shadows are

For every snow vertex the picture shades and the reference does not, a ray was cast toward the sun `[0.6161, 0.5592, 0.5547]` against every triangle, including the snow sheet. The origin sits 4 cm along the normal so the surface under the vertex is not the hit. The same ray hits all 80 checked vertices that the reference already calls occluded, so the caster walk is not blind.

| class | 11.70 s | 24 s |
| --- | --- | --- |
| GPU shadow, reference lit | 557 | 170 |
| (a) ray hits snow or a drift | 73 | 25 |
| (b) ray hits nothing | 472 | 132 |
| (c) ray hits a wall, icicle, or chunk | 12 | 13 |

(b) dominates. These points have a clear line to the sun. Adding the snow sheet to the reference would not explain them. A world-unit slope bias with the normal offset cut from 3.5 cm to a quarter of a near texel was tried on 11.70 s: the GPU-shadowed count stayed 1750 against 1752. It was reverted. At one of the clear points the shadow texel is closer than the receiver (stored 0.769, receiver 0.886) even though no triangle contains that light-space coordinate. That is a filled depth texel, not a missing snow caster. The 0.80 bar was not moved. Round 2 coverage is still 0.999–1.000. The round 3 blocky stills still fail IoU and the 5.567 s seam is still 0.086.

Current IoU, full caster set: 0.818, 0.894, 0.800, **0.664**, **0.773**, 0.824.

## 2. Vertex shadow factor

The screen test reads the shadow image at a reprojected pixel. The new metric runs the same shadow function at each world-fixed snow vertex, one point per vertex, with the two cameras 4 mm apart.

| build | edge vertices | flips | fraction | max change |
| --- | --- | --- | --- | --- |
| snapped | 1959 | 0 | 0 | 0 |
| unsnapped | 2018 | 59 | 0.0292 | 1 |

The bar is still 0.5%. The unsnapped build fails it. The snapped build passes it. The screen metric is unchanged beside it: 1.78% of edge pixels, 3.44% of reprojected vertices. `vert-shimmer.json`.

## 3. The 5.567 s pair

At a pixel on the far side of the 16–32 m band, the near cascade and the far cascade do not agree. One sample there is the near map reporting lit (1.00) and the far map reporting shadow (0.00). The two maps are not reading the same occlusion. The band was not widened.

| t | seam |
| --- | --- |
| 5.10 | 0.037 |
| 5.567 | 0.056 |
| 7.9 | 6 pairs |
| 11.70 | 0.056 |
| 24 | 0.012 |
| 30 | 0.051 |

## Coverage and perf

34° sun, all six inside the band: 0.832, 0.246, 0.573, 0.798, 0.378, 0.774. Keyscore 91.0. Snow p50 is still about 0.002 under the floor. SwiftShader at 540×960: 11.8 s/frame, 11 draws.
