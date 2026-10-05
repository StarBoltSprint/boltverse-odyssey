# Take note — zone B local harden — 2026-10-05

## Quota and turns

No Grok CLI ndjson for this step. `python3 tools/quota/quota.py` was not run. No image or video generation.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Face colliders, HUD, bloom draws, planet texture wiring | other | 1 | none | accepted |

## This step

- Step: Zone B local harden. No Imagine. No new assets.
- Accepted because: `node packs/zone-b/play/hard-collide.test.mjs` exit 0. Plaza opening 0.800 m, leg −0.258 m, walk ends x 0 z 80. Anchor mouth −2.200 m, sealed 0, a footprint cell +0.198 m, wallCells 4170. `node --check` clean. `lintPlaySource` clean on `play.js` and `hard.js`. Report `packs/zone-b/proof/local-harden/REPORT.md`.
- Recipe appended: none. Gotcha added to `learn/recipes/zone-b-hard-loft.md`.
- Failure appended: `learn/failures.md` 2026-10-05, the Anchor loft bridges the painted arch.

## Biggest waste

Treating the painted Anchor arch as a hole in the mesh. The face field is right to block it. The loft filled the mouth. That miss is the failure row above.

## Reuse next time

- Recipes to copy: `learn/recipes/zone-b-hard-loft.md`. Collider is `packs/zone-a/play/collide.js`, copied to `packs/zone-b/play/collide.js`.
- Library ids to place: none.
- Failures that would have caught this take earlier: the new Anchor-bridge row. It did not exist before this step.

## Added this take

- New recipes: none.
- New failure entries: one, dated 2026-10-05, the Anchor loft bridges the painted arch.
- Geometry: no change.
- Owner taste: no new row. The owner has not reviewed this step.
- Preview: freeze after the commit, loopback only.
