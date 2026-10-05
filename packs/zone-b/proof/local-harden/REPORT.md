Zone B local harden. No Imagine cooks. No new assets. Owner lessons stay on main (PR #174). This note is the Zone B pointer: face colliders, `?debug=1` only, one post pass, planet mp4 when `planet.json` names a video.

Verdict: PASS

Phone page was not re-shot. The last phone snapshot on this branch (step 2) was drawCalls 10, texture bytes 258192536 (246.2 MiB), active videos 4. Those draws did not include the post pass.

| row | measured | PASS/FAIL |
|---|---|---|
| Plaza arch | `node packs/zone-b/play/hard-collide.test.mjs`. Opening signed distance 0.800 m. Leg −0.258 m. Walk from z 48, step 0.4, 80 times, ends at x 0.00 z 80.00. Build 395 ms, 27 parts. | PASS |
| Anchor mouth | Same test. Centre signed distance −2.200 m. Pier min −3.950 m. A cell inside the footprint is +0.198 m, so the field is not a solid box. wallCells 4170. sealed 0. The loft bridges the painted arch. Walking it still needs an Anchor redo. | PASS |
| Debug text | `#hud` starts `display: none`. `SHOW_HUD` is `?debug=1` only. `paintHud` clears the text otherwise. A boot exception still writes `BOOT`. `frame` still skips `tick` when the search contains `debug=1`. | PASS |
| Draws | `composite` no longer draws the bright pass or the two blurs. It returns 1. `render` adds that 1. Bloom stays off. Honest sum of the step 2 scene count plus this pass is 11, under 12. Not a new phone reading. | PASS |
| Textures | The half-resolution bloom targets are not allocated. The post sample is 1×1. When `planet.json` has `video`, the PNG is not uploaded. | PASS |
| Videos | Cap stays 4: idle Bolt, haze, planet, beacon. The gate stays paused on the step 2 pose. No decoder was added. | PASS |
| Planet file | `planet-body.mp4` is h264 1280×720, 24 fps, 6.041667 s, 145 frames. `planetVideo.loop` is true. After `uploadPlanet` succeeds, the card samples that texture. Two decoded frames (about 1.4 s and 5.2 s) differ: mean abs 2.129 per channel, 605607 of 921600 pixels nonzero. That is a file difference. This step did not open the play page, so it does not show that the disk turns. | PASS |
| Lint | `node --check` on `play.js`, `hard.js`, `terrain.js`, `collide.js`. `lintPlaySource` clean on `play.js` and `hard.js`. `terrain.js` still reports NEAREST on the depth buffer and two static `bufferData` uploads. Those lines were already there. | PASS |

Still needs Imagine: an Anchor redo whose mesh leaves the arch open in the body band; rocks as 3D hulls (Zone B rocks stay cutout cards); a new planet cook if the turn on the phone is not obvious. Plaza lintel skin, the upper gradient join, and view drift stay stopped.
