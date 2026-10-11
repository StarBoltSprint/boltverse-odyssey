# Take note — zone-c terrain plates — 2026-10-11

## Quota and turns

One line per item that was cooked or rejected in this take. Counted turns, tool calls, image and video generations, tokens, and wall time are appended by `python3 tools/quota/quota.py` to [`learn/quota-log.md`](../quota-log.md). Copy that row. Do not invent the numbers.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| four moss plates on the kept causeway | ground tile | 1 bake, gate reruns were pose fixes | turns 0, tools 0, images 0, videos 0, tokens n/a, wall 3237.3 s (`quota.py` on events.jsonl) | accepted |

## This step

- Step: `steps/zone-c/03-terrain` plates, commit `fa2d6e61`
- Accepted because (command, row, numbers): `python3 tools/terrain-from-key/run.py --zone c --score` printed `deltaE2000 8.68 median 6.38 pass True gate PASS`. Object-gate verdict PASS. Path IoU 0.7704. UV p95 0.214. Visible px/m 237.1 vs 118.5. LOD pop unchanged. Draw calls 1. Height sha256 prefix `4f61b63bae4f`.
- Recipe appended (path, or `none`): `learn/recipes/zone-c-moss-plates.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — plate stretch used foreshortening, and the 8 m camera sat under the deck`

## Biggest waste

The first stretch definition used the two axes of one ground cell. That ratio is the pitch, about 3.4, and cannot clear 1.3. The same bake then aimed the 8 m sharpness camera under the mesh, and after that at the key band. Both are in the failure entry above.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-c-moss-plates.md`
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: the 2026-10-11 plate entry. The earlier MoGe gain-1.0 entry still applies if someone rebuilds the field.

## Added this take

- New recipes: `learn/recipes/zone-c-moss-plates.md`
- New failure entries: plate stretch / 8 m camera, 2026-10-11
