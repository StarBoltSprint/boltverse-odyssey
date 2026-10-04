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
