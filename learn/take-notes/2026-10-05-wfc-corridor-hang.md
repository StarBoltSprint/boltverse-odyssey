# Take note — wfc corridor hang — 2026-10-05

## Quota and turns

No session ndjson was in the repo. `tools/quota/quota.py` was not run. No image or video generation.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| WFC corridor hang | other | 1 | none | accepted |

## This step

- Step: hang `path-layout.json` into `world.json` and a play page that walks Bolt on already-cooked zone A ground stills.
- Accepted because: `python3 tools/wfc-path/hang_selftest.py` exit 0; `node --test packs/corridor-ab/play/place.test.mjs` 3 pass; `layout.py check --world` row `transition` PASS corridors=1 speed_bad=0 ground_bad=0 gate_bad=0; play `?shot=mid` mode corridor, along 7.2, drawCalls 9, glError 0, boltReady true.
- Recipe appended: `learn/recipes/wfc-corridor-hang.md` after the hang commit.
- Failure appended: none. The step confirmed doc 68 placement and added the hang. It did not repeat a logged failure.

## Biggest waste

Headless Chrome with `--disable-gpu` has no WebGL2, so the first screenshot was blank. SwiftShader draws the page. The same defect was not cooked twice as an Imagine miss.

## Reuse next time

- Recipes to copy: `tools/wfc-path/hang.py` with a spec whose `asset` and `ground` strings are files already on disk.
- Library ids to place: none. The floor reuses `packs/zone-a/src/ground/m0.png` through `m6.png`.
- Failures that would have caught this take earlier: none in `learn/failures.md`.

## Added this take

- New recipes: the hang command. No Imagine prompt.
- New failure entries: none.
