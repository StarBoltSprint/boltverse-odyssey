# Run 33 round 8

Not a KEEP. Not live. Not merged. Draft stays draft. Exposure and the grade were not touched.

## 1. Horizon step

The run-31 measure is the worst row median. Rows 420–679, columns 281–439 skipped, absolute rec.709 luma into the next row. The bar is 3.29.

The round-7 lossless t=24 frame scores 2.425 at row 492. The jpeg of that frame scores 3.144. Both are under 3.29, so the fixture does not fail. Team C's 4.353, and the pair RGB 113,136,172 over 172,165,175 at x=200, is not this frame. On this frame that column is fall ice over snow, and the row median is set by the quiet columns, not by that one cut.

| Time | Step | Row | Bar 3.29 |
| --- | --- | --- | --- |
| 5.10 s | 5.574 | 552 | fail |
| 5.567 s | 5.349 | 551 | fail |
| 7.9 s | 7.077 | 506 | fail |
| 11.70 s | 6.570 | 538 | fail |
| 24 s | 3.144 | 439 | pass |
| 30 s | 5.638 | 583 | fail |

A snow lip on the wall foot and the fall foot did not own the visible cut. At 24 s, x=200, the front triangle is a mid fall sheet (phase about 0.57), not the foot. Extending that sheet onto the snow pushed fall-ice stretch to 1.30 and the gate failed it, and the pixel did not move. The skirt was taken back. Stretch is 1.28 on fall-ice and 1.30 on glacier-ice, both passing.

## 2. Grazing flank

The sampler was being created with anisotropy 1. `adapter.limits.maxSamplerAnisotropy` is missing on this SwiftShader, so the old `|| 1` won, and `requestDevice({ requiredLimits: { maxSamplerAnisotropy } })` is rejected as an unknown limit. `createSampler({ maxAnisotropy: 16 })` succeeds. The bound value is 16.

The hex sample was rotating the footprint by the per-cell hash. That hash changes across the cell seam, so the anisotropic kernel became one long streak. The footprint is now the tooth-rotated face derivative, which is continuous. The hash still rotates the sample position.

The grazing 3× crop at t=30, window 288,392, is shipped. It still fails the repeat gate: +0.269 at 12 px, +0.213 at 19 px, +0.147 at 32 px, with a lattice at 12 and 19. The face derivative is longer than 16:1, so anisotropy 16 does not remove the streak. The frontal tooth crops still pass.

## Other gates

Dark-row passes the six stills. The 30 fps chase is 720×1280, 30 frames, 1.0 s, from t=24.0 to t=24.967. Bolt mean x is 360.00. Five of those frames fail dark-row, each a run of exactly 8 at mean dip 43–46. Follow sky-window at 24 s is 0.044 and at 30 s is 0.023. Draws 9. Page tris 196866. Anisotropy bound on the sampler is 16.

No KEEP.
