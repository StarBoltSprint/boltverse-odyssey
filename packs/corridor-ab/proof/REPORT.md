# Report — corridor look, sky, and props

Verdict: PASS

| # | Done when | Result |
| --- | --- | --- |
| 1 | Stick yaw and a swipe that eases back | `node --test packs/corridor-ab/play/look.test.mjs` pass. The spring returns to level after a drag. |
| 2 | Sky fills 0°, 90°, 180°, 270° and a tilt | Proof PNGs. Top 40 rows: dark pixels below luma 8 are 0, 2, 0, 0, 0 of 28800. Means 50.6, 107.4, 93.6, 65.1, 95.5. |
| 3 | Hulls, arch, gate, wreck, seed moves them | `scatter.test.mjs` pass. Play reports rocks 34. Seed 68 places the arch at x 21.75, the gate at x 52.89, the wreck at z 24.18. |
| 4 | Arch opening walkable, pier blocks | Play `archOpen` true, `archPier` true. |
| 5 | One straight run, 60–120 m | `length_m` 79.75, `straight` true, cols 56. |
| 6 | Selftests | `hang_selftest.py` exit 0. `place.test.mjs`, `scatter.test.mjs`, `look.test.mjs` pass. `renderlint` PASS on the four play sources. |
| 7 | Proof frames | `proof/hdg-0.png`, `hdg-90.png`, `hdg-180.png`, `hdg-270.png`, `tilt-up.png`. 720×1600. |
| 8 | No new Imagine file, no mid-run WFC | Placement is `placeProps` at load. No image was generated. |

Phone line on the settled frames: `drawCalls=7`, `texMB=211.2`, `activeVideos=4`, `glError=0`.
