# Obsidian Reach — report

Verdict: HOLD. The isolated page and the numeric gates are in. There is no visual KEEP and no phone FPS.

| Row | Result |
| --- | --- |
| Page | `engine/webgpu/reach/reach.html`. Meadow pages were not edited. |
| Factory | `make.mjs --biome reach --no-swatch` → HOLD, exit 2, run `4aa32e3ef8ce`. Hard failures: none. CIE76 threshold stays 10. |
| Scale | tile 1.45 m, UV 0.68965517, slope 5.3°, Bolt card 494.2 px on 1280, NDC x 0, magnification 0.714, run 53.13 m, clearance 298.86 m, eye step 0.281 m. |
| LOD | 10 rings, outer radius 16384 m, seam 0.0014 mm, missing shared verts 0. Streamed chunk set moves when the camera moves 2 km. Crest and seat do not change across structure LODs. |
| Far pop | Spire 740 m. At 12 km it is still inside the frustum, about 65.8 px tall. No visibility flip. LOD changes at 455 m and 1605 m. A spire behind the camera is culled. |
| Frame time | Unproven. Headless Chrome destroyed the WebGPU device on the first submit. Median GPU ms was not measured. Phone FPS was not measured. |
| Capture | `/opt/cursor/artifacts/obsidian-reach.mp4`, 720×1280, 12 fps, 6.0 s, 72 frames, about 5.0 MB. CPU raster of the same clipmap, structures, stone tiles, and Bolt atlas. Bolt moved 38.3 m. Not a WebGPU present. |

Holds from the factory: sky unusable, sky blocked, four materials without a visual pass, missing breath frames, missing page capture, missing review, phone unmeasured.
