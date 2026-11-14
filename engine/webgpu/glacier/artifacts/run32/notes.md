# Run 32

Not live. Not merged. No AAA claim and no KEEP. Director and Critic judge the captures.

Branch `cursor/snow-mirror-texel-c456`. Base `cursor/glacier-abyss-dawn-b27b`.

## What changed

Mirror row in `biome-factory/texel-gate.mjs`, written before the trial. Pearson on the detail field (radius-4 box removed). A 48 px mid-tile strip with r > 0.30 on X or Y fails. A whole-still flip with r > 0.02 fails. Floors are not a biome setting.

snow-v2-0 and snow-v2-1 fail both tests (strip r 0.95, flip r 0.04). snow-v2-2 and snow-v2-3 pass. The play shader loads only those two. Nothing was flipped, rotated, upscaled, or invented to fill the slot.

Snow shading is a hex cell that picks one or two of those stills and height-blends the grain. It does not average four stills. Normal, roughness, and occlusion come from the Imagine pixels in the shader. Metal stays 0. The run 18 colour lift is unchanged.

## Gates

`node engine/webgpu/biome-factory/texel-gate.mjs --biome glacier` exits 2.

| material | native | tile m | px/m | variants | stretch | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| crust | 1024x1024 | 0.5 | 2048 | 2 | 1.02 | FAIL |
| glacier-ice | 1024x1024 | 0.5 | 2048 | 4 | 1.29 | PASS |
| serac | 1024x1024 | 0.5 | 2048 | 4 | 1.27 | PASS |
| fall-ice | 1024x1024 | 0.5 | 2048 | 4 | 1.30 | PASS |
| arch-ice | 1024x1024 | 0.5 | 2048 | 4 | 1.25 | PASS |

HOLD: mirror on snow-v2-0 and snow-v2-1, then `variants 2 < 4`.

On-screen footprint at t=5.10, chase eye, phone 720×1280. UV for icicle, chunk, and drift is the world frame after the instance transform, not the proto chart.

| draw | n | dist m | authored px/m | screen px/m | mip | sampled px/m | mag |
| --- | --- | --- | --- | --- | --- | --- | --- |
| snow | 81 | 3.01 | 2048 | 382.9 | 4.10 | 119.3 | 0.187 |
| icicle | 8 | 72.07 | 2048 | 16.0 | 9.62 | 2.8 | 0.008 |
| chunk | 14 | 47.57 | 2048 | 19.6 | 8.42 | 6.0 | 0.010 |
| drift | 85 | 59.37 | 2048 | 13.5 | 9.07 | 3.8 | 0.007 |

Ground Laplacian versus the spire (wall ice, bias 4, four-still mix). Threshold 0.6, written before the trial. Clean variants only.

| distance | ground | spire | ratio | snow lod | spire lod |
| --- | --- | --- | --- | --- | --- |
| 1 m | 5.224 | 1.302 | 4.014 | 1.94 | 2.94 |
| 8 m | 2.690 | 1.208 | 2.228 | 4.94 | 5.94 |

Column gate, limit 1.688, unchanged. PASS.

| t | mix | still0 | still1 | still2 | still3 |
| --- | --- | --- | --- | --- | --- |
| 5.10 | 1.025 | 1.075 | 1.074 | 1.075 | 1.074 |
| 5.567 | 0.957 | 1.115 | 1.130 | 1.115 | 1.130 |
| 7.9 | 1.083 | 1.100 | 1.088 | 1.100 | 1.088 |
| 11.70 | 0.968 | 1.120 | 1.128 | 1.120 | 1.128 |

still2 and still3 repeat the two clean layers. They are not extra Imagine stills.

Chase-frame grid, limit 1.8, Bolt card dilated 8 px. Unchanged.

| t | grid |
| --- | --- |
| 5.10 | 1.022 |
| 5.567 | 0.964 |
| 7.9 | 1.096 |
| 11.70 | 0.968 |
| 24 | 1.313 |
| 30 | 1.047 |

The full-band grating control trips (12.39). The beside-card grating control peaks at 1.16 and does not trip 1.8. The frame itself is under the limit. The limit was not lowered.

Triangles 195818. Draws 9. Same as the branch tip before this change. Phone caps stay 200000 and 12.

## Stills

Same seed and route. Snow band mean sRGB, lower left and lower right, dog column left out.

| t | before | after | delta |
| --- | --- | --- | --- |
| 5.10 | 163, 158, 169 | 167, 161, 169 | +4, +3, +0 |
| 5.567 | 166, 160, 171 | 167, 161, 170 | +1, +2, −1 |
| 7.9 | 179, 170, 180 | 180, 172, 178 | +1, +2, −2 |
| 11.70 | 158, 154, 165 | 161, 156, 166 | +2, +2, +0 |
| 24 | 180, 171, 181 | 183, 174, 181 | +3, +3, +0 |
| 30 | 169, 163, 174 | 168, 162, 170 | −1, −1, −3 |

Grain standard deviation rose (about 2.5 to about 5). That is the hex cell keeping one still instead of averaging four.

Chase: 720×1280, 8 fps, 6.0 s, 48 frames. SwiftShader was about 14 s a frame, so this is not a 30 fps recording.

## Still open

- Two clean snow stills. The gate stays HOLD until two more Imagine stills pass the mirror row. Do not flip or generate the missing pair.
- Foreground snow is sampled at mip 4.1. Native density is 2048 px/m and magnification is 0.19. The pixels on screen are the mip.
- Icicles, chunks, and drifts that are actually on screen in this chase sit 48–72 m out. Nearer ones are off to the side.
- The beside-card grating control does not reach 1.8 on this grain.
- The old distance-to-horizon mix in the fragment shader is still there. This change did not add fog and did not remove that mix.
- The thin dark line on the ice and the ice sets that are one still short of four are unchanged from run 31.
