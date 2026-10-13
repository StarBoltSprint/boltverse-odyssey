# Zone C step 5c: solids3 — approach LOD + grounding + colour (`zc/05-solids-v3`, 12 Oct)

Zone C "Cascade Verdance". Bible: /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md (rules 1-9 apply).
Branch `zc/05-solids`. Camera #199 and masks #200 are in-tree. Terrain stays as kept (causeway from zc/03-terrain).
**NEW outdir only:** write everything under `steps/zone-c/05-solids-v3/`. Do **not** modify `steps/zone-c/05-solids/` (another task is serving previews from it; that folder is the solids2 result).

kit-gate: node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids-v3/object-gate
<!-- kit-gate-outdir: steps/zone-c/05-solids-v3 -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, learn/geometry.md, tools/imagine-to-3d/README.md, tools/object-gate/README.md, tools/terrain-from-key/README.md,
steps/zone-c/01-camera/, steps/zone-c/02-masks/, steps/zone-c/03-terrain/REPORT.md,
steps/zone-c/05-solids/REPORT.md + numbers.json + kit-gate-result.json + object-gate/report.md + sheet-phone.jpg,
SPEC-ZC-SOLIDS2-1012.md, /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md, key `/workspace/zc-bible-1011/key-zc1.jpg`,
**all 11 validated plates** at `/workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/` (VALIDATED.md; SmiR accepted #6 and #8).

Plates (reference by absolute path; do not regenerate, do not Imagine):
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

## Keep from solids2 (do not regress)
- Sealed / watertight on all 5 (open 0, non-manifold 0).
- All **11 plates** wired; hidden-face rows PASS.
- UV stretch ≤ 1.29 (gate maxes were ≤ 1.291).
- Arches phone px/m PASS (136.3 and 124.9 vs 118.5).
- Draw calls ≤ 12; relief from plate/key pixels PASS.

## Build (tools/imagine-to-3d only — RUN and EXTEND; NO hand recipe)
Rebuild the **5 solids** into `steps/zone-c/05-solids-v3/` with `tools/imagine-to-3d` (`auto.py` and related tool modules):
1. left arch (mask-arch-left)
2. right arch (mask-arch-right)
3. left cliff (mask-cliff-left)
4. central gorge (mask-gorge-rock)
5. right cliff (mask-cliff-right)

Rules:
- #199 camera, #200 SAM2 masks, **MoGe-2 depth only**. Key projection for key-visible faces from key-zc1.jpg.
- Hidden faces use the 11 validated plates (same plate→face map as solids2 REPORT). Zero new Imagine.
- Relief only from plate pixels. Extend tools as needed; changes stay inside `tools/`.

## Fix previous FAIL (blocking — from steps/zone-c/05-solids/REPORT.md)
| Fail | Need |
| --- | --- |
| LOD / approach silhouette jump on **all 5** | Identical silhouette across LOD / distance steps. **Reuse the tower fix4 approach-LOD method** that reached min IoU **0.91** (identical hull / sameHull / continuous fade — port or share the tool path from tower-vision imagine-to-3d / object-gate morph logic; do not invent a one-off script). Gate approach within bar on every solid. |
| Grounding | cliff-left **0.69 m** and gorge-rock **2.63 m** → **0.00 m** float; sink into terrain contact. Other three already near 0 — do not regress. |
| Visible px/m | cliff-left (52.1) and gorge-rock (0.0 flat) must improve; also fix **8 m probe** for cliff-right (no steep surface accepted). Arches must stay PASS. WARN only if native plate density is the hard limit (same pattern as tower). |
| Repetition | Fix empty **low-portrait** capture bug (arch-left / cliff-left had no 48×48 object); cliff-right face-z autocorrelation peaks. Gate repetition PASS on all five. |
| Colour | ΔE mean **16.9** vs key → match key (tone mapping / sRGB; no hand colours). Report before/after. |

Real headless renders after the loading screen is gone. Phone sheet **sheet-phone.jpg** 720×1600 beside the key. Staging port **8772** (NOT 8996, 8771, 8994, 8997, 8981, 8982) — if preview serve already holds 8772, use a free port and record it in REPORT; do not kill the preview task's serve. Live index.html untouched. Do not edit `steps/zone-c/05-solids/`.

## Verify (blocking)
| Check | Need |
| --- | --- |
| Grounding / float | 0.00 m on all 5 (esp. cliff-left, gorge-rock) |
| Sealed mesh | watertight on all 5 |
| LOD approach | same silhouette, no morph jump (tower-fix4 method) |
| UV stretch p95 | ≤ 1.3 |
| Draw calls | ≤ 12 |
| Visible px/m + repetition | honest; gate PASS (or documented native WARN) |
| Relief from plate pixels | PASS |
| Hidden-face plates 5–15 | wired; no PENDING |
| Colour vs key | improved ΔE reported |
| Runtime console / shaders | clean |
| Phone sheet | `sheet-phone.jpg` present |

Max 2 attempts. Never write PASS if any blocking row fails. Stop at PASS or after 2 attempts with honest REPORT.md.

## Deliver — steps/zone-c/05-solids-v3/
- **REPORT.md** (before/after vs 05-solids; plate→face map; approach method borrowed from tower fix4; grounding; px/m; repetition; ΔE; timings; cost = 0 new Imagine)
- **sheet-phone.jpg**, **kit-gate-result.json** (+ .txt), numbers.json, renders, object-gate/
- World Graph updates for the 5 solids into the v3 outdir if needed; validate zone.v1
- learn/ + tool README updates (ALWAYS IMPROVE). Local commits on `zc/05-solids` only. **Do NOT push, do NOT merge.** Do not touch tower worktree, plates worktree, or `steps/zone-c/05-solids/`.
