# Run 32 round 3 — no crater, soft contact

Not a KEEP. Draft only. Director reviews the captures.

Round 2 coat work stays: no blue bands, dawn on the back, darker belly, no spec. The no-bands gate was not moved. The print and contact gates were committed before this change. The round-2 stills fail both. The pre-D card passes both.

## What changed

The sliding foreground bowl is gone. Nothing is stamped along the path behind Bolt. A paw-down writes one paw-scale dent (about 9 cm by 14 cm) at the foot, fixed in the world. The trail buffer still holds that dent: a print at 10.03 m is height −0.702, and the snow there is darker than the snow beside it. The follow camera cannot show a print 4–6 m behind Bolt. That trail is off the frame. The shader does not invent one. On screen the dent is a slight darkening of the Imagine snow (8% at full depth) and a small normal nudge. There is no bright rim and no navy cavity.

The contact oval is back under the hind paws: a wide, short multiply of the snow, about the pre-D 24 s footprint. A planted paw still darkens its own disk. The oval sits off the lifted-paw sample, so a raised paw does not leave a black disk.

The lower legs use more of the card albedo. The 0.5 scale that holds the back stays on the belly band (uv.y through 0.78). The unlit card paw at 5.10 s is already about (45, 37, 35). The lit paw is within CIE76 1.5 of that. The pre-D paw was brighter because of the old grade, which is not the card.

The sun term and the 0.5 back exposure were not raised. Lab b and B/R match the round-2 coat numbers.

## Gates

| Gate | Result | Limit |
| --- | --- | --- |
| Print rings, round-2 fixture | 155–270 | must fail (> 12) |
| Print blob, round-2 fixture | 3974–7272 | must fail (> 1106, paw 48 px) |
| Contact ratio, round-2 fixture | 0.902 | must fail (pre-D 0.829 ± 0.045) |
| Print rings, pre-D | 0 | ≤ 12 |
| Print blob, pre-D | 0–501 | ≤ 1106 |
| Contact ratio, pre-D 24 s | 0.829 | 0.829 ± 0.045 |
| Print rings, round 3 | 0 on all six | ≤ 12 |
| Print blob, round 3 | 0, 0, 0, 120, 785, 0 | ≤ 1106 |
| Contact ratio, round 3 24 s | 0.857 | 0.829 ± 0.045 |
| No bands, blue-band fixture | FAIL (worst 4.06) | must fail |
| No bands, pre-D | PASS (worst 0.03) | ≤ 0.5 |
| No bands, round 3 | PASS (worst 0) | ≤ 0.5 |
| Base colour CIE76 | mean 0.49, worst 1.78 | ≤ 3 |
| Lab b, back − belly | 12.77, 12.13, 10.97, 10.48 | ≥ 3 |
| Belly B/R above back | 0.543>0.419, 0.591>0.428, 0.498>0.429, 0.478>0.415 | greater |
| Paw down / up | 0.379–0.401 / 0.986 | ≤ 0.55 / ≥ 0.85 |
| Paw correlation | 0.946 | ≥ 0.7 |
| Prints at 7.5–10 m | behind 9.09, 9.21, 9.33 then 10.03 m, height −0.702 | held |
| Card / draws | 1.15 m, screen x 360, 8 draws | unchanged / ≤ 12 |
| Triangles | live page 195818 | ≤ 200000 |

This SwiftShader has no `texture-formats-tier1`. The 16-bit trail value is packed in RG8. `r16unorm` is used when the feature exists.

## Still open

A print 4–6 m behind Bolt is not in the follow frame. The buffer holds it. The picture does not.

The left paw matches the dark paw in the card. It is not the brighter pre-D grade.

The chase is 720×1280, 8.0 s, 80 frames, 10 fps, Bolt centred at x 360. At the times where round 2 slid a crater through the stance (1.0, 1.4, 2.6, 4.2, 5.0, 6.0, 7.0, 7.8 s) the ring count is 0, 1, 0, 0, 0, 0, 0, 0. The limit is 12.

The thin dark horizon line from run 31 is still there. Shoulder-ice and range-serac are still one still short. No 45 s chase. This film is 8 s at 10 fps.
