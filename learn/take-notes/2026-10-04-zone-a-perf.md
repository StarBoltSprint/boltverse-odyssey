# Take note — zone A performance — 2026-10-04

## Quota and turns

Quota row from `python3 tools/quota/quota.py` on the session `events.jsonl`. That log did not classify turns or tool calls (the counters stayed 0). Imagine calls this step, counted from the session: 0.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | zone-a-perf | e70c6d3 | 0 | 0 | 0 | 0 | n/a | n/a | 3246.7 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Zone A phone budget | other | one pass on the existing play page | 2026-10-04 zone-a-perf e70c6d3 turns 0 tools 0 images 0 videos 0 tokens n/a wall_s 3246.7 | accepted |

## This step

- Step: Zone A performance pass, 2026-10-04. Branch `archives-shards`.
- Accepted because: live playcheck `Perf: drawCalls=12, texMB=254.370, activeVideos=4, jsMs=26.5`. `texture_mem` PASS (266725876 bytes). Spawn mag 0.998188. Root `npm test` exit 0. `tools/playcheck` `npm test` 51 pass, 0 fail. Pack 105218925 bytes. Imagine calls 0.
- Recipe appended: none. This step did not cook a new asset.
- Failure appended: none. The step confirmed law 65 (waste only, mag on the scaled bands stayed ≤ 0.993, upper band untouched at 0.998).

## Biggest waste

The first texture cuts (RGB8, unpadded detail cutouts, the micro-atlas shelf) still sat about 1 MiB over 256 MiB. The last cut was surplus pixels on the horizon and high bands, capped at magnification 0.993. The upper band was already at 0.998 and was left alone.

## Reuse next time

- Recipes to copy: none for this pass. Sky, ground, rocks, and the hall film stay on their existing recipes.
- Library ids to place: none.
- Failures that would have caught this take earlier: none. A walk `mag_max` above 1 on this clearing is a near solid at a stop heading, not the sky bands. Read `magSources` before scaling a band.

## Added this take

- New recipes: none.
- New failure entries: none.
- Confirmed row: law 65 phone budget. `learn/geometry.md` was not changed. No new level plate.
- Tool note: `feedback/2026-10-04-playcheck-depth-nearest.md`. `render_source` flags the post depth attachment and three one-time `STATIC_DRAW` uploads. Those lines were not changed.
