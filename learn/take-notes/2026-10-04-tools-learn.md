# Take note — tools learn — 2026-10-04

## Quota and turns

No Imagine cook. `python3 tools/quota/quota.py` read this session's `events.jsonl` and appended the row below. That log did not carry turn, tool, or token fields, so those cells are the tool's own 0 and n/a. Wall time is the tool's number.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | tools-learn-20261004 | ece3195 | 0 | 0 | 0 | 0 | n/a | n/a | 2684.8 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Frame gates, playcheck rows, passage skip, premerge | other | 0 (log had no turn field) | images 0, videos 0, wall 2684.8 s | accepted |

## This step

- Step: tools-learn-20261004. Catch the 2026-10-03/04 misses before a person looks.
- Accepted because (command, row, numbers): `python3 tools/frames/selftest.py` PASS. Root `npm test` exit 0. Playcheck `npm test` is recorded in `docs/reports/tools-learn-20261004.md`. Zone A scan current fails 20, which is the honest picture, not a failed tool step.
- Recipe appended (path, or `none`): none. No Imagine cook. Existing sky, ground, and rock recipes were not re-proven.
- Failure appended (heading in `learn/failures.md`, or `none`): seven new headings on 2026-10-04 (framebuffer foot gap, untextured face, sky and ground frame rows, missing hero, blocked passage, magnification and stair, resume). The two earlier 2026-10-04 rows were not rewritten.

## Biggest waste

The first floating-foot fixture used a gap under 12 px and a solid whose local contrast sat just under 6, so the unit test stayed red after the detector was already right. The fixture contrast was raised. The threshold was not loosened.

## Reuse next time

- Recipes to copy: none new. Sky recipe stays the validated one. `python3 tools/frames/check.py` is the extra frame gate.
- Library ids to place (`tools/library`), instead of recooking: none.
- Failures that would have caught this take earlier: the seven headings above. `seat_foot_gap` is INFO and must not be used as the pixel fail.

## Added this take

- New recipes: none.
- New failure entries: the seven headings in `learn/failures.md` dated 2026-10-04 after the wreck-face entry.
- Tool files: `feedback/2026-10-04-playcheck.md`, `feedback/2026-10-04-sky.md`, `feedback/2026-10-04-rocks.md`.
