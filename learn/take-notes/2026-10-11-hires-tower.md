# Take note — hires-tower — 2026-10-11

## Quota and turns

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-11 | steps/hires-tower-1011 | 5ac1d217 | 0 | 0 | 0 | 0 | n/a | n/a | 4288.7 | events.jsonl |

The session log did not carry turn or token counts. Wall time is 4288.7 s. Image gens in that log are 0. The three Grok vision calls are outside that counter and cost $0.007481 (`steps/hires-tower-1011/vision.ndjson`).

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| hires tower skin | hull/ship | 3 builds, 3 gates | wall 4288.7 s, vision $0.007481 | rejected (bars FAIL, tools kept) |

## This step

- Step: steps/hires-tower-1011
- Accepted because (command, row, numbers): the step is closed on honest FAIL. Gate grounding 0.00 m. Play Lab L\* 42.1. Mesh 9796 tris, 0 open. Gate5 9/21 FAIL. strict with vision yes is under 0.70 on every view. Vision $0.007481.
- Recipe appended (path, or `none`): none. The cook did not pass its QC rows. The tool note is in `tools/imagine-to-3d/README.md` under Multi-view tower.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — hires plates, lit captures black, then a lip above the foot`

## Biggest waste

The first installed runtime honoured `meta.cameraSpace` and the gate measured 25 m of air on the wrong footprint. The second gate, on the real basis, measured 1.54 m on the relief lip. Both were real. The third gate is the stop.

## Reuse next time

- Recipes to copy: none new. Keep MoGe-2, native plate crops, and the staged basis.
- Library ids to place (`tools/library`), instead of recooking: none. This solid is not a PASS.
- Failures that would have caught this take earlier: the multiview entry already names the black lit ortho and the flat back risk. The new guard is the sRGB read and the foot-band inset.

## Added this take

- New recipes: none
- New failure entries: hires plates, lit captures black, then a lip above the foot
