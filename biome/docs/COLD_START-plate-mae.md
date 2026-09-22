# COLD — plate seam MAE (paste before hang of plate N+1)

Read `biome/docs/33-plate-mae-qc.md`.

**Before hang** of a plate that continues another:

```
python3 biome/scripts/plate-mae-qc/plate-mae-qc.py <plateN.mp4> <plateN+1.mp4>
```

Exit 0 = PASS → hang. Exit non-zero = FAIL → recook. Do **not** hang a FAIL.

Last frame of N vs first frame of N+1. Full-frame MAE ≤ 36, asphalt luma MAE ≤ 14, white-balance `|Δ(R−B)|` ≤ 12. One file is not a pair.

This is not law 23 (camera) and not law 25 (lanes). Run those too. P0 has no seam.
