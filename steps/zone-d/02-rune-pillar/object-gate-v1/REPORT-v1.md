# Rune pillar v1 — FAIL

Verdict: FAIL

Build commit the mesh, UVs, LODs, and colliders were measured on: `9b5067d705ad1fd94e8e64b5c23981ce4d4a947b`. The JPG renders were drawn after that commit, with the y-down winding fix in `work/render_gate.py`. This report is the following local commit. No Imagine images were generated. No upscale.

UV stretch on the new plate projection: **1.221** (limit 1.3).

8 m front visible px/m: **190.8** (need 154.6). p25 162.6. Capture is `front-8m.jpg` at 1080×2400, vfov 58°, named distance 8 m, screen px/m 270.7. Phone need uses dpr 2.625 and render pixel ratio 1.5. `visible-shot.mjs` could not import `js-yaml`; the number is `tools/object-gate/lib/analyze.py visible_px`.

## Shaft widths, flat-to-flat

| Slice | Before `265ae83f` | After slim | Limit |
| --- | --- | --- | --- |
| Base | 2.0 | 1.6 | ~1.6 |
| Mid | 1.656 | 1.4034 | |
| Top body | 1.312 | 1.2104 | ~1.2 |
| Lip | 2.02 | 1.6 | |
| Max above the plinth | 2.02 FAIL | 1.6 PASS | 1.65 |

Rune grooves on the amber samples are 0.045 m deep (band 3–6 cm). 223 of 256 grooved front/right/left vertices sample amber with the stored UV (0.871). Front 155/160, right 16/24, left 52/72.

Plinth steps, unchanged: heights 0.20 / 0.23 / 0.32 m, all ≤ 0.4. Outer apothems 2.08 / 1.72 / 1.36 m. Outer flat-to-flat 4.16 m. Additions 3 allows a plinth up to 2.0 m wide. Additions 4 and 5 say the 2.0 m plinth stays unchanged. The frozen outline is the 4.16 m flat. The old `shaftBaseFlatM` of 2.0 was the shaft (2 × apothem 1.0), not this plinth. The shaft check does not fail the 4.16 m outline. That naming conflict is unresolved.

Plaza across at the pillar: 30 m round, pillar 5 m off centre, chord 28.284 m, minus the 4.16 m plinth outline, free width **24.124 m** (need ≥ 16 m).

## Gate table

| Gate | Value | Threshold | Result |
| --- | --- | --- | --- |
| Shaft profile max | 1.6 m | ≤ 1.65 m | PASS |
| Plinth step height | 0.20, 0.23, 0.32 m | ≤ 0.40 m | PASS |
| UV stretch | 1.221 | ≤ 1.3 | PASS |
| UV mirror | 0 / 17388 | 0 mirrored | PASS |
| Visible px/m at 8 m | 190.8 (p25 162.6) | ≥ 154.6 | PASS |
| Oblique 45° stepFrac | 0.0217 | ≥ 0.03 | FAIL |
| Oblique 45° normSpread | 0.604 | ≥ 0.15 | PASS |
| Grazing stepFrac | 0.001 | ≥ 0.03 | FAIL |
| Grazing normSpread | 0.5667 | ≥ 0.15 | PASS |
| Relief alignment (beauty) | 0.0629 | ≥ 0.70 | FAIL |
| Relief alignment (amber pair) | 0.0838 | ≥ 0.70 | FAIL |
| Painted duplicate | ghosts 0 | 0 | PASS |
| Untextured flat 128 | flat128Frac 0.006, mean rgb 45, 50, 57 | ≤ 0.02 | PASS |
| LOD0 triangles | 17388 | ≤ 25000 | PASS |
| Outline at 15 m | 0 px | 0 px | PASS |
| Outline at 40 m | 0 px | 0 px | PASS |
| Non-manifold edges | 0 | 0 | PASS |
| Contact / float | 0 m (mesh ymin −0.15, crosses y = 0) | 0 m | PASS |
| Icicles | 21 on column, lowest tip y 6.155 | roots above 5 m, no collision | PASS |
| Sliver fraction | 0.0056 | tool pass | PASS |
| Plaza free width | 24.124 m | ≥ 16 m | PASS |
| Shot sheet | PENDING, stamped `9b5067d7` | Art Director KEEP, build == HEAD | FAIL |
| Library intake | REFUSE: KEEP missing; run is not PASS | both guards | FAIL |
| Ticket clearance | headroom 6.155, width 24.124, ground 0 | ≥ 5, ≥ 6, = 0 | PASS |
| Ticket budget | 17388 tris, 3.098 MB jpg | ≤ 25000, ≤ 12 MB | PASS |

