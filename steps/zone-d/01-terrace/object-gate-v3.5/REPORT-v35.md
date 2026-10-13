# Zone D terrace v3.5

Mesh fix commit: `dd80963fca060d9bc352469d46228f2ef30ef357` (2026-10-13 08:27:45 +0200) on `zd/01-terrace`.
Parent: `1debe2277a2a8437825ec1d1f039703d31e4f2f0` (v3.4.2).
This report and the renders sit on the following commit. No push. No merge.

Object-gate verdict: **FAIL** (2 rows). The two FAIL rows are the 8 m sharpness gap and the empty key checklist. Every other object-gate row on this capture is PASS. Shot-sheet verdict is PENDING (Art Director). Phone fps was not measured on a phone.

Gate log: `steps/zone-d/01-terrace/work/gate-v35.log`
Gate report: `steps/zone-d/01-terrace/object-gate-v3.5/report.md`
URL: http://127.0.0.1:8971/ · adapter `zd-preview-1012` · 2026-10-13T06:38:48.557Z

## Gate table

| Check | Value | Threshold | Result |
| --- | --- | --- | --- |
| painted duplicate | overlap 0.0 m, ghosts 0 | no taper overlap ≥ 0.08 m, ghosts 0 | PASS |
| ghost streaks | 0 | 0 | PASS |
| UV stretch | max 1.269 | ≤ 1.3 | PASS |
| visible px/m at 8 m (mode B) | 153.7 (median of 16 tiles, p25 120.0; zoomed capture 309.3 screen px/m) | ≥ 154.6 | FAIL, gap 0.9. Stopped. |
| plate sampling (info) | worst +x 45.3 px/m on zd-terrace-lod0 (was +y 19.0 in v3.4.2) | info; tops allocated at 48 px/m, aniso 1.0 | INFO |
| mesh sealed LOD0 | 78160 tris, nonManifold 0, open 0 | ≤ 80000 tris, nonManifold 0, open 0 | PASS |
| mesh sealed LOD1 | 29066 tris, nonManifold 0, open 0 | nonManifold 0, open 0 | PASS |
| mesh sealed LOD2 | 14830 tris, nonManifold 0, open 0 | nonManifold 0, open 0 | PASS |
| grounding | worst float 0.00 m | 0 m | PASS |
| facade relief LOD0 | +x 0.495, −x 0.498, +z 1.519, −z 0 | ≥ 0.3 m on a faced side | PASS |
| oblique 45° profile | stepFrac 0.0726, normSpread 0.2385, hit 33622 | stepFrac ≥ 0.03, normSpread ≥ 0.15 | PASS |
| grazing profile | stepFrac 0.0456, normSpread 0.4068, hit 19052 | stepFrac ≥ 0.03, normSpread ≥ 0.15 | PASS |
| untextured far 19.7 m | greyFrac 0.0009, uncoveredFrac 0.0003 | grey ≤ 0.01, uncovered ≤ 0.005 | PASS |
| untextured 8 m | grey 0, uncovered 0 | same | PASS |
| untextured 3 m up | grey 0, uncovered 0 | same | PASS |
| untextured oblique | grey 0.0020, uncovered 0 | same | PASS |
| untextured grazing | grey 0, uncovered 0.0004 | same | PASS |
| LOD outline 15 m (LOD0 vs LOD1) | xorFrac 0, focusXorFrac 0, maxBlob 0 | xor ≤ 0.0005, focus ≤ 0.001, blob ≤ 4 px | PASS |
| LOD outline 40 m (LOD1 vs LOD2) | xorFrac 0, focusXorFrac 0, maxBlob 0 | same | PASS |
| LOD outline cross-check 40 m LOD0/1 and 15 m LOD1/2 | xorFrac 0, maxBlob 0 | same | PASS |
| shot-sheet verdict | PENDING, intake refused | KEEP with empty defects is the only library allow | PENDING |
| key checklist | volume, doorways, cornices, colours, base: no recorded pass | every item verified in `records/terrace.verified.yaml` | FAIL |
| float / approach / shadow / textures / repetition | see `report.md` | profile thresholds | PASS |
| phone fps (median, 1% low, min) | not measured on a phone | 35 s `?bench=1` route on a phone | not measured |

`view_gates.py` verdict on `reviews/`: PASS (`view-gates.json`).
`lod_gate.py` file: `lod-outline.json`.

Runtime perf rows (headless, device pixel ratio 1, both 412×915 and 540×1200): canvas ratio 1 (cap 2), ground renderOrder 2 above max opaque 0, adaptive on, detail layer kept, upscale `easu-rcas` rcas 0.8, sprintDip false. These rows do not count as phone fps.

## Sharpness — stopped

