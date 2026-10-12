# Tower volumes — real facade geometry + blocking oblique-profile gate (12 Oct)

SmiR saw the fix4 tower on phone (capture 09:43): facades are flat planes with the Imagine image pasted on; cables, chrome strip, recesses are only painted. The gate's `facade relief >= 0.3 m` passed anyway — it measures mesh AABB depth numbers, not visible profile from an oblique angle. New direction approved: stop polishing the 5 numeric fails; build the big volumes as REAL geometry and add a blocking oblique-profile check.

Base: `steps/tower-fix4-1012/` (approach IoU 0.91, float 0.00 m, sealed 28320 tris, UV stretch 1.30, lower plates). Max 2 attempts.
**NEW outdir only:** write everything under `steps/tower-volumes-1012/`. Do **not** modify `steps/tower-fix4-1012/` (preview serve reads it on :8780) or other worktrees. Do **not** resume fix5.

Read FIRST: this spec, GROK.md, docs/METHOD.md, learn/failures.md, tools/imagine-to-3d/README.md + auto.py + depth_relief.py + hard_surface.py, tools/object-gate/README.md + gate.mjs + selftest.mjs + profiles/building.yaml, tools/common/align/README.md, steps/tower-fix4-1012/gate/report.md + decree-brief.md + sheet-lower-plates.jpg + plates/ + work/, SPEC-TOWER-FIX4-1012.md. Key: `/workspace/zb-bible-1008/key-city3.jpg`.

Plates (reuse, do not regenerate unless missing):
- Full-face: `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/face-{front,right,left,back}-1024.jpg` (left = mirrored right; never open `face-left-REJECTED.jpg`)
- Lower-band: `steps/tower-fix4-1012/plates/lower-{front,right,left,back}.jpg` (+ sheet-lower-plates.jpg)

RUN and EXTEND repo tools only (`tools/imagine-to-3d` including `auto.py` / `multiview_tower.py` / `depth_relief.py` / `hard_surface.py`, `tools/object-gate` including `gate.mjs` + `selftest.mjs` + profiles, `tools/common/align`). NO hand recipe. Never push, merge, or reset --hard.

kit-gate: node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml --out steps/tower-volumes-1012/gate
<!-- kit-gate-outdir: steps/tower-volumes-1012 -->

## Keep from fix4 (do not regress)
- Approach morph min IoU **≥ 0.91** (300→10 m) — no jump at 11.3 m.
- Float **0.00 m**, sealed mesh (open 0, non-manifold 0), UV stretch **≤ 1.3** p95.
- Shadow cast: ground px **> 0** (receiveShadow / fixed neutral contact). If still 0 after volumes, fix it in this step.
- Lower-band plates on bottom ~20–30 m; d/w `0.86 ± 0.05` reason `from plates`; ladder checklist **N/A**.
- No invented bars / features not in the plate pixels. No upscale of plates.

## Goal — visible volume, not painted relief
The phone must read real depth when looking at a facade from a 45° angle and from a grazing (~75°) angle. Painted cables on a flat slab are a FAIL even if `reliefM` AABB says 0.3 m.

### A) Build big facade volumes as REAL geometry
Feature locations from **Grok vision + SAM2 masks** on the full-face and lower plates. Depth magnitudes from **MoGe-2 scaled to metric** (tower is **174 m**) — not centimetre displacement maps.

For each face, extract and model at least these classes when present in the pixels (lower plates especially):
1. **Cable bundle** → real tubes / pipes protruding from the facade (**tens of cm to > 1 m** depending on the plate scale), not a bump on a heightfield.
2. **Chrome strip** → raised band / ledge proud of the wall (metric height from MoGe-2, typically tens of cm).
3. **Window / panel recesses** → sunk **tens of cm** into the wall (real inset geometry, not dark paint).
4. **Cornices / frames** → proud of the wall (metric from MoGe-2).
5. **Damage** → real broken / sheared geometry (missing chunks, not a cracked albedo).

