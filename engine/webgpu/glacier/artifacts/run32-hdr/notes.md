# Run 32 — HDR grade, shoulder and ice chroma

Not a KEEP. Not live. Not merged. Exposure stays EV 0.32. AgX stays the operator. Scene draws stay 9.

## What the second pass changed

The AgX upper shoulder is milder. Above display-linear luma 0.46 it blends 0.7 of the way back toward the exposed scene colour, and it is identity below that knee, so the frame median does not rise. After the sRGB OETF, bright ice (the grey_bright mask: ice, display luma above 0.45, channel spread under 0.05) is pushed to a spread of 0.05, gain capped at 2.2. Hue is unchanged. Snow and Bolt are not in that mask.

## Gate

`tonemap-gate.json` is PASS. Keyscore 94.19, floor 85.84. Limits were not moved.

| Check | Result |
| --- | --- |
| 30 s frame p99 | 0.8005 vs key 0.8066, delta 0.0061 (was 0.0501) |
| 30 s p50 delta | 0.0345, unchanged from the first grade |
| 11.70 s p50 delta | 0.0479, unchanged |
| 30 s grey_bright | 0.1405 (was 0.189) |
| Ice dE76 vs the glacier-ice stills | 6.48 to 8.24, all under 10 |
| Clip / crushed | 0 / 0 |
| 45 s mean-Y std, one sample a second | 0.0093 |
| CIE76 | snow 0.12, fall 0.14, arch 0.15, wall 0.05; darkened wall blocks at 11.83 |
| Texel | PASS, 2048 px/m |
| CPU triangles / draws | 195634 / 9 |
| Page triangles / draws | 195818 / 9, same as before this grade |

## Stills and chase

Same seed and route. `before/` is gamma 2.2. `after/` is this grade. Tags: 51 = 5.10 s, 5567 = 5.567 s, 79 = 7.9 s, 117 = 11.70 s, plus 24 s and 30 s.

`chase.mp4` is 720×1280, 8 s, 5 fps, 40 frames. Bolt stays at x = 360. SwiftShader is about 14 s a frame.

## Still open

The thin dark horizon line, the right-hand drop, and the flat grey slabs are unchanged. The page triangle count and the CPU budget still disagree by 184 triangles; neither moved.

## Round 3 — stopped

Look gate committed in `a561be5f` before the trial. Neither candidate passed, so neither was adopted and no new chase was made. The shipped grade stays AgX at EV 0.32.

Khronos PBR Neutral, one exposure EV 0.36 calibrated to the snow key (mean |snow p50 − 0.708| = 0.024). Gate `neutral/tonemap-gate.json` FAIL. Contrast and saturation rise, peach sky is 0.179, and grey_bright passes. Frame luma misses on every still (p1 about 0.066, p99 about 0.06). Bolt torso sat is 0.03 to 0.06 above the before. Ice dE76 is 14.9 to 18.1.

AgX punchy (log-space power 1.35, saturation 1.4), one exposure EV 1.7 (mean snow error 0.014). Gate `punchy/tonemap-gate.json` FAIL. Contrast and mean saturation rise. Peach sky is 0.142, under 0.15. p50 is 0.055 to 0.075 above the gamma key. Bolt torso Y is about 0.076 high. Ice dE76 is 9.1 to 11.8.

Limits were not moved. Exposure was not refit after these numbers.

## Round 4 — display-matched grade, not a KEEP

The shipped grade is now `tonemap: "display"` at exposureEv 0. Below scene-linear 0.805437471876985 (display-linear 0.800) the curve is the gamma-2.2 picture: sRGB-linear of `pow(clamp(x,0,1), 1/2.2)`, then the exact sRGB OETF, so the encoded byte is that power. Above the knee a C1 Reinhard shoulder, slope 1.02155 at the join, reaches display-linear 1 at scene white 4 and keeps channel ratios. Scene 1 encodes to 0.955 instead of clipping at 1. Values above 4 stay at 1. rgba16float, 4× MSAA, and the sRGB OETF are unchanged. `present`, `gradeLinear`, and `gradeWgsl` keep their signatures. AgX, punchy, Neutral, and ACES stay as named operators and are not selected.

`display/tonemap-gate.json` is FAIL. Limits were not moved. Two rows miss, and both are the identity with the gamma stills, not a new midtone curve.

| Check | Result | Limit |
| --- | --- | --- |
| Frame p1/p50/p99 vs gamma | max abs 0.0008 | 0.05 |
| Look contrast delta | t24 −0.0005, t5567 −0.0002, the other four ≥ 0 | ≥ 0 |
| Look sat delta | −0.0004 to −0.0007 | ≥ −0.005 |
| t30 peach sky sat | 0.1613 | ≥ 0.15 |
| Bolt torso Y / sat | within ±0.0069 / ±0.0042 | ±0.02 |
| Snow p50 vs texture key 0.7082 | t117 0.621, t51 0.635, t5567 0.643, t30 0.655 miss; t24 0.683 and t79 0.684 pass | 0.05 |
| Snow p50 vs the gamma before still | 0.0000 on all six | |
| grey_bright | 0.047 to 0.132, b−r > 0 | < 0.15 |
| Clip / crushed | 0 / 0 | 0.5% |
| Keyscore | 87.80 | ≥ 85.84 |
| 45 s mean-Y std | 0.0148, mean 0.5821 | ≤ 0.015 |
| CIE76 | snow 0.42, fall 0.21, arch 0.28, wall 0.26; darkened wall blocks at 14.79 | 10 |
| Texel | PASS, 2048 px/m | 2048 |
| CPU triangles / draws | 195634 / 9 | unchanged |
| Page triangles / draws | 195818 / 9 | unchanged |

The snow-key miss is the gamma picture. A highlight shoulder above 0.805 cannot lift snow whose median is 0.62. The contrast hairs are a fraction of one code. The knee was not moved after the gate, and the exposure stayed at 0.

`display/chase.mp4` is 720×1280, 8 s, 5 fps, 40 frames. Bolt pixel x stays at 360 (359.9995–360.0004). Not marked KEEP-candidate.
