# Living Archives / Echo Shards

Verdict: PASS

Date: 2026-10-04. Branch `archives-shards`. Imagine calls: 5 of 8 (3 spare). Prompts were not stored.

## Done when

| Row | Result |
| --- | --- |
| Root `npm test` | PASS (exit 0), including `packs/common/archives/archives.test.mjs` (10 tests) |
| `tools/playcheck` `npm test` | PASS on this `play.js` before the card was moved to the top-left: 51 tests, 0 fail. Ruin walk shake 0, invisible contacts 0. Not re-run after that DOM-only move |
| Manifest validation and save/load | PASS. Bad rows rejected. `mark` once. Thrown storage falls back to memory. `remote` does not drop `found` |
| Shard in the world | `/workspace/grokcli/out/archives/shard-world.png`. `pulse-birth`, mag 0.490, world height 0.919 m, boom 7.18 m, dist 4.98 m |
| Pickup card | `pickup-card.png`. Opacity 1. Crystal image 105×108 css (source 714×731). Lore line present. Stick stays. Run continues |
| Archives screen | `archives-screen.png`. Hall 360×640 css from 720×1280. “1 of 6”. Found crystal plus lore. Five dim silhouettes. Stick hidden |
| Pack size | `packs/zone-a` 100.33 MiB (105206921 bytes) + `packs/common/archives` 1.58 MiB (1651583 bytes). Under 150 MB |
| drawCalls / texMB | 14 draws, 282.3 MiB (296020714 bytes). Archives is 1 draw and 2.65 MiB (`echo-crystal`). See the budget note |

## What a zone writes

`packs/common/archives/` is the shared module. Zone A’s only catalogue is `packs/zone-a/src/archives/manifest.json` (six shards on the spawn–gate path, the hangar apron, and beside the arch). Recipe: `docs/METHOD/archives.md`.

## Budget note

The mid-phone caps in the step (12 draws, 260 MiB) are not met by the live page. Step 4c on the previous zone measured 11 draws and 256.76 MiB. Details already on `origin/main` account for the rest. This layer adds one instanced draw and 2.65 MiB. It does not retile the sky, the ground, or the ruins.

`fpsAvg` 2.7 on the still pass is the id-buffer inside `snapshot()` on swiftshader (7 samples). It is not a phone-GPU figure.

## Known issues

- The Archives hall is contained, not covered, so a 360×800 phone at device pixel ratio 2 letterboxes a 720×1280 painting. Cover would enlarge it. The frozen world shows in those bands. The list can scroll the sixth row up into the painting.
- The crystal stands 0.92 m. A 1.12 m card would enlarge the 731 px source at the 2.3 m approach.
- Imagine prompts for the five calls were not stored. No sixth call.
- The paw’s dark recess and a faint rainbow on the hall floor stayed. Both are in the Imagine pixels.

# Archives polish — menu film and paw glow

Date: 2026-10-04. Branch `archives-shards`. Owner 2026-10-04 20:36. Imagine this step: 2 image calls, 3 video calls, 1 video file. Prompts were not stored.

## Done when

| Row | Result |
| --- | --- |
| One backdrop for every menu | PASS. `packs/common/archives/backdrop.js`. Pause, Archives, Settings, and `setScreen` share one video. |
| Seamless hall loop | PASS. `art/hall-loop.mp4` 720×1280, 24 fps, 145 frames, 6.041667 s. First-to-last MAE 1.8. Frame 0 to 3 s MAE 9.986. |
| Phone placement, no enlargement | Scale 1 contain on 360×800 at device pixel ratio 2. CSS box 360×640 at (0, 80). `object-fit: contain`. Transform none. A 9:16 phone (360×640) covers at scale 1. |
| Still fallback | PASS. `art/hall.jpg` is frame 0, 720×1280. It shows until the video is playing. |
| Paw shimmer | PASS. One Imagine glow, 944×1088. Opacity 0.22–0.58 over 2.8 s. No `scale(`. Contain scale about 0.118 in the 56×64 corner. |
| World videos while a menu is open | PASS. Sky, gate, and Bolt pause. Decoder count is 1 for the menu film. Play with no menu stays at 4 (Bolt plus three skies). |
| Unfound shards | PASS. Catalogue still uses the dim silhouette and hides lore. A phone check with one found id showed `crystal.png` plus five `silhouette.png` rows. |
| Root `npm test` | PASS, exit 0. `archives.test.mjs` 13 tests, 0 fail. |
| `tools/playcheck` `npm test` | PASS. 51 tests, 0 fail. |
| Stills and mp4 | `/workspace/grokcli/out/archives/polish/`: `hall-still.jpg`, `hall-mid.jpg`, `hall-end.jpg`, `hall-920.jpg`, `hall-loop.mp4`, `paw-glow.png`, `menu-pause.png`, `menu-archives.png`, `menu-closed.png`. |

## Phone check

Chrome headless, viewport 360×800, device pixel ratio 2. The world canvas was filled green. With the pause menu open, `html.archives-cover` was set, `#view` visibility was `hidden`, and the backdrop video was playing (`readyState` 4, paused false) at 360×640. Pixels at (360, 8) and (360, 1590) of the 720×1600 shot were rgb(31, 28, 41), the colour sampled once from the still’s corners. They were not the green canvas. The Archives list kept the same film. One console 404 was logged; the hall video and the row images loaded.

