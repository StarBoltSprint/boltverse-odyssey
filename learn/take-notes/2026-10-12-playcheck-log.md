# Take note — playcheck log — 2026-10-12

## Quota and turns

No Imagine cook. `python3 tools/quota/quota.py` read this session's `events.jsonl` and appended the row below. That log did not carry turn, tool, or token fields, so those cells are the tool's own 0 and n/a. Wall time is the tool's number. No commit was made, so the commit cell is n/a.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-12 | 04-playcheck-log | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 995.5 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Approach-run colliders and log | other | 2 fixture tries | images 0, videos 0, wall 995.5 s | accepted |

## This step

- Step: tools/04-playcheck-log. Library local boxes placed by the zone file, approach JSONL, bad fixtures fail.
- Accepted because (command, row, numbers): `cd tools/playcheck && npm test` exit 0, 66 pass, 0 fail. Good fixture 21 samples, all `miss`, facing 90, distance 1.2 m, anchor y 0. Bad collision, float, missing clearance, tight lintel (1.0 m under 2.0 m), and a keep-out all FAIL. A log line with `fps` -1, `cameraLayer` `hud`, or `collision` `blocked` fails the schema. Report `steps/tools/04-playcheck-log/REPORT.md`.
- Recipe appended (path, or `none`): none. No Imagine cook. Existing recipes were not re-proven.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-12 — a zone part collider that is not the library box`.

## Biggest waste

The first good arch put both jambs across the path centerline, so the 0.3 m body hit a visual solid and the all-miss assert failed. The opening was moved to either side of the run. The fail threshold was not loosened.

## Reuse next time

- Recipes to copy: none new. The 2026-10-05 invisible-wall heading still names the ruin-face rule. This step adds the library-box row.
- Library ids to place (`tools/library`), instead of recooking: none. The fixture part `arch` is synthetic and is not a library id to hang.
- Failures that would have caught this take earlier: the new heading. `ruinwalk.test.mjs` does not read zone `parts`.

## Added this take

- New recipes: none.
- New failure entries: `2026-10-12 — a zone part collider that is not the library box`.
- Phone preview: not frozen. No zone play tree in this step.
