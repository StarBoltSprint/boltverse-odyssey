# Take note — corridor horizon — 2026-10-06

## Quota and turns

No session ndjson was in this cook, so `tools/quota/quota.py` was not run. No quota figure is invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| corridor horizon and one ground | other | 2 | n/a | accepted |

## This step

- Step: raise the chase pitch toward the horizon, and paint the carpet from one native ground still
- Accepted because (command, row, numbers): walk `drawCalls=7`, `texMB=184.5`, `activeVideos=4`, `eyeY` 3.5, `pawY` 0, ground `m3` at 1024, rocks 13, speed 2.85. Sprint rocks 33, speed 8.6, charge 1, same draws and textures. Horizon test is inside 0.30–0.35. `hang_selftest.py` exit 0. Twenty node tests pass. `renderlint` PASS.
- Recipe appended (path, or `none`): `learn/recipes/corridor-horizon-ground.md`
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-06 — the chase aimed at the paws`; `2026-10-06 — ground stills drew a square every tile`

## Biggest waste

The first single still was m0 on a quad per cell. Its rim is darker than its core, so the checkerboard came back as a grid of the same picture. That row is in `learn/failures.md`.

## Reuse next time

- Recipes to copy: `learn/recipes/corridor-horizon-ground.md`, `learn/recipes/corridor-awaken.md`
- Library ids to place (`tools/library`), instead of recooking: `packs/zone-a/src/ground/m3.png`, zone A lofts, boulder and stone hulls
- Failures that would have caught this take earlier: the paw-aimed chase, and a ground still whose rim is darker than its core

## Added this take

- New recipes: `learn/recipes/corridor-horizon-ground.md`
- New failure entries: `2026-10-06 — the chase aimed at the paws`; `2026-10-06 — ground stills drew a square every tile`
