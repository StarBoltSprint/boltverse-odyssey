# Take note — zone B step 1g — 2026-10-04

## Quota and turns

Copied from [`learn/quota-log.md`](../quota-log.md). The command was `python3 tools/quota/quota.py --log /workspace/grokcli/logs/zoneB-1g-20261004-2112.jsonl --step zone-b-step1g --commit 6a9ced6 --date 2026-10-04`. Do not read the zero image and video cells as a cook count. That log does not label Imagine generations in the fields the tool counts.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | zone-b-step1g | 6a9ced6 | 0 | 464 | 0 | 0 | 912063 | 224190 | n/a | zoneB-1g-20261004-2112.jsonl |

Cook count, from this step (prompts not stored): 9 Imagine image calls, 3 Imagine video calls. The third video replaced the planet loop. The first planet video was not the shipped file.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Canyon walls, ground materials, cutouts | ground / rock / other | 9 image calls | quota image cell 0; cook count above | accepted |
| Haze loop | sky | 1 video call | quota video cell 0; cook count above | accepted after the dome grid was dropped |
| Planet loop | sky | 2 video calls | same session row | second loop accepted; moon fringe remains |

## This step

- Step: Zone B step 1g. Walls `9364283`. Ground `ad16d10`. Cutouts `de81922`. Haze `1c416cf`. First planet loop `bcd42df`. Replacement planet loop `e266efb`. Report and notes `6a9ced6`.
- Accepted because: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Live playcheck exit 1, 25 pass / 6 fail (the `clearing/1` rows; `render_source` passed with `--source`; not converted). Phone 720×1600: presented mag 0.982, drawCalls 8, texture bytes 216551234, active videos 3, area 6500 m², boot maxSlope 0.2366 rad. Status IN TEST.
- Recipe appended: none. The sky gate was not re-run, and the wide lattice still reads. Imagine prompts for this step: not stored.
- Failure appended: two headings in `learn/failures.md` dated 2026-10-04 (haze on the dome grid, planet disk hole and moon fringe).

## Biggest waste

The first planet video carried a dark band in the disk. A neighbour key cannot delete a feature that is in the source, and the same test fringed a moon. The third video, the last one in the budget, replaced the file. The fringe stays.

## Reuse next time

- Recipes to copy: the zone A sky lock stays the sky recipe. This zone B sky is IN TEST. A sparse living plate uses a few whole-frame cards, not the dome grid.
- Library ids to place: none.
- Failures that would have caught this take earlier: the lattice entry (a second family on the same UV does not break a tile edge). The butte-cut entry (a loft outside the floor still meets the ground on a straight line). The new haze entry (do not tile a sparse plate on the 17×8 grid).

## Added this take

- New recipes: none.
- New failure entries: the two headings above.
- Prompt or tool improvement: those two failure entries. No new QC number. The video budget was closed, so the moon fringe was not recooked. The step also confirmed the existing lattice row, the loft-cut row, and the step 1f sky-check count of 84 (not re-run).
- `python3 tools/reportview/build.py --take zone-b-step1g --take-dir packs/zone-b/proof/step1g --playcheck tools/playcheck/out/2026-10-04T20-10-05-715Z --out /tmp/zb1g-reportview` exited 0 and printed `FAIL take=zone-b-step1g`. Assetcheck, objsheet, and walkaround were not passed, so those sections are NOT RUN. The page is not in the repo.
- Preview freeze exited 1: `REPORT verdict is missing; freeze waits for PASS`. The report line is `Verdict: IN TEST`. The parser only accepts PASS, FAIL, WARN, or INCOMPLETE. No preview folder was written. No public URL.
