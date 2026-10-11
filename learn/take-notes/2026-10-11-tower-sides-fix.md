# Take note — tower-sides-fix — 2026-10-11

## Quota and turns

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-11 | tower-sides-fix-1011 | bdc3ee8b | 0 | 0 | 0 | 0 | n/a | n/a | 3881.7 | events.jsonl |

The session log did not carry turn or token counts. Wall time is 3881.7 s for that events.jsonl span. Image gens in that log are 0. Vision is outside that counter: **$0.011484**, five calls, one round, cache `steps/tower-sides-fix-1011/vision-cache`, log `steps/tower-sides-fix-1011/vision.ndjson`. Preview freeze exited 1 because the report verdict is FAIL.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| tower side skins | hull/ship | 2 builds, 2 gates | vision $0.011484, builder 62.104 s then 37.003 s | rejected (bars FAIL, tools kept) |

## This step

- Step: steps/tower-sides-fix-1011
- Accepted because (command, row, numbers): the step is closed on honest FAIL. Ortho ΔE +z 1.16, +x 1.85, −x 6.59, −z 3.30. Body ΔE 0. Float 0.00 m. Mesh 9796 tris, 0 open. Gate5 7 FAIL. strict with vision yes is under 0.70 on every view. Vision $0.011484.
- Recipe appended (path, or `none`): none. The cook did not pass its QC rows. The tool note is in `tools/imagine-to-3d/README.md` under Multi-view tower.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — whole-image Reinhard, visible px/m printed 0, UV and shadow still miss after two`

## Biggest waste

Attempt 1's gate died on a block-scoped `render` after the mesh was already built, and `faceCaptures` rejected a second Playwright argument, so the per-face px/m line was missing until attempt 2. The UV crop and the shadow wrap were the real second try. Both still miss. A third unwrap was not cooked.

## Reuse next time

- Recipes to copy: none new. Keep `grade_strip` (body untouched), native side crops, back = mirrored right, MoGe on that mirrored plate, and the staged basis.
- Library ids to place (`tools/library`), instead of recooking: none. This solid is not a PASS.
- Failures that would have caught this take earlier: the hires entry already names the Reinhard side lift and visible px/m 0. The new guard is body ΔE 0 plus `coarserThanEstimator` instead of a printed 0.

## Added this take

- New recipes: none
- New failure entries: whole-image Reinhard, visible px/m printed 0, UV and shadow still miss after two
