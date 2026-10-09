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
