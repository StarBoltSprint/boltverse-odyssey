# Run 33 round 9

Not a KEEP. Not live. Not merged. Draft stays draft. Exposure and the grade were not touched. The horizon-step bar stays 3.29.

## 1. Grazing crop

The round-8 crop failed the repeat gate at +0.269 / +0.213 / +0.147 (periods 12 / 19 / 32), with a lattice at 12 and 19.

The footprint on that window is not a real 16:1 graze. The tooth yaw rotates the sample position and both screen derivatives, and the tangent frame was still built from the unrotated normal. Projecting the rotated derivative onto that frame collapses one axis. On the graze window the collapsed ratio is 6:1 to 9.6:1. The same pixels, measured on the face, are 1.2:1. Anisotropy 16 already covers 9.6:1. The streak was the collapsed axis, not an overflow past 16.

The normal is now rotated by the same yaw before the tangent frame is built. The hash still rotates the sample position. The four stills still go through the stochastic blend (lead among v1, v3, v4 at 0.85, v2 at 0.05).

Where the measured ratio does exceed 16, the shorter derivative is lengthened by ratio/16. That raises the minor-axis LOD by log2(ratio/16) and leaves the ratio the sampler sees at 16. On these faces the ratio is 1.2 after the frame matches the derivative, so that branch does not move them. Frontal faces stay at the same LOD.

Detail on the 200×200 graze source, mean absolute Laplacian and mean absolute neighbour:

| | Laplacian | Neighbour | Repeat over at 12 / 19 / 32 |
| --- | --- | --- | --- |
| Before | 9.56 | 3.75 | +0.269 / +0.213 / +0.147 |
| After | 9.97 | 4.33 | −0.235 / −0.338 / −0.337 |

The crop is sharper, not blurred. `crops/t30-graze-3x.jpg` is the same window, 288,392, scaled 3× nearest. It passes at periods 12, 15, 19, 24, and 32. The frontal crops pass on the same periods. The plain tile still fails (+0.739, lattice). The glacier-ice still still passes.

## 2. Dark row

Five frames of the round-8 30 fps chase failed, each reported as a run of exactly 8:

| Frame | t | y | x of the run |
| --- | --- | --- | --- |
| 15 | 24.500 | 417 | 384–393 |
| 17 | 24.567 | 417 | 384–393 |
| 19 | 24.633 | 385 | 328–337 |
| 20 | 24.667 | 385 | 328–337 |
| 25 | 24.833 | 418 | 385–394 |

The run is one pixel tall. The luma along the row is a tent, not a flat 8-wide block. At a dip of 20 the same marks are 8–11 px, and the frames that passed have the same kind of mark at 5–6 px. The gate's minimum is 8, so the ones that cleared 32 luma for 8 px failed and the shorter ones did not.

They are not an 8×8 workgroup, an 8-row texture block, or a clear that sits on the screen. Ice is rgba8 jpeg. The ASTC atlas is 4×4 and it is the snow crust. The y row moves (417, then 385, then 418) and the x origin moves (384, then 328, then 385). Projected back, the marks sit on one wall tooth, phase 3.49, about 63 m out, and they travel with the camera.

That tooth is the collapsed footprint from section 1. At the mark the shader ratio was 8.3 and the face ratio was 1.2. The short axis was about 14 texels per pixel and the long axis about 120, so each screen row read a different slice of the still. One slice was a dark band about a tile long, which the gate counted as 8.

Rotating the normal with the yaw removes the collapsed axis. The new 30 fps chase, t=24.000 to t=24.967, is 30/30. The six stills pass. `fixture-r2-t30.jpg` still fails (run 14, mean dip 39.7, y=548).

## 3. Horizon step

The bar stays 3.29. The round-7 lossless t=24 fixture still scores 2.425 at row 492. These are the shipped jpegs. The lossless png of the new t=24 frame scores the same 3.068. The other five times are still over the bar. The skirt stays off. This is the cut that was handed back.

| Time | Step | Row | Bar 3.29 |
| --- | --- | --- | --- |
| 5.10 s | 5.222 | 552 | fail |
| 5.567 s | 5.345 | 551 | fail |
| 7.9 s | 6.710 | 506 | fail |
| 11.70 s | 6.710 | 538 | fail |
| 24 s | 3.068 | 492 | pass |
| 30 s | 4.630 | 583 | fail |

## Other gates

Texel PASS. Glacier-ice stretch 1.30, fall-ice 1.28, 2048 px/m, four variants. Draws 9. Page tris 196866. Follow sky-window on the six stills is 0.023–0.092, stairs 0 or 1. Anisotropy bound is 16. The chase is `chase-30fps.mp4`, 720×1280, 30 frames, 1.000 s, 30 fps. Bolt mean x is 360.00.

No KEEP.
