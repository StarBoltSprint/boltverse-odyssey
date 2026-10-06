# Report — corridor ground covers the pass start

Verdict: PASS

Date: 2026-10-06

The black floor on `monolith-pass.mp4` was the carpet extent. The quad’s west edge was `xStart − 40` (`xmin` −40.6). The pass shot starts Bolt at −63.275, and the camera sits 6.1 m behind him, so the near ground (about the bottom 60% of the frame) fell off the quad and showed the clear colour. Fog mixes toward a sky sample, and the m3 crossfade was already on the fragments that were drawn. Walk starts at 6.725, inside the old carpet, which is why `walk-speed.png` stayed textured.

`carpetWest` takes the further west of the walk apron and the pass Bolt minus 40 m. The west edge is now −103.275 (`xmin` −104.4). One quad, the same native m3, the same draw.

| # | Done when | Result |
| --- | --- | --- |
| 1 | Carpet west edge is at least 40 m behind the pass-shot Bolt. | `carpetWest(0.725, −63.275)` is −103.275. The play test “the carpet covers the ground under the pass camera” passes. |
| 2 | Frame 0 has no black floor in the bottom 60%. | Pure black (`r,g,b < 8`) in the bottom 60% is 0.36% (was 82% on the old frame 0). Mean luma there is 48.8. The largest dark blob is a small silhouette, not a floor wedge. |
| 3 | Every 6th frame is the same. | Frames 0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66. Bottom-60% pure black is 0.36%–1.43% on the source and 0.37%–1.57% on the encoded clip. No bottom row is more than 14% black. No run of rows is a black band. |
| 4 | Walk and sprint stay at 7 draws and 184.5 MB. | Both titles: `drawCalls` 7, `texMB` 184.5, `activeVideos` 4, `glError` 0, `fogOn` 1, `pawY` 0, `eyeY` 3.5. Walk rocks 13, jsMs 3.2. Sprint rocks 33, live 36, jsMs 0.9, `gateLat` 16. |
| 5 | Tests | `node --test packs/corridor-ab/play/*.test.mjs` 25 pass. `hang_selftest.py` was already exit 0 on this tree. `renderlint` was already PASS on the six sources. No play source changed after those gates. |
| 6 | Frame-0 still | `monolith-frame0.png` is the new frame 0 (byte-identical to the capture). |
| 7 | No new Imagine file. | The clip is a re-record of the same page. |
| 8 | The three nit fixes stay. | Horizon seats, `rockBottom` −0.18, gate at 16 m, pitch −0.159 → −0.141 on the new clip. |

## Phone numbers (law 65, 720×1600, seed 68)

| | Walk | Max sprint | Pass frame 0 |
| --- | --- | --- | --- |
| drawCalls | 7 | 7 | 7 |
| texMB | 184.5 | 184.5 | 184.5 |
| activeVideos | 4 | 4 | 3 |
| jsMs | 3.2 | 0.9 | 15.7 |
| glError | 0 | 0 | 0 |

Caps stay drawCalls ≤ 12, texMB ≤ 260, videos ≤ 4. Draws and texture MB match the previous table. jsMs moves with the frame; the first pass frame is 15.7 and later frames on the same clip are 0.4 and 6.5. A video count of 2–3 on the clip is the gallop handoff.

## Proof

`monolith-pass.mp4` 720×1600, 72 frames, 24 fps, 3.0 s, 2,968,735 bytes. `monolith-frame0.png` is frame 0. Walk and sprint stills from the nit pass were not recaptured.

LOD swaps were not part of this pass.
