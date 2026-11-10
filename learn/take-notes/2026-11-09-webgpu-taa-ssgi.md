# Take note — webgpu taa ssgi — 2026-11-09

Engine step, not an Imagine cook. `python3 tools/quota/quota.py` was not run. There is no cook ndjson for this run. No quota figure is invented.

## Quota and turns

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| TAA and SSGI bricks, crystal candidate page | other | one implementation, three headless WebGPU passes | not stored | accepted |

## This step

- Step: optional in-house TAA and SSGI on the house WebGPU engine, off by default, measured only on `m449cand`.
- Accepted because (command, row, numbers): `node --test engine/webgpu/check/post449/math.test.mjs` 13 pass. `node engine/webgpu/check/post449/run.mjs` PASS on SwiftShader. Joint flicker variance 2.89e-5 → 1.73e-5. Close-up 1.02e-4 → 3.61e-5. Wake behind Bolt 0.036 vs 0.467 with history open. Wall luma 0.0335 → 0.0539, pocket 0.0336 → 0.0464. Frame wall-clock 208 / 307 / 452 / 589 ms (off / TAA / SSGI / both) at 720×1280. Phone cost not measured.
- Recipe appended (path, or `none`): none. No Imagine prompt was sent.
- Failure appended (heading in `learn/failures.md`, or `none`): “SSGI still brightens a pocket behind a thin fin”.

## Biggest waste

The first screen-space hit test treated “farther than the depth buffer” as a hit. The lit floor is closer than the shadowed wall, so those rays missed and the wall gain was only the miss colour. Cited below.

## Reuse next time

- Recipes to copy: none
- Library ids to place (`tools/library`), instead of recooking: none
- Failures that would have caught this take earlier: the new SSGI entry. A ray that walks toward the camera needs a world-distance hit, not a farther-than-depth test.

## Added this take

- New recipes: none
- New failure entries: “SSGI still brightens a pocket behind a thin fin”
