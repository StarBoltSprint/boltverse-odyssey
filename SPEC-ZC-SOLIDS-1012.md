# Zone C step 5: solids — left/right arch, left/right cliff, central gorge (`zc/05-solids`, 12 Oct)

Zone C "Cascade Verdance". Bible: /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md (rules 1-9 apply).
Branch `zc/05-solids` from `zc/03-terrain` (PR #203 open, NOT merged). Camera #199 and masks #200 are in-tree under steps/zone-c/01-camera and 02-masks. Terrain stays as kept.

kit-gate: node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids/object-gate
<!-- kit-gate-outdir: steps/zone-c/05-solids -->

## Read first
GROK.md, docs/METHOD.md, learn/failures.md, learn/geometry.md, tools/imagine-to-3d/README.md, tools/object-gate/README.md, tools/terrain-from-key/README.md,
steps/zone-c/01-camera/, steps/zone-c/02-masks/ (masks: arch-left, arch-right, cliff-left, cliff-right, gorge-rock, causeway), steps/zone-c/03-terrain/REPORT.md,
/workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md, key `/workspace/zc-bible-1011/key-zc1.jpg` (also steps/zone-c/03-terrain/key-zc1.jpg if present).

## Build (tools/imagine-to-3d only — RUN and EXTEND; NO hand recipe, NO side script outside a tool)
Build these **5 solids** with tools/imagine-to-3d:
1. left arch (mask-arch-left)
2. right arch (mask-arch-right)
3. left cliff (mask-cliff-left)
4. central gorge (mask-gorge-rock)
5. right cliff (mask-cliff-right)

Rules:
- Use the #199 camera (steps/zone-c/01-camera/camera.json) and #200 SAM2 masks. MoGe-2 depth only (MIT). Key projection for **key-visible faces** at full quality from key-zc1.jpg.
- **Hidden faces need the 11 remaining approved Imagine plates (#5–#15 of the Zone C plate plan).** Those plates DO NOT exist yet. Do NOT invent them. Do NOT generate images (no Imagine, no image_gen/image_edit). Build solids with key-visible faces at full quality; mark each hidden face as `pending-plate` in the report with the exact plate number it needs (from the approved plan / steps/zone-c/04-plates on zc/04-plate-plan if present, else the bible plan numbers #5–#15). Make the object-gate show those rows as **PENDING** (not PASS, not FAIL-as-pass).
- Same hull at all LODs (no silhouette pop). Instancing where appropriate. Draw calls ≤ 12 for the solids scene. UV stretch ≤ 1.3 on key-visible faces at +8 / +30 / +60 m.
- Real headless renders after the loading screen is gone. Phone sheet 720×1600 beside the key. Staging port **8772** (NOT 8996, 8771, 8994, 8997, 8981, 8982). Live index.html untouched.

## Verify (blocking)
| Check | Need |
| --- | --- |
| UV stretch p95 on key-visible faces at +8,+30,+60 m | ≤ 1.3 |
| Draw calls (solids scene) | ≤ 12 |
| LOD silhouette (approach sequence) | same hull, no pop (IoU drop within gate bar) |
| Key-visible faces vs key (shape/colour via object-gate / key-compare as wired) | honest numbers; no invented pixels |
| Hidden-face plate rows | PENDING with plate #, never fake PASS |
| Runtime console / shaders | clean |
| Phone sheet 720×1600 beside key | present |

Max 2 attempts. Never write PASS if any blocking row fails (PENDING hidden-face plates are allowed and must be listed). Stop at PASS-or-honest-PENDING or after 2 attempts with REPORT.md.

## Deliver — steps/zone-c/05-solids/
- REPORT.md (pending-plate table with plate numbers; before/after; timings; cost = 0 new Imagine)
- numbers.json, renders, sheet-phone.jpg (or .png), object-gate report, kit-gate-result.*
- World Graph updates for the 5 solids if the zone JSON is the place; validate zone.v1
- learn/ + tool README updates (ALWAYS IMPROVE). Local commits on `zc/05-solids` only. Do NOT push, do NOT merge, do NOT touch other worktrees (tower runs in wt/tower-vision-1010).
