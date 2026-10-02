---
name: keyed-cutout
description: Gate a keyed cutout for magnification, alpha, and halo before it is named in a scene. Use for a rock card, a prop, or any cut that is composited onto a plate.
---

# Keyed cutout

Cook the cut at or above its final on-screen pixels. The compositor may shrink (`scale` ≤ 1). It does not enlarge. Law: [`biome/docs/56-cutout-native-scale.md`](../../../biome/docs/56-cutout-native-scale.md).

Bolt's motion is `lock/bolt-gallop-cycle.mp4`. A WARN from assetcheck on a `lock/` path is not a recook. Bolt’s withers are about **0.60 m** at the shoulders. `h_px = f_px × H / Z`. State the pixel fraction, then measure. Do not enlarge the cut to hit a fraction (law 56). Chase plates still use `withersFrac ~0.10`. Lock: [`learn/geometry.md`](../../../learn/geometry.md).

## Before the cook

Read [`learn/failures.md`](../../../learn/failures.md) and [`learn/recipes/INDEX.md`](../../../learn/recipes/INDEX.md) `#cutout`.

## Gate

```bash
python3 tools/assetcheck/check.py --dir <stills> --kind cutout --on-screen <W>x<H> --key <alpha|black|green> --out <reports>
```

Or a manifest. Missing `onScreen` (and no camera projection) is a resolution FAIL, unless the file is grandfathered.

Rows that have to pass:

| Row | FAIL |
| --- | --- |
| `resolution` | Magnification > 1.0. The cutout uses the foreground mask bbox. |
| `alpha` | Opaque near-black with no alpha, an undeclared black field, a background rectangle, a halo thicker than 3 px, a bright green fringe on more than 0.35 of the edge, or more than 1% of a 3 px edge band with G > max(R, B) + 6. |
| `basic` | Not a PNG when lossless is required. Banding fraction above 0.045. |

Dark spill fails the 3 px edge row. Bright key green (G > max(R, B) + 28 and G > 70, or G > R + 35 and G > 80) is the older fringe row and still applies on a green key.

```bash
python3 tools/assetcheck/despill.py --in fringe.png --out clean.png
```

Despill clamps G to max(R, B) and erodes alpha by 1 px. It writes only `--out`. Then run the gate again. Stop after 2 failures of the same edge defect. List a small remaining miss and accept it.

Paste `report.md` and `report.json`. Exit 1 stops the cook.

A cutout that is also one view of a solid continues in the `orbit-views` skill (`tools/objsheet`, then `tools/walkaround`).

World sampling of the still, once it is in the play view, is `LINEAR_MIPMAP_LINEAR` plus mipmaps. `NEAREST` on a world texture fails `tools/playcheck` row `render_source`. See the nearest-sampling entry in the failure log.

## After an accepted step

Append a `cutout` recipe, any new failure, and update the take note.
