# Run 32 round 2 — coat bands, back roll, readable prints

Not a KEEP. Draft only. Director reviews the captures.

The no-bands gate was committed before this light change. Limit: mean vertical (B−R) steps on the torso crop ≤ 0.5. The blue-band fixture fails (worst 4.06). The pre-D card passes (worst 0.03). The new stills pass (worst 0).

## Light

The distance field is blurred into a dome before the gradient, so the back is not a flat plateau. The vertical slope of that dome rolls the back up and the belly down. The slope is clamped and the facing component stays large, so a ripple cannot become a stripe.

Bolt uses the dawn ambient and the dawn sun, the same record as the snow. The sun is applied on upward normals. The belly stays on the ambient. There is no blue grade and no white specular.

## Prints

Paw-down still stamps the 16-bit trail. A bowl is also laid every 0.28 m, 0.38 m behind the paws, because that is the snow the follow camera still has. The lens loses the ground about 0.8 m behind Bolt, so a print 4–6 m behind him is off the frame. The print in the chase sits at the bottom of the frame, about 2 m from the camera, and is a dark bowl in the Imagine snow (no painted colour). The 10 m buffer still holds: a print at 10.00 m is height −0.711.

This SwiftShader has no `texture-formats-tier1`, so the 16-bit value is packed in RG8. `r16unorm` is used when the feature exists.

## Gates

| Gate | Result | Limit |
| --- | --- | --- |
| No bands, blue-band fixture | FAIL (worst 4.06) | must fail |
| No bands, pre-D | PASS (worst 0.03) | ≤ 0.5 |
| No bands, new stills | PASS (worst 0) | ≤ 0.5 |
| Base colour CIE76 | mean 0.49, worst 1.78 | ≤ 3 |
| Lab b, back − belly | 12.77, 12.13, 10.97, 10.48 | ≥ 3 |
| Belly B/R above back | 0.543>0.419, 0.591>0.428, 0.498>0.429, 0.478>0.415 | greater |
| Paw down / up | 0.379–0.401 / 0.986 | ≤ 0.55 / ≥ 0.85 |
| Paw correlation | 0.946 | ≥ 0.7 |
| Prints at 7.5–10 m | behind 9.19, 9.30, 9.42 then 10.00 m, height −0.711 | held |
| Card / draws | 1.15 m, screen x 360, 8 draws | unchanged / ≤ 12 |
| Triangles | CPU gate 195634, live page 195818 | ≤ 200000 |
| Texel gate | PASS | 2048 px/m |

## Still open

The follow camera cannot show a print that is 4–6 m behind Bolt. The readable print is the near bowl at the bottom of the frame.

The back is warmer than the belly, but the roll is a smooth dome, not a sculpted ribcage. Frame 24's belly is the least blue of the four.

The thin dark horizon line from run 31 is still there. Shoulder-ice and range-serac are still one still short. No 45 s chase. This film is 8 s at 10 fps.
