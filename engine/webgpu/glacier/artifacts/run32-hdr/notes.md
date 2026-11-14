# Run 32 — HDR grade

Not a KEEP. Not live. Not merged. The scene draws stay 9. The present pass is the grade, outside that list.

## What changed

`present()` no longer applies gamma 2.2. The scene is rgba16float, 4× MSAA, resolved, then one fullscreen grade: fixed exposure, AgX, exact sRGB OETF. Ice specular is capped at 0.04 linear luma before that grade. The cap keeps the albedo colour. Metal stays 0.

The three operators were scored on linear dumps at 5.10 s and 11.70 s. AgX at EV 0.32 was the only one inside the snow-median band and the frame-luma band together. ACES Narkowicz and Khronos PBR Neutral matched the snow median and were less grey, and both pulled frame p1 more than 0.05 off the gamma key. The limits were written in `tonemap-limits.json` before that trial. They were not moved.

The distance-to-horizon colour mix in the world shader is gone. On these frames it did not move the luma percentiles.

## Gate

`tonemap-gate.json`. Keyscore 94.19 against a run-31 floor of 85.84. Clip 0. Crushed 0. 45 s mean-Y, one sample a second, std 0.0092 (limit 0.015). Texel gate PASS at 2048 px/m. CPU budget 195634 triangles, 9 draws. The page reports 195818 triangles both before this change and after; draws stay 9.

Snow p50 versus the four live stills (key p50 0.708): all six frames within 0.05. The worst is 11.70 s at 0.661.

Two misses, both at 30 s, limits not lowered:

- Frame p99 is 0.7566 against the gamma key 0.8066. Delta 0.0501. Limit 0.05.
- Bright-ice grey_bright is 0.189. Limit 0.15. Blue minus red stays positive (0.102).

## Stills

Same seed and route. Tags are the capture names: 51 is 5.10 s, 5567 is 5.567 s, 79 is 7.9 s, 117 is 11.70 s.

Before (gamma 2.2): `before/`. After (AgX, EV 0.32): `after/`.

## Chase

`chase.mp4`. 720×1280, 8 s, 5 fps, H.264. SwiftShader is about 14 s a frame, so this is not a 30 fps take. Bolt stays at x = 360.
