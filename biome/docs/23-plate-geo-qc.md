# 23 — Plate geometric QC (1-point · lock-off · curvature)

**Sealed 2026-09-21 (SmiR).** Hang ≠ wipe. Judge, not essay.

A cold Grok must **run the script** on every new Video A **before hang**. Feeling the rush in chat is not the law. Frost empty KEEP is the teacher that sealed the thresholds. Densify d2 (I2V warp / reverse feel) is the FAIL that proved why.

φ is an **audit** (law 20). The judge is the table + the script.

Script: [`../scripts/plate-geo-qc/plate-geo-qc.py`](../scripts/plate-geo-qc/plate-geo-qc.py)  
Paste: [`COLD_START-geo-qc.md`](COLD_START-geo-qc.md)

---

## What it is

One-point linear perspective on the 3 neon dash tubes. Camera lock-off = a **fixed pencil of rays**. Texture scrolls along the rays. The VP does not travel. I2V that shears / S-curves the dashes reads as reverse even when a hazard approaches.

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <plate.mp4>
```

Exit 0 = PASS → hang allowed. Exit 1 = FAIL → recook, do not hang.

---

## Sealed thresholds (empty KEEP)

| Check | PASS | FAIL example (d2) |
|---|---|---|
| Frame | 720×1280, ~48 fps | anything else |
| 3-lane span at `y=0.70` | **0.58–0.82** (KEEP ~0.73) | corridor / ice-hole |
| Dash inliers (RANSAC) | **≥ 75 %** (empty ~92 %) | **55 %** — extra cyan / bent rays |
| 1-point spread `{L∩R, L∩C, C∩R}` | **≤ 0.10** (empty 0.002) | **0.12** — not one VP |
| VP.x wander across the clip | **σ ≤ 0.06** (empty 0.003) | rolling camera |
| VP.y wander | **σ ≤ 0.12** | horizon rolling |
| Inlier \|sag\| | **≤ 12 px** (empty ~7) | banana tubes |
| First→last span drop | **> −0.12** | pull-back / reverse |
| VP.x mean | **0.46–0.60** (law **0.53**) | yaw |

Bolt X stays **0.50**. Do **not** slide Bolt onto φ 0.618. Do **not** widen `PATH_TABLE` to the visual 0.75–0.82 (13d would grow the dog).

Near-field fat tubes put fitted VP.y ~0.62 even when the eye reads vanishing in the aurora at **φ minor 0.382**. That is KEEP, not a recook. The judge does **not** fail on VP.y vs 0.382.

---

## When to run

1. After empty A encode, **before** hang.
2. After every densify recook (law 22-m), **before** replacing `road-<biome>-dN.mp4`.
3. Never overwrite empty KEEP to make the script pass.

**FAIL if:** hang without a PASS line · recook Bolt to fake geometry · treat φ as the whole law · skip because “it looks fine.”

---

## Teacher / FAIL pair (Frost, 2026-09-21)

| Plate | Verdict | Why |
|---|---|---|
| `road-frost.mp4` empty KEEP | **PASS** | inliers 92 % · 1pt 0.002 · VP.x σ 0.003 · \|sag\| 7 px |
| `road-frost-d1.mp4` flora | **PASS** | same camera, lanterns pollute tracker but inliers 86 % |
| `road-frost-d2.mp4` meteor recook | **FAIL** | inliers 55 % · 1pt 0.119 — I2V sheared the pencil |

Related: [20](20-default-plate-proportions.md) · [20b](20b-frost-aurora-proportions.md) · [22-m-densify-snowball.md](22-m-densify-snowball.md) · [00](00-PRIORITY0-any-biome.md) · paste [COLD_START-any-biome.md](COLD_START-any-biome.md)
