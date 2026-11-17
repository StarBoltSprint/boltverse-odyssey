# Run 33 — cascaded sun shadows, round 5

Not a KEEP. Not live. Not merged. Exposure was not changed. The sun is the round 3 direction.

## 1. Hardware compare

Depth is 0 at the sun and 1 at the far side, cleared to 1, written with `less`. A receiver is lit when the stored texel is farther: `stored >= reference`.

On one frame of flat path snow, one bilinear tap:

| sampler | mean abs vs textureLoad | IoU of the 0.5 mask |
| --- | --- | --- |
| greater-equal | 0.977 | 0.0025 |
| less-equal | 0.0003 | 1.000 |

This stack compares `(reference, texel)`. `less-equal` is the test we want. `greater-equal` is the same test backwards, which is why the umbra was lifted above one half. The UV is clamped inside its tile by the tap radius plus one texel, so a bilinear footprint does not cross the boundary between the cascades.

The filter is now four `textureSampleCompareLevel` taps. The beauty path no longer does 36 depth loads.

## 2. What the IoU reference is

It is not `csmoff` and it is not a ray trace. `cpuOcclusion` rasterizes spire triangles only (materials 1, 2, 3, 6, 7) into a hard 384² depth image per cascade, in the same light projection as the GPU. A snow vertex is occluded when that depth is more than 0.008 closer than the receiver. The GPU side is the rendered shadow factor, counted as shadow when it is below 0.5. The bar stays 0.80. The reference was not changed.

Filter width, both cascades forced to the same width, two times:

| width | 5.10 s IoU | 5.567 s IoU |
| --- | --- | --- |
| 0 cm | 0.776 | 0.899 |
| 4 cm | 0.776 | 0.897 |
| 8 cm | 0.776 | 0.896 |
| 14 cm | 0.776 | 0.897 |

Widening the penumbra does not move the IoU. The misses are the hard reference, which does not include the baked props the GPU draws.

This capture, with the near map at 8 cm and the far map at least two of its own texels:

| t | IoU | gpu | cpu |
| --- | --- | --- | --- |
| 5.10 | 0.846 | 1964 | 1938 |
| 5.567 | 0.898 | 1840 | 1833 |
| 7.9 | 0.818 | 1732 | 1689 |
| 11.70 | 0.694 | 1778 | 1322 |
| 24 | 0.820 | 1303 | 1256 |
| 30 | 0.868 | 1029 | 1072 |

## 3. Shimmer

Sphere radii are constant across the 4 mm move: 23.75 m and 102.81 m, same on both cameras, same light. The centre stays on the snapped texel, so the light-space UV of a world point does not move.

Of 3,834 snow vertices, 87 change by more than 0.1. All 87 are the receiver. Zero are the shadow map moving. There is no mesh LOD. Face normals are baked and do not depend on the camera. A vertex whose screen pixel crosses a stable shadow edge is the whole of the 2.3% world figure. The screen edge figure is 1.75% (was 2.4%, then 4.2%). The floor is 0.5%.

## 4. Seams

The blend is a cross-fade on ground distance from 16 m to 32 m. Both samples use one world width in that band: the far width, which is at least two far texels (40 cm at 1024). The near map is 8 cm inside that and opens to the far width across the band. Dither was not added. It would put grain on the snow.

| t | seam |
| --- | --- |
| 5.10 | 0.031 |
| 5.567 | 0.047 |
| 7.9 | 6 pairs |
| 11.70 | 0.044 |
| 24 | 0.009 |
| 30 | 0.045 |

24 s is under 0.03. A third cascade was not added. The 1024 far map did not move the seam relative to 2048, so another split would spend memory on a boundary the test is not limited by.

## 5. Coverage and the sun

Round 2 still fails (0.999–1.000). This capture, sun unchanged:

| t | path in shadow |
| --- | --- |
| 5.10 | 0.849 |
| 5.567 | 0.335 |
| 7.9 | 0.628 |
| 11.70 | 0.893 |
| 24 | 0.474 |
| 30 | 0.803 |

11.70 s is over 0.85. A shadow-only survey behind the runner (azimuth 124 at 28°, and elevation 30 at 132°) looked inside the band. The full stills at azimuth 124 were not: 7.9 s 0.978, 11.70 s 0.996, 24 s 0.965. The sun stayed at `[0.6561, 0.4695, 0.5910]`. The survey is in `sun-criterion.json`.

## 6. Memory

Near 2048² over far 1024², atlas 2048×3072, 25,165,824 bytes (24 MiB). Against the 32 MiB pair of 2048 maps, on 5.10, 5.567, and 11.70: coverage unchanged, IoU within 0.002, seam within 0.001. The path sits in the near map. The phone config is the 24 MiB atlas.

## Tone map and perf

Keyscore 90.86. Frame luma inside 0.05. Grey-bright 0.06–0.08. Snow p50 is 0.655–0.656 on 5.10, 7.9, 11.70, and 30 s, about 0.002 under the floor. Exposure was not touched.

SwiftShader at 540×960: 12.2 s/frame, 0.082 fps, 9 colour draws + 2 shadow draws. Not a phone.

Round 3 stills are in `r3-stills/`. Round 4 stills are in `r4-stills/`.
