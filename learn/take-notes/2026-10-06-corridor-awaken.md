# Take note — corridor awaken — 2026-10-06

## Quota and turns

No session ndjson was in this cook, so `tools/quota/quota.py` was not run. No quota figure is invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| corridor chase, sprint, streaming props | other | 2 | n/a | accepted |

## This step

- Step: higher chase, un-mirrored turn, paws on the ground, a wider carpet, sprint that climbs, seeded streaming of already-cooked solids
- Accepted because (command, row, numbers): walk `drawCalls=7`, `texMB=211.2`, `activeVideos=4`, rocks 13, speed 2.85, `eyeY` 3.5, `pawY` 0. Sprint rocks 33, live 36, speed 8.6, charge 1, same draws and textures. `hang_selftest.py` exit 0. Twenty node tests pass. `renderlint` PASS.
- Recipe appended (path, or `none`): `learn/recipes/corridor-awaken.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-06 — the stream pool filled from behind the camera`; `2026-10-06 — the paw quad used the image fraction from the top`

## Biggest waste

The first sprint shot matched the walk. The pool had filled from behind and from lanes outside the 22.7° cone, so a full pool still showed nothing new ahead. That row is in `learn/failures.md`.

## Reuse next time

- Recipes to copy: `learn/recipes/corridor-awaken.md`, `learn/recipes/corridor-look-sky-props.md`, `learn/recipes/wfc-corridor-hang.md`
- Library ids to place (`tools/library`), instead of recooking: zone A sky slices, `gate.ruin`, `arch.ruin`, `wreck.ruin`, boulder and stone hulls
- Failures that would have caught this take earlier: the behind-first pool fill, and the paw offset that used `frac` instead of `1 - frac`

## Added this take

- New recipes: `learn/recipes/corridor-awaken.md`
- New failure entries: `2026-10-06 — the stream pool filled from behind the camera`; `2026-10-06 — the paw quad used the image fraction from the top`
