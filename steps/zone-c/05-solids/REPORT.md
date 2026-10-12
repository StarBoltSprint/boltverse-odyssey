# Zone C solids — rebuild attempt 2 — FAIL

Five solids from `key-zc1.jpg`, camera #199, and the SAM2 masks. MoGe-2 only. All 11 SmiR-validated plates (5–15) are in `data/plate-atlas.jpg`. No new Imagine. Cost = 0.

The object-gate verdict is **FAIL** (`steps/zone-c/05-solids/object-gate/report.md`, `kit-gate-result.json`). `numbers.json` keeps `pass: false`. This step stops here. Two rebuilds were gated. Preview freeze and the quota row wait for an accepted step.

## Plate → face

| Solid | Key-visible | Back / inner | Side / grazing | Bottom |
| --- | --- | --- | --- | --- |
| arch-left | key-zc1.jpg | #5 arch-left-inner | #11 leaf | #13 causeway-underside |
| arch-right | key-zc1.jpg | #6 arch-right-inner | #12 fern | #13 causeway-underside |
| cliff-left | key-zc1.jpg | #7 wall-left | #9 waterfall | #13 causeway-underside |
| gorge-rock | key-zc1.jpg | #14 gorge-closure | #10 mist | #13 causeway-underside |
| cliff-right | key-zc1.jpg | #8 wall-right | #15 planet | #13 causeway-underside |

#13 uses one V band per solid. Every hidden-face row is PASS. None are PENDING.

## Before / after

| | Previous cook (old REPORT) | Rebuild attempt 1 (full skirt) | Rebuild attempt 2 (this mesh) |
| --- | --- | --- | --- |
| Plates 5–15 | PENDING, not on disk | All 11 wired, rows PASS | All 11 wired, rows PASS |
| Sealed after 1 mm weld | non-manifold 6, 6, 0, 4, 2 | open 0, non-manifold 0 | open 0, non-manifold 0 |
| Grounding worst air | 3.06, 2.54, 5.91, 6.21, 14.36 m | −1.00, −1.00, −1.00, −1.04, −1.00 m | −0.22, −0.25, **0.69**, **2.63**, −0.22 m |
| Approach min IoU | 0.80, 0.70, 0.724, 0.738, 0.824 | 0.808, 0.692, 0.864, 0.838, 0.667 | 0.773, 0.684, 0.779, 0.846, 0.662 |
| Visible px/m | 0.0, 0.0, 132.4, 157.6, no steep face | WARN 52.1, WARN 62.1, WARN 49.2, PASS 157.6, FAIL 88.8 | **PASS 136.3, PASS 124.9**, FAIL 52.1, FAIL 0.0 flat, no steep face |
| Repetition | arch-right and gorge FAIL | cliff-right FAIL (face z 0.835) | arch-left and cliff-left low-portrait empty; cliff-right face z 0.878 |
| Stretch p95 (builder) | 1.2878 … 1.2904 | 1.109 … 1.290 | 1.242, 1.247, 1.252, 1.247, 1.267 |
| Draw calls | gate at along=0: 7 | 11 | 11 |
| Key colour CIEDE2000 | mean 15.55, median 10.08 | not re-scored | mean 16.885, median 13.326, 327147 px |
| Mesh time | 0.841 s | 15.997 s | 18.116 s (MoGe cache 0 s, atlas 0.343 s, total 18.666 s) |

Attempt 2 seats the lower band of a thin shell on the terrain (`SHELL_M` 0.55, sink 0.30 m). The arch-hole ring is not dropped. `sameHull` is true. One index buffer per solid. Quads: 6554, 4990, 3886, 2664, 1154.

## Gate (blocking)

Command: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids/object-gate`. Exit 1. Verdict FAIL.

| Check | Result |
| --- | --- |
| UV stretch ≤ 1.3 | PASS. Gate max 1.280, 1.286, 1.276, 1.278, 1.291. |
| Draw calls ≤ 12 | PASS. 11 at 720×1600 and at 412×915. Captures at key / +8 / +30 / +60 also 11. |
| Sealed mesh | PASS on all five. open 0, non-manifold 0. |
| Relief from plate / key pixels | PASS. Every axis the gate keeps is ≥ 0.5 m. High-pass of the key, not noise. |
| Hidden faces | PASS. Plates 5–15, tris > 0, files bound. |
| Grounding | PASS arch-left −0.22 m, arch-right −0.25 m, cliff-right −0.22 m. FAIL cliff-left 0.69 m, gorge-rock 2.63 m. |
| LOD / approach | FAIL on all five. Jumps stay above the 0.05 neighbour drop. |
| Visible px/m | PASS on both arches (136.3 and 124.9 vs 118.5). FAIL cliff-left 52.1 (capture landed at 2.97 m), gorge-rock flat 0.0, cliff-right (no steep surface between 2.5 m and 8 m on the path side). |
| Repetition | PASS arch-right and gorge-rock. FAIL arch-left and cliff-left because the low-portrait capture has no 48×48 object. FAIL cliff-right face z peak 0.878, close 0.768, low-portrait 0.884. |
| Runtime | Console clean. Shaders compiled. Title “Zone C solids”. |
| Phone sheet | `sheet-phone.jpg` (key 1792×1008 beside phone 720×1600). |

The foot band removes the full-height lace and lets the arches clear phone px/m. It still changes the silhouette between 5% distance steps, leaves cliff-left and the gorge off the terrain, and turns cliff-right’s seated band into a tall column the 8 m probe does not accept as a steep face. That is the same approach defect as attempt 1. Stop.

## Staging

`python3 tools/imagine-to-3d/serve_zone_c.py` on 127.0.0.1:8772. Captures ran after Chargement was gone. Live `index.html` was not edited.

World graph: `node tools/world-graph/export-zone-c.mjs --solids` wrote `steps/zone-c/05-solids/zone-c.zone.json` (6 objects). `validateZone` accepted the file. `qualityGates.pass` is false. The terrain worktree and the plates worktree were not edited.
