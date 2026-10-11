# Foundation tools

Shared helpers for the cooks that failed on 11 Oct (fusion-fix2, terrain, placement). They live in [`tools/common`](../../tools/common) and are wired into the object gate. They do not cook a plate, do not call Imagine, and do not touch the live preview.

## Models

`python3 tools/common/vision_models.py status` prints the shared CPU weights. They stay outside the repo, in `VISION_MODELS_DIR` or `/workspace/models/vision`.

| Name | File | Role |
| --- | --- | --- |
| `dav2-large` | `depth_anything_v2_vitl.pth` | Depth Anything V2 Large |
| `moge-2` | `moge-2-vitl.pt` | MoGe-2 vitl |
| `sam2-small` | `sam2.1_hiera_small.pt` | SAM 2.1 Hiera small |
| `sam2-base` | `sam2.1_hiera_base_plus.pt` | SAM 2.1 Hiera base+ |

`ensure` checks free space and keeps a 4 GiB reserve before a download. A short file is deleted and fetched again. Each process loads a model once. Depth and masks are cached by the sha256 of the image bytes under `cache/`. The second call on the same image is a disk read.

The default depth model is **MoGe-2** (`vision_models.DEFAULT_DEPTH`, `load_default_depth()`). Relief and fuse call that (`depth_relief.session()`). `tools/relief/bake_depth.py` defaults to `moge-2-vitl.pt` and runs one tile through MoGe-2. A `.onnx` model path still uses the small ONNX tile blend. Depth Anything V2 Large stays on disk for an explicit internal comparison (`depth_dav2`, a `.pth` passed to `bake_depth`). Do not write that map into a shipped or posted output. This step does not rebake the 3916 panorama.

Run the loaders with the environment that has torch (`/workspace/.venv-sam2/bin/python` on this box). `status`, the frame math, the capture gate, and the stage clock run on system Python.

## Captures

`tools/common/capture_gate.py` fails a frame whose DOM text contains `chargement`, a frame that is mostly the `#1d1418` loading plate with a small bright label, an empty frame, or a checklist view whose target covers too little. Perspective checklist views need 25%. Ortho faces need 60% and must not be black.

`tools/object-gate/gate.mjs` waits until no visible node says Chargement before it returns the page (`waitSceneReady`). The runtime row `capture ready` screenshots that page and runs the gate. A timeout is a failed row.

`node tools/common/render_harness.mjs <out-dir>` is the local proof. It opens a fixture that says `Chargement… 17/20` for 2.5 s, shots too early, waits, then shots again. The early shot fails. The late shot passes. It does not open the live preview.

## Checklist cameras

`tools/common/frame_bbox.py` frames one AABB:

| View | Camera |
| --- | --- |
| `close` | 8 m off the front face, eye at the box centre, field fitted to the box |
| `low-portrait` | 8 m off the front face, eye 1.6 m above the box minimum |
| `far` | `max(2.2 × height, 120)` m off the front face, field narrowed so the box stays in frame |
| `ortho-front`, `ortho-side`, `ortho-top` | orthographic face, pixel aspect = face aspect, 2% margin |

The object gate calls `window.__og.renderPose` with that pose and hides every mesh that is not the target. The blocking row is `checklist camera framed on the target`. The old walker pose (eye at ground + 1.6 m, pitch clamped) cannot frame a tall tower. The 8 m visible-texel shot is a different measurement and is unchanged.

`python3 tools/common/tower_sheet.py <tower.glb> <out-dir>` rasterises an existing GLB with the same math and writes the contact sheet. It does not call Imagine.

## Cheap gates first

`tools/common/stage_clock.py`: silhouette IoU (minimum 0.87) then colour mean-abs (maximum 0.12). Both must pass before `heavy()`. A heavy stage that starts first raises `StageOrderError`. Each row stores seconds.

## Check

```bash
python3 tools/common/selftest.py
NODE_PATH=/usr/share/nodejs node tools/object-gate/selftest.mjs
```

The object-gate selftest needs `js-yaml` (declared in `tools/object-gate/package.json`).