Achieved visible detail at 8 m: **153.7 px/m**. Threshold **154.6 px/m**. Gap **0.9 px/m**.
The capture is the gate’s zoomed steep-wall sample (phone 1080×2400, render pixel ratio 1.5, vfov 58°). Ledge tops were given the existing 1024 plate first (isotropic 48 px/m, disjoint bands, no new Imagine, no upscale). Plate sampling worst axis moved from +y 19.0 px/m (v3.4.2) to +x 45.3 px/m. One native 1024 plate still covers at most about 6.6×6.6 m at 154.6 px/m. This item stops here.

## Renders

All five review PNGs have mtimes after `dd80963f` (08:27:45). JPG copies sit beside them.

| View | Path |
| --- | --- |
| 19.7 m | `steps/zone-d/01-terrace/object-gate-v3.5/reviews/far19.7.png` (jpg beside it) |
| 8 m | `steps/zone-d/01-terrace/object-gate-v3.5/reviews/close8m.png` |
| 3 m looking up | `steps/zone-d/01-terrace/object-gate-v3.5/reviews/close3m-up.png` |
| oblique 45° | `steps/zone-d/01-terrace/object-gate-v3.5/reviews/oblique45.png` |
| grazing | `steps/zone-d/01-terrace/object-gate-v3.5/reviews/grazing.png` |
| phone 8 m, mode B | `steps/zone-d/01-terrace/object-gate-v3.5/phone/8m.jpg` |
| phone 3 m up, mode B | `steps/zone-d/01-terrace/object-gate-v3.5/phone/3m-up.jpg` |
| phone 30 m, mode B | `steps/zone-d/01-terrace/object-gate-v3.5/phone/30m.jpg` |
| pre-fix non-manifold edges | `steps/zone-d/01-terrace/object-gate-v3.5/debug-nonmanifold-edges.png` |

Cameras (Blender Z-up, front at −Y) are in `reviews/views.json` and `work/v35-views.json`. The oblique that cleared normSpread is position `[-14.7, -9.0, 4.8]`, target `[-0.86, 2.0, 6.0]`. An earlier camera at `[-12.9, -13.0, 5.0]` scored normSpread 0.1472 and was replaced.

The far view’s first pass scored uncoveredFrac 0.0063 because the new top UV islands sit outside the original SAM2 top mask. `work/top-mask-cover.png` is that mask plus the top-face UV raster (builder `work/top-mask.png` is unchanged). The installed far render scores uncoveredFrac 0.0003.

## What the fix commit holds

- Painted icicle streaks were filled from neighbouring basalt on the v35 plates. Ice cones keep their own materials on the original plates (`plate-front.jpg`, `t1-right.jpg`, `plate-side.jpg`) so the wall fill does not strip cone colour. `painted-duplicate.json` and `work/ghost-gate-v35.json` both record 0.
- The 108 edges were overlapping buried 12-gon root rings (debug PNG above, drawn before the fix). After the spacing cap, weld reports open 0 and nonManifold 0 on every LOD (`work/weld-lod0.json`, `weld-lod1.json`, `weld-lod2.json`). Cones stay separate. No booleans.
- Lip normals are written in `tools/imagine-to-3d/weld_export.py` from builder `(x, y, z)` onto the exported mesh.
- Ground on the live preview and play pages, and in the spec snapshots, is one `top.jpg` quad, ClampToEdge, no repeat. Untextured-area rows above are the blocking check.
- Stone courses: `course_ys` cuts a step only where a horizontal basalt edge covers at least 0.48 of the columns above the doorway. `work/relief-align-v35.json` records an empty step list. No steps were invented.
- `window.__perfReport()` and `?bench=1` are on the phone build (0–10 s walk 30 m→8 m, 10–20 s to 3 m looking up, 20–30 s back to 30 m, then a pause at 19.7 m until 35 s). The 35 s route was not run on a phone, so fps median, 1% low, and min are unmeasured.

## Unresolved

- 8 m visible sharpness 153.7 vs 154.6 (gap 0.9 px/m). Stopped. No upscale.
- Key checklist has no recorded pass in `tools/object-gate/specs/zone-d/records/terrace.verified.yaml`. The sheet is `object-gate-v3.5/terrace/capture-sheet.jpg`. This report does not invent those five pass/fail notes.
- Shot sheet `object-gate-v3.5/shot-verdict.json` is PENDING. `verdict.py intake` exits 1. An Art Director KEEP was not written.
- Phone fps over the 35 s bench route was not measured on a phone. Headless device pixel ratio was 1.
- Tier-3 left corner: the oblique render still shows the front-plate / side-plate join as a vertical edge on the return. There is no separate blend metric. The mesh row is sealed (open edges 0).
- Preview freeze expects `Verdict: PASS` in the report. This step’s object-gate verdict is FAIL, so the freeze is refused.
