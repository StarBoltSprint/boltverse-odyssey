# Imagine to 3D — pipeline and its mandatory final stage (IN TEST, 2026-10-09)

Back to [METHOD.md](../METHOD.md) · gate: [object-quality-gate.md](object-quality-gate.md) · objects:
[objects from key crops](objects-from-key-crops.md).

The in-house Imagine-to-3D tool turns crop-sourced Imagine views of one object into a real solid with its Imagine
plates. First prototype: the Zone B mesa test (agent workspace `zb-preview-1008-tools/imagine-to-3d/`: `masks.py`
silhouettes, `hull.py` height field / hull, `blender_mesa.py` mesh + LODs, `relief.py`, `proj.py` plate projection,
`qc.py`, `package.py` byte-identical plate copy + runtime json). It lands in the repo once the mesa test passes.

## Stages

1. Key crop → Imagine views (edits of the crop, silhouette gate) — [objects-from-key-crops §2–4](objects-from-key-crops.md).
2. Views → solid (hull / loft / extrude), relief, damage, LODs from the same cuts — §5.
3. Plates at native resolution, UV or projection — never resized.
4. Package into a **staging** copy of the biome page (own folder / port). **Never edit the live preview in place**
   (lesson 2026-10-09 17:14).
5. **object-gate (mandatory, last).** `gate → FAIL → automatic fix plan → fix → re-gate`. Export (= swap the staging
   copy into live / register in the object library) **only on PASS**.

## Stage 5 integration point

```bash
node tools/object-gate/hooks/imagine-to-3d.mjs --scene staging/scene.yaml --object mesa \
     --fix-cmd "python3 imagine-to-3d/fix.py {plan}" \
     --export-cmd "python3 imagine-to-3d/package.py <args>" --max-rounds 3
```

- Exit 0: PASS, exported. Exit 1: still FAIL (nothing exported). Exit 3: needs review (checklist verification by
  Grok vision or the owner).
- `{plan}` is `fix-plan.json`: one item per FAIL row with `action` (`plate-sections`, `unique-plates`, `sink`,
  `heal-manifold`, `add-relief`, `rescale`, `single-silhouette-lod`, `static-shadow`, `shadow-tint`,
  `texture-params`, `restore-native`, `imagine-fx-texture`, `verify-captures`…), `auto` (true = the pipeline fixes it
  without asking), the measured detail and the hints. Table: `FIX_ACTIONS` in the hook.
- From JS: `import { gateAndFix } from "tools/object-gate/hooks/imagine-to-3d.mjs"`; one object without a loop:
  `gateObject(spec, { adapter, url })` from `tools/object-gate/gate.mjs`.
- The same defect failing twice stops the loop (workflow §2) and reports; quota is never burned in a blind loop.

## Upgrade 2026-10-09 (Grok q16, approved by SmiR 18:23): the full chain

Code: [`tools/imagine-to-3d/`](../../tools/imagine-to-3d/) — prototype files as they ran on the mesas, plus the q16
modules below. Stage order, hooks and interfaces: [`INTEGRATION.md`](../../tools/imagine-to-3d/INTEGRATION.md).
Self-tests on Zone B assets: [`selftest/RESULTS.md`](../../tools/imagine-to-3d/selftest/RESULTS.md).

| Stage | Module | What it does |
|---|---|---|
| 0 classify | `classify.py` | Key crop → type (building, rock, wreck/prop, vegetation, ice, creature, effect) by heuristics (silhouette straightness, aspect, solidity, lines, saturation, dark backdrop), Grok vision when unsure → `profiles/<type>.yaml` merged with the object-gate profile (a profile may only tighten the gate). |
| 1 coarse | `coarse.py` | Cheap metric scaffold from the key crop + Depth Anything V2-Small (extrude for buildings, lathe/superellipse for rocks, depth-thickness for wrecks…), rendered from every planned camera. |
| 2 views | `views.py` | 8–12 Imagine **edits**, each = key crop + accepted neighbour one axis away + scaffold render of the target camera (coarse-to-fine). IoU ≥ 0.87 vs the scaffold; the first side/top view defines the depth/footprint (rejects a copy of the front) and refits the scaffold. 3 attempts, then hard fail. |
| — sections | `views.py` | Required px/m precomputed (max(128, phone px/m at the closest approach) near the ground band, ≥ 64 above): each view owns its most frontal surface; only the cells that hold surface become full-size Imagine section plates. No loop, no resize. |
| 5 PBR | `pbr.py` | Imagine albedo (flat shadowless light), height, roughness, metalness plates of each section → map (byte-identical), tangent normal (OpenGL), ORM (AO/rough/metal in R/G/B) + `material.json` for `MeshStandardMaterial`. Checks: native size, delit albedo, no violet, relight response. |
| 8 compare | `compare.py` | Matched-angle in-game capture vs key: LPIPS ≤ 0.15, SSIM, ΔE2000 ≤ 12, a*b* histogram, silhouette IoU ≥ 0.87, neutral shadow, feature checklist ≥ 90 % (template/ORB per item region, else a current Grok-vision record). Sheet in the object-gate format. |
| 9 fix loop | `fixloop.py` | Each failure → one action (sharpness → split section; silhouette → regenerate view → refine depth; checklist → targeted edit; colour/shadow → regenerate albedo; gate pipeline actions passed through). Escalates on repeat; 3–5 iterations then HARD FAIL; vision-only → NEEDS_REVIEW. Plugs into the gate as `--fix-cmd`. |
| ideas | `keyvideo.py` | Optional Imagine video from the key → frames → candidate checklist items + sand/air motion notes. Frames are marked and refused by every geometry/plate stage (video morphs). |

Imagine access is the Grok Build CLI (`imagine.py` writes one batch per step; outputs are copied byte-for-byte and
recorded with sha256 + native size). Quality rule unchanged: nothing lowers texture resolution or geometry for the phone.
