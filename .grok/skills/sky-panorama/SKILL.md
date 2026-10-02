---
name: sky-panorama
description: Build a wide sky from chained Imagine slices and a seam check. Use when a backdrop or relief ring must cover a yaw without one image wider than the model allows.
---

# Sky panorama

Imagine has no panorama mode and no output wider than the 2k token. The pixel size is not published. Measure the file.

Close a full yaw with **8** rectilinear slices, **60°** horizontal field, **45°** step, **25%** overlap (`8 × 45 = 360`). Horizontal field stays ≤ 60°. Wider than about 70° stretches the edges. `f_px = (W / 2) / tan(HFOV / 2)` from the measured width. An equirectangular image is code only: width = 2 × height. Law 64’s 22.7° line is the magnification example below, not this closing set. Lock: [`learn/geometry.md`](../../../learn/geometry.md).

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
python3 tools/sky/check.py --slices <dir> --out <reports>
python3 tools/assetcheck/check.py --manifest <manifest.json> --out <reports>
```

`tools/sky/check.py` is the chain gate. It rejects a trailing clone or mirror, a content-strip join MAE above 4, a column-luma swing above 6 inside any 60° window, and a chain that does not close (last joins first). The report names which joins fail and the cheapest slice to recook. Kind `backdrop` still applies: width above 4096 fails until the file is split, vertical magnification above 1 fails, and a hard horizontal wrap uses the tile seam limits (ratio > 2.2 and absolute seam > 12).

The relief KEEP also requires plate MAE 0 and an overlap MAE in the band written in [`biome/docs/60-imagine-relief-panorama-method.md`](../../../biome/docs/60-imagine-relief-panorama-method.md) (accepted about 0.02–3.5).

A narrow crossfade (2–4% of the slice width, default 3%) may mix the two slices' own pixels after this gate passes. It stays off when the gate fails, and when the layout says seam blend off. It does not invent a pixel and it does not hide a failed join.

Stop after 2 failures of the same seam defect. List the miss. Do not spend a third cook on it.

## Living sky

The hung sky is video, not a frozen still. Each still slice is the first frame of an Imagine video seamless loop. Cook three layers for the whole yaw, not one video per slice:

| Layer | Duration |
| --- | --- |
| Stars | about 13 s |
| Dust | about 17 s |
| Nebula drift | about 29 s |

Those durations are pairwise coprime. The combined sky repeats at their least common multiple (6409 s for 13, 17, and 29). The gate fails a combined repeat under 600 s and prints `combinedRepeatSec`.

Give each slice its own random start offset. Adjacent slices, including the last against the first, must differ by at least 0.75 s. One decoder per layer samples those offsets. Do not open a decoder per slice.

Motion stays slow and small. No flash, no shooting star, and no other one-off event inside the loop: a distinctive feature that returns on a fixed period under 60 s makes the repeat obvious. The perceived-repetition row flags that period. An always-on star field is the texture and is not that row. A rare event, if one is wanted, is a separate one-shot Imagine clip fired at a random gap of at least 30 s.

Phone caps: at most 3 sky videos (Bolt keeps one decoder of the game's four) and 48 MiB of sky textures. Kind `sky-loop` in assetcheck measures one file's loop seam, amplitude, and that repetition row.

The plate-0 prompt was not stored. Do not write a new one. Record the call you actually made.

## After an accepted step

Append a `sky` recipe, any new failure, and update the take note.
