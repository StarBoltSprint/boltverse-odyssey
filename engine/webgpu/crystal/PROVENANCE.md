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

Known picture limits, from the frames: ground and crystal faces repeat the key crops, so a repeat edge shows near the camera; the planet crop sits in the upper right as a bright limb on the dome, not a reconstructed sphere. The arch and the spires are meshes you can walk to. Bolt is the live `bolt439` card, follow camera 2.35 m, lateral offset 0.
