# Zone C solids — attempt 2 — FAIL

Five solids from `key-zc1.jpg`, camera #199, and the SAM2 masks. MoGe-2 only. No new Imagine plates. Cost = 0.

The object-gate verdict is **FAIL** (`steps/zone-c/05-solids/object-gate/report.md`, `kit-gate-result.json`). `numbers.json` keeps `pass: false`. Hidden-face rows are PENDING with plate numbers. This step stops here (2 builds). Preview freeze and the quota row wait for an accepted step.

## Pending plates

Plates 1–4 are the moss slabs already on the causeway. Plates 5–15 are not on disk and were not generated.

| Solid | Key-visible | Back | Sides and grazing | Contact bottom |
| --- | --- | --- | --- | --- |
| arch-left | key-zc1.jpg | #5 arch-left-back | #6 arch-left-sides | #15 solids-contact |
| arch-right | key-zc1.jpg | #7 arch-right-back | #8 arch-right-sides | #15 solids-contact |
| cliff-left | key-zc1.jpg | #9 cliff-left-back | #10 cliff-left-sides | #15 solids-contact |
| gorge-rock | key-zc1.jpg | #11 gorge-rock-back | #12 gorge-rock-sides | #15 solids-contact |
| cliff-right | key-zc1.jpg | #13 cliff-right-back | #14 cliff-right-sides | #15 solids-contact |

Pending fragments do not write colour. The phone sheet shows the key faces that stayed under stretch 1.3, and the clear colour (median of the causeway mask) everywhere else.

## Before / after

| | Attempt 1 | Attempt 2 (shipped mesh) |
| --- | --- | --- |
| Depth | MoGe-2 rebuilt from depth + intrinsics. The raw `points` tensor was x = y = z = depth and was rejected. | Same cache. `points_ok` accepted it. |
| Quads | arch-left 1509, arch-right 1130, cliff-left 875, gorge-rock 592, cliff-right 264 | 1072, 676, 607, 343, 208 after dropping edges longer than twice the pixel angle |
| Key-face stretch p95 | 139.98, 156.94, 16.95, 48.71, 6.70 | 1.2878, 1.2904, 1.2710, 1.2814, 1.2857 |
| Index edges | open 0. arch-right one edge with 4 triangles. The other four solids had 0. | open 0, non-manifold 0 on the index |
| Gate, welded to 1 mm | not run | non-manifold 6, 6, 0, 4, 2 (arch-left, arch-right, cliff-left, gorge-rock, cliff-right). Open 0. |
| Time | MoGe 11.243 s, mesh 1.076 s, total 12.343 s | MoGe 0 s (cache), mesh 0.841 s, total 0.977 s |

Attempt 2 keeps one index buffer per solid (`lodTris` three equal copies, `sameHull` true). The five shapes are not instanced. Draw calls planned: 11 (causeway + a key group and a pending group on each solid).

## Gate (blocking)

Command: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids/object-gate`. Exit 1. Verdict FAIL.

| Check | Result |
| --- | --- |
| UV stretch p95 on the key group | Builder worst 1.2904. Gate PASS on the classes it sampled (arch-left max 1.284, cliff-left 1.257, gorge-rock 1.281, cliff-right 1.284). arch-right’s gate line says max 1.000 and also “no plate surface sampled”. |
| Draw calls | Key pose 1792×1008: 11. Phone +8 / +30 / +60: 7 / 5 / 3. Gate 720×1600 and 412×915 at `along=0`: 7. All ≤ 12. |
| LOD silhouette | One hull in the buffer. Gate approach 300→10 m FAIL on every solid (min IoU 0.80, 0.70, 0.724, 0.738, 0.824). |
| Key colour | CIEDE2000 on the five masks vs `renders/key-1792x1008.png`: mean 15.55, median 10.08, 327147 pixels. |
| Hidden faces | PENDING #5–#15 as in the table. No row is PASS. |
| Runtime | Console clean. Shaders compiled. Title “Zone C solids”. |
| Phone sheet | `sheet-phone.jpg` (key 1792×1008 beside phone 720×1600). |
| Visible px/m | FAIL arch-left (0.0 vs 118.5), arch-right (0.0), cliff-right (no steep surface). PASS cliff-left 132.4 and gorge-rock 157.6. Plate sampling on those two is still under the bar in the info line (22.2 and 12.6 px/m). |
| Grounding | FAIL. Float 3.06 m, 2.54 m, 5.91 m, 6.21 m, 14.36 m. |
| Sealed mesh | FAIL on four solids after the 1 mm weld. cliff-left PASS (0 / 0). |
| Relief | PASS on every solid (≥ 0.5 m on the axes the gate keeps). |
| Repetition | FAIL arch-right (no 48×48 face) and gorge-rock (face z peak 0.625). The other three PASS. |

## Staging

`python3 tools/imagine-to-3d/serve_zone_c.py` on 127.0.0.1:8772. Captures ran after Chargement was gone and `__sceneReady` was true. Live `index.html` was not edited. Terrain port 8771 was not used.

World graph: `node tools/world-graph/export-zone-c.mjs --solids` wrote `zone-c.zone.json` (6 objects: causeway + five solids). `validateZone` accepted it. `qualityGates.pass` is false. The terrain file `steps/zone-c/03-terrain/zone-c.zone.json` was not rewritten. `node tools/world-graph/selftest.mjs` still fails in this worktree on `export-zone-b.mjs` (missing `/workspace/grokcli/wt/zoneb-bible-1008/tools/biome/runtime/biome-runtime.js`). That export is outside this step.
