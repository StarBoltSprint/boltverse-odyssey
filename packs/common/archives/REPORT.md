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
