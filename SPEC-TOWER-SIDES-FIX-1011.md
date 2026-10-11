# Tower-sides-fix step — side skins unlit at native res, UVs re-unwrapped, back = mirrored right, contact shadow (11 Oct)

SmiR approved ONE step (11 Oct 20:10). Placement is NOT in this step (do not touch the staging layout). Max 2 attempts.
Read FIRST: steps/hires-tower-1011/REPORT.md + numbers.json + gate/report.md + turnaround.jpg + sheet-phone.jpg (this is the BASE), SPEC-HIRES-TOWER-1011.md, GROK.md, tools/imagine-to-3d/README.md, tools/object-gate/README.md, tools/common/align/README.md.
Key image: `/workspace/zb-bible-1008/key-city3.jpg`. RUN and EXTEND the repo tools (tools/imagine-to-3d/ fusion.py, vision_mesh.py, moge_depth.py; tools/object-gate/ gate.mjs, key-compare.mjs, visible-shot.mjs, specs/zone-b/tower-hero-vision-scene.yaml; tools/common/align/ metrics.py strict_score). Import, never copy code. NO hand recipe: every fix lands in a tool so the next object gets it for free.

## Base (hires-tower-1011, kept)
Watertight 9796 tris, 0 open, h/w 3.711, float 0.00 m (keep it), front ΔE 7.73 / 9.81 (keep it: MeshBasicMaterial toneMapped:false + readRT SRGBColorSpace). Gate5 9/21 FAIL. Sides ΔE 40.6 / 43.2 (capture L* 81.9 vs plate 41.7). UV stretch p95 +x 4.63, −x 6.15, +y 10.15. Visible px/m at 8 m = 0 vs 154.6. −z relief 0.002 (back plate rejected: it is a second front). No shadow (0 px). Ladder not painted. Vision said no on every view; hero/30 m were the same grazing shot on the glass grid.

## Plates — ZERO new Imagine in this step
In `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/`:
- `face-front-1024.jpg` 720×1280 → +z (as before, keep).
- `face-right-1024.jpg` 1008×1792 → +x.
- `face-left-1024.jpg` 1008×1792 = right mirrored → −x (record "mirrored right").
- BACK (−z) = `face-right-1024.jpg` MIRRORED (SmiR rule, same as the left: no new Imagine). `face-back-1024.jpg` stays unused (it is a second front). Record it.
- TOP (+y): if `view-top.jpg` truly shows this tower's roof (open and describe it first; verify silhouette/footprint vs the mesh top), use it. Otherwise crop the roof edge band of the plate(s) — never a stretched row.
- `face-left-REJECTED.jpg` MUST NOT be used for anything.

## Goals
1. Sides colour. Skin +x / −x (and −z) each with its OWN 1008×1792 plate at NATIVE resolution, UNLIT, through the SAME shading path as the front that passed (MeshBasicMaterial, toneMapped false, sRGB map, readRT sRGB). Find why sides came out ~4× paler and fix it in the tool. Lead from the base report: the Reinhard seam match onto the key front lifted the whole stone body off its plate; also check side materials for a lit/tonemapped path or wrong colour space. Seam matching may only touch a feathered strip at the edges, never the face body. Bar: ortho Lab ΔE vs its own plate < 10 PER FACE (+z, +x, −x, −z), logged.
2. UV stretch ≤ 1.3 p95 on +x, −x, −z, +y (and keep +z, −y). Re-unwrap per face as a planar projection matched to the plate aspect (tapered sides: map the plate's masked silhouette rows to the mesh rows, do not use the full texture width at every height). Never downscale, never upscale-and-claim.
3. Back. −z relief from MoGe-2 on the mirrored right plate only (moge_depth.py). Relief non-zero on every visible axis.
4. Visible px/m at 8 m > 0, reported PER FACE. First check whether the 0 is a measuring bug: gate cameras must actually frame the tower (≥ 25% coverage), not a grazing angle on the glass grid, and the albedo-8m camera must be the same camera as cap-visible-8m. Fix the cameras/measurement in object-gate if wrong (record before/after). The true value from native plates is what it is: report it, never fake it; if the 154.6 target is unreachable without new Imagine, say so with the number.
5. d/w. Report what the plates' measured widths say (side width / front width at the same height). If the plates truly say ~0.86, record it and PROPOSE in REPORT relaxing the bar to the plate value — do not squash the mesh, do not change the bar yourself. SmiR decides. This is the only fail allowed to remain pending.
6. Contact shadow. Fixed neutral contact shadow under the tower (house rules: fixed, neutral, not baked into the albedo), extended in the tool/runtime, and the gate shadow row must measure it (> 0 px).
7. Ladder stays "not painted". Mark that gate checklist item N/A with the reason (no plate paints it) ONLY if the gate supports N/A from plate evidence (key-compare.mjs already skips verdict "N/A" — verify it is a supported, documented path, not a loophole). Otherwise leave it FAIL.

## Bars (blocking)
- gate5 (`tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml`, fusion page) → ZERO fails, except the d/w row pending SmiR.
- `strict_score` (metrics.py with Grok-vision yes/no) ≥ 0.70 on EVERY view: key, hero, 30 m, 8 m, side. Hero and 30 m must be different, non-grazing cameras framing the tower. Grok vision ≤ $0.10 for the step, ≤ 3 rounds, cached by image hash, logged in learn/quota-log.md.
- UV ≤ 1.3, watertight, float < 0.5 m, h/w 3–5, relief non-zero on every visible axis, phone budget passes (hero 1 draw call).
- Turnaround RE-RENDERED from the final installed glb (three.js, same orientation as the game).
Max 2 attempts. If a bar is still missed: finish the tools, report honest numbers and stop. Never loosen a bar or a metric. Never PASS if a blocking check fails.

## Rules (all SmiR, binding)
Relief ONLY from the painted pixels of the exact Imagine image. MoGe-2 (MIT) default depth; SAM2 ok; DA V2 internal only. ZERO new Imagine. Native-res textures. Dense triangles near the player; LOD keeps identical silhouette. Local commits only on this branch; live tree untouched; never push, merge, or reset --hard. Never nvdiffrast. Placement/staging layout out of scope.

## Report — steps/tower-sides-fix-1011/
- `REPORT.md`: honest PASS/FAIL; before (hires-tower-1011) vs after per view: strict_score, vision yes/no + cost; Lab ΔE per face; side-paleness root cause + fix; UV stretch per face; px/m (texture) and visible px/m at 8 m per face, plus the measurement-bug finding; relief per axis; h/w, d/w with the plate-width evidence and the bar proposal; float; shadow px; ladder N/A decision; gate5 full fail list; phone budget (texture MB, draw calls, tris); which plate fed which face; attempts; seconds.
- `numbers.json` (same keys as hires-tower-1011 numbers.json plus per-face ΔE, UV, px/m, visible px/m).
- `sheet-phone.jpg`: phone portrait play render beside the key crop.
- `turnaround.jpg`: 4-angle turnaround (front, left, back, right) beside the plates used, from the final glb.
Append the lesson to learn/failures.md or learn/recipes/, update tool READMEs. Commit locally.
