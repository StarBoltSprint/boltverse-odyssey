# Align-solve metrics, camera, CMA-ES

Validated 2026-10-11 on the synthetic box and on the two failing key jobs. No Imagine prompt. The cook is the module.

## Command

```bash
python3 tools/common/align/selftest.py
python3 tools/imagine-to-3d/auto.py run <spec> --method fusion5 --solve-camera --search cmaes
PYTHONPATH=tools/common:tools/placement-from-key python3 tools/common/align/apply_placement.py
```

## What passed

- Synthetic box: FOV within 2°, pitch within 1°, height within 0.25 m (`tools/common/align/selftest.py`).
- CMA-ES log row count equals evals.
- `overlap` in the object gate is `alignment` (min edge precision and recall at 2 px), bar 0.70.

## What failed on the real plates

- Facade key vanishing points are not a ground-plane camera (FOV 117°, pitch −30°). Empty 8 m and side frames filled once the mesh orbited its centroid. Relief stayed on −z only.
- City vanishing points (3, 1314 lines) failed the focal check and the solver fell back to FOV 40°. The staging framebuffer IoU went from 0.3763 to 0.2859. Stop after 3 rounds.

## QC

`steps/align-solve-1011/numbers.json`. Licences: `tools/common/align/README.md`.
