# Take note — zone B step 1f — 2026-10-04

## Quota and turns

The quota row is appended by `python3 tools/quota/quota.py` from `/workspace/grokcli/logs/zoneB-1f-20261004-1928.jsonl`. Copy that row after it runs. Do not invent the numbers.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Emptier horizon, upper gradient, planet still | sky | 12 image calls | see quota row | accepted, one haze frame not installed |
| Planet video | sky | 1 video call | see quota row | accepted |
| Haze frame | sky | 1 of the 12 | see quota row | rejected, not installed |

## This step

- Step: Zone B step 1f. Canyon floor commit `e74fd7f`. Sky, planet, stills, and this note follow in the next commits.
- Accepted because: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Live playcheck exit 1, 24 pass / 7 fail (the `clearing/1` rows; not converted). Phone 720×1600: presented mag 0.982, drawCalls 6, texture bytes 218084034, active videos 2, area 6500 m². Sky `check.py` 84 failures, recorded, not a recook. Status IN TEST.
- Recipe appended: none. The sky gate does not pass. Imagine prompts for this step: not stored.
- Failure appended: four headings in `learn/failures.md` dated 2026-10-04 (black cap, upper join, tile lattice, butte cut).

## Biggest waste

The upper gradient is not flat across its width. Copying the clean horizon frame removed the horizon joins and left the upper join. That was the second look at the same seam. The image budget was already closed.

## Reuse next time

- Recipes to copy: the zone A sky lock stays the sky recipe. This zone B sky is IN TEST.
- Library ids to place: none.
- Failures that would have caught this take earlier: the black-cap entry (do not aim above the painted band). The lattice entry (a second family on the same UV does not break a tile edge).

## Added this take

- New recipes: none.
- New failure entries: the four headings above.
