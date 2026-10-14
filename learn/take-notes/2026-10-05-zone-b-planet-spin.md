# Take note — zone B planet spin — 2026-10-05

## Quota and turns

Cook count from this step, not from `quota.py`: 1 Imagine video, and the stills that staged the storm. `quota.py` was not run. No session ndjson was passed, and the counts are not invented as a quota row.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Ringed planet spin | cutout | 1 video | not a quota row | accepted |

## This step

- Step: zone B planet spin. Cook `89bb49a`. The storm travels across the disk. The ring stays. The loop meets.
- Accepted because: disk mean abs 17.70 (0.00→1.50 s) and 15.34 (1.50→3.00 s). Seam full-frame mean abs 2.02. Chase videos 4, drawCalls 10, texture bytes 256963736, scale 0.5625, aspect 1.7777778 / 1.7777778. In-game times 1.122 s, 2.118 s, 3.863 s show the storm on the left, in the centre, then off the disk. Proof `/workspace/grokcli/out/zoneB/planet-spin/`.
- Recipe appended: `learn/recipes/zone-b-planet-spin.md`.
- Failure appended: `2026-10-05 — a planet frame diff can rise while the storm stays put`.

## Biggest waste

The first still edits would not move the storm off the lower middle of the previous planet. A fresh still, then edits of that still, placed it. That miss is the same class as `learn/failures.md` 2026-10-05, a hard planet key (the edit that did not turn the clouds).

## Reuse next time

- Recipes to copy: `learn/recipes/zone-b-planet-spin.md`, then `learn/recipes/zone-b-planet-card.md`.
- Library ids to place (`tools/library`), instead of recooking:
- Failures that would have caught this take earlier: 2026-10-05, a planet frame diff can rise while the storm stays put. The 2.8/255 figure was a glow.

## Added this take

- New recipes: `learn/recipes/zone-b-planet-spin.md`.
- New failure entries: `2026-10-05 — a planet frame diff can rise while the storm stays put`.
- Prompt or tool improvement: that failure entry. The guard is the storm's longitude, not the mean diff. No new QC number.
