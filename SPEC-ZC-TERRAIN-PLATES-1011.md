# Zone C step 3: moss slab plates on the terrain (`zc/03-terrain`, 11 Oct, SmiR approved 20:10)

Zone C "Cascade Verdance". Bible: /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md (rules 1-9 apply).
Branch `zc/03-terrain` (PR #203 open, NOT merged). This step continues on it.

## Read first
GROK.md, docs/METHOD.md, docs/METHOD/terrain-from-key.md, learn/failures.md, learn/geometry.md, tools/terrain-from-key/README.md,
SPEC-ZC-TERRAIN-1011.md (previous step), steps/zone-c/03-terrain/REPORT.md + numbers.json + object-gate/report.md.

## Base (previous attempt, kept field)
Path IoU 0.7704 PASS; slope 15.5 deg, width, relief, LOD pop all pass; 1 draw call.
OPEN: UV stretch p95 1.25 at 0-8 m but 16.7 (8-30 m), 74 (30-60 m), 93 (>60 m) because the far ribbon reuses one pixel row of the key.
Object-gate FAIL: baked albedo too small (113x205), visible px/m, repetition. Render shows a blurry causeway on black.

## Inputs (FIXED, already committed)
4 Imagine top-down plates, 1408x1408 each, edits of key-zc1.jpg, in `steps/zone-c/03-terrain/plates/` (SHA256SUMS beside them):
- moss-top-1.jpg: clean slabs, moss joints
- moss-top-2.jpg: heavy moss
- moss-top-3.jpg: cracked slabs
- moss-top-4.jpg: fallen leaves
No other new Imagine images. No hand-typed colours, no procedural textures (pixels = key-zc1 + these 4 plates only).
Camera, masks and the kept height field are FIXED (do not re-solve, re-segment or regrow the field).

## Build (extend tools/terrain-from-key only: run.py / causeway_field.py / build_field.py / gates.py / keyed-field.mjs / features.json; NO side script)
1. Near band: keep the key projection only where the key has enough px/m (measure px/m per ground cell; the cutoff is a measured threshold, written in numbers.json).
2. Beyond: the 4 plates as world-space tiling at native resolution (1408 px, no downscale), full mipmaps + anisotropic filtering (max the device allows, 16 on desktop gate).
3. Seam: blend to the key colour over a soft band (no visible line at the key/plate boundary).
4. Plate choice per tile by graph-colouring: no neighbour within 7 m reuses the same plate. Random rotation/flip by 90 deg per tile (seeded, deterministic).
5. Macro variation from the key colours (low-frequency tint taken from key-zc1 path pixels) so the tiling does not read as repeated.
6. Background: neutral non-black (cliffs and sky are later steps and stay absent) so the path reads.
7. Plates in the Zone C World Graph JSON (zone-c.zone.json) as terrain material inputs; validate zone.v1.

## Verify (blocking; real headless renders after the loading screen is gone)
| Check | Need |
| --- | --- |
| UV stretch p95 at +8, +30, +60 m and during a lane change | <= 1.3 each |
| Visible px/m at 8 m | meets the object-gate threshold |
| Repetition check (object-gate) | pass |
| Path IoU at key camera vs causeway mask | >= 0.75 |
| Draw calls (scene) | <= 12 |
| LOD silhouette (approach-sequence pop) | unchanged vs base (>= 0.90 each) |
| Colour deltaE (CIEDE2000 or the repo's metric, state which) of path vs key at key camera | < 10 |
Renders at the key camera, +8, +30, +60 m; sheets 16:9 and phone portrait 720x1600 with the key beside them. Report triangles near/mid/far, timings per stage, cost (4 Imagine images, already made).
Staging server: `tools/terrain-from-key/serve.py --port 8771` (NOT 8996, 8994, 8997, 8981, 8982). Live index.html untouched.

Max 2 attempts. Never write PASS if any blocking row fails. Stop at PASS or after 2 attempts with an honest REPORT.md (before/after table vs the base numbers above).

## Deliver
- steps/zone-c/03-terrain/: REPORT.md updated (plates section, before/after), numbers.json, renders, sheets, object-gate report.
- learn/ and tools/terrain-from-key/README.md updates for anything learned (ALWAYS IMPROVE).
- Local commits on `zc/03-terrain`. Do NOT push, do NOT merge, do NOT touch other worktrees (tower step runs in wt/tower-vision-1010).
