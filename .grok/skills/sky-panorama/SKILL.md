---
name: sky-panorama
description: Build a wide sky from chained Imagine slices and a seam check. Use when a backdrop or relief ring must cover a yaw without one image wider than the model allows.
---

# Sky panorama

Imagine has no panorama mode and no output wider than the 2k token. The pixel size is not published. Measure the file.

## Before the first slice

Read [`learn/failures.md`](../../../learn/failures.md) (a sky or hull video that drifts) and [`learn/recipes/INDEX.md`](../../../learn/recipes/INDEX.md) `#sky`. Copy a listed recipe. The plate-0 prompt was not stored. Do not write one.

## Cook

From [`biome/docs/64-imagine-build-limits.md`](../../../biome/docs/64-imagine-build-limits.md) section D:

1. Generate slice 1 at 21:9 or 5:2.
2. Measure the width.
3. Slice count is the smallest integer whose total width meets magnification ≤ 1.

   `required_px = play_width / (hfov_deg / 360)`

   The documented example is hfov 22.7° on a 720 px play view, about 11419 px, budget about 11500 px.
4. Each next slice is an **edit** with the previous slice as the source.
5. Hard-paste pixels already kept. Do not blend the locked center. Do not ask Imagine to pan.

The 138° KEEP and the depth tile starts (0, 960, 1920, 2636) are [`tools/relief/README.md`](../../../tools/relief/README.md). Depth only:

```bash
python3 tools/relief/bake_depth.py \
  --color <panorama.png> \
  --lock <depth-plate.png> \
  --lock-x <x> \
  --model /path/to/depth_anything_v2_small.onnx \
  --out <depth-panorama.png>
```

The image CLI in this repo is `POST /images/edits` ([`scripts/imagine-hooks.mjs`](../../../scripts/imagine-hooks.mjs) `imagineStill`). That function is the hall first-seal, not this panorama. Record generate versus edit, and the image refs, in the recipe.

A texture wider than 4096 is split before upload. The 2d KEEP ring is 4636 wide and is split at 2318 + 2318.

## Seam

```bash
python3 tools/assetcheck/check.py --manifest <manifest.json> --out <reports>
```

Kind `backdrop`. Width above 4096 fails until the file is split. Vertical magnification above 1 fails. Horizontal wrap uses the tile seam limits (ratio > 2.2 and absolute seam > 12).

The relief KEEP also requires plate MAE 0 and an overlap MAE in the band written in [`biome/docs/60-imagine-relief-panorama-method.md`](../../../biome/docs/60-imagine-relief-panorama-method.md) (accepted about 0.02–3.5).

## After an accepted step

Append a `sky` recipe, any new failure, and update the take note.
