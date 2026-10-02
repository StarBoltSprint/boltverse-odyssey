# Take note — geometry lock — 2026-10-02

## Quota and turns

One line per item that was cooked or rejected in this take.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| none | other | 0 | 0 | no cook |

## This step

- Step: store the owner geometry lock (practice, not an xAI seal) and the report-only checks. No Imagine cook.
- Accepted because (command, row, numbers): `python3 biome/scripts/plate-geo-qc/selftest.py` — level horizon row 800 on 1600, sky `f_px` ≈ 623.538 from width 720, turn +15° / 8×45 and 4×90, 45° shadow equals height, texel density spread fails, law 23 thresholds unchanged (`INLIER_MIN` 0.75, sag 12 px).
- Recipe appended (path, or `none`): none. The index points at `learn/geometry.md`. That page is not a recipe.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-02 — law 23 does not measure a level horizon, slice closure, f_px, or texel density`.

The step confirmed the sealed dash thresholds and the KEEP prompt files. It did not confirm a new still. The improvement written under `learn/` is `learn/geometry.md` plus the failure row. Prompt variants are in `learn/prompts-audit.md` and were not sent.

## Biggest waste

None on a cook. The waste this lock avoids is treating 0.38 as a level horizon. That miss is the failure entry above.

## Reuse next time

- Recipes to copy: none new. Ship KEEP stays `learn/recipes/hull-ship-xai-starship-hero.md` (eighteen degrees stays in that file). Rock KEEP stays `learn/recipes/rock-slab-overhang.md`.
- Library ids to place (`tools/library`), instead of recooking: none added.
- Failures that would have caught this take earlier: the new law 23 row. Before it, only the dash judge existed.

## Added this take

- New recipes: none.
- New failure entries: law 23 does not measure a level horizon, slice closure, `f_px`, or texel density.
