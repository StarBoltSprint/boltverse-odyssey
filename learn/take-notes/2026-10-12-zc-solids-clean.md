# Take note — zc-solids-clean — 2026-10-12

The step is rejected. Quota and `tools/preview/freeze.py` were not run.

## Quota and turns

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| five Zone C solids | hull/ship | 2 mesh builds, 2 object-gate runs | 0 Imagine | rejected |

## This step

- Step: SPEC-ZC-SOLIDS-CLEAN-1012, outdir `steps/zone-c/05-solids-clean/`
- Accepted because (command, row, numbers): not accepted. Object-gate verdict FAIL. `numbers.json` `pass` is false. CIEDE2000 mean 10.122. Triangle-quality PASS. Untextured, oblique-profile, and approach IoU FAIL on all five.
- Recipe appended (path, or `none`): none. The cook did not pass its QC rows.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-12 — Zone C clean hull is sealed and still grey up close`

## Biggest waste

Attempt 1 spent a full gate on inward ±Z windings and a key sampler on the plate material (stretch 1.333, black camera wall). Attempt 2 fixed those and the close oblique and untextured rows still failed. The second gate was the last allowed measurement.

## Reuse next time

- Recipes to copy: Zone B mesa path in `tools/imagine-to-3d/README.md` (hull silhouette, voxel remesh, plate projection). Do not copy the MoGe per-pixel shell.
- Library ids to place (`tools/library`), instead of recooking: none. These hulls are not registered.
- Failures that would have caught this take earlier: the new triangle-quality row catches soup; it does not catch a slab that is sealed and still flat at 8 m. Oblique-profile and untextured-area are the rows that failed this hull.

## Added this take

- New recipes: none
- New failure entries: the heading above
- Tool note: `feedback/2026-10-12-object-gate.md`
