# Canyon cristal — provenance

SmiR, 2026-11-07, on the new environment key: « Ok trop bien ».

The key is an artistic reference only. It is not a runtime texture. `CROPS` remains a record of that plate and is not sampled.

Revision `materials-v2-r1` (zip sha256 `6a2cf6ce010a552ce0797bdc75f354d625ffc6e5997dd52791ae6a62f61e6186`, 1986224 bytes) holds four native 1024×1024 JPEGs. Completion zip sha256 `938f362343d0e8b68a9339209d5528894e1e98c76776928e9aa20383ead67d30`, 865532 bytes, adds stream (2 m), violet (0.5 m, paler than requested) and a 1280×720 sky plate. Embedded C2PA names softwareAgent “Grok Imagine” and certificate identity “xAI Grok Imagine”. The signature was not verified.

The sky plate is not the house sky. The house map is equirectangular 2:1, `uv = (atan2(x,-z)/2π+0.5, 0.5-asin(y)/π)`, repeat on U, horizon on the middle row, at least 2048×1024. This plate is 16:9 and its left and right nebulas do not meet. It is stored and not sampled.

Declared periods are not measurements. Wall and cyan stay quality HOLD. Ground, architecture, violet and stream are not a visual PASS. The r1 review stands: the ground JPEG repeats, the wall JPEG is near-black, the cyan JPEG is almost flat. Bevels, an 8-side cut gem and a harder sun term are there so the mesh can read. They do not invent grain the JPEGs do not have. Fog stays off. Release is HOLD.

Isolated candidate: `crystal.html?candidate=materials-v2-r1`. Without that flag the page does not paint.

Route: `engine/webgpu/crystal/crystal.html` served from `engine/webgpu`.

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

The archive `bolt-idle4b5-rgba-1107` (23728089 bytes, sha256 `8e4c640f234c858e407d6623c2cfd3939c58743b957554446c829a4391f8fab8`) was extracted under `engine/webgpu`. `sha256sum -c idle-manifest.sha256` : 145/145 OK (144 PNG plus the WebM). Crystal calls `makeBreathClip` on `../assets/meadow/` and sets `misc.x` to 0 so the sine warp stays off.

Paw-plant and tail/side crop of that gen4b source are unchanged. They were not accepted as fixed.

## Planet

`key/planet-surface.jpg` sha256 `62a6b8e69bb71b557219b41740bfa7bf64ed2d38068ba5d77bfc56a66a4c1f81`, 1280×720. It is a surface plate, not a finished disc. Left/right edges do not match (mean channel difference about 30; the equator is a hard cut). Poles are pale low-detail bands. The loader feathers 56 columns and flattens 4 pole rows to their own average, then maps the plate on a world-fixed sphere with the scene sun as terminator and a larger shell for the limb. Phone frame time was not measured.
