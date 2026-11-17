# D9 notes

Not a KEEP. The stills are for the Director and the Critic.

The planet is lit by the scene sun `[0.6161, 0.5592, 0.5547]` (elevation 34 deg). That vector is not the dawn-light sun, and `dawn-light.json` was not edited. The normal is the radial vector from the planet centre. The plate's own broad light is divided out with mip 5 so the photograph's frontal grade does not fight the sun. Craters stay. A thin blue rim sits on the silhouette, stronger on the day side. The sky is the same function plus a 64×64 blue-noise dither of ±1 code before the 8-bit store.

No new Imagine plate. `tex/glacier-planet-surface.jpg` is still 1024×1024.

## Gates

Limits were not lowered. The run-31 fixture still fails the terminator and the banding gates (`fixture-before.json`).

| t | heading error | lit − unlit | rim gap | sky step | band run | hf RMS |
| --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 16.5 | 93.0 | 30.0 | 1 | 5 | 1.00 |
| 5.567 | 33.7 | 92.1 | 45.1 | 1 | 5 | 0.98 |
| 7.9 | 5.5 | 92.7 | 13.1 | 1 | 5 | 1.01 |
| 11.70 | 15.2 | 97.1 | 12.8 | 1 | 5 | 1.14 |
| 24 | 66.2 | 73.4 | 18.3 | 1 | 5 | 1.02 |
| 30 | 8.8 | 80.7 | 31.8 | 1 | 5 | 0.74 |

Heading limit ±15. Lit gap limit 8. Rim gap limit 4. Sky step limit 1. Band run limit 10. HF limit 2.5. The smooth-reference RMS (5×5 mean against an 11×11 mean) stays about 0.7–1.6. Dither grain is about 1 level.

Sky anchor worst 0.00762, limit 0.015. The screen-space control is 0.052 and still fails, as required.

Left-side terrain silhouette moves by at most 2 rows. Sky fraction is 1.02× the pre-change frames. Sky CIE76 against those frames is 0.00–0.96, lightness included.

Planet median against the unshaded plate median is CIE76 13.8–19.9. That misses 10. The gap is lightness from the sun, not a hue-only match.

Bolt centre x = 360.00 at every still. Card height 1.15 m. Draws 9. The live page reports 195818 triangles. The CPU budget is 195634. Both are under 200000. Texel gate PASS at 2048 px/m. Planet magnification 0.950. The equirect stretch of 2.0 is the old report, not a new scale.

`dawn-light.json` is unchanged. The sky function is unchanged apart from the ±1 code dither, whose mean is zero. An SH fit of this sky would move by less than the sky's own ΔE of 1. It was not rebaked.

## Still open

The heading is outside ±15° at 5.10, 5.567, 11.70, and 24 s. At 24 s the sun-facing half is behind the ice, so the bright edge that remains is not the subsolar heading. At 5.567 the bright mass sits higher than the sun. The sun-facing half is still the brighter half at every time, by 73 to 97 luma.

The planet is lighter than the plate. The run-31 dark line on the horizon is untouched. No fog was added.
