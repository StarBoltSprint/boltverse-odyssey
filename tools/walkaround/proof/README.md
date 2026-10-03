# Walk-around proof stills

The only view set in this repo is `testdata/synthetic-rock`. Those PNGs are synthetic. They are not Imagine pixels. There is no boulder or wreck view set in the tree to cook.

Left is `--legacy-voxels` (the coarse occupancy the old raymarcher draws). Right is the default surface (surface nets + Taubin). Both use the rock’s depth maps. Both are shot from the same camera: the approach distance stored in the checked-in voxel report.

`compare-*.png` is that pair at the source still’s size (legal magnification ≤ 1). `compare-*-x4.png` is the same pair scaled up with nearest-neighbor as a viewing copy. That scale is not an asset upscale and it is not the legal QC.

`viewing-yaw-090.png` draws the same camera and the same vertical fov into a wider frame so the voxel staircase is easier to see. That frame is above magnification 1. It is a viewing render, not the legal QC. On that frame the mean axis-aligned run of the silhouette edge is about 6.5 on the voxel hull and about 3.5 on the smooth hull. A smooth outline still has short runs where the tangent is horizontal or vertical, and the color stays in source texels, so the right side is not a blur.

`bowl-top.png` is a synthetic open tube from a top view (`elevationDeg` 90). The shaft is empty because that still is not hole-filled. `assembly-yaw-090.png` is a body plus a supplied part (`subObjects`) with its own 8 views, carved out and attached at a joint. The tool does not animate the joint.

`web-view.png` is a stored capture of `web/view.html` drawing a smooth hull (a synthetic open tube, top view included). The status line is `PASS` with `gl.getError` at 0. The page samples stills with `LINEAR_MIPMAP_LINEAR` and mipmaps. The z target is a measurement buffer. There is no lighting pass.

`report.json` records vertex count, seam fraction, and magnification for the rock pair.

Regenerate with `python3 tools/walkaround/selftest.py --proof`.
