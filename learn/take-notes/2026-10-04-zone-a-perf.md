# Take note — zone A performance — 2026-10-04

## Quota and turns

The quota row is copied here after `python3 tools/quota/quota.py`. Imagine calls this step: 0.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Zone A phone budget | other | one pass on the existing play page | see quota-log row `zone-a-perf` | accepted |

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
