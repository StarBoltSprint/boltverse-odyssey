# tools/common — shared foundation

Shared helpers for the depth, mask, capture, and checklist steps. Full method: [`docs/METHOD/foundation-tools.md`](../../docs/METHOD/foundation-tools.md).

| File | What it does |
| --- | --- |
| `vision_models.py` | Model catalog, `status` / `ensure`, one load per process, sha256 image cache under `cache/`. MoGe-2 is the default depth model by licence policy; the code constant `DEFAULT_DEPTH` lands with terrain-key2. |
| `capture_gate.py` | Fails a loading screen (`Chargement`), an empty frame, or a checklist view whose target covers too little (25% perspective, 60% ortho). |
| `frame_bbox.py` | Checklist cameras framed on one AABB: `close`, `low-portrait`, `far`, `ortho-front`, `ortho-side`, `ortho-top`. |
| `render_harness.mjs` | Local proof that an early (loading) shot fails and a late shot passes. Uses `fixtures/loading.html`, not the live preview. |
| `stage_clock.py` | Cheap gates first: silhouette IoU then colour mean-abs must pass before a heavy stage. Times every stage. |
| `tower_sheet.py` | Contact sheet of an existing GLB with the same checklist cameras. |
| `selftest.py` | Unit checks for all of the above. |

## Steps

1. `python3 tools/common/vision_models.py status` — confirm the weights on disk (they stay outside git, in `VISION_MODELS_DIR` or `/workspace/models/vision`).
2. Depth: use MoGe-2 (after terrain-key2: `load_default_depth()`). Depth Anything V2 Large is an explicit internal comparison only.
3. Masks: SAM2 small or base+, cached by image hash.
4. Before a heavy stage, run the cheap clock (`stage_clock.py`).
5. Capture with the object gate; the capture gate rejects loading and empty frames.
6. Checklist views come from `frame_bbox.py`.

## Models and licences

| Model | Licence | Use |
| --- | --- | --- |
| MoGe-2 (vitl) | MIT | Default depth. May feed shipped outputs. |
| Depth Anything V2 Large | CC BY-NC 4.0 (non-commercial) | Internal comparison only. Never written into a shipped or posted file. |
| SAM 2.1 (Hiera small, base+) | Apache 2.0 | Masks. |

No weights are committed to this repo.

## Check

```bash
python3 tools/common/selftest.py
NODE_PATH=/usr/share/nodejs node tools/object-gate/selftest.mjs
```
