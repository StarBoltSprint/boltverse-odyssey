# 25 — Hazard on the 1-point cone

**Sealed 2026-09-21 (SmiR).** Hang ≠ wipe. Judge, not essay.

Camera must already **PASS law 23**. This law is the **obstacle**. Spectacle = the event. The cone does not move ([24](24-camera-1point.md)).

Script: [`../scripts/plate-hazard-qc/plate-hazard-qc.py`](../scripts/plate-hazard-qc/plate-hazard-qc.py)  
Paste: [`COLD_START-hazard.md`](COLD_START-hazard.md)  
Imagine: [`../prompts/hazard-1lane.txt`](../prompts/hazard-1lane.txt)

---

## Formulas (same cone as the road)

Hazard center rides **one lane ray**. Size foreshortens like the asphalt:

\[
x(y) = x_{VP} + b_{\text{lane}}\,(y - y_v)
\]
\[
w_{\text{haz}}(y) = k_{\text{lane}}\,(y - y_v)
\]

\(y_v = 0.382\) · \(x_{VP} = 0.53\) · Bolt X = **0.50**.

At plant, \(w_{\text{haz}} \le\) **1 lane** (~⅓ of the 3-lane span) for `--expect 1`. Never \(w_{\text{haz}} \approx\) the whole span.

Spawn = a **speck** near the VP (far, small). Approaches, exits the **bottom**. No pop-in. No crater (Imagine fills three lanes).

---

## Occupancy (law 09, now measured)

Split the nationale into **L / C / R thirds** along a scanline `y ∈ [0.44, 0.62]` (far–mid, where KEEP asphalt is dark). A third is **blocked** if its luma is **≥ 38** above the empty KEEP at the same y.

| Blocked thirds | Meaning | Hang |
|---|---|---|
| 0 | empty / décor | `--expect 0` PASS |
| 1 | one-lane (meteor / jersey) | `--expect 1` PASS |
| 2 | two-lane, one corridor | `--expect 2` PASS |
| 3 on ≥2 samples | **WALL** | **FAIL** — recook |

Uniform wash (all 3 thirds up together, small spread) on a décor plate = lantern lighting, **WARN**, not a peaked hazard. A real meteor is peaked then grows.

---

## Cook order (hazard plate)

1. Law 23 PASS on the plate’s camera (or recook camera first).
2. Still = empty KEEP frame (`IMAGE_0`). Composite the danger **tiny, far, 1 lane** on that still. Not I2V inventing the road.
3. I2V: [`camera-1point.txt`](../prompts/camera-1point.txt) + [`hazard-1lane.txt`](../prompts/hazard-1lane.txt). Object grows **along one ray**. L and R stay open. NEVER reverse.
4. `python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 <dN.mp4>`
5. PASS → hang ADD. FAIL → recook **this** plate. Never overwrite empty KEEP.

Code windows (`t0 / t1 / tPass / lanes`) stay in `plates.ts`. The script says whether the **picture** matches.

---

## Teacher / FAIL (Frost 2026-09-21)

| Plate | `--expect` | Verdict |
|---|---|---|
| `road-frost.mp4` empty | 0 | **PASS** (n=0) |
| `road-frost-d1.mp4` flora | 0 | **PASS** + wash WARN (lanterns, not a wall) |
| `road-frost-d2.mp4` meteor | 1 | **FAIL** wall on 2 samples + 2-lane mid — recook 1-lane |

**FAIL if:** hang a 3-lane crater · I2V builds the meteor **and** a new camera · skip 23 · overwrite empty · t-shirt / jersey as the object · fire on Frost · treat this meteor as Howl-destroyable.

Rail A stops here. A keyed obstacle the player can Howl apart is law [32](32-howl-gpu-targets.md) (own plate, GPU composite, shatter per type). Howl does not delete these baked pixels.

Related: [09](09-recette-biome.md) · [23](23-plate-geo-qc.md) · [24](24-camera-1point.md) · [22-m](22-m-densify-snowball.md) · [32](32-howl-gpu-targets.md) · [00](00-PRIORITY0-any-biome.md)
