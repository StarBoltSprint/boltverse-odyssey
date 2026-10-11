# Strict facade score, and a relight is not a side plate

Validated 2026-10-11. No Imagine prompt.

## Command

```bash
python3 tools/common/align/selftest.py
```

## What passed

- `strict_score` fails the week-2 striped sheet and the fragmented MoGe-2 sheet (both strict 0.0). A clean extruded silhouette of the hero mask passes (selftest).
- `plate_is_side_view` is false for `relight-left.jpg`, `relight-right.jpg`, `relight-top.jpg`, and `relight-front.jpg`. Those names are lights on the key camera.

## What failed

- Every week-2 facade view stays under strict 0.70 after the vision no (key 0.042, hero 0.307, 30 m 0.000, 8 m 0.000, side 0.250). Vision cost $0.011433.
- Placement framebuffer after 3 CMA-ES rounds: IoU 0.2909, skyTop 0.3676 vs key 0.5741, 14 depth inversions, 17 phone draw calls. Float 0.409 m passes. Verdict FAIL. The loss picked round 0 trial 2, which climbed the dune.

## QC

`steps/scene-strict-1011/numbers.json`. Licences in `tools/common/align/README.md`.
