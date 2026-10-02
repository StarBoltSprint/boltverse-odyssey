# COLD — plate geometric QC (paste before hang)

**Tool feedback (law 66):** if a repo tool let a defect through, reported a wrong number, or was hard to use, finish the take, write `feedback/<date>-<tool>.md`, and open it upstream. [`66-tool-feedback-loop.md`](66-tool-feedback-loop.md).

Read `biome/docs/23-plate-geo-qc.md`.

**Before hang** of any Video A (empty or densify):

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <plate.mp4>
```

Exit 0 = PASS → hang. Exit 1 = FAIL → recook. Do **not** hang a FAIL.

Checks 1-point VP, lock-off, 3-lane span at y=0.70, dash inliers, curvature sag. φ is audit only. Empty KEEP is the teacher. Never overwrite empty to make it pass.

The seam (last frame N vs first N+1) is a different script: `biome/docs/33-plate-mae-qc.md`. This judge does not measure it.

Camera sentences for Imagine: `biome/prompts/camera-1point.txt` (law 24). Do not put UV / φ in the Imagine prompt.
