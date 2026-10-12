# Tower fix3 — 2026-10-12 — FAIL

Verdict: FAIL

Two attempts. The gate is `steps/tower-fix3-1012/gate/report.md`. Verdict **FAIL** (5 FAIL / 21). No blocking row was loosened. Nothing was written under `dataset/i23d`.

## SmiR decisions

- **d/w** bar is the plate foot **0.86 ± 0.05**, recorded as `spec.proportions.dOverW: [0.81, 0.91]` with `reason: from plates`. The mesh was not squashed. Attempt 2 mesh d/w is **0.871**, h/w **3.777**. The proportions row **PASS** and the detail includes `reason from plates`.
- **Visible px/m at 8 m** is WARN only when `nativePlateLimit` is set and the render is `coarserThanEstimator`. That rule is in `tools/object-gate/README.md` and in `selftest.mjs` (a measured 140 without `coarserThanEstimator` stays FAIL). Attempt 1 printed WARN **18.9** vs 154.6 because the fit pull had moved the capture to about 256 m and every tile was flatter than the coarsest probe (upper bound `S/kmax`). Attempt 2 leaves probe and measurement cameras alone, so the 8 m shot is a real zoom: **41.3** px/m of detail vs **154.6** needed, screen 309.3 px/m, not `coarserThanEstimator`. That row is **FAIL**. The plates were not upscaled. Sampling on the atlas is still 6.9 px/m.

## Before / after vs tower-sides-fix-1011

| Row | 1011 | Attempt 1 | Attempt 2 |
| --- | --- | --- | --- |
| UV p95 max | 1.701 | 1.284 PASS | **1.298 PASS** |
| Visible px/m | 18.9 FAIL | 18.9 WARN (far upper bound) | **41.3 FAIL** (real 8 m) |
| Morph | jump 11.3 m, min IoU 0.911 | min IoU 0.401, jumps 232.1 m and 11.3 m | min IoU **0.911**, one jump **11.3 m (0.917)** |
| Shadow ground px | 0 | 1676 (probe camera was pulled) | **0** on the probe's own pose |
| d/w | 0.87 vs old 0.45–0.70 | 0.878 PASS | **0.871 PASS** |
| Float | 0.00 m | 8.74 m | **0.00 m** |
| Relief overlap | 0.1501 / 0.2488 / 0.1027 | 0.1212 / 0.2656 / 0 / 0.0537 | **0.1945 / 0.2655 / 0 / 0.0978** |
| Checklist | 5 recorded FAIL | ladder N/A, four still FAIL | ladder **N/A**, four still recorded FAIL |
| Tris, open | 9796, sealed | 9920, sealed | **28320, sealed** |
| Body ΔE | 0 | 0 | **0** (left, right, back) |

## What changed on attempt 2

- Planar UV from attempt 1 stayed. Crown lean cap stayed. Offline and gate p95 are both ≤ 1.298.
- Relief inset is 0 for `t < 0.22`, so the lower fifth the grounding probe rays has no overhang. Float returned to 0.00 m at 88.5, −98.5.
- The fit pull no longer runs on a camera other than `__ogHost.camera`. Reach is `1 - smoothstep(gap, 0.4, 6)`. The 232 m silhouette cliff (IoU 0.40) was that pull calling `lookAt` on the morph mask camera. It is gone.
- SAM2 `points_per_side` 24. Front kept 10 regions, sides 13–15. Medians snap to 0.4 m, clip at 1.2 m, relief scale 0.4131. Loft is 48 × 120. Crispness still PASS (planes 6 / 6 / 4 / 9, and two faces inside 2–8 are enough). Facade relief PASS: +x 2.851, −x 2.832, +z 0, −z 0.496.

## Shadow hypotheses

The sticky tower ortho is on the light (`downSunM` 360, tint 0.4, map true, left 11.8, right 88.1, bottom −52.4, top 427.9). That is hypothesis 1 (city ortho was winning) applied in the runtime.

Attempt 2 counts, with the probe camera left on the pose the gate sets: **n = 0, nInside = 0, nAny = 0**. Hypothesis 2 (the probe ignores pixels under the object mask) does not explain a zero: nothing darkened outside the mask either. Hypothesis 3 (the hero is missing from the map) is not proven by a missing map; the map exists and the caster is still forced on. The attempt 1 count of 1676 was taken while the same fit pull rewrote every perspective camera, including the shadow probe. That count is not a contact shadow on the specified pose. No hypothesis cleared `n > 30` on the probe's own camera. The bar was not lowered.

## Relief alignment

Bar 0.70 was not reached.

- Hero 0.1945 (relief precision 0.49, texture precision 0.19, 6378 vs 16995 edges, silhouette IoU 0.99).
- 30 m 0.2655 (relief precision 0.99, texture precision 0.27). The steps that exist sit on paint. Most painted edges, the window grid, have no step.
- 8 m overlap 0, reason `too few edges` (0 and 0). The visible-shot crop is a smooth band. Both gradients stay under the 0.02 floor. The camera was not retargeted.
- Side 0.0978 (relief precision 0.81, texture precision 0.10, 3710 vs 35747 edges).

## Morph

min IoU 0.911 clears 0.80. The frame at 11.3 m is 0.917 and the neighbour median is more than 0.05 above it, so `maxDropVsNeighbours` fails. `near.json` is `ready: false`, so the near-atlas colour mix is not in this shader. The remaining jump is a silhouette step, not a colour fade. The bar was not lowered.

## Checklist and the N/A selftest

`checklistEvidence` treats `plateEvidence: absent` plus a note as N/A. `tools/object-gate/selftest.mjs` covers that path, a missing note, a recorded FAIL, and a recorded pass. The live gate prints the ladder note and does not fail the row for it: "No plate paints a ladder. Cables on the right plate are not rails."

Wedge, chrome, damage, and sand stay `pass: false` on the old record. They were not copied forward as passes and the black hashes were not reused. Wedge and the damaged crown are readable on the fresh far and close captures. A chrome strip and a sand seating were not confirmed on those frames (the light bay reads as stone tile; the low portrait shows the base on a flat plinth). Marking them pass would have been a false record, and the attempt budget was already spent, so the record was not rewritten and the checklist row stays FAIL.

## Sheets

`turnaround.jpg` is four orthographic three.js `MeshBasic` views of the installed glb (`toneMapped: false`, `flipY: false`), from `node tools/imagine-to-3d/ortho_sheet.mjs`. `sheet-phone.jpg` is 720×1600 with that front view beside the key crop. They are renders of this mesh. They are not a gate PASS.
