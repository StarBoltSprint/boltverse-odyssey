---
name: orbit-views
description: Cook eight consistent views of one object from one reference still, then gate them before a hull. Use for a rock, a hull, or a ship walk-around.
---

# Orbit views

Eight stills, one every 45°. Imagine does not offer this as one feature. A multi-image edit takes at most five sources ([`biome/docs/64-imagine-build-limits.md`](../../../biome/docs/64-imagine-build-limits.md) section C).

## Before the first still

Read [`learn/failures.md`](../../../learn/failures.md) (orbit views without a silhouette lock) and [`learn/recipes/INDEX.md`](../../../learn/recipes/INDEX.md) `#rock` and `#hull-ship`. If a recipe file is listed, copy it. Do not invent its prompt.

## Cook

1. One sharp still is V0. Full-res PNG. The walk-around KEEP size in doc 60 is **1248×1584**. Measure the file. The 1k / 2k token is not a pixel size.
2. Each next view is an **edit** of V0 plus the previous view. Name the roles (`First image =`, `Second image =`) as in [`biome/docs/30-i2i-prompt.md`](../../../biome/docs/30-i2i-prompt.md). Area stays within ±15% of the neighbors. Height stays within ±8%.
3. This repo's image CLI is `POST /images/edits` (`image` plus `image_urls`). The checked-in caller is `imagineStill` in [`scripts/imagine-hooks.mjs`](../../../scripts/imagine-hooks.mjs). That function is the hall first-seal. It is not the orbit cook. Record the call you actually made in the recipe. There is no `/images/generations` script in the tree.
4. No turntable video. Doc 60 test 4: a spinning video morphs.

## Gate

```bash
python3 tools/objsheet/preflight.py --views <views> --hero <hero.png> --out <proof>
python3 tools/assetcheck/check.py --dir <views> --kind cutout --on-screen <W>x<H> --key <alpha|black|green> --out <reports>
python3 tools/objsheet/sheet.py --views <views> --config <config.json> --out <proof>
```

Run the preflight before keeping an 8-view set. It grades each still against the hero: luma within ±10%, hue correlation at least 0.80, centered silhouette IoU at least 0.55, top fraction within ±25% of the hero, ground gap within 0.12. Elevation is that silhouette proxy, not a surveyed camera. A failing set should fall back to **3–4 views** on a limited arc (about 90–120° around the hero). Do not cook eight yaws after that.

Stop after 2 failures of the same defect (the same drift, the same exposure jump). List the small Imagine-intrinsic miss and accept it. Do not spend a third round on it.

Stop the hull unless assetcheck and the sheet both exit 0. Paste `report.json`, `report.md`, and `sheet.png`.

Then, for a solid:

```bash
python3 tools/walkaround/build.py --views <views> --config <config.json> --out <hull-dir>
```

`qc/report.json` magnification ≤ 1. `sourceGates` and `handedness` PASS.

A validated object is registered, not recooked:

```bash
python3 tools/library/library.py add --intake <intake.json>
```

## After an accepted step

Append a recipe from [`learn/recipes/_template.md`](../../../learn/recipes/_template.md), a failure if a new miss showed up, and a take note from [`learn/take-notes/_template.md`](../../../learn/take-notes/_template.md).
