# Constrained focal when the vanishing pairs are not orthogonal

Validated 2026-10-11. No Imagine prompt.

## Command

```bash
python3 tools/common/align/selftest.py
```

## What passed

- key-city3 no longer falls back to FOV 40°. Solve is `constrained-focal`, FOV 88°, pitch +7.67°, height 1.77 m, fallback false.
- A known box matches three.js projection at silhouette IoU 1.0000.
- Facade alignment on the solid vertex raster is at least 0.704 on every view. The three search rounds did not beat that minimum, so the camera-only pose stayed.

## What failed

- Placement framebuffer IoU is 0.3226. The bar is 0.75.
- Side-axis relief stays 0. Only −z (2.02 m) is painted.

## QC

`steps/week2-1011/numbers.json`. Licences in `tools/common/align/README.md`.
