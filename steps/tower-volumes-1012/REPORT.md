# Tower volumes — 2026-10-12

Verdict: FAIL

The completed object-gate (816 s, exit 1) is 5 FAIL / 22. `oblique-profile 45°/grazing` PASS and plane relief PASS. The step is FAIL because five blocking rows fail. This is not a PASS.

Gate: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/tower-volumes-1012/gate`

Report: `steps/tower-volumes-1012/gate/report.md`

## What the phone asked for

SmiR, capture 09:43: the fix4 facades are flat planes with the Imagine plate pasted on. Cables, the chrome strip, and recesses are only painted. The old `facade relief >= 0.3 m` row passed on AABB spans (+x 2.851, −x 2.848, +z 0.496, −z 0.496).

This step built 36 closed boxes from SAM2 masks on the full-face and lower plates. Depth is the MoGe-2 median, snapped into a class band in metres (cable 0.55–1.05, chrome 0.35–0.55, window 0.45–0.65, damage 0.50–0.80). The wall is inset 1.20 m. Each box stays 0.08 m inside the original shell. Protrusion is 0.35–1.05 m. Texture is the plate, projected per quad. UV stretch max 1.113.

The boxes are square ducts (`axis_box`), not round tubes. Window and damage boxes stand proud of the wall. A Boolean hole was not cut: it opens the shell. No cornice mask survived the class filter. The left lower band has four windows and no cable. Two front chrome masks are wide piers (6.8 m and 4.3 m) at 0.55 m and 0.35 m proud. Per-feature xy and metres: `work/features.json`.

## Gate rows that hold

| Row | fix4 | this step |
| --- | --- | --- |
| approach morph 300→10 m | min IoU 0.91 | min IoU 0.914 (67 frames) |
| grounding | 0.00 m | 0.00 m |
| sealed | tris 28556, open 0, non-manifold 0 | tris 28988, open 0, non-manifold 0 |
| UV stretch ≤ 1.3 | max 1.299 | max 1.113 |
| proportions | PASS, reason from plates | PASS, reason from plates. Local size 46.02 × 173.82 × 39.57 m (d/w 0.86) |
| ladder | N/A | N/A (absent from every plate) |

## Oblique profile — PASS

Bar = max(0.5 m, 0.003·H) = 0.521 m at H = 173.821 m. Blocking distances are 8 m and 30 m, at 45° and 75°, on +z, −z, +x, −x. Hero (~182.8 m) is reported and also cleared the bar. Range is the spread of 5 cm plane-distance bins on fragments facing that face, inside ±2.5 m of the shell. A flat AABB control is the roughness baseline. A smooth pier can pass when its range clears the bar and its roughness is at least the flat control.

| Face | 45° @ 8 m | 45° @ 30 m | 75° @ 8 m | 75° @ 30 m |
| --- | --- | --- | --- | --- |
| +z | 0.80 / 0 | 1.20 / 0.160 | 0.60 / 0.070 | 0.85 / 0.139 |
| −z | 2.90 / 0 | 2.55 / 0.278 | 2.95 / 0.173 | 4.50 / 0.247 |
| +x | 2.25 / 0.034 | 3.55 / 0.374 | 2.20 / 0.308 | 3.55 / 0.398 |
| −x | 1.45 / 0.030 | 2.30 / 0.146 | 1.45 / 0 | 1.70 / 0.033 |

Cells are range metres / silhouette roughness metres. Sheet: `oblique-sheet.jpg` (45° and grazing at 30 m). Captures: `gate/oblique-*.png` and `gate/tower-hero/oblique-*.png`.

Self-test (`steps/tower-volumes-1012/selftest-object-gate.txt`): flat box FAIL/FAIL on oblique and tightened relief; studded box PASS/PASS.

Plane relief (same bar, outward gap from the modal wall plane): +x 3 m, −x 3 m, +z 1.05 m, −z 2.95 m. PASS. The +x / −x figures include the inset shaft against the wider foot, so they are larger than the 1.05 m box depth.

## Five blocking FAILs

1. **visible px/m.** 50.8 px/m on screen vs 154.6 needed (same 50.8 as fix4). The row stayed FAIL. The native-plate WARN applies only when the render is `coarserThanEstimator`. This capture is not. Plates were not upscaled.

2. **shadow cast.** 0 ground pixels outside the object mask. `s1.n = 0`, `s2.n = 0`. The page has `vision-shadow-caster`, map 2048, near 1532.6, far 2216.7. A headless probe outside the gate saw the caster and the instanced mesh enter the shadow pass, and a contact texel whose unpacked depth would cross the 0.45 m step, while the probe colour mean stayed identical with every caster off. That probe is not the gate row. The gate row is 0. Albedo was not darkened to fake it.

3. **facade crispness.** Need axis ≥ 0.72 and 2–8 offset planes. Measured: +x axis 0.955 planes 10, −x axis 0.905 planes 10, +z axis 0.99 planes 1, −z axis 0.951 planes 6. +z is one offset depth. +x and −x have more than eight. fix4 printed PASS with −z planes 14 under the old 0.3 m relief path. Quantizing the class depths would be another mesh cook. Stopped.

4. **relief-texture alignment.** hero 0.1446, 30 m 0.0934, 8 m 0, side 0.1513. Bar 0.70. The UV rect sits on the feature and still samples neighbours. No invented bars were added to chase the score.

5. **key checklist.** wedge, chrome, damage, and sand stay recorded FAIL on the current captures. Ladder stays N/A. The record file was not rewritten to a PASS.

Colour vs key is INFO only: ΔE 17.51 (object L\*a\*b\* 21.2, 1, −2.4; key 34.9, 11.4, 0.6).

## Attempts

The scoring run is the one above. Two earlier gate launches died in the tool before a geometry row (a `const` used before initialization, then a Playwright `evaluate` with two arguments). Both are fixed in `tools/object-gate/gate.mjs`. The mesh was rebuilt while UV was brought from a collapsed atlas to 1.113, which is more than two cooks. No further mesh. No further gate.

## Sheets

- `sheet-phone.jpg` — 720×1600, tower beside `/workspace/zb-bible-1008/key-city3.jpg` (`node tools/imagine-to-3d/ortho_sheet.mjs`).
- `turnaround.jpg` — four orthographic views.
- `oblique-sheet.jpg` — 45° and 75° at 30 m, four faces.

`steps/tower-fix4-1012/` was not modified. Nothing was pushed or merged.
