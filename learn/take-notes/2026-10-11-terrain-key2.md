# Take note — terrain-key2-1011 — 2026-10-11

## Quota and turns

Copied from `learn/quota-log.md`. The counter does not see `turn_started` in this session log, so turns and tool calls are 0. Those cells were not invented upward.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| colour-mask skyline field | other | 1 reconstruction | turns 0, tools 0, images 0, videos 0, tokens n/a, wall 2581.2 s | accepted |
| SAM2 outline | other | scored inside attempt 1 | same row | rejected (silhouette 0.5486) |

## This step

- Step: terrain-key2-1011
- Accepted because (command, row, numbers): `python3 tools/terrain-from-key/run.py` gates.json pass true — silhouette 0.8481, repetition 0.1499, corridor slope 6.269°, median sink 1.986 m, vertex 38997 / 69632. Capture gate: loading frames contain Chargement and fail; later terrain frames pass, live and staging, 1280×720 and 720×1280. `DEFAULT_DEPTH` is `moge-2`. A 160×90 swatch through `bake_depth.py` wrote a 90×160 map.
- Recipe appended (path, or `none`): `learn/recipes/terrain-key2-skyline.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-11 — SAM2 sand mask is too holey to be the dune silhouette`; `2026-10-11 — Depth Anything V2 Large was left as the relief default`

## Biggest waste

The SAM2 box plus the Large comparison (18.08 s) did not change the shipped field. The colour outline was already passing. See the SAM2 row in `learn/failures.md`.

## Reuse next time

- Recipes to copy: `learn/recipes/terrain-key2-skyline.md`
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: key-camera dunes collapse (2026-10-11); checklist capture shot the loading overlay (2026-10-11)

## Added this take

- New recipes: `learn/recipes/terrain-key2-skyline.md`
- New failure entries: SAM2 holey sand mask; Large left as the relief default

The sheets stay the honest picture: key-city3, the live key-pose frame, and the keyed field. The after frame is a steep banked lane. Attempt 2 was not started. The numeric gate already passed.
