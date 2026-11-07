# Canyon cristal — provenance

SmiR, 2026-11-07, on the new environment key: « Ok trop bien ».

The key is an art plate, not a gameplay backdrop. Meshes are house geometry. Every world colour is a crop of that plate.

| Item | Source |
| --- | --- |
| Key bytes | `key/environment.jpg` |
| sha256 | `a912d091c0a698d47c027f1ca2e9c1f5faa7d329c29c56ce6fa6f135ab6274e9` |
| Parent path | `/workspace/biome-crystal-1107/new-biome-key.jpg` |
| Size | 720×1280, 465807 bytes |
| Bolt | `engine/webgpu/assets/meadow/bolt439_atlas.png` (live card, not a new dog) |
| Crops | `biome.js` `CROPS` — mineral, violet, cyan, stone, stream, stars, planet |

Fog colour is the average of the stars crop, converted from sRGB. No second painted texture.

Route: `engine/webgpu/crystal/crystal.html` served from `engine/webgpu`. Capture adds `?cap=1&w=720&h=1280`.

## Capture (this VM, headless Chrome + SwiftShader)

| | |
| --- | --- |
| Page | `http://127.0.0.1:8765/crystal/crystal.html?cap=1&w=720&h=1280` |
| Sim step | 1/60 s inside `bolt-idle` (a 1/240 step never leaves the idle gate) |
| Video frames | 600 steps of sim time 1/30 s, encoded 30 fps, 20.000 s |
| Readback | `mapAsync` RGBA8, JPEG q=0.92 then libx264 |
| HQ | h264 High, 720×1280, crf 18, 600 frames, decode exit 0, 23 MB |
| Proxy | scale 360×640 only, same 600 frames and 20.000 s, crf 26, decode exit 0, 2.0 MB |
| MSAA | 4. Canvas 720×1280 for the capture. Play page still uses `min(devicePixelRatio, 2)` like the meadow page. |

The 30 fps figure is the encode rate of the stepped frames, not a measured display rate. SwiftShader took about 170 s to produce the 600 frames.

## Idle

Crystal previously imported only `bricks/bolt-idle.js`. That plants a gallop atlas frame and warps it with a sine (`idleCardLy` / `idleTailUV`). It is not the filmed breath.

The selected Imagine idle is gen4b, already integrated on the meadow breath page:

- module `engine/webgpu/bricks/bolt-breath.js` (`BREATH_BUILD` `m448aaa3-breath1`)
- 144 PNG frames, 24 fps, 200 ms crossfade, stamp `{sx:286, sy:570, sw:156, sh:470}` into the 384×896 card
- clip name `bolt_idle4b_loop_alpha.webm` (the GPU reads the PNGs, not the WebM)
- directory `engine/webgpu/assets/meadow/bolt_idle4b5_rgba/f0000.png` … `f0143.png`

Those PNG files and the WebM are not in this checkout. Parent scratch named by the task: `/workspace/bolt-idle/gen4` and `assets/meadow/bolt_idle4b5_rgba` on the install box. Crystal now calls `makeBreathClip` on `../assets/meadow/` and sets `misc.x` to 0 so the sine warp stays off. It does not invent frames.

Paw-plant and tail/side crop of that gen4b source are unchanged. They were not accepted as fixed.

## Planet

`key/planet-surface.jpg` sha256 `62a6b8e69bb71b557219b41740bfa7bf64ed2d38068ba5d77bfc56a66a4c1f81`, 1280×720. It is a surface plate, not a finished disc. Left/right edges do not match (mean channel difference about 30; the equator is a hard cut). Poles are pale low-detail bands. The loader feathers 56 columns and flattens 4 pole rows to their own average, then maps the plate on a world-fixed sphere with the scene sun as terminator and a larger shell for the limb. Phone frame time was not measured.
