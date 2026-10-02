# 65 — Render quality (any play view)

Kitchen only. Not a hang. Dated **2026-10-02**.

**This page names no biome and no sky style.** Paint stays in the Imagine assets. These rules are how a play view draws those assets. A cold session applies them on every play build, including the first one in a new conversation.

Performance work may only remove waste. The picture the player sees stays as sharp as the Imagine files, at magnification **≤ 1.0**.

Law [56](56-cutout-native-scale.md) already forbids enlarging a keyed cut. Law [63](63-layout-file-and-validator.md) already fails a play view whose HUD magnification is above `1.0`. This page is the draw path around those locks. Do not invent a second render-quality law. The only passes allowed on top of Imagine pixels (fog, grade, bloom) are the law [67](67-imagine-post-pass.md) exception, and these rules still apply under it.

## Acceptance

| # | Rule | PASS | FAIL |
| --- | --- | --- | --- |
| 1 | Zero quality loss | After a perf change, sharpness and magnification are equal or better. Displayed magnification stays **≤ 1.0**. | Lower displayed resolution, a downgraded Imagine file, a cut visible layer, a slower living-loop frame rate, or softer pixels. |
| 2 | Instanced repeats | Repeated objects (ring stones, rocks, cutouts, any repeated asset) use `drawArraysInstanced` or `drawElementsInstanced`. Per-instance `matrix` and view index go through `vertexAttribDivisor`. | A per-object `drawArrays` / `drawElements` loop for a repeated asset. |
| 3 | Static upload | Ground, hulls, ring stones, and wreck vertex data are uploaded **once** with `STATIC_DRAW` at load. | `new Float32Array` (or any new typed array) inside `bufferData` on a batch, every frame. |
| 4 | Filtering | Still images: `LINEAR_MIPMAP_LINEAR` and `generateMipmap`. Ground also sets `EXT_texture_filter_anisotropic` up to **8**. Video textures: `LINEAR`. | `NEAREST` on a world texture (ground, sky, prop, hull view, video). |
| 5 | Video budget | Offscreen or out-of-range videos are paused or unloaded. At most **4** videos decode at once on a phone. Decode size matches the displayed size, and magnification stays **≤ 1.0**. A video texture uploads only when a new frame is ready (`requestVideoFrameCallback` where the browser has it). | A 2K decode for a small on-screen object, a fifth simultaneous decode, or an upload of a frame that did not change. |
| 6 | Phone frame | `devicePixelRatio` is capped at **2**. The render loop allocates nothing. Atlases are used where they cut texture binds without resampling the Imagine file. | DPR above 2, a per-frame allocation, or an atlas that resamples a texture softer than its source. |
| 7 | Perf line | Every playcheck report contains `Perf: drawCalls=<n>, texMB=<n>, activeVideos=<n>, jsMs=<n>`. | A report that omits any of the four fields. |
| 8 | World lock | Every world object (wreck, ring stones, rocks, props) is a hull mesh plus a view chosen from the camera bearing. Use the 8-view set, or however many distinct Imagine views exist. | A solid object on `camQuad` or any other camera-facing billboard. A still object whose screen orientation follows camera yaw. |

Walking **360°** around an object shows different sides. That is the world-lock check.

Frame times measured on software rendering (SwiftShader, no GPU) are printed and are **not** a pass or a fail by themselves. `tools/playcheck` launches Chrome with SwiftShader. Its `fps_avg`, `fps_1low`, and `frame_ms` rows stay in the report and do not decide the take on that run. `jsMs` is still required on the perf line. Draw calls, texture memory, active videos, magnification, and the source lint still decide the take.

The per-frame exceptions are the Bolt quad and the uniforms that pick a view from the camera bearing. Everything else that does not change stays on the GPU.

An integer object-ID / picking buffer may use `NEAREST`. That buffer is not a world texture. Ground, sky, props, hull views, and video may not.

## Counter-example — take 10c

Verified on `packs/zone-a/play/play.js` at commit `ef19dda` (branch `take10c`). That file is the draw path to refuse.

- World stills (`makeTex`), the Bolt video upload, and the gate video upload set `TEXTURE_MIN_FILTER` and `TEXTURE_MAG_FILTER` to `NEAREST` (around lines 135, 345, and 361). The ID buffer does the same (around line 107); only that ID buffer is allowed to.
- The file never calls `generateMipmap`, never sets `LINEAR_MIPMAP_LINEAR`, and never asks for anisotropic filtering.
- `drawBatches` runs every frame and does `gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.buf), gl.DYNAMIC_DRAW)` then `gl.drawArrays` once per batch (around lines 794 and 805). There is no `STATIC_DRAW` and no `drawArraysInstanced` / `drawElementsInstanced`.
- Solid objects, the gate, and the hero are pushed through `camQuad` (around lines 658, 681, and 693), so they face the camera. The wreck hull is a mesh; the other solids are not world-locked.

## Where the take is judged

`tools/playcheck/run` writes the perf line into `report.md` and `report.json` (`perfLine`). Rows:

| Row | FAIL when |
| --- | --- |
| `mag_max` / `mag` | Peak magnification above **1.0**. Already required. A perf change that raises it is FAIL under rule 1. |
| `active_videos` | More than **4** videos decoding in a captured frame. |
| `perf_line` | `drawCalls`, `texMB`, `activeVideos`, or `jsMs` was not reported. |
| `render_source` | The play source was not scanned, or the scan found `NEAREST` on a world texture, `bufferData` of a new typed array, a per-object draw loop, or `camQuad` on a solid. |
| `fullscreen` | The backing store is not **720×1600**, which is **360×800 CSS at DPR 2**. |

A local build is scanned from the `.js` files next to the served page. A remote URL passes `--source <play.js>` (repeatable). Unscanned source on a real play URL is FAIL. The measurement fixture (`snap.harness`) records the row and does not apply it.

`tools/reportview` shows those rows. A playcheck report with no valid perf line is FAIL on the page, including when the other rows say PASS.

```bash
tools/playcheck/run --url <local build> --layout <clearing.json>
tools/playcheck/run --url <play url> --layout <clearing.json> --source <play.js>
```

The same scan runs without a browser:

```bash
node tools/playcheck/src/renderlint.mjs <play.js>
```

Exit 0 is a clean scan. Exit 1 is a finding. The scan reads source text. It does not time the GPU and it does not see a draw that was built in another language and shipped without that source.
