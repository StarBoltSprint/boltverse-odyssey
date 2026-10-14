# Take note — zone A 3d-details — 2026-10-05

## Quota and turns

Quota row from `python3 tools/quota/quota.py` on the session `events.jsonl`. That log did not classify turns, tool calls, or image generations (the counters stayed 0). The cook record in the recipe is 15 Imagine edits and two HTTP 429s. Those counts are not in this quota row.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-05 | zone-a-3d-details | a1f1268 | 0 | 0 | 0 | 0 | n/a | n/a | 4135.0 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Echo Shard loft and six small-detail lofts | rock | 15 Imagine edits, two 429 retries | 2026-10-05 zone-a-3d-details a1f1268 turns 0 tools 0 images 0 videos 0 tokens n/a wall_s 4135.0 | accepted |

## This step

- Step: Zone A Echo Shards and small details as hard objects, 2026-10-05. Branch `zone-a-3d-details`. Play commit `a1f1268`.
- Accepted because: phone proof drawCalls 12, texMB 254.37, textureBytes 266726474, activeVideos 4, presented mag 0.998 on the four proof cameras. Root `npm test` exit 0. `tools/playcheck` `npm test` 56 pass, ruinwalk gallop blocked 0 and invisible walls 0. Pickup on pulse-birth and Archives `1 of 6` still open. Live `tools/playcheck/run` exits 1 on rows the prior perf report already failed.
- Recipe appended: `learn/recipes/zone-a-3d-details.md`.
- Failure appended: `2026-10-05 — tuft lofts were keyed by the manifest index` and `2026-10-05 — a loft cap sampled the collapsed tip column` in `learn/failures.md`.

## Biggest waste

The tuft loft key used the manifest index, so the live page kept tufts as crossed cards until the script was re-run. The cap UV used the collapsed tip column. Both are in `learn/failures.md`. Two HTTP 429s used the one retry each. No 16th image.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-a-3d-details.md`. Stations and `packs/common/archives/solid.js`. One merged draw. Front and top plates stay rulers while texMB sits near 256.
- Library ids to place: none. These lofts are not registered in `tools/library`.
- Failures that would have caught this take earlier: the two 2026-10-05 entries above. No playcheck row counts tuft solids or reads cap pixels.

## Added this take

- New recipes: `learn/recipes/zone-a-3d-details.md`.
- New failure entries: tuft manifest-index keys; loft cap on the collapsed tip column.
- Confirmed row: phone budget on this clearing stays drawCalls 12 and texMB 254.37 when a skin replaces `crystal.png` bytes. `learn/geometry.md` was not changed.
- Known cards left: ridge, pebble, rock pebbles, ground families c0–c2, far flecks.
- Visual judge: `tools/judge/judge.py` exits 1 before a score (`FAIL grok`). A direct call with the same prompt shrunk to 62221 bytes returned `{"score": 2, "keep": false, "matches_refs": false}`. `python3 tools/judge/judge.py --parse-reply` prints `FAIL gate: score 2 < 7`. The references were the locked relief plates. That score does not override the phone rows. No recook. Tool note: `feedback/2026-10-05-judge-prompt-json.md`.