Place each volume **exactly under its pixel feature** (snap edges to SAM2 mask outlines; report per-feature xy + protrusion metres in `work/features.json`). Texture = plate projected onto those volumes (UV stretch ≤ 1.3). No invented relief that is not in the pixels. Prefer hard-surface / Boolean / tube extrusions over a global centimetre displacement; a global heightfield that only moves vertices by a few cm on a 174 m tower will FAIL the new oblique check.

Extend `tools/imagine-to-3d` (auto.py / depth_relief.py / hard_surface.py or a new sibling under that tool) so the pipeline can produce these volumes from plates + MoGe-2 + SAM2. Do not drop a one-off script outside the tool tree.

### B) NEW BLOCKING gate check: `oblique-profile`
Add to `tools/object-gate` (gate.mjs + profile knobs + README/API):
- Name: **`oblique-profile`** (row label like `oblique-profile 45°/grazing`).
- For each face of the target object: render at **45°** and **grazing (~75°)** angles at **8 m**, **30 m**, and **hero** distance.
- Measure silhouette / profile deviation from the base plane along the face:
  - depth-buffer range across the face (metres), AND
  - silhouette edge roughness vs a flat-plane control render of the same AABB.
- **FAIL** if the face reads flat. Document thresholds in metres, **scaled to object size** (e.g. for a building of height H, require depth-buffer range across the face ≥ max(0.5 m, 0.003·H) at 45° / 8–30 m, and silhouette roughness above a flat-plane baseline by a clear margin — pick concrete numbers, write them in the profile and in REPORT). For this 174 m tower that means order-of-magnitude **≥ ~0.5–1 m** readable protrusion, not 0.3 m AABB.
- Also tighten the existing `facade relief` path so it **FAILS** when protrusion depth is below that same metric threshold (raise `minReliefM` for building / this scene, or make reliefM the actual max protrusion from the base plane, not a loose AABB). A flat textured box must fail both checks.
- **Self-test** in `tools/object-gate/selftest.mjs` (or a dedicated fixture): prove a **flat textured box FAILS** `oblique-profile` (and the tightened relief), and a **box with real protrusions (≥ threshold) PASSES**. Self-test must run and pass in this step.
- Wire the check into `tower-hero-vision-scene.yaml` (or the building profile) so the kit-gate line below exercises it.
- Emit captures under `steps/tower-volumes-1012/gate/oblique-*.png` and aggregate `oblique-sheet.jpg` (45° + grazing per face) into the step outdir.

### C) Bars
- object-gate on this outdir → **zero FAIL** (WARN allowed only for documented native-plate 8 m px/m).
- Keep fix4 wins listed above.
- `oblique-profile` PASS on every face at 45° and grazing for at least 8 m + 30 m (hero reported too).
- Self-test for oblique-profile + tightened relief PASS.
- Max 2 attempts. Never PASS on a blocking fail. Never claim volume from paint alone.

## Deliver — steps/tower-volumes-1012/  (MUST write even on failure)
- **REPORT.md** (honest PASS/FAIL; before/after vs fix4; per-face oblique depth-buffer range + silhouette roughness; feature list with metres; morph IoU; float; sealed; shadow ground px; UV; ΔE; checklist)
- **kit-gate-result.json** (+ .txt via Stop hook)
- **sheet-phone.jpg** (720×1600 beside key)
- **oblique-sheet.jpg** (45° + grazing views per face; required even on FAIL)
- work/features.json, numbers.json, turnaround.jpg, gate/ (incl. oblique captures), selftest proof log
- Tool + learn/ updates (ALWAYS IMPROVE — document why centimetre displacement failed the phone test and what oblique-profile catches). Local commits only on this branch. **Do NOT push, do NOT merge.** Do not touch fix4 outputs, the :8780 preview, or the Zone C solids worktree.
