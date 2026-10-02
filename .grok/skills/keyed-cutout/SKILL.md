---
name: keyed-cutout
description: Gate a keyed cutout for magnification, alpha, and halo before it is named in a scene. Use for a rock card, a prop, or any cut that is composited onto a plate.
---

# Keyed cutout

Cook the cut at or above its final on-screen pixels. The compositor may shrink (`scale` ≤ 1). It does not enlarge. Law: [`biome/docs/56-cutout-native-scale.md`](../../../biome/docs/56-cutout-native-scale.md).

Bolt's motion is `lock/bolt-gallop-cycle.mp4`. A WARN from assetcheck on a `lock/` path is not a recook.

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
| `alpha` | Opaque near-black with no alpha, an undeclared black field, a background rectangle, a halo thicker than 3 px, or a green fringe on more than 0.35 of the edge. |
| `basic` | Not a PNG when lossless is required. Banding fraction above 0.045. |

Paste `report.md` and `report.json`. Exit 1 stops the cook.

A cutout that is also one view of a solid continues in the `orbit-views` skill (`tools/objsheet`, then `tools/walkaround`).

World sampling of the still, once it is in the play view, is `LINEAR_MIPMAP_LINEAR` plus mipmaps. `NEAREST` on a world texture fails `tools/playcheck` row `render_source`. See the nearest-sampling entry in the failure log.

## After an accepted step

Append a `cutout` recipe, any new failure, and update the take note.