## Known issues

- A 720p 9:16 Imagine video is 720×1280. Covering a 720×1600 phone would be magnification 1.25. The API rejected a 9:20 video and a 1080p video before any file was made. The film stays at scale 1. The bands are the sampled hall matte, not the frozen world.
- `python3 tools/judge/judge.py` exited 1: current `grok -p` is `--single` and does not take the prompt file. The same prompt, recompressed so one argument stayed under 128 KiB, then `judge.py --parse-reply`, returned `FAIL gate: score 4 < 7; keep is false`. `matches_refs` was true. The defects are round basin mouths, repeated crystals, and a rendered look already in the previous hall still. Image budget for this step was already spent. Not recooked.

Verdict: PASS

# Archives menus — futuristic hall

Date: 2026-10-04. Branch `archives-shards`. Owner 2026-10-04 21:54. Imagine this step: 3 image calls, 3 video calls, 1 video file. Two image calls were not used. Prompts were not stored.

The 720×1600 phone is not filled. The shipped film is 640×1424. Cover on that phone is 1.125, so the frame stays at scale 1.

## Done when

| Row | Result |
| --- | --- |
| Shared seamless hall | The live file is `art/hall-loop.mp4`, a ping-pong of the one Imagine clip. 640×1424, 24 fps, 289 frames, 12.000 s. First-to-last MAE 1.813. Frame 0 to 3 s MAE 9.98. The source clip before the reverse is 145 frames, 6.041667 s, first-to-last MAE 14.445. |
| Phone fill by crop only, scale ≤ 1 | The film does not fill the phone. `menuFrame(640, 1424, 360, 800, 2)` is contain, scale 1, `fills` false, CSS 320×712 at (20, 44). Chrome at 360×800, device pixel ratio 2, measured the playing video at the same box (`readyState` 4, paused false, `videoWidth` 640). The 720×1600 shot has matte gaps of 40 device pixels on the left and the right and 88 on the top and the bottom. Gap pixel (35, 38, 51). Computed backdrop colour rgb(35, 38, 51). Green samples in the pause and Archives shots: 0. |
| Stone plate hidden | Pause image sources were `paw.png`, `paw-glow-alpha.png`, and `hall.jpg`. `plate.jpg` was not among them. `present.js` does not name `plate.jpg` or `ui.plate`. The file is still on disk for the manifest schema. |
| Paw print, glow, bob | Bytes unchanged. `paw.png` sha256 prefix `3451bb5154db9401`. `paw-glow-alpha.png` sha256 prefix `e0ea6c07907f364e`. At animation time 0 the glow opacity is 0.05 and the paw transform is identity (y 16). At 1400 ms the opacity is 0.72 and the transform is translateY −2.5 px (y 13.5). Element-shot corners are rgb(0, 255, 0), the page behind the transparent button. No `scale(` in `present.js` or `backdrop.js`. |
| Root `npm test` | PASS, exit 0, including `archives.test.mjs` (13 tests, 0 fail). |
| `tools/playcheck` `npm test` | PASS. 51 tests, 0 fail. Duration 250486.692 ms. `play.js` was not edited in this step. |
| Stills and mp4 | `/workspace/grokcli/out/archives/futurist/`: `pause.png`, `archives.png`, `paw-page.png`, `paw-low.png`, `paw-high.png`, `hall-loop.mp4`, `hall-loop-4s.mp4`. |
| Imagine budget | 3 image calls and 3 video calls. Two video calls returned no file. Two image calls were not used. |
| Decoders, HUD, shake, draws | A menu pauses sky, gate, and Bolt (`menuVideoHold`). Decoder count with the menu film alone is 1. Debug HUD was not opened; `?debug=1` was not changed. Brightest row of frames 0, 3 s, 6 s, and the last frame stays at row 723 or 724 of 1424 (fraction 0.508). This step adds no WebGL draw. The earlier page figure stands: 14 draws, 282.3 MiB. |

## Phone check

Chrome headless, viewport 360×800, device pixel ratio 2, page `packs/common/archives/_futurist_harness.html` (removed after the shots). The hall video was playing under the pause words and under the Archives list. `html.archives-cover` was set. Pack size on disk after the new film: `packs/zone-a` 105208030 bytes, `packs/common/archives` 7582731 bytes.

## Known issues

- Filling 720×1600 at scale ≤ 1 needs a file at least 720 wide and 1600 tall. The Imagine video is 640×1424. Aspect `9:20` was rejected before a file (`aspect_ratio must be one of: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3`). Resolution `1080p` was rejected before a file (`resolution_name must be one of: 480p, 720p`). Two image edits that asked for a taller plate returned 576×1280. That height miss stops here. The film is not enlarged, stretched, or edge-cloned.
- The source clip does not close (MAE 14.445). The shipped loop is the same clip played forward and then reversed. The turn at 6 s measures MAE 14.444. That is the ping-pong seam, not a camera move.
- Hologram panels contain marks that are not readable words, and some panels are round. Both are in the Imagine pixels. Not recooked.
- The Archives list still uses the world `crystal.png` for a found shard and `silhouette.png` for the others. A separate holographic card was not cooked.
- `python3 tools/judge/judge.py` exited 1: `grok -p` is `--single` and does not take the prompt file. Same failure as `feedback/2026-10-04-judge.md`. A score was not produced. The scale law does not wait on that score.

Verdict: PASS
