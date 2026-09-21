# 24 — Camera (conical 1-point lock-off)

**Sealed 2026-09-21 (SmiR).** Hang ≠ wipe. Sprint camera law. Judge = [23](23-plate-geo-qc.md).

φ is audit ([20](20-default-plate-proportions.md)). Imagine does **not** run formulas — Grok does. The empty KEEP still **is** the cone.

Paste: [`COLD_START-camera.md`](COLD_START-camera.md)  
Imagine block: [`../prompts/camera-1point.txt`](../prompts/camera-1point.txt)

---

## What we use

**Sprint Video A = conical 1-point lock-off.** Chase behind Bolt. One vanishing point. Not 2-point. Not 3-point.

| | When | Sprint plate |
|---|---|---|
| **1-point** | Face to the road. One VP ahead. Verticals stay vertical. | **YES — only this** |
| **2-point** | Look **aside** (¾, corner, turn, door) | NO on sprint. OK on a crate / cutscene / at-A at-B |
| **3-point** | Plongée / contre-plongée (verticals vanish) | NO on sprint. OK on a drone / planet arrive. **Not** a minimap (minimap = ortho) |

Slight **yaw** (VP.x ≈ **0.53**, not 0.50) and slight **pitch** (horizon **0.38**, PP at 0.50) stay 1-point. They are attitude, not a second / third vanishing.

Bolt X stays **0.50**. Do not φ-slide the dog.

---

## Conical (pinhole)

All rays through one eye **O**, cut by the 9:16 plane **π**. Straight 3D lines stay straight on the plate. Parallel depth lines share **one** VP. Ground plane = one homography.

\[
w(y) = k\,(y - 0.38),\quad k \approx 2.2
\]

| y | What | 3-lane width |
|---|---|---|
| 0.38 | visual horizon (aurora diamond) | ≈ 0 |
| 0.70 | law-20 neon measure | **~0.73** |
| 0.80 | paw plant | **~0.75–0.82** |
| 1.00 | bottom | cone overflows (rumble eats corners) — KEEP |

Fitted dash VP.y ~0.62 is a **fat-tube artefact**. Visual VP is the green diamond in the aurora at **0.38**. Script 23 does not fail on VP.y vs 0.382.

**Lock-off** = the cone is welded to the frame. Asphalt scrolls **along** the generators, toward the bottom. The VP does not travel. First ≠ last = deeper **into** the canyon, not a dolly-out.

I2V that shears dashes / rolls the VP is **no longer that cone** — it reads reverse even if a meteor grows. Recook. Do not hang. Empty KEEP (`road-frost.mp4`) PASS is the teacher. Densify d2 I2V warp FAIL (inliers 55 %, 1-pt 0.119) proved it.

---

## Formulas = Grok. Pixels = Imagine.

Imagine ignores `w(y)=k(y−0.38)` and `VP=(0.53,0.38)`. Putting φ / 0.618 in the prompt slides Bolt. **Ban** those tokens in Imagine.

Grok:
1. `@ref` the empty KEEP still (the cone is in the photo).
2. Paste [`camera-1point.txt`](../prompts/camera-1point.txt) — 8 camera sentences, no UV table.
3. Composite hazards **onto** that still (1–2 lanes). Do not ask I2V to invent a new road.
4. Run [plate-geo-qc.py](../scripts/plate-geo-qc/plate-geo-qc.py). FAIL = recook.

---

## 2-point / 3-point (not sprint)

- **2-point** — two VPs on the horizon. Camera yawed. Use: turn plate, ¾ crate, room door. L/C/R X-shift dies if you put this on the sprint.
- **3-point** — third VP for verticals. Use: looking **down** a canyon from a drone, looking **up** a tower, planet approach. A true top-down **map** is ortho (parallel), not 3-point.

Hazard objects may be ¾ (2-point locally). The **nationale** under them stays 1-point.

---

**FAIL if:** 2-point / 3-point sprint plate · φ / 0.618 in the Imagine camera prompt · hang without law-23 PASS · overwrite empty KEEP to fake the cone · treat minimap as 3-point.

Related: [20](20-default-plate-proportions.md) · [20b](20b-frost-aurora-proportions.md) · [23](23-plate-geo-qc.md) · [25](25-hazard-cone.md) · [22-m](22-m-densify-snowball.md) · [00](00-PRIORITY0-any-biome.md)
