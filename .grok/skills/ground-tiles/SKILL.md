---
name: ground-tiles
description: Cook at least four world-locked ground tiles and gate their seams before layout places them. Use for a clearing floor, not for a corridor video.
---

# Ground tiles

A clearing floor is top-down Imagine stills, about **0.90 m**, **≥ 4** variants, on an invisible relief. A single relief still is not the floor. A scrolling ground video is the corridor, not the zone.

## Before the cook

Read [`learn/failures.md`](../../../learn/failures.md) (one ground still frozen to the camera) and [`learn/recipes/INDEX.md`](../../../learn/recipes/INDEX.md) `#ground-tile`.

Method: [`biome/docs/61-free-clearing-walk.md`](../../../biome/docs/61-free-clearing-walk.md) and [`biome/docs/62-open-world-zones-process.md`](../../../biome/docs/62-open-world-zones-process.md) step 2.1.

## Cook

Lossless PNG. No horizon. No Bolt. True world scale for 0.90 m so magnification stays ≤ 1 at 720×1600. Record generate or edit, the image refs, and the measured size in the recipe. This repo's image CLI is `POST /images/edits` in [`scripts/imagine-hooks.mjs`](../../../scripts/imagine-hooks.mjs). Hall `imagineStill` is not this cook.

## Gate

One manifest for the whole variant set:

```bash
python3 tools/assetcheck/check.py --manifest <manifest.json> --out <reports>
```

Kind `tile`. Seam ratio above 2.2 and absolute seam above 12 fails. Exposure delta above 18 (0–255) or contrast ratio above 1.75 fails. Magnification above 1 fails.

Then placement, which does not draw:

```bash
python3 tools/layout/layout.py generate --spec <spec.json> --out <zone>
python3 tools/layout/layout.py check --clearing <zone>/clearing.json --out <zone>
```

Paste the layout `report.md`. Row `mag` must pass. A layout PASS is not a play PASS. The framebuffer is `tools/playcheck/run`.

## After an accepted step

Append a `ground tile` recipe, any new failure, and update the take note.
