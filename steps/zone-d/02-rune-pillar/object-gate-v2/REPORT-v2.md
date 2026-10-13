# Rune pillar v2 — FAIL

Verdict: FAIL

The Art Director has not given KEEP or FAIL on these shots. `ad_verdict` stays pending. One measured row still fails: grazing relief `stepFrac` 0.0162 (limit 0.03). Absolute volume mode still fails both views, and that row is reported beside the relief-scaled row. The shaft taper is unchanged: base 1.6 m, top body 1.2104 m, max above the plinth 1.6 m.

Build commit the mesh, UVs, LODs, textures, normals, and colliders were measured on: `c9f1803852ffe316a3c8c1df672f5b770edc0075`. That commit's message says "WIP pending wall proof". The mesh in it is sealed: LOD0 nonManifold 0, boundary 0, degenerate 0, weld 12495. This report is the following local commit. After it, HEAD is one report commit past the build. No Imagine images were generated. No upscale. JPG only.

Registration search did not converge (front IoU 0.022, right45 0.0065, left45 0.0263). The masks were left unmoved. Grooves are cut under those pixels, 0.038 m deep (inside 3–6 cm).

Gate files `tools/gate/nogrey.py` and `tools/gate/volume.py` match `tools/13-gate-fixes` commit `7a1d1a59` byte for byte. `diff -q` against `/workspace/grokcli/wt/tools-13-gate-fixes/tools/gate/` was empty. They land in the report commit. The spec path `tools-09-build-ticket` is absent on this machine. Validate used `/workspace/grokcli/wt/tools-10-golden-run/tools/build-ticket/cli.mjs`.

Free disk at the report was above 3.5 GB. The 2048 MB stop did not fire.

## Before / after

| Gate | v1 (`9b5067d7`) | v2 (`c9f18038`) | Limit | v2 result |
| --- | --- | --- | --- | --- |
| Shaft profile max | 1.6 m | 1.6 m (top body 1.2104) | ≤ 1.65 m | PASS |
| Plinth step height | 0.20, 0.23, 0.32 m | 0.20, 0.23, 0.32 m | ≤ 0.40 m | PASS |
| UV stretch | 1.221 | 1.218 | ≤ 1.3 | PASS |
| UV mirror | 0 / 17388 | 0 negative, 0 over 1.3 | 0 mirrored | PASS |
| Visible px/m at 8 m | 190.8 (p25 162.6) | 180.0 (p25 160.3) | ≥ 154.6 | PASS |
| Oblique stepFrac absolute | 0.0217 FAIL | 0.0216 FAIL | ≥ 0.03, thr 0.25 m | FAIL |
| Oblique normSpread | 0.604 PASS | 0.6439 PASS | ≥ 0.15 | PASS |
| Grazing stepFrac absolute | 0.001 FAIL | 0.0009 FAIL | ≥ 0.03, thr 0.25 m | FAIL |
| Grazing normSpread | 0.5667 PASS | 0.5636 PASS | ≥ 0.15 | PASS |
| Oblique stepFrac relief 0.045 m | (no row) | 0.0494 | ≥ 0.03, thr 0.0225 m | PASS |
| Grazing stepFrac relief 0.045 m | (no row) | 0.0162 | ≥ 0.03, thr 0.0225 m | FAIL |
| Relief alignment | beauty 0.0629, amber 0.0838 | front 0.9812, right45 0.9849, left45 0.7971 | ≥ 0.70 each face | PASS |
| No grey region | flat128 0.006 | five views, worstRegionFrac 0 | no region ≥ 1% flat grey | PASS |
| Painted duplicate | ghosts 0 | ghosts 0 | 0 | PASS |
| LOD0 triangles | 17388 | 24902 | ≤ 25000 | PASS |
| LOD1 / LOD2 | 17388 / 17388 copies | 6592 / 2352 | ~7k / ~2.5k, real cuts | PASS |
| Outline 15 m / 40 m | 0 / 0 px | 0 / 0 px | 0 px | PASS |
| Sealed | nonManifold 0 | LOD0/1/2 nonManifold 0, boundary 0 | 0 | PASS |
| Contact | ymin −0.15 | ymin −0.15, gap 0 | 0 m | PASS |
| Icicles | 21, tip y 6.155 | 21, tip y 6.155 | roots above 5 m | PASS |
| Sliver fraction | 0.0056 | 0.0035 (min angle p5 17.22°) | ≤ 0.01 | PASS |
| Plaza free width | 24.124 m | 24.124 m | ≥ 16 m | PASS |
| Texture share | 3.098 MB | 3.221 MB | ≤ 12 MB | PASS |
| Shot sheet | PENDING | PENDING | Art Director KEEP | FAIL |
| Ticket gates | fail | fail | pass | FAIL |

