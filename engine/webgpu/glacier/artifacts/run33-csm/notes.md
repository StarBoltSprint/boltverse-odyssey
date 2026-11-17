# Run 33 — cascaded sun shadows, round 10

Not a KEEP. Not merged. Exposure was not changed. The sun, the 16–32 m band, and the ~20 cm filter stay. The 0.1 mm walk is its own commit so it can be folded on its own.

The picture seam finds two snow pixels up to 16 px apart whose cascade weights are on opposite sides of the blend, then averages the beauty luma. That number mixes albedo, lighting, and texture with the shadow. It is still reported. It is not the bar.

The bar is the mean |near − far| shadow factor, same sampler on both cascades, for every snow vertex whose ground distance is inside 16–32 m and which still sits in the near map. The floor stays 0.03.

| time | factor mean | factor max | fraction over 0.1 | n | picture seam |
| --- | --- | --- | --- | --- | --- |
| 5.10 | 0.012 | 0.548 | 0.047 | 5051 | 0.035 |
| 5.567 | 0.009 | 0.484 | 0.035 | 4681 | 0.053 |
| 7.9 | 0.007 | 0.440 | 0.024 | 3189 | no pair |
| 11.70 | 0.006 | 0.450 | 0.027 | 1850 | 0.057 |
| 24 | 0.010 | 0.390 | 0.039 | 1400 | 0.017 |
| 30 | 0.010 | 0.390 | 0.039 | 1347 | 0.051 |

Every time is under 0.03. No bias change and no wider band. The round 3 kernel (point load, near kernel stepped on a 2048×1024 grid, one far tap, unequal bias) is over 0.03 on all six: 0.039, 0.037, 0.030, 0.040, 0.039, 0.033. A far bias raised by 0.01 in depth is 0.044 at 5.567 s and 0.062 at 11.70 s. Vertex IoU, snapped shimmer, and coverage are unchanged from round 9. The stills are the round 9 capture.

# Run 33 — cascaded sun shadows, round 9

Not a KEEP. Not merged. Exposure was not changed. The 34° sun, the 16–32 m band, and the ~20 cm filter stay.

The picture mask is the shadow factor of whatever fragment won the pixel. The IoU reference tests the snow vertex. Those are not the same sample. At 11.70 s, ten vertices whose picture reads 0 have a shader factor of 1: the centre texel is empty (stored 1) on both cascades, the four taps are stored 1, and the less-equal compare is lit. The depth clear is 1. A cleared texel compares lit. Every logged vertex is inside its tile, so the out-of-tile path (return lit) is not what shaded them. The cascade the shader uses is the near map while the extent is under 0.995, and the far map only once a vertex falls out of the near square. Round 8 read the follow camera and the cascade with the smallest stored depth, which is not the cascade this shader samples.

The other half of the contradiction was the mesh. Node and Chrome each walked the wall and the ground by feeding the next z into the hash. One ulp and the walks split: Chrome had 4,475,616 floats, Node had 4,471,200, and primitive 147663 was a different wall triangle. The GPU wrote that triangle's depth where Node's raster had no caster. Both walks now round every step to 0.1 mm. Both engines then build 4,458,336 floats and the same primitive positions. The IoU reference is that mesh. The GPU bit is the vertex shadow factor, the same function as the vertex shimmer probe. A 1 px point was missing its pixel and the clear (0) was being read as a full shadow, so the probe now covers each pixel with a triangle.

| time | vertex IoU | seam | path shadow |
| --- | --- | --- | --- |
| 5.10 | 0.992 | 0.035 | 0.834 |
| 5.567 | 0.982 | 0.053 | 0.249 |
| 7.9 | 0.988 | no pair inside 16 px | 0.579 |
| 11.70 | 0.983 | 0.057 | 0.630 |
| 24 | 0.979 | 0.017 | 0.214 |
| 30 | 0.993 | 0.051 | 0.767 |

The 0.80 bar is unchanged and every time clears it. The seam floor is unchanged. Five times are still over 0.03, and 7.9 s has no snow pair with one cascade weight under 0.15 and another over 0.85 inside 16 px. The band was not widened. Coverage stays inside 0.15–0.85. Round 2 coverage is still 0.999–1.000. The round 3 blocky stills, scored on their frozen masks, still fail IoU, and their 5.567 s seam is still 0.086.

Snapped vertex shimmer is 0 (max delta 0.0039). Unsnapped is 0.0323 and still fails the 0.5% bar. The screen metric is 1.75% of edge pixels. Keyscore is 91.0. Snow p50 is still about 0.052 under the key 0.708 on four times. Exposure was not moved. SwiftShader at 540×960 is 14.1 s/frame, 9 colour draws and 2 shadow draws, 195,098 triangles. The chase is 720×1280, 30 fps, 2.0 s.

# Run 33 — cascaded sun shadows, round 8

The shadow pass can write a caster id (draw and primitive) next to the depth. At the class-(b) vertices the centre texel is usually empty. Where it is written, the writer is the world mesh.

| draw at the centre texel | 11.70 s (472) | 24 s (132) |
| --- | --- | --- |
| nothing written | 457 | 113 |
| world mat 6 (canyon wall) | 15 | 18 |
| world mat 1 | 0 | 1 |
| Bolt card | 0 | 0 |
| icicle, chunk, drift, flakes | 0 | 0 |
| other cascade's tile | 0 | 0 |

Of the empty centres, a wall, an icicle, or a drift sits within two texels for 62 of 457 at 11.70 s and 34 of 113 at 24 s. The rest have no writer that close. The 5.567 s seam pixel is empty on both cascades. No draw was removed. IoU, seams, and coverage are unchanged from round 7. The vertex shimmer gate is still 0 snapped and 0.0292 unsnapped. Round 2 coverage is still 0.999–1.000. The round 3 blocky stills still fail.

# Round 7


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
