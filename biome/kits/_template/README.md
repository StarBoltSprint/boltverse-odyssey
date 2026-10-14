# Biome kit template

Copy [`kit.json`](kit.json) to `biome/kits/<id>.json`. One file per biome. Any later player uses the same file. The id is the filename: `biome/kits/player-coast.json` has `"id": "player-coast"`.

Fill the paint. Leave the geometry.

| Fill | Leave |
| --- | --- |
| `name`, `timeOfDay`, `paint` | `geometry` |
| `sun.azimuthDeg`, `sun.elevationDeg`, `sun.kelvin` | `sun.count` (1) |
| `palette` hexes (prompt guidance) | `camera.play` |
| `camera.plates` you add, each with a `type` | sky plate: 8 slices, 60° HFOV, 45° step, horizon 0.5 |
| `livingLoops` roles and durations | ground plate: `ortho`, tile 0.9 m, no horizon |
| `promptPreamble` | `scale.boltShoulder` |
| `decreeHooks` | `pixels` |
| `fog.colourSource` (the Imagine plate you will sample) | `negatives` already list the failure-log headings |

`python3 tools/kits/kit.py check` must pass before the file is a kit. `python3 tools/kits/kit.py show --id <id>` prints the preamble to paste.

## Geometry lock

Owner geometry for every kit:

- Level horizon at **50%** of the frame (`horizonFraction` 0.5).
- **8** Imagine sky slices, **60°** horizontal field, yaw step **45°** (headings 0, 45, 90, 135, 180, 225, 270, 315). Overlap is 15°. Eight steps of 45° close the ring.
- **One sun.** Azimuth, elevation, and Kelvin change with the biome. The count does not.
- **Ortho ground tiles.** Top-down, 0.90 m, no horizon in the picture.

The phone play view stays 720×1600, fov_y 40, eye 0.85 m, boom 6 m, magnification ≤ 1. Those numbers are [`tools/layout/testdata/spec.json`](../../../tools/layout/testdata/spec.json). Bolt's shoulder reference stays withersFrac 0.10 on that frame, measured at the shoulders ([`biome/docs/20-default-plate-proportions.md`](../../docs/20-default-plate-proportions.md), [`biome/docs/13d-auto-scale.md`](../../docs/13d-auto-scale.md)). Body width 0.7 m and radius 0.45 m are the layout hero.

A slice at 60° on a 720 px play view needs `720 / (60/360) = 4320` px across. Width above 4096 is split before upload (`tools/assetcheck` kind `backdrop`). The sky chain is still `python3 tools/sky/check.py`.

An orbit plate, when you add one, asks for eight stills, yaw step 45°, elevation 18°. That elevation is the stored hull recipe, then `tools/objsheet/preflight.py` measures the file.

## Pixels

Every visible pixel is an Imagine image or video. Code may compute invisible relief, placement, and physics, and it may apply fog, one grade, and capped bloom ([`biome/docs/67-imagine-post-pass.md`](../../docs/67-imagine-post-pass.md)). Fog colour is sampled from the Imagine sky or plate named in `fog.colourSource`. Palette hexes are prompt guidance. They are not a fog colour and not a code colour.

Living-loop roles and the registry: [`stock/loops/README.md`](../../../stock/loops/README.md). Two or more layer durations must have a combined repeat of at least 600 s (the sky gate). 13, 17, and 29 do.

Decree hooks are extra keywords for `python3 tools/decrees/brief.py --kit <id>`.

Machine-readable lock: [`schema.json`](schema.json).
