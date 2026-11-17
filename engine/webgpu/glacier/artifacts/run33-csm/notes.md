# Run 33 — cascaded sun shadows

Not a KEEP. Not live. Not merged. Director and critic decide from the captures.

## What this is

Phone CSM for the glacier. Two cascades, 0–25 m and 25–120 m, split lambda 0.7, side by side in a 2048×1024 `depth32float` atlas. 4-tap PCF near, 1 tap far, blended seam. The projection uses a fixed bounding-sphere radius and snaps the centre to the shadow texel. Polygon depth bias is 0. The receiver is moved along its normal by 1.5 cm (near) and 4.5 cm (far), under one texel, so a low sun does not slide the sample off the ground onto a spire.

The shadow multiplies only the direct sun term (`dawnIrrSh`). Ambient stays, so a full shadow stays blue. Specular is the albedo tint times F0 0.045 (cap 0.21) times the same factor. `dawnIrr` is unchanged.

`csmoff=1` matches the PR 239 frames with mean absolute channel difference 0. The normal image is the shadowed one. `lmask=shadow` is the capture mask.

Colour draws stay 9. The shadow pass is 5 draws (world, icicle, chunk, drift, sun-facing Bolt card). Both cascades are instances of those draws. Unique triangles stay 195634. The page still reports 195818, which is the same split run 32 already recorded. Shadow raster is the same meshes drawn again, about 377k triangles of depth fill, not a second copy of the mesh budget.

The snow sheet is the receiver. Fragments with material snow are discarded in the depth pass so the flat crust does not occlude itself. Falls, arches, walls, peaks, icicles, chunks, drifts, and the Bolt card cast.

## Gates

`csm-gate.json`. IoU of the rendered mask against a CPU light-space raster of those casters, on snow vertices within 70 m:

| t | iou | blue Δ (b−r) | seam luma | grey_bright | ice b−r | clip |
| --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 0.846 | 0.148 | 0.028 | 0.043 | 0.143 | 0 |
| 5.567 | 0.836 | 0.149 | **0.037** | 0.046 | 0.141 | 0 |
| 7.9 | 0.845 | 0.148 | 0.022 | 0.037 | 0.141 | 0 |
| 11.70 | 0.878 | 0.147 | 0.028 | 0.045 | 0.141 | 0 |
| 24 | 0.924 | 0.150 | 0.015 | 0.050 | 0.141 | 0 |
| 30 | 0.832 | 0.151 | 0.005 | 0.036 | 0.142 | 0 |

Limits, not moved: iou ≥ 0.80, blue Δ > 0.03 on sun-facing snow, seam ≤ 0.03, grey_bright < 0.15, ice b−r > 0, clip ≤ 0.5%.

One miss, limit not lowered: the cascade seam at 5.567 s is 0.037 luma.

Edge shimmer on the shadow mask, cameras 1.2 cm apart inside one snapped texel: 95 of 26294 edge pixels changed by more than 0.1 (0.36%). The same snow vertices flip in 3 of 3837 samples (0.08%). Limit 0.5%.

Cross-camera CIE76 on one world patch: 0.28. Limit 10.

Texel gate PASS at 2048 px/m. `csmoff=1` is identical to the PR 239 stills.

## Tone map

`tonemap-gate.json`, same limits as PR 239, compared with the run-31 gamma key. Not lowered.

Clip 0. Crushed 0. Ice b−r stays positive (about 0.14). Grey-bright on ice is 0.036–0.050, under 0.15, and under the run-32 miss of 0.189 at 30 s.

The ground is inside the spire shadow, so snow p50 falls to about 0.49 against the key 0.71, and frame p50 moves 0.11–0.18. Keyscore is 83.81 against the run-31 floor 85.84. That is a regression of the unshadowed luma gate. It is the shadow, not a grade change.

## Perf

SwiftShader at 540×960: 13.3 s/frame, 0.075 fps, 4 samples. This machine is not a phone. Soft-OK ≥ 50 fps is not demonstrated here. The added work is a depth-only atlas of 2048×1024, two cascades, five draws.

## Chase

`chase.mp4`. 720×1280, 6 s, 4 fps, 24 frames. Bolt stays on the chase route. SwiftShader cannot play this back at 30 fps.

## Remaining defects

- At 5.567 s the cascade blend steps 0.037 luma, over the 0.03 limit.
- The dawn sun is low and the walls are tall, so the snow in frame is mostly shadowed. Lit snow is the sun-facing caps. The path does not show a small penumbra; it sits in the shadow volume. Snow p50 and the tone-map keyscore move because of that.
- The contact decal under Bolt is still drawn. It can sit on top of the cascaded shadow.
- The 4-cascade 16-tap tier exists behind `csm=high` and was not the trial.
- Phone fps was not measured on a phone GPU.
