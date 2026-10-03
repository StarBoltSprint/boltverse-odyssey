# Take note — issue 153 tool loop — 2026-10-03

No Imagine cook. No quota ndjson was present for this run, so no row was appended to `learn/quota-log.md`. Numbers below are not invented.

## Quota and turns

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| law 65 play sampling + TripoSR off auto | other | 1 tool-loop round | not logged (no ndjson) | accepted |

## This step

- Step: issue #153. Play viewers sample with `LINEAR_MIPMAP_LINEAR` and mipmaps. TripoSR is not `auto` and does not replace the play mesh.
- Accepted because (command, row, numbers): `python3 tools/walkaround/selftest.py` PASS (law 65 check, rock, bowl, assembly, primitives, photogrammetry, compare). `python3 tools/mesh3d/selftest.py` PASS. `node tools/playcheck/src/renderlint.mjs` PASS on the three viewer files. Magnification limit stayed 1.0 (`MAG_LIMIT`, `fit_view_distance` default). The same new checks failed on the base before the fix (view.html had no `LINEAR_MIPMAP_LINEAR`; mesh3d stills used `NearestFilter`; `engine in ("auto", "triposr")` was present).
- Recipe appended (path, or `none`): none. No cook. No prompt was sent.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-03 — walkaround and mesh3d still sampled nearest, and auto called TripoSR`.

## Biggest waste

The first mesh3d colour assertion looked for `);` after the uv expression, so a correct continuous uv (`(vec2(u, v) + 0.5) / wh`) failed the same way a missing match fails. The assertion now reads the uv expression and fails when it contains `floor`. That is the same defect the base already failed (the old uv used `floor`).

## Reuse next time

- Recipes to copy: none for this tool loop.
- Library ids to place (`tools/library`), instead of recooking: none.
- Failures that would have caught this take earlier: `2026-10-02 — nearest sampling on world textures` and `2026-10-02 — single-image mesh leaves the phone orbit with holes`. Those guards did not scan these viewers. The new selftests do.

## Added this take

- New recipes: none.
- New failure entries: the 2026-10-03 heading above.
- Tool improvement: the two selftests. Confirmed existing rows; did not invent a prompt or a QC threshold. Phone preview was not frozen: no zone play page changed.