Builder cell-paint predict, same masks, before the UV raster of the saved triangles: front 0.9404, left45 0.7217, right45 0.9134. The gate numbers above are the mesh floors (inset > 0.02 m) against the saved amber masks, both painted flat stone `[32,36,44]` plus amber `[230,170,60]`, scored by `checks.relief_align.overlap`.

## Looks

Five beauty JPGs were opened. The cap is pale frost, matte. The plinth is dark navy basalt tile. The right-face rune column and the front strokes sit in the groove floors. On the 8 m frame, 70.5% of the relief-gold groove pixels land on bronze texture. The side chevron pattern is plate stone and has no groove, because those pixels are outside the amber mask.

`up-3m` flatGreyFrac is 0.0216 and worstRegionFrac is 0, so the region rule passes.

## LOD triangles

| LOD | Tris | Use | Grooves |
| --- | --- | --- | --- |
| LOD0 | 24902 | near | closed pockets, 0.038 m |
| LOD1 | 6592 | from 15 m | geometry off, normal maps baked from LOD0 |
| LOD2 | 2352 | from 40 m | same normal maps, runes stay in the albedo |

Outline XOR is 0 px at 15 m (LOD0 vs LOD1, four yaws) and 0 px at 40 m (LOD1 vs LOD2). `node tools/lodstream/gate.mjs` verdict PASS.

## Collider

Recorded in `zone-placement.json` `collision_layers` and in `ticket.json` `placement.colliders`.

| Piece | Y | Height | Apothem | Layers |
| --- | --- | --- | --- | --- |
| Plinth step 0 | −0.15 to 0.05 | 0.20 m | 2.06 m (visual 2.08, inset 2 cm) | player, camera |
| Plinth step 1 | 0.05 to 0.28 | 0.23 m | 1.70 m | player, camera |
| Plinth step 2 | 0.28 to 0.60 | 0.32 m | 1.34 m | player, camera |
| Shaft hull | 0.60 to 7.00 | | 0.78 m at the widest section | player, camera |

Each camera box adds 1 m. Outer visual flat-to-flat stays 4.16 m. No rune colliders. No icicle colliders. Position and yaw are unchanged.

## Renders

All under `steps/zone-d/02-rune-pillar/object-gate-v2/`. JPG only.

| View | File |
| --- | --- |
| 19.7 m | `front-19.7m.jpg` |
| 8 m and phone mode B | `front-8m.jpg`, `phone-8m.jpg` (same bytes) |
| 3 m looking up | `up-3m.jpg` |
| Oblique 45° | `oblique45.jpg` |
| Grazing | `grazing.jpg` |
| Groove floors at 8 m | `front-8m-relief.jpg` |
| Per-face alignment | `align-front-groove.jpg`, `align-front-rune.jpg`, `align-right45-groove.jpg`, `align-right45-rune.jpg`, `align-left45-groove.jpg`, `align-left45-rune.jpg` |
| Shot sheet | `shot-verdict.json` (PENDING) |

Depth `.npz` files were deleted after `volume.oblique_view` read them. The numbers are in `volume.json`.

## Ticket validate

The spec binary `/workspace/grokcli/wt/tools-09-build-ticket/tools/build-ticket/cli.mjs` is not on disk. The run was:

```
node /workspace/grokcli/wt/tools-10-golden-run/tools/build-ticket/cli.mjs validate steps/zone-d/02-rune-pillar/ticket.json --git-dir /workspace/grokcli/wt/zd-rune-pillar-1013 --commit c9f1803852ffe316a3c8c1df672f5b770edc0075
```

Output: `ticket-validate.json`. `build.commit` stays `c9f18038` after the report commit moves HEAD.

## Remaining

- Grazing relief stepFrac 0.0162. The same step-fraction defect failed in v1 (absolute 0.001). This is the second miss. The bar was left at 0.03. The groove depth was left at 0.038 m. No third cook.
- Absolute mode still cannot see a 3.8 cm groove (`JUMP_M` 0.25). Oblique relief mode can: 0.0494 PASS.
- Art Director verdict is pending. Intake is not KEEP.
- Phone fps is unverified. There is no play page. The preview freeze script refuses this report, because its verdict token is FAIL.
- `visible-shot.mjs` still cannot import `js-yaml`. The 180.0 px/m number is the Python estimator.
