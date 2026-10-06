# other — adventure contract

Status: the card tests passed. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | adventure contract v0 |
| Commit | `3f7af65` |
| Date | 2026-10-06 |
| Size | No new image. Corridor phone line stays drawCalls 7, texMB 184.5, activeVideos 4. |
| Tries | 1 |
| CLI | none |
| Image refs | none |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node --test tools/adventure/adventure.test.mjs packs/corridor-ab/play/*.test.mjs` | 40 tests | pass 40, fail 0 |
| `node tools/playcheck/src/renderlint.mjs` on the eight play sources | render_source | PASS files=8 |
| proof `adventure-run.mp4` | clip | 720×1600, 79 frames, 24 fps, 3.29 s, 687657 bytes |

## Gotchas

Echo positions that are nudged and then clamped can land inside the 3.5 m monument clearance. `placeShards` uses a slot grid instead. A card may omit `question` and `truth`. The offline path still writes both. The Archives hall-loop test needs PIL and was already failing on this machine. Sprint `jsMs` on a cold swiftshader frame is not the warm 3.5 from the horizon step. `drawCalls`, `texMB`, and `activeVideos` are the columns that match.

## Reuse

Copy `tools/adventure/` and doc 69. Swap only the library rows when a segment becomes ready. Do not invent a Bolt sprint. Do not call Imagine from `unique.js`. Do not mount the archives world draw on the corridor. Missing segments fall back. The Codex Spire and a self-growing catalogue are not this recipe.
