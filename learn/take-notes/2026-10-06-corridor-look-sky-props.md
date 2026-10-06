# Take note — corridor look sky props — 2026-10-06

## Quota and turns

No session ndjson was in this cook, so `tools/quota/quota.py` was not run. No quota figure is invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| corridor look, sky, props | other | 1 | n/a | accepted |

## This step

- Step: phone look, full sky, seeded solids on the hung corridor
- Accepted because (command, row, numbers): settled shots `drawCalls=7`, `texMB=211.2`, `activeVideos=4`, `glError=0`, `archOpen` true, length 79.75 m. Top-band dark pixels below luma 8 are at most 2 of 28800. `hang_selftest.py` exit 0. Nine node tests pass.
- Recipe appended (path, or `none`): `learn/recipes/corridor-look-sky-props.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-06 — sky array upload passed ten arguments`

## Biggest waste

The first five captures were 6 KB blanks because `texSubImage3D` was called with ten arguments. The failure log has that row.

## Reuse next time

- Recipes to copy: `learn/recipes/corridor-look-sky-props.md`, `learn/recipes/wfc-corridor-hang.md`
- Library ids to place (`tools/library`), instead of recooking: zone A sky slices, `gate.ruin`, `arch.ruin`, `wreck.ruin`, boulder and stone hulls
- Failures that would have caught this take earlier: the ten-argument upload, once it is in the log

## Added this take

- New recipes: `learn/recipes/corridor-look-sky-props.md`
- New failure entries: `2026-10-06 — sky array upload passed ten arguments`
