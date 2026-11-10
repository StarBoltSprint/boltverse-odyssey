# Take note — obsidian-reach — 2026-11-09

## Quota and turns

No Imagine image or video was requested. No session ndjson was available, so `tools/quota/quota.py` was not run and no quota number was invented.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Obsidian Reach page | other | 1 | 0 | accepted as HOLD |

## This step

- Step: kilometre basin in the house WebGPU engine, isolated page.
- Accepted because: `test-scale.mjs`, `test-lod.mjs`, `test-pop.mjs` exit 0; factory HOLD exit 2 with CIE76 still 10; capture is a labelled CPU raster, 720×1280, 6 s, Bolt moved 38.3 m.
- Recipe appended: `learn/recipes/reach-clipmap-seam.md`.
- Failure appended: headless WebGPU submit destroys the device.

## Biggest waste

The headless Chrome device died on the first submit, including a one-triangle page. The GPU frame time could not be measured.

## Reuse next time

- Recipes to copy: `learn/recipes/reach-clipmap-seam.md`.
- Library ids to place: the zone A ground stills `packs/zone-a/src/ground/m0.png`–`m3.png` at 1.45 m. Do not crop a reference.
- Failures that would have caught this take earlier: none in the log. The new failure is the headless device loss.

## Added this take

- New recipes: `learn/recipes/reach-clipmap-seam.md`.
- New failure entries: 2026-11-09 headless WebGPU submit.

Preview freeze was not run. The freeze tool requires `Verdict: PASS`. This step is HOLD.
