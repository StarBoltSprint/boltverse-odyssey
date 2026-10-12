# Zone C step 5b: solids2 — rebuild with all 11 validated plates (`zc/05-solids`, 12 Oct)

Zone C "Cascade Verdance". Bible: /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md (rules 1-9 apply).
Branch `zc/05-solids`. Camera #199 and masks #200 are in-tree. Terrain stays as kept (causeway from zc/03-terrain). Previous solids attempt FAIL is in `steps/zone-c/05-solids/REPORT.md` — rebuild that same outdir.

kit-gate: node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids/object-gate
<!-- kit-gate-outdir: steps/zone-c/05-solids -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, learn/geometry.md, tools/imagine-to-3d/README.md, tools/object-gate/README.md, tools/terrain-from-key/README.md,
steps/zone-c/01-camera/, steps/zone-c/02-masks/, steps/zone-c/03-terrain/REPORT.md, steps/zone-c/05-solids/REPORT.md + numbers.json + object-gate/report.md + sheet-phone.jpg,
/workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md, key `/workspace/zc-bible-1011/key-zc1.jpg`,
**all 11 validated plates** at `/workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/` (see VALIDATED.md there; SmiR accepted #6 and #8 on 12 Oct 07:18 PT).

Plates (copy or reference by absolute path; do not regenerate, do not Imagine):
| # | File |
| --- | --- |
| 5 | plate-05-arch-left-inner.jpg |
| 6 | plate-06-arch-right-inner.jpg |
| 7 | plate-07-wall-left.jpg |
| 8 | plate-08-wall-right.jpg |
| 9 | plate-09-waterfall.jpg |
| 10 | plate-10-mist.jpg |
| 11 | plate-11-leaf.jpg |
| 12 | plate-12-fern.jpg |
| 13 | plate-13-causeway-underside.jpg |
| 14 | plate-14-gorge-closure.jpg |
| 15 | plate-15-planet.jpg |

## Build (tools/imagine-to-3d only — RUN and EXTEND; NO hand recipe, NO side script outside a tool)
Rebuild the **5 solids** with `tools/imagine-to-3d` (`auto.py` and related tool modules):
1. left arch (mask-arch-left)
2. right arch (mask-arch-right)
3. left cliff (mask-cliff-left)
4. central gorge (mask-gorge-rock)
5. right cliff (mask-cliff-right)

Rules:
- Use the #199 camera (`steps/zone-c/01-camera/camera.json`) and #200 SAM2 masks. **MoGe-2 depth only** (MIT). Key projection for **key-visible faces** at full quality from key-zc1.jpg.
- **Hidden faces MUST use the 11 SmiR-validated plates above.** Map each plate to the correct solid face by name / bible plan (inner arch, wall, waterfall, mist, leaf, fern, causeway underside, gorge closure, planet). No more `pending-plate`. No invented pixels. ZERO new Imagine (no image_gen / image_edit).
- **Relief only from plate pixels** (SAM2 / plate-driven displacement — not invented noise).
- Extend the tools as needed so the pipeline consumes these plates end-to-end (UV, material roles, gate sampling). Changes stay inside `tools/`.

## Fix previous FAIL (blocking — from steps/zone-c/05-solids/REPORT.md)
| Fail | Need |
| --- | --- |
| Grounding | float **0.00 m** per solid; sink into terrain contact (no hover). Gate grounding PASS. |
| Sealed / watertight | open edges 0 and non-manifold 0 after weld on every solid. |
| LOD silhouette | identical hull / silhouette on approach (gate approach IoU within bar; no morph pop). `sameHull` true, one index buffer per solid or equivalent that keeps silhouette. |
| Visible px/m | report honest numbers; plates must appear on steep/hidden faces (no 0.0 px/m on arches). Extend tools if sampling misses plate surfaces. |
| Repetition | no tiled/repeated face patches; gate repetition PASS on every solid. |
| UV stretch p95 | ≤ 1.3 on key-visible and plated faces at +8 / +30 / +60 m. |
| Draw calls | ≤ 12 for the solids scene. |
| Hidden faces | all plated; gate rows PASS (or honest FAIL), never PENDING. |

Real headless renders after the loading screen is gone. Phone sheet **sheet-phone.jpg** 720×1600 beside the key. Staging port **8772** (NOT 8996, 8771, 8994, 8997, 8981, 8982). Live index.html untouched.

## Verify (blocking)
| Check | Need |
| --- | --- |
| Grounding / float | 0.00 m; sink into terrain |
| Sealed mesh | watertight on all 5 |
| LOD approach | same silhouette, no morph |
| UV stretch p95 | ≤ 1.3 |
| Draw calls | ≤ 12 |
| Visible px/m + no repetition | honest; gate PASS (or documented WARN only if native plate density is the hard limit — same pattern as tower) |
| Relief from plate pixels | PASS |
| Hidden-face plate rows | no PENDING; plates 5–15 wired |
| Runtime console / shaders | clean |
| Phone sheet 720×1600 beside key | `sheet-phone.jpg` present |

Max 2 attempts. Never write PASS if any blocking row fails. Stop at PASS or after 2 attempts with honest REPORT.md.

## Deliver — steps/zone-c/05-solids/ (rebuild in place)
- REPORT.md (before/after vs previous FAIL; plate→face map; timings; cost = 0 new Imagine)
- numbers.json, renders, sheet-phone.jpg, object-gate report, kit-gate-result.*
- World Graph updates for the 5 solids if the zone JSON is the place; validate zone.v1
- learn/ + tool README updates (ALWAYS IMPROVE). Local commits on `zc/05-solids` only. **Do NOT push, do NOT merge**, do NOT touch other worktrees (tower runs in wt/tower-vision-1010; plates stay in wt/zc-plates-1012).
