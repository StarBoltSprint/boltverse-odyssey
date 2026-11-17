# Run 33 — cascaded sun shadows, round 4

Not a KEEP. Not live. Not merged. The sun from round 3 is unchanged.

## Shadow map

Phone atlas is 2048×4096 `depth32float`, 33,554,432 bytes (32 MiB). Both cascades are 2048², near on top, far below. One depth pass, still 2 shadow draws, 11 draws with colour. Practical split lambda 0.7: 0–25.8 m and 25.8–120 m. Near texel is 2.3 cm (radius 23.8 m). Far texel is 10.0 cm (radius 103 m).

Each cascade is a bounding sphere on fixed light axes. The ortho origin is that centre snapped to whole shadow texels, so a camera move inside one texel does not move the map.

The filter is a 3×3 of bilinear depth compares. The penumbra is 14 cm in world units on both cascades, so the width does not jump at the split. The blend is the outer quarter of the near map, sampling both. Bias is a slope term from the shadow-depth derivatives plus a 3.5 cm normal offset.

On this GPU the hardware comparison sampler does not match the depth texel (it lifts the umbra above one half). The bilinear weights are applied to `textureLoad` compares. The sampler stays bound.

## Coverage

Round 2 fixture still fails (0.999–1.000). This capture:

| t | path in shadow |
| --- | --- |
| 5.10 | 0.835 |
| 5.567 | 0.319 |
| 7.9 | 0.628 |
| 11.70 | **0.893** |
| 24 | 0.473 |
| 30 | 0.788 |

11.70 s is over the 0.85 ceiling. The other five are inside.

## Quality gates

Not lowered.

| check | result | limit |
| --- | --- | --- |
| csm_iou | 0.737, 0.795, 0.736, 0.692, 0.774, 0.725 | ≥ 0.80 |
| cascade seam | 0.046, 0.064, 0.023, 0.046, 0.052, 0.044 | ≤ 0.03 |
| edge shimmer | 2.4% of edge pixels; 2.1% of snow vertices | ≤ 0.5% |

5.567 s seam was 0.086 and is now 0.064. Shimmer was 4.2% / 3.9% and is now 2.4% / 2.1%. Neither is under the floor. IoU is still short. The shadow edges in the stills are soft rather than one-texel rectangles.

## Tone map

Exposure was not changed. Keyscore 91.25. Frame luma is inside 0.05. Clip 0. Grey-bright 0.08–0.10. Snow p50 is 0.655–0.656 on 5.10, 7.9, 11.70, and 30 s, about 0.002 under the 0.658 floor. 24 s is 0.707 and 5.567 s is 0.758.

## Perf

SwiftShader at 540×960: 12.8 s/frame, 0.078 fps, 9 colour draws + 2 shadow draws. Not a phone.

Round 3 stills are in `r3-stills/`. Round 2 masks are in `r2-fixture/`.
