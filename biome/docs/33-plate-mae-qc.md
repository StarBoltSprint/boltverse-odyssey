# 33 — Plate seam MAE (last N vs first N+1)

**Sealed 2026-09-22 (SmiR).** Hang ≠ wipe. Judge, not essay.

A cold Grok must **run the script** on every chained Video A **before hang**. “It looks like the same night” is not the law. Law [29](29-imagine-compiler.md) and law [31](31-light-lock.md) already require `last(n)` = `first(n+1)` as still identity (same white balance, same road luma, décor closer). This script measures that pair.

Script: [`../scripts/plate-mae-qc/plate-mae-qc.py`](../scripts/plate-mae-qc/plate-mae-qc.py)  
Paste: [`COLD_START-plate-mae.md`](COLD_START-plate-mae.md)

Geometry is law [23](23-plate-geo-qc.md). Occupancy is law [25](25-hazard-cone.md). This law is only the **seam**.

---

## What it is

```
python3 biome/scripts/plate-mae-qc/plate-mae-qc.py <plateN.mp4> <plateN+1.mp4>
```

Consecutive arguments are pairs: last frame of N against first frame of N+1. Three files check two seams. One file is not a seam — exit **non-zero**.

Exit 0 = PASS → hang allowed. Exit non-zero = FAIL → recook the seam, do not hang.

Grab: first frame at t=0, last frame via `-sseof` just inside the end (same idea as the last-frame extract in [02](02-videos.md)).

---

## Sealed thresholds (0–255)

No hung seam pair is in git. These caps are the cold-start default. Do not raise them to force a hang. Recalibrate only when SmiR accepts a real pair.

| Check | PASS | FAIL |
|---|---|---|
| Full-frame mean \|RGB\| | **≤ 36** (warn above 18) | different picture |
| Asphalt band luma MAE `y 0.70–0.92`, `x 0.30–0.70` | **≤ 14** (warn above 8) | hotter / other road (law 31) |
| \|Δ mean(R−B)\| | **≤ 12** | white-balance jump |
| Both frames same size | required | not the same still |

A closer décor (law 28: last is travel, not a new noun pile) may warn. A new camera, a wall, or a day grade must FAIL.

Law 23 still owns 720×1280 on a road plate. A matching pair at another size warns, then the MAE still runs. A **mismatched** pair FAILs before MAE.

---

## When to run

1. After plate N+1 encodes, **before** hang, with N and N+1 both on disk.
2. After every densify recook that claims to continue the previous plate.
3. Never overwrite empty KEEP to shrink the error.

Order with the other judges: **23** (this plate’s camera) → **25** (this plate’s lanes) → **33** (seam to the previous plate). P0 has no previous plate — do not invent a pair.

**FAIL if:** hang a chain with no PASS line · one mp4 passed off as a seam · thresholds edited upward in the cook · optical-flow morph used to hide a broken still.

---

## Related

[02](02-videos.md) · [23](23-plate-geo-qc.md) · [28](28-stills-two-rails.md) · [29](29-imagine-compiler.md) · [31](31-light-lock.md) · [00](00-PRIORITY0-any-biome.md)
