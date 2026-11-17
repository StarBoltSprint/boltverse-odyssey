# D9 notes

Not a KEEP. The stills are for the Director and the Critic.

The planet is lit by the scene sun `[0.6161, 0.5592, 0.5547]` (elevation 34 deg). That vector is not the dawn-light sun, and `dawn-light.json` was not edited. The normal is the radial vector from the planet centre. The plate's own broad light is divided out with mip 5 so the photograph's frontal grade does not fight the sun. Craters stay. A thin blue rim sits on the silhouette, stronger on the day side. The sky is the same function plus a 64×64 blue-noise dither of ±1 code before the 8-bit store.

No new Imagine plate. `tex/glacier-planet-surface.jpg` is still 1024×1024.

## Gates

Limits were not lowered. The run-31 fixture still fails the terminator and the banding gates (`fixture-before.json`).

The first heading was a sector average of the whole disc, so craters and the hidden side pulled it. The shader N·L mask agrees with the projected sun (the zero line is in world space). The edge is now the luma gradient on the band where analytic N·L is within 0.12 of zero.

| t | shader N·L error | edge error | terminator visible | lit − unlit | rim gap | sky step | band run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 4.1 | 0.6 | 0.41 | 93.0 | 30.0 | 1 | 5 |
| 5.567 | 4.4 | 0.8 | 0.44 | 92.1 | 45.1 | 1 | 5 |
| 7.9 | 7.6 | 1.2 | 0.35 | 92.7 | 13.1 | 1 | 5 |
| 11.70 | 4.9 | 0.4 | 0.45 | 97.1 | 12.8 | 1 | 5 |
| 24 | 14.6 | 13.2 | 0.32 | 73.4 | 18.3 | 1 | 5 |
| 30 | 7.9 | 0.4 | 0.36 | 80.7 | 31.8 | 1 | 5 |

Heading limit ±15, not moved. Every time is inside it. At 24 s, 32% of the on-screen terminator arc is free of ice, which is over the 30% line, so the 13.2° stands. Shader N·L is the debug mask, not a beauty retune.

The key planet is front-lit. Its own lit-versus-shadow CIE76 is 0.68, 0, 2.01, 3.91, 24.15, and 1.37. Five of those are a flat disc. The new shadow side against that key is 7.0–8.4. The new lit side is 18.8–45.7, because the key has no day side. It was not pulled toward the key. Crops: `colour/t7.9-key-vs-after.jpg` (key lit, new lit, key shadow, new shadow).

Sky anchor worst 0.00762, limit 0.015. The screen-space control is 0.052 and still fails, as required.

Left-side terrain silhouette moves by at most 2 rows. Sky fraction is 1.02× the pre-change frames. Sky CIE76 against those frames is 0.00–0.96, lightness included.

Bolt centre x = 360.00 at every still. Card height 1.15 m. Draws 9. The live page reports 195818 triangles. The CPU budget is 195634. Both are under 200000. Texel gate PASS at 2048 px/m. Planet magnification 0.950. The equirect stretch of 2.0 is the old report, not a new scale.

`dawn-light.json` is unchanged. The sky function is unchanged apart from the ±1 code dither, whose mean is zero. An SH fit of this sky would move by less than the sky's own ΔE of 1. It was not rebaked.

## Still open

The key disc is front-lit, so the new day side is not the same colour as the key. The run-31 dark line on the horizon is untouched. No fog was added.
