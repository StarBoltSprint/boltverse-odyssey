# Asset gate

Measure an Imagine image or video **before** it enters the game. The command does not resize, regrade, key, or replace the file. A downscale exists only inside a discarded measurement buffer (loop diffs, coarse flow).

A hand-written PASS is not a PASS. Paste `report.md` and `report.json`. Exit code 1 means the cook stops.

```bash
python3 tools/assetcheck/check.py --manifest manifest.json --out reports/assetcheck
python3 tools/assetcheck/check.py --dir stills --kind cutout --on-screen 400x700 --key alpha --out reports/assetcheck
```

Needs `numpy`, `pillow`, and `ffmpeg` / `ffprobe` on a CPU. No GPU.

## Manifest

See `manifest.example.json`.

| Field | Meaning |
| --- | --- |
| `screen` | Portrait the magnification is judged on. Default **720×1600**. |
| `webglMaxTexture` | Default **4096**. A backdrop wider than this must be split before upload. |
| `assets[].file` | Path relative to the manifest. |
| `kind` | `cutout`, `still`, `tile`, `backdrop`, `loop`, `turntable`, `video`. |
| `yaw`, `elevation` | Recorded on the report. Not a geometry solve. |
| `onScreen` | `[width, height]` pixels of this asset at the **closest camera** on that portrait. |
| `camera` + `objectSize` | Optional. Projects an on-screen size when `onScreen` is omitted. If both are set and they differ by more than 10%, the resolution check FAILs. |
| `key` | `alpha` (default for a cutout), `black`, `green`, or `none`. |
| `loop` | Run the seam check. Implied by kind `loop`. |
| `lossless` | Stills, cutouts, tiles, and backdrops require a PNG. Videos are lossy unless this is set. |

Missing `onScreen` (and no camera projection) is a resolution **FAIL**. The gate cannot prove magnification ≤ 1 without a declared size.

## Checks

Each check is PASS or FAIL with numbers.

| Check | What is measured | FAIL |
| --- | --- | --- |
| `basic` | File opens, codec, frame size, fps, duration. | Does not open. Lossless required and the codec is not PNG (stills) or a lossless video codec. Banding fraction above **0.045**. |
| `resolution` | Source pixels against `onScreen`. Cutouts, loops, and turntables use the **foreground mask** bbox, and the report includes the row span and fill ratio (`maskHeight / frameHeight`, `maskArea / frameArea`). Full-frame kinds use the frame. | Magnification **> 1.0** (the cook would be upscaled). Empty mask. `onScreen` larger than 720×1600. |
| `alpha` | Cutouts and keyed loops. | Opaque near-black field with no alpha (fraction **> 0.02**) unless `key` is declared. Undeclared black field on a cutout. Solid or inset background rectangle. Alpha halo thicker than **3 px**. Green fringe on more than **0.35** of the silhouette edge, or a green field whose luma std is above **18**. |
| `loop` | Last frame against first, on a neighbor downscale (160 px wide). Mean absolute error, 95th percentile, coarse block-match flow scaled back to source pixels. Frame-to-frame MAE for pops and frozen runs. | Seam MAE **> 8**, seam p95 **> 28**, flow **> 2 px**. A frame diff above `max(18, 4.5 × median)`. A run of **0.40 s** under MAE **0.45**. |
| `morph` | Turntables (one object that must keep its shape). Silhouette area, height, and IoU on the measurement scale, every frame. | One frame moves area by more than **15%**, height by more than **8%**, or silhouette IoU under **0.75**. Smooth yaw change of a stable solid stays inside this. A shape pop does not. |
| `tiling` | Ground-tile variants, together. Wrap seam versus the interior step, cross-seam between variants, mean luma, contrast. | Seam ratio **> 2.2** and absolute seam **> 12**. Exposure delta **> 18** (0–255) or contrast ratio **> 1.75** (checkerboard risk). |
| `backdrop` | Width against the WebGL max, vertical pixels against on-screen height, horizontal wrap. | Width **> 4096** (split before upload). Vertical magnification **> 1**. A hard horizontal seam, same limits as tiles. |

Kind decides which checks run. A full-frame `still` or `video` does not take the alpha gate unless `key` is set. A `loop` does. A `turntable` takes `morph`, and `loop` only when `loop` is set.

## Heuristics — read this before trusting a number

- The tool never writes the source. It also never proves the picture is the right subject. It proves the file is large enough, keyed, and stable enough to enter.
- Loop flow is **block matching** (8×8, search ±4) on a gray downscale. A shift counts only when it beats staying put by 2 levels, so a flat keyed field does not invent motion. It is not a learned optical-flow model. Motion larger than the search window is caught by the pixel seam, not by the flow number.
- Seam MAE / p95 are on that same downscale, not on the raw frame.
- Banding looks for a flat run of 4 pixels and then a step of 2–12 levels. Noise hides bands. A clean ramp does not trip it. A posterized ramp does.
- A declared `key=black` or `key=green` is the compositor key. The gate then looks for a plate that is **not** that key, and for a fringe. An undeclared opaque black field on a cutout is a FAIL.
- Magnification is `onScreen / source` at the closest camera. It is the same ≤ 1.0 rule as law 56 and the walk-around hull. It is not a meter-scale solve.

## Samples

`samples/` is the output of `python3 tools/assetcheck/selftest.py`. Synthetic cases are the gate (a clean cutout passes; a black plate, a thick halo, a 377–596 px mask asked to cover 700 px, a posterized JPEG, a tile exposure jump, a broken tile seam, a backdrop wider than 4096, a short backdrop, a loop jump, a frozen loop, and a turntable shape pop all fail).

Real files in this repo, same command, no retune:

| Sample | File | Result |
| --- | --- | --- |
| `real-gallop` | `lock/bolt-gallop-cycle.mp4` | **FAIL** loop. 768×1168, h264, 96 fps, 534 frames, 5.5625 s. Seam MAE **4.63** (under 8). Seam p95 **33** (limit 28). Coarse flow **2.09 px** (limit 2). No pop, no frozen run. Foreground mask **192×580**, rows **318–897**, fill height **0.50**. Declared on-screen 180×280 → magnification **0.94**. |
| `real-bolt-back` | `lock/bolt-back.jpg` | **FAIL** basic. JPEG is not a lossless still. |
| `real-ship-depth` | `biome/void-orbit/stills/ship-depth.png` | **FAIL** resolution. 192×108 against a declared 200×200, magnification **1.85**. |

Those three reports are what the gate prints. They are not a KEEP and not a recook order.

## Self-test

```bash
python3 tools/assetcheck/selftest.py
```
