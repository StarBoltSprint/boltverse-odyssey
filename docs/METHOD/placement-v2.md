# Placement v2: camera match first, then a greedy loop on real renders

Tools: `tools/imagine-to-3d/placement_v2.py` and `tools/object-gate/kc-shots.mjs`.
Everything runs on the **staging mirror** (`kc_stage.py`, which refuses live roots). Run one browser at a time.
Imagine images are never generated here.

## Inputs per biome
- The key image and a composition file `layouts/<biome>-composition.json` with key rects (5 % grid read).
- A `camera` block holding the key's feature targets, as frame fractions (x, y from the top-left):
  ```json
  "camera": {"vp": [0.50, 0.59], "spireTop": [0.6325, 0.10]}
  ```
  - `vp`: the vanishing point of the main avenue.
  - `spireTop`: the tip of the hero landmark.
  - Read both off the key on a 5 % grid. If a biome has no spire, use its tallest hero object, and point `kc-shots probe` at that mesh name (`spire-lod*` today).
- A staging mirror, built with `python3 kc_stage.py build --stage S` and served with
  `cd S && python3 -m http.server 8997`.

## Step 1: camera solve (real renders)
```
cd tools/imagine-to-3d
OG_PLAYWRIGHT=/workspace/playtest/node_modules/playwright/index.mjs \
python3 placement_v2.py camera --out RUN/camera --budget 28 [--composition layouts/<biome>-composition.json]
```
- Coordinate descent over yaw, pitch, fovDeg and dy (eye lift). The starting steps are 3°, 2°, 6° and 3 m; a step halves when it brings no improvement.
- Limits: dy 0..25 m, fov 40..80°, pitch -12..15°.
- Each step is one 480x270 render. In-page `probe` projects the rendered camera's avenue direction and the visible spire box.
- Error = squared frame distance of `vp` and `spireTop` from the key targets.
- The visible-horizon line is logged as a diagnostic only. A warm horizon haze in the key fails the sky test, so it is not scored.
- Output: `RUN/camera/camera-v2.json` (the camera, the first and final error parts, and the log). Every later step reads it.
- **Check:** if a parameter ends at a bound (for example fov 80), say so in the report. It means the target cannot be reached with the current layout and eye height, not that the value is right.
- **Sand mound:** there is no local flattening; this is an honest limit. The dy solve lifts the eye over the mound instead. Flattening the terrain would mean editing the live heightfield, which is out of scope for staging.

## Step 2: greedy placement (real renders)
```
python3 placement_v2.py place --camera RUN/camera/camera-v2.json --out RUN/place --budget 12 \
    [--init layouts/<biome>.json] [--elements towers,spire]
```
- The start is the live layout. `--init` offers a whole candidate layout first, accepted under the same rule.
- Candidate moves, one element at a time: ds ±12/±24 m along the avenue, dlat ±8 m, dyaw ±15°.
- Candidates are ranked analytically by `layout_fit` (YXZ camera, same rules). Only the best few are rendered, so the budget is spent on likely wins.
- Rules checked before any render (`layout_fit.rules_ok`):
  - the street stays clear;
  - spacing is respected;
  - the 50/50 left/right balance holds;
  - each element stays on its own side.
- Each render does the following:
  - write `layout-v2.json` into staging;
  - run `kc_stage.build` (towers are InstancedMesh, so the page reloads);
  - take a 480x270 shot;
  - run `keycompare` IoU on the listed elements.
- **Accept** a move only if its owner element (the key rect containing the moved object's projection) gains more than 0.005 IoU AND no element drops more than 0.01. Otherwise revert. A layout worse than the current one is never accepted.
- Output:
  - `RUN/place/placement-log.json` (per-render scores, accept/revert);
  - `layout-v2.json`;
  - staging rebuilt with the final layout.
- The before/after table comes from the first and last accepted entries of the log.

## Applying to live (Grok Build, after review)
Staging only produces a layout and a camera. To go live:
1. Copy `layout-v2.json` to the live `objects1/layout.json`.
2. Copy the `camera` block to the biome's spawn and key camera.

Do both through the normal live-swap procedure (bump `?v=`), not from these tools.

## Honest limits
- The ranking is analytic, and the acceptance is by real render.
- With a budget of 12, the loop explores about 12 moves; it is not a global optimum.
- IoU on low-res renders is noisy at about ±0.005, which is why the acceptance threshold is 0.005.
