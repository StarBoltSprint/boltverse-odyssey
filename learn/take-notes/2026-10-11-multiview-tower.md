# Take note — multiview-tower — 2026-10-11

## Quota and turns

`python3 tools/quota/quota.py` read this session's `events.jsonl`. That file did not carry turn, tool, or token fields, so those cells are 0 / n/a. Wall time is the span of timestamps in the log.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-11 | multiview-tower-1011 | 1a455361 | 0 | 0 | 0 | 0 | n/a | n/a | 4020.1 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| hero tower solid from the 10 Oct sheet | other | 2 gate rounds | wall 4020.1 s; images 0 | rejected |

## This step

- Step: multiview-tower-1011
- Accepted because (command, row, numbers): close-out of an honest FAIL. Gate round 2 exit 1, 11 FAIL / 21 (`steps/multiview-tower-1011/gate/report.md`). Mesh sealed, 9672 tris, d/w 0.792, float 2.45 m, vision cost $0. No dataset export.
- Recipe appended (path, or `none`): none. The cook did not pass its QC rows.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — multi-view sheet builds a sealed tower and still misses the bars`

## Biggest waste

Two full object-gate runs on a solid whose plate d/w is already 0.761. Round 2 (UV complement, global front u, wider foot ring) moved the float from 2.53 m to 2.45 m and added the visible-px/m fail. The same bars were still missed.

## Reuse next time

- Recipes to copy: none from this step. Scene-strict already records that relight plates are fronts.
- Library ids to place (`tools/library`), instead of recooking: none. This solid did not pass.
- Failures that would have caught this take earlier: read `view-top` bbox h/w before building a roof, and compare left/right foot widths to 0.70 before a gate. The new failure entry is that check.

## Added this take

- New recipes: none
- New failure entries: the multiview-tower heading in `learn/failures.md`
- Tool note: `feedback/2026-10-11-object-gate.md` (relief row PASS with +z 0.163 m)
