# Object consistency sheet

One object, one view set, one proof. Run this **before** `tools/walkaround/build.py`. The command does not call Imagine and does not rewrite the stills. `sheet.png` is a labelled proof (nearest-neighbor fit into a 180 px cell, cyan mask outline). It is not an asset and it must not be sampled as a texture.

A hand-written PASS is not a PASS. Paste `report.json`, `report.md`, and `sheet.png`. Exit code 1 means do not build the hull.

```bash
python3 tools/objsheet/sheet.py \
  --views <views-dir> \
  --config <config.json> \
  --out <proof-dir>
```

The config is the walk-around config: `views[].file`, `yawDeg`, optional `elevationDeg`, `camera`, `objectSize`, optional `subObjects` (own `viewsDir` and `config`). Optional per view `guide` (a still, or a frame pulled from `guideVideo` at `guideDegPerSec` / `guideYaw0Deg`).

Needs `numpy` and `pillow`. A guide video also needs `ffmpeg`. No GPU. No depth model.

## What is measured

| Check | PASS | FAIL |
| --- | --- | --- |
| Silhouette | Keyed subject. Fill area ≤ **0.92**. | Empty mask, or the mask is the whole frame (no keyed background). |
| Ring | **8** horizontal yaws, every **45°** (0, 45, …, 315). | Missing or extra yaw. Elevated stills (pitch ≥ 25°) are drawn and carved against, and they are not part of this ring. |
| Guide IoU | Each view against its guide mask, **≥ 0.97**. | Below 0.97. Skipped, not failed, when no guide is given. A size mismatch is nearest-neighbor resized for this number only. |
| Adjacent | Area within **±15%**, height within **±8%** (the walk-around silhouette lock). | Outside that band. |
| Opposite | Views 180° apart: width within **±15%**, height within **±8%**. | Outside that band. This is width and height, not a pixel mirror. |
| Colour | Histogram correlation and mean foreground distance, reported on every adjacent pair. | Correlation **< 0.20** and distance **> 110** together. |
| Hull keep | Coarse **7-of-8** voxel carve (grid capped at 40). Each mask is ray-marched; keep fraction is the share of the mask the carve still covers. | Any horizontal view under **0.70**, or the mean under **0.80**, or the volume collapses. Disagreeing views shrink the carve toward a blob and the fraction falls. |
| Frame margin | Empty pixels on every side of the unfilled mask, as a fraction of that side. Width and height are the decoded file. | Any side under **3%**, a mask that touches the frame, or a still over **2048** px on a side. A cropped view carves the hull down to the frame. |
| Interior holes | Transparent pixels enclosed by the silhouette, divided by interior pixels (opaque plus those holes). Measured on the unfilled mask. | Above **0.2%**. The sheet does not fill those pixels. A see-through stone is a failed still, not a hole to paint shut. |

Sub-objects are the same checks on their own view set, drawn on the sheet under their name. A failed part fails the sheet.

## Heuristics — read this before trusting a number

- Guide IoU is the strict identity check, and only when a guide frame exists. **0.97** means the still and the guide are the same silhouette, not a similar object.
- Adjacent area and height are the silhouette lock from the walk-around method. They do not know what the object is.
- Opposite width will fail a part that is genuinely much wider from one side than the other. Look at the sheet before treating that as two objects.
- Colour is a weak test. Two facings of one solid can sit far apart in the histogram and still pass, because the fail needs both a very low correlation and a large mean-colour distance. Do not use colour to override a failed silhouette.
- Hull keep is **not** the smooth surface-nets mesh. It is a coarse occupancy carve with the same 7-of-8 vote, ray-marched back into the mask. It answers “how much of each still would that vote keep?” A passing sheet is not a built hull. Run `tools/walkaround/build.py` after it. The same margin, hole, and 2K gates run again inside that build, before the carve, so a skipped sheet still cannot ship a cropped or see-through hull.
- The cyan outline and the labels are drawn on the proof only.

## Samples

`samples/` is the output of `python3 tools/objsheet/selftest.py`.

| Sample | What | Result |
| --- | --- | --- |
| `repo-synthetic-rock` | `tools/walkaround/testdata/synthetic-rock` (checked-in test solid, not Imagine pixels) | PASS. Min keep **0.99**. |
| `guides-good` | Those same stills used as their own guides | PASS. IoU 1. |
| `bad-guide` | Guides shifted by 24 px | FAIL guide IoU under 0.97. |
| `inconsistent` | Two yaws replaced by a different tall shape | FAIL. |
| `with-spur` | The test solid plus a second view set | PASS, both objects on one sheet. |
| `cropped-margin` | Synthetic ellipse that touches the top of the frame | FAIL margin. |
| `interior-holes` | Synthetic keyed ellipse with an enclosed transparent hole | FAIL holes. |
| `real-void-orbit` | Eight real stills from `biome/void-orbit/stills/` (flanks, top, belly, stern), yaws assigned only so the ring has eight numbers | FAIL adjacent area and height. They are not one locked walk-around. |

## Self-test

```bash
python3 tools/objsheet/selftest.py
```
