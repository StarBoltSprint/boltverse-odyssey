# Run 33 — cascaded sun shadows, round 13

Not a KEEP. Not merged. The sun, the exposure, the terrain, and the ambient were not changed. This round only changes what the gates sample.

Shade b* now requires snow's draw id, a shadow factor under 0.35, and mask blue under 0.03. Bolt is id 5, the contact decal is 6, a print is 7, and a flake is 8. Those are excluded by the id, not by the fur colour. The old luma window on the same stills is still +2.30 at 24 s and +2.49 at 5.567 s. The clean values are −12.67, −8.63, −12.67, −12.66, −9.02, −12.81. The two lit times have 36 and 7 clean pixels because that window is in sun. They are outside −4.4 to −3.2, so the gate fails until G lands.

The slab gate samples wall id inside the ice box and sky id inside the sky box. The old box means on these stills are 0.022 and 0.012. The new wall-minus-sky is 0.048 and 0.081. They disagree because the sky box holds 1884 lit-snow pixels at 24 s (luma 0.70) and 1688 at 30 s. True sky is luma 0.544 and 0.514. The wall is 0.590 and 0.595. The bar stays 0.8 of the key's +0.076 and +0.086. 24 s is 0.048 and fails. 30 s is 0.081 and passes. Laying our pixel mask on the key gives about 0, because the key's slab is not at these pixels. The key's own figures stay the bar.

| time | contact | slivers | far px | IoU | seam | path shadow | form | shade b* | slab |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 0.134 | 1 | 4 | 0.924 | 0.014 | 0.832 | | −12.67 fail | |
| 5.567 | 0.139 | 2 | 3 | 0.921 | 0.009 | 0.255 | | −8.63 fail | |
| 7.9 | 0.169 | 0 | 4 | 0.904 | 0.007 | 0.586 | | −12.67 fail | |
| 11.70 | 0.140 | 1 | 4 | 0.834 | 0.008 | 0.645 | | −12.66 fail | |
| 24 | 0.140 | 0 | 5 | 0.802 | 0.014 | 0.212 | ridge 0.036 fail | −9.02 fail | 0.048 fail (old box 0.022) |
| 30 | 0.132 | 4 | 4 | 0.860 | 0.011 | 0.763 | slope 0.032 fail | −12.81 fail | 0.081 pass (old box 0.012) |

Snapped vertex shimmer is 0. The screen shimmer is still 0.0054 and the world shimmer is still 0.034. Those bars were not moved. Triangle count is 195,098. The round-3 seam fixture still fails.

# Run 33 — cascaded sun shadows, round 12

Not a KEEP. Not merged. Exposure was not changed. The 34° sun stays. Terrain was not edited. Shading normals were not edited. The lost form is occlusion by the terrain, not the sun heading and not a smoothed crease.

The 24 s ridge crop is a narrow band, p10 0.614 to p90 0.652, step 0.036 against the key's 0.394. Mean shadow factor in the crop is 0.112 and 3% of the pixels are lit. Of the 243 sun-facing snow triangles in the box (N·L above 0.45), 4 have a clear ray to the sun. The others hit a wall or more snow: 51 walls beyond 8 m, 91 snow beyond 8 m, 76 walls at 2–8 m, 19 walls under 2 m. The sharpest pair in the box is 149° at the face and 136° at the shading normal, 3.95 m apart. One side is up-facing snow, face (0.074, 0.996, 0.040), shading normal (0.017, 0.999, 0.052), 3.3° between those two, N·L 0.597, shadow 0.176, ambient luma 0.375, AO 1, edge 2.1 m. The other side is a downward wall, face (−0.570, −0.822, 0.020), shading normal (−0.699, −0.711, −0.081), N·L 0, shadow 0, ambient luma 0.205, AO 1, edge 1.68 m. Picture luma on that pair is 0.687 and 0.652. G's SH L2 ambient on those same normals is 0.466 and 0.744. Both sides are already in shadow, so the extra ambient does not open the 0.315 step.

