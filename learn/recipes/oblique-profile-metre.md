# object-gate — oblique profile in metres

Status: validated for the check. The tower cook in this take is FAIL overall. Do not treat the tower mesh as a KEEP.

| Field | Value |
| --- | --- |
| Asset kind | `hull/ship` |
| Take | tower-volumes-1012 |
| Commit | `61e56a9a` |
| Date | 2026-10-12 |
| Size | tower local 46.02 × 173.82 × 39.57 m |
| Tries | one completed gate (816 s). Two earlier launches died in the tool before geometry. |
| CLI | `python3 tools/object-gate/lib/oblique.py selftest` then `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/tower-volumes-1012/gate` |
| Image refs | full-face plates reused; lower plates reused. No new Imagine prompt. |

## Prompt

not stored

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/object-gate/lib/oblique.py selftest` | flat box | oblique FAIL, relief FAIL |
| `python3 tools/object-gate/lib/oblique.py selftest` | studded box | oblique PASS, relief PASS |
| object-gate tower-hero | oblique-profile 45°/grazing | bar 0.521 m; blocking ranges 0.60–4.50 m; H 173.821 |
| object-gate tower-hero | facade relief >= 0.521 m | +x 3, −x 3, +z 1.05, −z 2.95 |

The same gate is FAIL on visible px/m 50.8 vs 154.6, shadow 0 px, crispness planes 10/10/1/6, alignment max overlap 0.1513, checklist wedge/chrome/damage/sand.

## Gotchas

A raw camera-depth range of the whole object false-passes a flat box, because the front and the side are both in frame. Score signed distance from the face plane, fragments whose normal faces the camera, inside ±2.5 m of that shell.

The step-root `oblique-sheet.jpg` is the parent of the directory named `gate`. The object dump lives in `<gate>/<id>/`. Copying only when the dump directory itself is named `gate` leaves the step sheet missing.

`attach()` must see `multiview_tower` as `__main__` or the planar UV table is empty and stretch collapses.

## Reuse

Copy the bar `max(0.5 m, 0.003·H)`, the 8 m and 30 m blocking pair, and the flat-box self-test. Swap the mesh. Do not copy this tower as a hung solid.
