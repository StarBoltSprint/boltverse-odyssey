# Take note — zone A step 2c — 2026-10-03

## Quota and turns

`python3 tools/quota/quota.py` on this session's `events.jsonl` appended: date 2026-10-03, step zone-a-step2c, commit 624f00c, turns 0, tool calls 0, image gens 0, video gens 0, tokens n/a, wall 3639.0 s. Those zero counts are what the tool printed. The log's event types are `turn_started` and `tool_started`, which that counter does not tally. The wall time is the span of timestamps in the file. Do not invent a second count.

Phone preview freeze refused: REPORT has no `Verdict: PASS` line. The script exits 1 and writes nothing. That matches the sky-check FAIL on the unreplaced slices.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Camera chase | other | 1, committed earlier | tool row above | accepted, IN TEST |
| Horizon continuation | sky | 2 | tool row above | rejected, stopped |
| Corona loop | sky | 1 video, then a frame subset | tool row above | accepted as one keyed tile |
| Failed slices | sky | 0 installed | tool row above | left as step 2b |

## This step

- Step: zone A step 2c, retouch of the sky and the camera.
- Accepted because: camera proof on the earlier commit (eye step max 0.148 m over 6 s, spikes 0). This commit: selftest PASS, root npm test PASS, playcheck 43/0, play mag_max 0.989, activeVideos 4. Sky check FAIL on the unreplaced slices, which is the gate working.
- Recipe appended: `learn/recipes/zone-a-sky-ring.md` (step 2c note on the existing row).
- Failure appended: `2026-10-03 — horizon outpaint repeated the source, then stopped`.

## Biggest waste

Two horizon outpaints that did not continue the neighbour edge. Cited in the failure entry above. Upper candidates that passed the eye were not installed, because one short slice would not match the band and the edges did not meet the join limit.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-a-sky-ring.md`, `docs/METHOD/sky.md`.
- Library ids to place: none.
- Failures that would have caught this take earlier: the motif gate, had it existed at step 2b. Upper slice 6 still slips through.

## Added this take

- New recipes: none as a new file. The sky-ring recipe gained a step 2c note.
- New failure entries: horizon outpaint stop. The motif gate misses a soft two-bank gap.
