# Report — corridor horizon and one ground

Verdict: PASS

| # | Done when | Result |
| --- | --- | --- |
| 1 | Horizon between 30% and 35% from the top. Eye 3.5 m, behind Bolt. Stick-right still turns toward camera-right. | `look.test.mjs`. Eye y 3.5. Aim y 2.52. Pitch about −9°. Settled titles `eyeY` 3.5. |
| 2 | Bolt's body is in the lower third. Paws stay on y = 0. | The same test puts the body below the lower-third line. Titles `pawY` 0. On the walk still the bright body sits from about row 1200 to 1450. |
| 3 | Arch top inside the frame at 20 m and at 30 m ahead. | The test puts the 7.4 m arch top between the frame top and the horizon at both distances. The walk still shows sky above that arch. |
| 4 | One ground still, native size, one layer. | Title `ground` `m3`, `groundLayers` 1, `groundPx` 1024. One quad. The sampler repeats it. |
| 5 | Sprint still climbs. A faster pace still streams more rocks. | Walk speed 2.85, rocks 13. Sprint speed 8.6, rocks 33. The clip climbs 0.07 → 4.95 while rocks go 5 → 33. |
| 6 | Selftests | `hang_selftest.py` exit 0. `node --test packs/corridor-ab/play/*.test.mjs` 20 pass. `renderlint` PASS on six sources. |
| 7 | Proofs | `proof/walk-speed.png`, `proof/sprint-speed.png` (720×1600). `proof/sprint-run.mp4` 720×1600, 72 frames, 24 fps, 3.0 s, 2,353,380 bytes. |
| 8 | No new Imagine file. WFC stays load-time. | The floor still is `packs/zone-a/src/ground/m3.png`. The corridor solve is still `when: load`. |

Phone line, walk (`?shot=walk`, seed 68): `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `jsMs=3.6`, `glError=0`, rocks 13, live 15, speed 2.85, charge 0.

Phone line, max sprint (`?shot=sprint`): `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `jsMs=3.5`, `glError=0`, rocks 33, live 36, speed 8.6, charge 1.

The 28 m Eclipse Gate still rises past the top of a 22.7° portrait when it is 20–30 m ahead. The arch (7.4 m) and the wreck (4.1 m) fit. Opening the lens was not part of this step.

On the sprint clip a video count dips to 2 while the gallop clip hands off. That stays inside the cap of 4.
