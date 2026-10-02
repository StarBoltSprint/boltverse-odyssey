# Recipe index

Filled recipes live in this directory, one file per validated cook, copied from [`_template.md`](_template.md). Add the row when the file is added. Do not list a cook whose prompt or QC numbers were not stored.

No filled recipe is in the tree yet. The methods below are the docs and commands a new cook follows until a recipe file exists. They are not recipes: several of them say the prompt was not stored.

Skills: [`.grok/skills/`](../../.grok/skills/). Failures already paid for: [`../failures.md`](../failures.md).

## sky

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

Chained slices, not one wide file: [`biome/docs/64-imagine-build-limits.md`](../../biome/docs/64-imagine-build-limits.md) section D (generate slice 1 at 21:9 or 5:2, each next slice an edit of the previous, `required_px = play_width / (hfov_deg / 360)`). Seam and magnification: `python3 tools/assetcheck/check.py` kind `backdrop` ([`tools/assetcheck/README.md`](../../tools/assetcheck/README.md)). The 138° KEEP outpaint and the overlap MAE band are [`tools/relief/README.md`](../../tools/relief/README.md) and [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md). Plate-0 prompt: not stored.

## ground-tile

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

World-locked top-down stills, about **0.90 m**, **≥ 4** variants: [`biome/docs/61-free-clearing-walk.md`](../../biome/docs/61-free-clearing-walk.md), [`biome/docs/62-open-world-zones-process.md`](../../biome/docs/62-open-world-zones-process.md). Gate the set together: `python3 tools/assetcheck/check.py` kind `tile` (wrap seam, exposure, magnification ≤ 1 at 720×1600). Placement is `python3 tools/layout/layout.py generate` then `layout.py check`. The layout tool does not draw the tile.

## rock

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

Eight views, one every 45°, from one sharp still (V0) plus the previous view: [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md) KEEP method. Eight consistent views are not an Imagine feature (max 5 sources): [`biome/docs/64-imagine-build-limits.md`](../../biome/docs/64-imagine-build-limits.md) section C. Before a hull: `python3 tools/assetcheck/check.py` kind `cutout`, then `python3 tools/objsheet/sheet.py`.

## hull-ship

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

Hull from stills that already passed the sheet: `python3 tools/walkaround/build.py --views <dir> --config <config.json> --out <dir>`. Read `qc/report.json`. Magnification ≤ 1. Register a passing object with `python3 tools/library/library.py add` so the next zone names `{ "library": "<id>" }` instead of recooking it ([`tools/library/README.md`](../../tools/library/README.md)).

## cutout

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

`python3 tools/assetcheck/check.py` kind `cutout` with a declared `onScreen` size and `key` (`alpha`, `black`, or `green`). Cook at or above the on-screen pixels. Compositor `scale` stays ≤ 1 ([`biome/docs/56-cutout-native-scale.md`](../../biome/docs/56-cutout-native-scale.md)). Bolt motion stays `lock/bolt-gallop-cycle.mp4`. An `assetcheck` WARN on a `lock/` file is not a recook.
