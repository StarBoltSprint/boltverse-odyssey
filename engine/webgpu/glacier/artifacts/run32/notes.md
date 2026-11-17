# Run 32 round 4 — a dent in the grain, not a two-tone smudge

Not a KEEP. Draft only. Director reviews the captures.

Round 3 stays except the print and the left paw. The crater is gone, the contact oval is back, the coat is the same, the print is still one paw-scale dent fixed in the world, the follow view stays centred, and the card stays 1.15 m.

## Gate, committed first

`test-print-lobe.mjs` finds a print mask in the nearest snow. Inside the mask, the brightest pixel may not exceed the 95th percentile of the snow around it. The mask mean stays between 0.85 and 1.0 of that snow. High-frequency energy inside the mask stays at least 0.6 of the ring, so the Imagine grain is still there.

The round-3 24 s crop fails (max 207.7 against a ring p95 of 179.1). Clean snow passes. The new stills pass. Where a chase frame still has a readable dent, the mask is darker than its ring, never brighter, and the grain ratio stays above 0.6.

## Print

The steep normal on the trail is gone. That tilt was the white lobe on the sun side and the blue-grey pit on the other. The dent is now a multiply of the snow that is already there, about a quarter of the trail depth at the centre, with a very small normal nudge. After lighting, the result is clamped so it cannot come out brighter than the same snow without the dent. No colour is mixed in. No sheen is added on top of that clamp.

The follow camera still cannot show a trail 4–6 m behind Bolt. The buffer holds the dent: at 10.03 m the height is −0.702, and the snow there is darker than the snow beside it.

## Left paw

The left paw at 5.10 s was darker than the pre-D grade because the 0.5 scale that holds the back leaves the low-alpha paw outline on ambient only. The sun term was not raised. Below the belly band (uv.y from 0.80, under the Lab samples) the card gets the same small fill the pre-D paw carried, including that outline. Mean colour of the left paw against the pre-D still is CIE76 2.26. The coat numbers did not move.

## Gates

| Gate | Result | Limit |
| --- | --- | --- |
| Print lobe, round-3 crop | FAIL, max 207.7 > p95 179.1 | must fail |
| Print lobe, clean snow | PASS | no mask |
| Print lobe, round 4 stills | PASS | max ≤ ring p95, mean 0.85–1.0, grain ≥ 0.6 |
| Print rings / blobs, round 4 | 0 / 0 on all six | ≤ 12 / ≤ 1106 |
| Contact ratio, round 4 24 s | 0.794 | 0.829 ± 0.045 |
| No bands, fixture / pre-D / round 4 | 4.06 fail / 0.03 pass / 0 pass | ≤ 0.5, fixture must fail |
| Base colour CIE76 | mean 0.49, worst 1.78 | ≤ 3 |
| Lab b, back − belly | 12.77, 12.13, 10.97, 10.48 | ≥ 3 |
| Belly B/R above back | unchanged from round 3 | greater |
| Paw down / up | 0.379–0.401 / 0.986 | ≤ 0.55 / ≥ 0.85 |
| Paw correlation | 0.946 | ≥ 0.7 |
| Prints at 7.5–10 m | 9.09, 9.21, 9.33, then 10.03 m, height −0.702 | held |
| Card / draws / tris | 1.15 m, x 360, 8 draws, 195818 tris | unchanged / ≤ 12 / ≤ 200000 |
| Left paw vs pre-D, 5.10 s | mean colour dE 2.26 | ≤ 3 |

## Still open

A print 4–6 m behind Bolt is in the buffer and not in the follow frame. The dent in the nearest snow is shallow on purpose.

The chase is 720×1280, 8.0 s, 240 frames, 30 fps, Bolt centred at x 360. At 1.2, 1.4, 2.2, 3.2, 4.0, 4.3, 5.0, 5.6, 6.3, 6.6, 6.8, 7.6 and 7.9 s the lobe gate passes. The readable dents (1.4 s, 2.2 s, 6.3 s) sit at 0.91–0.93 of the surrounding snow, with the grain ratio above 0.8, and none of them is brighter than that snow.

The thin dark horizon line from run 31 is still there. Shoulder-ice and range-serac are still one still short.
