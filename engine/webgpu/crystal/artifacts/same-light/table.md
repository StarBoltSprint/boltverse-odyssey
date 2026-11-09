# Crystal same-light table

CIE76 limit 10, lightness included. Exposure is 1 on both sides. Nothing was fitted per material. This is not a visual KEEP.

`compareSameLight` in `engine/webgpu/biome-factory/colour-same-light.mjs`, light id `presented-srgb`. The key windows and the shaded albedo are finished sRGB pictures. The day sun and the night moon are not the same lamp as the painting.

## Day rig

White sun `[0.48, 0.74, -0.42]`, ambient `0.10`, sun weight `0.90`, flat scale `1`, no night tint.

Max dE76 57.44.

| material | dE76 | verdict | key L* a* b* | rig L* a* b* |
| --- | ---: | --- | --- | --- |
| obsidian wall | 16.37 | BLOCK | 3.55, 6.26, -16.62 | 11.31, 0.60, -3.37 |
| mineral ground | 28.73 | BLOCK | 6.55, 7.83, -17.92 | 28.48, 0.04, -1.07 |
| cyan facets | 57.44 | BLOCK | 17.70, 3.35, -27.01 | 67.67, -24.84, -24.31 |
| architectural stone | 18.94 | BLOCK | 5.16, 3.55, -17.00 | 18.07, 0.81, -3.40 |
| stream surface | 25.95 | BLOCK | 46.66, -7.94, -24.91 | 57.60, -27.06, -11.19 |
| violet mineral | 28.03 | BLOCK | 16.86, 24.47, -33.98 | 44.76, 24.39, -31.23 |

## Night rig before this search

Ambient `[0.026, 0.014, 0.138]`, moon `[0.76, 1.08, 1.55]` at intensity `0.92`, direction `[0.58, 0.24, -0.78]` (about 14°), flat scale `0.40`. Measured with the nebula pedestal still in the sky.

Max dE76 50.30.

| material | dE76 | verdict | key L* a* b* | rig L* a* b* |
| --- | ---: | --- | --- | --- |
| obsidian wall | 11.07 | BLOCK | 3.55, 6.26, -16.62 | 6.49, 1.40, -7.12 |
| mineral ground | 9.47 | PASS | 6.55, 7.83, -17.92 | 10.64, 3.63, -10.48 |
| cyan facets | 50.30 | BLOCK | 17.70, 3.35, -27.01 | 63.77, -9.97, -42.16 |
| architectural stone | 10.60 | BLOCK | 5.16, 3.55, -17.00 | 11.48, 1.55, -8.72 |
| stream surface | 22.63 | BLOCK | 46.66, -7.94, -24.91 | 25.10, -1.09, -24.92 |
| violet mineral | 29.64 | BLOCK | 16.86, 24.47, -33.98 | 42.52, 27.98, -48.39 |

## Best shared rig

Ambient `[0.026, 0.014, 0.138]`, moon `[0.76, 1.08, 1.55]`, intensity `1`, direction `[0.587638, 0.173648, -0.790271]` (10°), flat scale `1`.

The grid was ambient scale and hue, moon hue, intensity, elevation, and flat scale. Facet swing stayed at or above 0.6 and the moon stayed under 0.45 in y. The score is the maximum dE76 across the six materials. A change under 0.05 in that maximum was treated as a tie, and the lower sum won.

Max dE76 49.84. The maximum is the cyan facets. Flat scale 1 moves the stream toward the bright water in the key and pushes the ground just past 10. Flat scale 0.4 keeps the ground under 10 and leaves the stream further away. The maximum does not change, because the gems do not use flat scale.

| material | dE76 | verdict | key L* a* b* | rig L* a* b* |
| --- | ---: | --- | --- | --- |
| obsidian wall | 11.77 | BLOCK | 3.55, 6.26, -16.62 | 4.49, 1.25, -6.01 |
| mineral ground | 12.19 | BLOCK | 6.55, 7.83, -17.92 | 14.54, 2.57, -10.36 |
| cyan facets | 49.84 | BLOCK | 17.70, 3.35, -27.01 | 63.30, -10.12, -41.93 |
| architectural stone | 9.74 | PASS | 5.16, 3.55, -17.00 | 8.48, 1.51, -8.07 |
| stream surface | 13.89 | BLOCK | 46.66, -7.94, -24.91 | 32.95, -5.70, -24.76 |
| violet mineral | 29.14 | BLOCK | 16.86, 24.47, -33.98 | 42.24, 27.66, -47.93 |

## Sky

Zenith L* 5.08  a* 10.18  b* -20.87. Yaw gate 0.015, measured 0.02200 on the elev-12 pair used by the review.

The old yaw delta of 0.01611 was the nebula term. Halving the nebula colours halved it to about 0.008, under the gate. The noise mix sits near 0.51, and `raw * raw` adds that as a pedestal on every direction, including the zenith, which was L* 11.87 instead of the atmosphere's L* 5.1. Subtracting `floor * floor` removes that constant. The zenith falls to the atmosphere. The yaw difference of the samples that remain above the floor stays above 0.015.

The volume gate still wants the elev-12 sky 6 L* above the obsidian side. After the pedestal came out, that gap was 5.06. The side is held up by the fill floor 0.22, so dimming the band further widens the miss. The band colours are 1.4 times the previous night values, which puts the gap at 6.12. The gate was not moved. A uniform scale that also kept the pedestal cannot hit zenith L* 5 and this yaw gate together.

## Crystals

The key window for the cyan facets is L* 17.70  a* 3.35  b* -27.01. That rectangle includes the dark gaps between crystals, so the median is darker than the glowing tips in the same window (about L* 47). The shaded median across the gem faces is L* 63.30  a* -10.12  b* -41.93.

Lowering the moon from about 14° to 10° moves that median by a fraction of an L*. Replacing the gem ambient term 0.12 with 0, on the same faces, leaves cyan at L* 58.47  a* -9.36  b* -40.24, dE76 44.70.

A face looked at straight on, with no moon and no ambient, is still the core term `albedo * 0.72`. For the cyan median that presents as L* 63.96  a* -9.72  b* -43.48. The key is darker than that. The albedo was not darkened.

The key is darker than real-colour crystal.
