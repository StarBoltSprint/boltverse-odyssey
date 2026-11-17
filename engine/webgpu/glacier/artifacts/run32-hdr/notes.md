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
