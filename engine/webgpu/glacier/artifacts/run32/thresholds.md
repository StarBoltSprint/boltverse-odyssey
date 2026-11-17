# D5 thresholds — written before the trial

Run 32. Branch `cursor/d5-bolt-light-trail-8838`. These numbers are the gate. They are not moved after the capture.

The phone budget is unchanged: 200000 triangles, 12 draws. Run 31 was 195634 triangles and 9 draws. This run may drop the contact-decal draw. It does not add one.

| Gate | Threshold | How it is measured |
| --- | --- | --- |
| Bolt base colour | CIE76 ≤ 3, lightness included, worst interior sample and the mean | Albedo diagnostic: the card samples the bolt439 atlas and `present`s it with no tint. Compared with `present22(srgbToLinear(plate texel))` on interior texels, alpha > 0.75, four cells (0, 8, 16, 24). Uniform coat neighbourhoods only (luma range under 28), so a one-pixel fur edge is not the sample. |
| Cool belly / warm back | Lab b of the back band minus Lab b of the belly band ≥ 3. Belly linear B/R greater than the back. | Lit card only. Back band uv.y 0.28–0.48. Belly band uv.y 0.58–0.78. uv.x 0.35–0.65. uv.y 0 is the head. |
| Paw down | Snow Y in the paw disk / Y of snow 0.45 m to the side ≤ 0.55 | `PAW_FRAC ≥ 0.12` (a peak is a contact). 32-frame scan, bolt card not covering the sample. |
| Paw up | Same ratio ≥ 0.85 | `PAW_FRAC ≤ 0.040`. |
| Paw correlation | Pearson r ≥ 0.7 over all 32 frames | Correlate `1 - (frac - min) / (max - min)` with the Y ratio. High lift, high ratio. |
| Prints, three frames | The same stamp stays above 0.35 of its peak for 3 consecutive frames | Look-back probe. The follow camera stays 2.35 m back and is not moved to cheat this. |
| Prints, distance | That stamp is ≥ 7.5 m behind Bolt, and the buffer still holds it at 10 m (above 0.25 of peak) | World distance along the heading. Full strength through 10 m, fade 10–12 m. |
| Card | Height 1.15 m. Screen x stays the centred follow view (capture mean within 28 px of 360, same check as `capture.mjs`) | `boltIdle` card. Not resized. |
| Texel | `test-texel-density.mjs` PASS | `MIN_PX_PER_M` 2048, not overridden. |
| Draws | ≤ 12 | `DRAWS.length`. |
| Triangles | ≤ 200000 | Unchanged mesh. |
| Fog | No new distance-to-sky mix | Existing aerial term is not extended. |
| Identity | Same atlas, same card, x = 360 | No new dog. |

Paw-down and paw-up are the extremes of `PAW_FRAC`. Frames between them are only in the correlation.
