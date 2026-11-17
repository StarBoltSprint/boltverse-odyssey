# Run 32 — D5 Bolt integration

Not a KEEP. Not live. Not merged. Director and Critic/Art decide from the captures.

Bolt stays the bolt439 card. Height 1.15 m. Screen x is 360 on every still. Draws 8. The CPU gate counts 195634 triangles. The live page reports 195818, the same number the run 31 page reported. Both are under 200000.

## What the pixels do

The coat normal is rebuilt in the page from a chamfer distance of the atlas alpha. The dawn sun, a sky hemisphere, and a snow-bounce term then light that normal. Albedo is the atlas texel with no tint. A violet sky rim sits on the silhouette. There is no white specular.

Four capsules (hips to feet) and a body ellipsoid darken the snow. Foot height follows `PAW_FRAC`. A paw-down foot is on the snow. A lifted foot is not.

Prints are stamped into a 16-bit trail at the paw-down peak and read by the snow shader: a dark bowl, a lighter packed rim, and a normal from the height. They stay full through 10 m and fade by 12 m.

This SwiftShader device does not expose `texture-formats-tier1`, so `r16unorm` cannot be created. The same 16-bit value is packed in RG8 and unpacked in the shader. When the feature exists the texture is `r16unorm`.

## Gates

Thresholds were committed before the trial (`thresholds.md`). They were not moved.

| Gate | Result |
| --- | --- |
| Base colour CIE76 | mean 0.49, worst 1.78, limit 3. 13 uniform interior samples. |
| Lab b, back minus belly | frame 0: 16.81. frame 8: 16.72. frame 16: 7.82. frame 24: 15.24. Limit 3. |
| Belly B/R greater than back | 1.343 > 0.676, 1.477 > 0.692, 0.807 > 0.685, 1.249 > 0.676. |
| Paw down Y ratio | 0.379–0.401. Limit 0.55. |
| Paw up Y ratio | 0.986. Limit 0.85. |
| Paw correlation, 32 frames | 0.946. Limit 0.7. |
| Prints, 3 frames | behind 9.09, 9.21, 9.32 m. Centre Y 0.076 vs side 0.42. Height −0.707. |
| Print at 10 m | behind 10.02 m, height −0.707. |
| Card | 1.15 m. Screen x 360. |
| Texel gate | PASS. 2048 px/m not overridden. |
| CPU gate | PASS. Draws 8. Triangles 195634. |
| Fog | No new term. |

## Still open

The follow camera sits 2.35 m behind Bolt, so a print 7.5 m behind him is behind the lens. The three-frame proof is a look-down probe, not the chase frame. Nearer prints are in the chase stills.

The upper back of the card is near the medial axis of the distance field, so that normal is almost flat. The cool belly is the strong half of the split. Frame 16's belly is the least cool (Lab b +1.05 against a back of +8.87).

The trail format on this machine is RG8 packing of a 16-bit value, not an `r16unorm` texture.

The thin dark horizon line from run 31 is still there. The shoulder-ice and range-serac sets are still one still short, so they are not installed.

No 45 s chase. This film is 8 s at 10 fps, 720×1280.
