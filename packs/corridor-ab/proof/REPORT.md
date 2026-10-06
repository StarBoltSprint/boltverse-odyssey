# Report — corridor chase, sprint, and streaming props

Verdict: PASS

| # | Done when | Result |
| --- | --- | --- |
| 1 | Chase eye above 2.6 m, behind Bolt, pitched down. Stick-right turns toward camera-right. | `look.test.mjs`: eye y 3.5, boom 6.1, pitch below −0.2. Settled titles `eyeY` 3.5. Stick-right increases heading toward camera-right. |
| 2 | Paw line on y = 0 | `look.test.mjs` paw row. Titles `pawY` 0 at walk and at sprint. |
| 3 | Sprint climbs under a hold and eases on release | `look.test.mjs`. Film titles: speed 1.65 → 3.22 → 4.54 → 6.85. Settled sprint is 8.6 with charge 1. Walk stays 2.85. |
| 4 | Same seed and speed history, more rocks when faster, new slots outside the near radius | `stream.test.mjs`. Walk rocks 13, live 15. Sprint rocks 33, live 36. The sprint cone holds more rocks than the walk. |
| 5 | Arch opening walkable. Rock contact is the hull. No position clamp. | Titles `archOpen` true, `archPier` true. The carpet runs from 40 m before the link to 160 m past it, and ±70 m off the path. |
| 6 | Selftests | `hang_selftest.py` exit 0. `node --test packs/corridor-ab/play/*.test.mjs` 20 pass. `renderlint` PASS on six sources. |
| 7 | Proofs | `proof/walk-speed.png`, `proof/sprint-speed.png` (720×1600). `proof/emerge.mp4` 720×1600, 16 frames, 3.2 s, 2,011,232 bytes. |
| 8 | No new Imagine file. WFC stays load-time. | Props are the zone A lofts and boulder/stone hulls. `when` on the corridor solve is still `load`. |

Phone line, walk (`?shot=walk`, seed 68): `drawCalls=7`, `texMB=211.2`, `activeVideos=4`, `jsMs=0.8`, `glError=0`, rocks 13, live 15, speed 2.85, charge 0.

Phone line, max sprint (`?shot=sprint`): `drawCalls=7`, `texMB=211.2`, `activeVideos=4`, `jsMs=0.6`, `glError=0`, rocks 33, live 36, speed 8.6, charge 1. The gate is seated only at this pace.

Film frame 15 briefly shows `activeVideos` 3 while the gallop clip hands off. That stays inside the cap of 4.
