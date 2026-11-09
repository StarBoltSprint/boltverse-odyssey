# Crystal same-light table

CIE76 limit 10, lightness included. Exposure is 1 on both sides. Nothing was fitted per material. This is not a visual KEEP.

The blocking reference is each Imagine albedo under the declared night rig (`crystal-night-rig`). The key tables are advisory. `compareSameLight` does not fit a per-material exposure.

## Blocking real-colour gate

Each row is that file lit by the shared night rig and compared with itself. A different render blocks. The key is not in this table.

| material | dE76 | verdict | rig-lit L* a* b* |
| --- | ---: | --- | --- |
| obsidian-wall | 0.00 | PASS | 1.40, 1.58, -3.41 |
| ground | 0.00 | PASS | 9.30, 4.09, -10.98 |
| crystal | 0.00 | PASS | 13.70, 20.43, -40.21 |
| architecture | 0.00 | PASS | 2.39, 3.09, -6.80 |
| stream | 0.00 | PASS | 23.12, 0.52, -25.42 |
| violet | 0.00 | PASS | 9.02, 23.15, -33.25 |

## Day rig

White sun `[0.48, 0.74, -0.42]`, ambient `0.10`, sun weight `0.90`, flat scale `1`. The shade is albedo times that irradiance, the same rule as the night page.

Max dE76 43.49.

| material | dE76 | verdict | key L* a* b* | rig L* a* b* |
| --- | ---: | --- | --- | --- |
| obsidian wall | 17.36 | BLOCK | 3.55, 6.26, -16.62 | 2.98, 0.14, -0.39 |
| mineral ground | 28.73 | BLOCK | 6.55, 7.83, -17.92 | 28.48, 0.04, -1.07 |
| cyan facets | 43.49 | BLOCK | 17.70, 3.35, -27.01 | 53.73, -20.00, -20.04 |
| architectural stone | 16.63 | BLOCK | 5.16, 3.55, -17.00 | 5.01, 0.19, -0.71 |
| stream surface | 25.95 | BLOCK | 46.66, -7.94, -24.91 | 57.60, -27.06, -11.19 |
| violet mineral | 20.73 | BLOCK | 16.86, 24.47, -33.98 | 35.25, 19.85, -25.61 |

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

## Shared rig, flat scale 0.4

The key table below is advisory. It does not block. The blocking reference is each Imagine albedo lit by this rig.

Ambient `[0.026, 0.014, 0.138]`, moon `[0.76, 1.08, 1.55]`, intensity `1`, direction `[0.587638, 0.173648, -0.790271]` (10°), flat scale `0.4`.

Advisory max dE76 against the key 25.06. Flat scale 0.4 is the shared rig that kept the ground near dE76 8.4. Walls and gems are the albedo times that irradiance. Crystal spec stays `alb * nh` at weight 0.06.

| material | dE76 | verdict | key L* a* b* | rig L* a* b* |
| --- | ---: | --- | --- | --- |
| obsidian wall | 14.18 | BLOCK | 3.55, 6.26, -16.62 | 1.40, 1.58, -3.41 |
| mineral ground | 8.30 | PASS | 6.55, 7.83, -17.92 | 9.30, 4.12, -11.02 |
| cyan facets | 15.01 | BLOCK | 17.70, 3.35, -27.01 | 17.84, 10.27, -40.33 |
| architectural stone | 10.86 | BLOCK | 5.16, 3.55, -17.00 | 2.39, 2.99, -6.52 |
| stream surface | 25.06 | BLOCK | 46.66, -7.94, -24.91 | 23.12, 0.64, -25.40 |
| violet mineral | 2.23 | PASS | 16.86, 24.47, -33.98 | 15.86, 23.69, -35.80 |

## Sky

Zenith L* 5.08  a* 10.18  b* -20.87. The nebula is domain-warped fbm of the unit direction, gain 1.7, denser on a tilted band and faded toward the horizon. The elev-12 pair of two different view directions is advisory and measures 0.00000. It does not block.

The 0.015 limit is one world direction rendered from many cameras. Eight directions, 32 cameras, screen spread at least 707 px, max colour delta 0.00047. A 36-frame 360 turn, max frame-to-frame delta 0.00047, no pops. A screen-space sky reaches 0.04881 and fails. Volume gap 6.07. `sky-yaw-strip.png` is a full yaw turn at elev 12, 25, and 45. `sky-fisheye.png` is the upper dome. `sky-turn.mp4` is the slow 360.

## Crystals

The key window for the cyan facets is L* 17.70  a* 3.35  b* -27.01. The rig-lit median is L* 17.84  a* 10.27  b* -40.33. The albedo bytes were not darkened. This distance is advisory.
