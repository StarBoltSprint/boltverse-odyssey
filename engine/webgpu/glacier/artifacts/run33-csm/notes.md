# Run 33 — cascaded sun shadows

Not a KEEP. Not live. Not merged. Director and critic decide from the captures.

## What this is

Phone CSM for the glacier. Two cascades, 0–25 m and 25–120 m, split lambda 0.7, side by side in a 2048×1024 `depth32float` atlas. 4-tap PCF near, 1 tap far. The blend is `smoothstep(0.40, 0.98)` and the near kernel widens to the far texel across that zone. The 4-tap radius also grows with blocker distance (a small penumbra). The projection uses a fixed bounding-sphere radius and snaps the centre to the shadow texel. Polygon depth bias is 0. The receiver is moved 2 cm along its normal.

The shadow multiplies only the direct sun term. The shade is a sky dome (zenith and horizon from the dawn rig, darker on downward faces) plus a small circumsolar lobe that the shadow map does not zero. `dawnIrr` is unchanged. Exposure stays 0.32. Specular is the albedo tint times F0 0.045 (cap 0.21) times the shadow. Bolt's contact decal fades where the cascade already shadows the ground. Paw prints stay.

`csmoff=1` forces the shadow factor to lit and skips the depth pass. The sky dome, the circumsolar lobe, and the bright-sky lift stay, so those frames are not the PR 239 stills. Absent, the query does not change the shadowed image. `lmask=shadow` is the capture mask.

Colour draws stay 9. The shadow pass is 2 draws: one batched caster buffer (world, icicle, chunk, drift) and the sun-facing Bolt card. Both cascades are instances of those draws. Colour plus shadow is 11. Unique triangles stay 195634. The page still reports 195818, which is the same split run 32 already recorded.

The snow sheet is the receiver. Fragments with material snow are discarded in the depth pass so the flat crust does not occlude itself. Falls, arches, walls, peaks, icicles, chunks, drifts, and the Bolt card cast.

## Gates

`csm-gate.json`. IoU of the rendered mask against a CPU light-space raster of those casters, on snow vertices within 70 m:

| t | iou | blue Δ (b−r) | seam luma | grey_bright | ice b−r | clip |
| --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 0.854 | 0.115 | 0.009 | 0.040 | 0.122 | 0 |
| 5.567 | 0.842 | 0.114 | 0.013 | 0.044 | 0.120 | 0 |
| 7.9 | 0.865 | 0.116 | 0.003 | 0.036 | 0.121 | 0 |
| 11.70 | 0.878 | 0.110 | 0.014 | 0.043 | 0.120 | 0 |
| 24 | 0.924 | 0.115 | 0.025 | 0.047 | 0.120 | 0 |
| 30 | 0.832 | 0.117 | 0.028 | 0.032 | 0.118 | 0 |

Limits, not moved: iou ≥ 0.80, blue Δ > 0.03 on sun-facing snow, seam ≤ 0.03, grey_bright < 0.15, ice b−r > 0, clip ≤ 0.5%. All six times pass.

Edge shimmer on the shadow mask, cameras about 1 cm apart inside one snapped texel: 96 of 26163 edge pixels changed by more than 0.1 (0.37%). The same snow vertices flip in 3 of 3837 samples (0.08%). Limit 0.5%.

Cross-camera CIE76 on one world patch: 0.006. Limit 10.

Texel gate PASS at 2048 px/m. Colour draws 9, shadow draws 2, total 11. Unique triangles 195634.

## Tone map

`tonemap-gate.json`, same limits as PR 239, compared with the run-31 gamma key. Not lowered. Exposure 0.32.

Clip 0. Crushed 0. Ice b−r stays about 0.12. Grey-bright on ice is 0.032–0.047.

Snow p50 is 0.659–0.660 against the still key 0.708. Frame p50 deltas are 0.012–0.049. Keyscore is 90.35 against the run-31 floor 85.84.

## Perf

SwiftShader at 540×960: 13.3 s/frame, 0.075 fps, 4 samples. This machine is not a phone. Soft-OK ≥ 50 fps is not demonstrated here.

## Chase

`chase.mp4`. 720×1280, 6 s, 4 fps, 24 frames. Bolt stays on the chase route. SwiftShader cannot play this back at 30 fps.

## Remaining defects

- The dawn sun is low and the walls are tall, so the snow in frame is mostly inside the shadow volume. The shade is blue and brighter than the first trial. It is not a sunlit snowfield.
- The closest gates are the seam at 30 s (0.028) and the tone-map p99 at 24 s (delta 0.0499). Both are inside the limits.
- `csmoff=1` is not bit-identical to the PR 239 stills. Mean absolute channel difference is about 12.5 counts, because the sky dome and the bright-sky lift remain when the shadow is forced off.
- The 4-cascade 16-tap tier exists behind `csm=high` and was not the trial.
- Phone fps was not measured on a phone GPU.
