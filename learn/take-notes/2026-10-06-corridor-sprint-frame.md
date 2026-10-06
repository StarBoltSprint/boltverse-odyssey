# Take note — corridor sprint frame — 2026-10-06

## Quota and turns

No ndjson for this step. Image generations: 0. Video generations: 0. `tools/quota/quota.py` was not run. No quota row was invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| zone A frame, continuous sprint, speed ramp, density, seam | other | code plus headless portrait captures | 0 image gens | accepted |

## This step

- Step: frame the corridor like zone A, remove the corridor-end teleport, raise the sprint cap, keep visible density rising, fog the ground into the horizon.
- Accepted because: `node --test packs/corridor-ab/play/look.test.mjs packs/corridor-ab/play/chase.test.mjs packs/corridor-ab/play/stream.test.mjs packs/corridor-ab/play/run.test.mjs` — 38 pass, 0 fail. `packs/corridor-ab/proof/density-seam/REPORT.md` Verdict: PASS. Screen-y delta 0.0026. 60 s run x 1008.4 m, top speed 19.35 m/s, min live 40, max drop 2, max draw 8, 184.5 MB. Visible density 0.0139 → 0.0265 → 0.0297 at 8 / 16 / 24 s.
- Recipe appended: none. No Imagine prompt was sent.
- Failure appended: corridor-end teleport, portrait y 0.761, sprint cap 8.6, and the skipped proof draw, in `learn/failures.md`.

## Biggest waste

The first 60 s capture skipped `placeCamera` whenever a frame was not drawn. The eye fell behind Bolt and the ground left the portrait, which looked like the teleport the owner reported. The chase now steps even when the draw is skipped.

## Reuse next time

- Recipes to copy: none new. `holdBody`, `sprintCap`, and `pitchForEye` are in `packs/corridor-ab/play/look.js`.
- Library ids to place: none. Existing hulls and ruins.
- Failures that would have caught this take earlier: the four rows appended today.

## Added this take

- New recipes: none.
- New failure entries: the four 2026-10-06 rows at the bottom of `learn/failures.md`.
