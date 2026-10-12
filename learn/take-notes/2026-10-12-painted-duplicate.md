# Take note — tools/07-painted-duplicate — 2026-10-12

## Quota and turns

Copied from `learn/quota-log.md`. Not rewritten.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| painted_duplicate gate | other | quota log turns 0 | turns 0, tools 102, images 0, videos 0, tokens in 204676, tokens out 60486, wall n/a, commit n/a, log 20261012-171249-tools-07-painted-duplicate.ndjson | accepted |

## This step

- Step: tools/07-painted-duplicate
- Accepted because (command, row, numbers): `python3 tools/object-gate/py/painted_duplicate.py --selftest` ok true, exit 0. Painted overlap 1.4 m, faces 101,102,103, world [1.28, 0.0, -0.4], ghosts 0, FAIL, CLI 1. Pale smear ghosts 1, world [3.6, -0.76, 0.0], overlap 0.0, FAIL, CLI 1. Clean overlap 0.0, ghosts 0, suggested_fix empty, PASS, CLI 0. `node tools/object-gate/selftest.mjs` printed `PASS selftest` and exited 0, including ghost icicles 84 without cones FAIL and cones PASS.
- Recipe appended (path, or `none`): none. No Imagine cook. The improvement is the failure entry below.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-12 — painted icicle still on the plate under a real cone`

## Biggest waste

The first proof used field names that were not the gates-API names (`failing_face_ids`, `world_position`, empty `suggested_fix` on PASS). The records were renamed and both self-tests were run again. The node kit command also does not resolve `js-yaml` through `NODE_PATH` (ESM). A temporary `tools/object-gate/node_modules` link to `/usr/share/nodejs` was used for the run and removed. It is gitignored.

## Reuse next time

- Recipes to copy: none. Reuse `tools/object-gate/py/ghost_streaks.py` for the pale smear. Do not duplicate that detector.
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: the new 2026-10-12 entry. `ghost_streaks` alone PASSes when a cone sits on the painted column.

## Added this take

- New recipes: none
- New failure entries: painted icicle still on the plate under a real cone
- No owner was present, so `learn/taste.md` has no new row. Preview freeze was not run: no play tree, and the terrace stays untouched.
