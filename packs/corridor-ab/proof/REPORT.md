# Report — corridor horizon break, seated rocks, whole monolith

Verdict: PASS

Date: 2026-10-06

| # | Done when | Result |
| --- | --- | --- |
| 1 | Horizon silhouettes are existing boulder or stone hulls, at least 8 m tall, inside the 22.7° view, clear of the run, sharing the hull draws. | `horizonSeats` returns 8 seats. Heights 8–13.8 m. Each lateral is inside `tan(11.35°)` and past the footprint. They instance on the boulder and stone draws already in the page. Draw calls stay 7. |
| 2 | Ground fog colour comes from a sky-slice average. Density and cap stay inside law 67. Bolt is not fogged. | Titles `fogOn` 1. Samples are `sky-0.jpg`, `sky-4.jpg`, `sky-8.jpg`, rows 0.72–0.90. Density 0.015, cap 0.58. The Bolt shader has no fog uniform. |
| 3 | A settled rock bottom is −0.18 m. A rising rock is lower. | `rockBottom(1)` is −0.18. `rockBottom(0.4)` is lower. The rise starts under the plane. |
| 4 | The gate sits about 16 m off the run. Pitch-up keeps the 28 m top in frame, within about 12° of the rest pitch, and never looks further down. | Sprint title `gateLat` 16. Rest pitch −0.159. On the pass clip the pitch moves −0.159 → −0.141 (up only). Far from the gate the pitch stays −0.159. |
| 5 | Walk shows fewer rocks than sprint. The arch stays on the path. WFC does not run during play. | Walk rocks 13, gate null, arch z 2.175. Sprint rocks 33, gate present. `hang_selftest.py` exit 0. |
| 6 | Selftests | `hang_selftest.py` exit 0. `node --test packs/corridor-ab/play/*.test.mjs` 24 pass. `renderlint` PASS on six sources. |
| 7 | Proofs and phone numbers | Stills `walk-speed.png`, `sprint-speed.png`, `rocks-grounded.png`. Clip `monolith-pass.mp4` 720×1600, 72 frames, 24 fps, 3.0 s, 1,627,162 bytes. |
| 8 | No new Imagine file. | No new image or video cook. Hulls, lofts, ground, and sky slices are the zone A files already in the tree. |

## Phone numbers (law 65, 720×1600, seed 68)

| | Walk | Max sprint |
| --- | --- | --- |
| drawCalls | 7 | 7 |
| texMB | 184.5 | 184.5 |
| activeVideos | 4 | 4 |
| jsMs | 0.9 | 1.2 |
| glError | 0 | 0 |
| rocks / live | 13 / 15 | 33 / 36 |
| speed | 2.85 | 8.6 |
| charge | 0 | 1 |
| eyeY / pawY | 3.5 / 0 | 3.5 / 0 |
| fogOn | 1 | 1 |

Caps stay drawCalls ≤ 12, texMB ≤ 260, videos ≤ 4. Draws and texture MB match the previous horizon pass. The pass clip at speed 8.6 reads the same 7 draws and 184.5 MB; jsMs on that clip is 1.5 after the first frame. A video count of 3 on the clip is the gallop handoff and stays inside the cap.

The gate offset is 16 m, not 55 m. At 55 m the monolith sits outside the 22.7° lens for the whole approach. 16 m clears the gate footprint and stays inside that lens while the top still fits. A sprint looks out to 150 m so the gate is drawn before it leaves the lens. A walk keeps the shorter window, so the gate still waits.

LOD swaps were not part of this pass.