The 30 s slope is the left-box mean 0.727 against the right-box mean 0.695, step 0.032 against the key's 0.079. The left box's sharpest roll is 17° at the face and 3° after the up-axis smooth. That roll is not the missing step. The right box has a real crease: 113.6° at the face and 113.6° at the shading normal, so the normal was not smoothed. Sun-facing side (0.800, 0.590, −0.106), N·L 0.764, shadow 0.035, ambient luma 0.322, edge 2.95 m. Away side (−0.857, 0.503, 0.114), N·L 0, shadow 0, ambient luma 0.308, edge 2.79 m. Picture luma on the two sides is 0.660 and 0.655. Of 108 sun-facing triangles in the right box, 11 see the sun; 55 are blocked by a wall beyond 8 m and 30 by snow beyond 8 m. G's ambient on the two sides is 0.541 and 0.558. The crease is in the mesh and in the shading normal. The sun term is what the occlusion removes.

Normals come from stampFaceNormals, one geometric normal per triangle. shadeNormalsFor averages a snow vertex only when the faces stay upward (y above 0.45) and share a dominant axis. The 114° crease does not share an axis, and the shading normal equals the face normal. There is no normal map on the snow. The grain term is an albedo derivative, not a crease. This is a handoff to F (#243): the key's step needs the sun-facing side of these folds to see the sun, and the mesh occludes it. This branch does not edit that terrain.

Shade b* of +2.31 and +2.26 was the crop, not the snow. The lower-center window also contains Bolt, the contact decals, the prints, and the flakes. Those draws put a non-zero blue in the mask. Their b* is +3.7 to +4.5 at every time. At 5.567 s and 24 s the path snow is bright enough to leave the luma window, so the overlay becomes the median. Clean snow, shadow factor under 0.35 and mask blue under 0.03, is −12.70, −9.67, −12.67, −12.66, −9.66, −13.18. The same snow albedo graded with our sky dome is b* −13.55. Graded with G's SH L2 plus the snow bounce, same exposure, it is b* −4.28 (Lab 70.7, 2.4, −4.3), inside the key band −4.4 to −3.2 and lighter than the key's L* 59. Ambient was not changed. The periwinkle on the clean snow is G's.

The slab-to-sky gate is 0.022 and 0.012. The ice box contains no sky. At 24 s the wall in that box is luma 0.604 at shadow 0.29. The sky box's actual sky is luma 0.478, and the same box holds 136 samples of sunlit snow at luma 0.699. Wall minus true sky is +0.126 at 24 s and +0.150 at 30 s, already past the key's +0.076 and +0.086. The slab does not need a darker exposure, and a rim is not the missing term. The sky sample is sharing its box with lit ground. Exposure stays with A.

Lossless stills are the six `after/t*.png` frames. Diagnostic crops are `crops/r12/`. The numbers are `round12-diag.json`.

# Run 33 — cascaded sun shadows, round 11

Not a KEEP. Not merged. Exposure was not changed. The 34° sun stays. The round-10 capture is `r10-fixture/` and it fails the four new gates.

Paw contact is an occlusion darkening under the toes and it stays when the snow is already in cascade shade. The sun-offset blot still draws only as the attached shadow on lit snow. Contact darkening is 0.134, 0.139, 0.169, 0.140, 0.140, 0.132 at the six times. The round-10 shade times were −0.002, 0.033, 0.026, and −0.000, all under 0.04.

The four taps widen with the blocker gap at 0.27° and with 0.032 rad of camera distance, because 0.27° alone is under a pixel on the grazed shelf. In the 25–120 m band the far edge is 3–5 px (it was 1 px) and thin lit spikes are 0–4 (they were 12–25).

The key's 24 s ridge step is 0.394. The rendered step at 34°/132° is 0.036. Elevation 42 at the same azimuth is 0.039. Azimuth 80 at 34° reaches 0.160, still under 0.8 of the key, and it leaves the behind-the-runner heading. The sun was not moved. The 30 s left-to-right slope step is 0.032 against a key step of 0.079. Ice texture energy stays above 0.8 of the key. The slab-to-sky step is 0.022 and 0.012 against key steps of 0.076 and 0.086, so the silhouette gate still fails with the kept sun.

Shade snow b*, lit times first then shade: 5.567 s +2.31, 24 s +2.26, 5.10 s −13.04, 7.9 s −12.03, 11.70 s −12.00, 30 s −13.03. Ambient was not changed.

Vertex IoU is 0.924, 0.921, 0.904, 0.834, 0.802, 0.860. Cascade-factor seam means are 0.014, 0.009, 0.007, 0.008, 0.014, 0.011. Path shadow is 0.832, 0.255, 0.586, 0.645, 0.212, 0.763. Snapped vertex shimmer is 0. Round 2 coverage is still 0.999–1.000. The chases are 720×1280, 30 fps, 2.0 s at 5 s, 24 s, and 30 s.

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
