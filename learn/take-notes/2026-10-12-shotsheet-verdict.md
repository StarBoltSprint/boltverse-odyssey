# Take note — tools/05-shotsheet-verdict — 2026-10-12

No Imagine cook. No session ndjson. `python3 tools/quota/quota.py` was not run. No quota row was added. The numbers were not invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| shot-sheet visual verdict | other | 1 | not recorded | accepted |

## This step

- Step: tools/05-shotsheet-verdict
- Accepted because (command, row, numbers): `python3 tools/objsheet/selftest.py` exit 0 (repo rock keepMin 0.9939). `python3 tools/library/selftest.py` exit 0. `sheet.py --build terrace-block` wrote PENDING cells key, 45°, grazing, 8 m, 3 m up. PENDING intake exit 1. KEEP intake exit 0. FAIL listed `door void too deep` and `texel mush at the cornice`.
- Recipe appended (path, or `none`): `learn/recipes/shotsheet-verdict.md`
- Failure appended (heading in `learn/failures.md`, or `none`): none

## Biggest waste

The first shot-verdict check was launched from the repo root, so `import selftest` missed `tools/objsheet`. Re-ran from that directory. No second cook.

## Reuse next time

- Recipes to copy: `learn/recipes/shotsheet-verdict.md`
- Library ids to place (`tools/library`), instead of recooking: none. A present `shotSheet` of PENDING or FAIL is refused. KEEP with empty defects is the only sheet that passes.
- Failures that would have caught this take earlier: none. The pixel sheet still does not judge these five cameras.

## Added this take

- New recipes: `learn/recipes/shotsheet-verdict.md`
- New failure entries: none
