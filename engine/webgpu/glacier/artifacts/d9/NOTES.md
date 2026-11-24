# D9 notes

Not a KEEP. The stills are for the Director and the Critic.

The planet is lit by the scene sun `[0.6161, 0.5592, 0.5547]` (elevation 34 deg). That vector is not the dawn-light sun, and `dawn-light.json` was not edited. The normal is the radial vector from the planet centre. The plate's own broad light is divided out with mip 5. There is no output clamp. The sun-facing silhouette is darkened and given a blue tint so crater highlights stay under the lit-disc p99. A blue lift sits on the N·L ≈ 0 band and dies before the deep night limb. The atmospheric shell is a few percent of the radius. The sky dither is unchanged: ±1 code of 64×64 blue noise.

No new Imagine plate. `tex/glacier-planet-surface.jpg` is still 1024×1024.

## Round 3 gates

The round-2 stills fail the new limb gates on all six times (`r2-limb-gate.json`): hundreds of near-white pixels where the limb burned, a night rim about 30% of the radius, and a dark limb within a few levels of the sky. The ±15° heading bar was not moved.

The old bright-rim gap (outer ring at least 4 above the pre-rim) is the haze those gates forbid. It is not a pass condition anymore. The measured gap is negative, which is the dark limb.

| t | shader N·L | edge | visible | near-white | rim width | dark gap | limb max | lit p99 | lit − unlit | sky step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5.10 | 4.1 | 6.3 | 0.41 | 0 | 0.02 | 91.1 | 178 | 205 | 49.4 | 1 |
| 5.567 | 4.4 | 6.3 | 0.44 | 0 | 0.02 | 92.2 | 197 | 207 | 54.5 | 1 |
| 7.9 | 7.6 | 5.8 | 0.35 | 0 | 0.02 | 89.4 | 168 | 219 | 56.2 | 1 |
| 11.70 | 4.9 | 4.9 | 0.45 | 0 | 0.02 | 90.1 | 178 | 216 | 59.2 | 1 |
| 24 | 14.6 | 14.9 | 0.32 | 0 | 0.02 | 88.8 | 149 | 152 | 48.8 | 1 |
| 30 | 7.9 | 13.2 | 0.36 | 0 | 0.02 | 87.8 | 189 | 209 | 57.0 | 1 |

Band run is 5 at every time. Heading limit ±15. At 24 s, 32% of the on-screen terminator arc is free of ice, over the 30% line, so 14.9° stands. Shader N·L at 24 s is 14.6°.

## Colour, planet pixels only

Ice is excluded with the N·L mask. Lit is N·L > 0.25. Dark is N·L < −0.05. The key disc is front-lit. Its own lit-versus-dark CIE76 is 2.63, 2.99, 1.51, 3.15, 3.77, 1.15.

The dark side against that key is 4.18, 3.55, 2.83, 3.52, 3.73, 3.70, inside 10, lightness included. The lit side is 32.5, 31.7, 43.2, 37.7, 40.4, 38.0, because the key has no day side. It was not pulled toward the key. Sheet: `colour/planet-only-7.9-11.7.jpg` (7.9 on top, 11.7 below, key on the left). 11.7 has the larger lit set (17547 planet pixels).

## Kept

Sky step 1 and band run 5. Dither grain about 1 level. Sky anchor worst 0.00762, limit 0.015, not re-fit: the sky function was not edited. Clear-sky CIE76 against the pre-change frames is 0.36–0.72, lightness included. Draws 9. Live page 195818 triangles. CPU budget 195634. Both under 200000. Texel gate PASS at 2048 px/m. Bolt at x = 360.00, card 1.15 m. Sun vector untouched. No new plate. No fog. SH was not rebaked.

4× crops of the sun-facing limb and the dark limb are in `after/edge/`. The ice spires in front of the disc are the existing terrain.

## Still open

The key disc is front-lit, so the new day side is not the same colour as the key. The run-31 dark line on the horizon is untouched. At 24 s the beauty edge is 14.9°, inside 15 and close to the shader's 14.6°.
