# Take note — scene-strict — 2026-10-11

## Quota and turns

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| strict score + avenue staging | other | 13 placement evals, 5 vision calls | vision $0.011433; quota row wall_s 3097.5, turns 0 (events.jsonl has no turn records) | rejected |

Quota row from `learn/quota-log.md`: `| 2026-10-11 | scene-strict-1011 | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 3097.5 | events.jsonl |`

## This step

- Step: scene-strict-1011
- Accepted because (command, row, numbers): not accepted. `python3 tools/common/align/selftest.py` PASS. Facade strict max 0.3073. Placement IoU 0.2909. gate5 12 fails. Browser float 44.834 m.
- Recipe appended (path, or `none`): `learn/recipes/scene-strict-1011.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — strict score fails the striped tower; avenue search still misses the masks`

## Biggest waste

Three CMA-ES rounds (316 s, 13 framebuffer shots) moved the eye up the dune. The seed already failed the same bars. The inversion term in the loss picked a worse sky.

## Reuse next time

- Recipes to copy: `learn/recipes/scene-strict-1011.md`, `learn/recipes/week2-constrained-focal.md`
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: week-2 alignment is not a picture of the tower; relight-left is a light, not a side plate

## Added this take

- New recipes: `learn/recipes/scene-strict-1011.md`
- New failure entries: the heading above