`python3 tools/object-gate/py/shaft_profile.py --selftest` passes a 1.6 m shaft and fails a 1.8 m mid-shaft. LOD1 and LOD2 are copies of the slimmed LOD0, which is why the outline difference is 0 px. Texture share 3.098 MB is the eight jpgs. The amber `.npy` masks stay as build inputs.

Volume: `JUMP_M` is 0.25 m. A 4.5 cm groove cannot trip that jump. Normal spread shows the shaft is not one flat face. The grooves were left at 4.5 cm. The bar was not loosened.

Relief: beauty pair overlap 0.0629 (precision 0.6684, recall 0.0629, 8301 groove edges against 90415 albedo edges). Amber-mask pair overlap 0.0838. The 0.70 bar is `min(edge precision, edge recall)` at 2 px. The vertex amber rate above is the seating measure. It does not clear 0.70.

Grey: `greyFrac` 0.0269 is low-saturation frost and stone. The blocking untextured row is flat 128, which is 0.006 of the subject.

## Colliders

Shaft player box is the AABB of the inset octagon, apothem 0.78 m, y 0.60 to 7.00, layers player and camera. Camera box adds 1 m (apothem 1.78). The octagon itself is `hull_xz`. The AABB includes the square corners outside the diagonal flats; the path-facing flat matches the hull. Plinth box is player only, y −0.15 to 0.60, apothem 2.06 (outer visual apothem 2.08, inset 2 cm). No rune colliders. Icicles have no collision.

## Renders

All under `steps/zone-d/02-rune-pillar/object-gate-v1/`. JPG only.

| View | File |
| --- | --- |
| 19.7 m | `front-19.7m.jpg` |
| 8 m and phone mode B | `front-8m.jpg`, `phone-8m.jpg` (same bytes) |
| 3 m looking up | `up-3m.jpg` |
| Oblique 45° | `oblique45.jpg` |
| Grazing | `grazing.jpg` |
| Shot sheet | `shot-verdict.json` (PENDING) |
| Groove mask / amber pair | `front-8m-relief.jpg`, `front-8m-amber.jpg` |

Depth `.npz` files were deleted after the volume gate. Disk at report time was about 4.6 GB free.

## Ticket validate

```
node /workspace/grokcli/wt/tools-09-build-ticket/tools/build-ticket/cli.mjs validate steps/zone-d/02-rune-pillar/ticket.json --commit 9b5067d705ad1fd94e8e64b5c23981ce4d4a947b
```

Exit 1. `reset` empty. Fields: plates pass, placement pass, build pass, gates fail, play pending, shots pending, phone pending, go pending. Reason: `gates: status fail`. Full JSON: `ticket-validate.json`.

Phone stays the pending string. There is no play page, and a phone object while gates fail is an order error. Go stays pending. Re-running validate without `--commit 9b5067d7` after the report commit will auto-reset gates, play, shots, and phone, because HEAD will no longer equal `build.commit`.

## Unresolved

- Art Director has not given KEEP or FAIL on the shot sheet. Intake stays REFUSE.
- No live object-gate scene (`window.__ogHost` is absent). Offline modules only.
- `tools/object-gate/visible-shot.mjs` fails: `gate.mjs` imports `js-yaml`, which Node cannot resolve here.
- Volume stepFrac stays under 0.03 on both views. Normal spread passes.
- Relief edge overlap stays under 0.70. Right-face amber seating is the weak side (16 of 24).
- Plinth outer flat is 4.16 m. A literal reading of “plinth up to 2.0 m” disagrees with the frozen steps.
- The shot sheet build id matches `9b5067d7`, which was HEAD when the sheet was emitted. This report commit moves HEAD.
- Phone fps is unverified. Preview freeze refuses a FAIL verdict, and there is no play directory.
