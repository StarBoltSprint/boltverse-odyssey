# Zone C step 2: `zc/03-terrain` (11 Oct, SmiR approved 18:57)

Zone C "Cascade Verdance". Bible: /workspace/zc-bible-1011/PROMPT-GROK-BUILD-ZONE-C.md (rules 1-9 apply).
Key image: `steps/zone-c/03-terrain/key-zc1.jpg` (copy of /workspace/zc-bible-1011/key-zc1.jpg; the camera/masks JSON still say /workspace/attachments/key-zc1.jpg, which no longer exists: point them at the repo copy).
Order of the approved 15-image plan: camera (#199, merged) -> masks (#200, merged) -> **terrain (this step)** -> step 3: 4 top-down moss slab plates (Imagine) -> sky -> placement -> objects -> light/atmosphere.

## Read first
GROK.md, docs/METHOD.md, docs/METHOD/terrain-from-key.md, learn/failures.md, learn/geometry.md, tools/terrain-from-key/README.md,
steps/zone-c/01-camera/REPORT.md + camera.json + moge-ground.json, steps/zone-c/02-masks/REPORT.md + masks.json.

## Scope
- Inputs are FIXED: camera from PR #199 (`steps/zone-c/01-camera/camera.json`, MoGe-2 lock: vfov 51.47, eye 1.508 m, pitch +7.95, horizon row 0.645) and masks from PR #200 (`steps/zone-c/02-masks/`: causeway = walkable path; cliff-left/right, gorge-rock, arches, foliage, falls-water, planet = NOT terrain). Do not re-solve the camera or re-segment.
- The key only gives the walkable mossy path ribbon (causeway). Terrain = that ribbon plus a plain base under it. Cliffs, arches, gorge rock and foliage are NOT terrain relief (method cap 3 m relief); they become imagine-to-3d solids in later steps. Leave their footprint as flat placeholder base, no cliffs grown from the heightfield.
- Depth = MoGe-2 (MIT) only, via tools/common/vision_models.py. Depth Anything V2 Large is allowed ONLY as an internal comparison number in REPORT.md, never in outputs, renders or the shipped field.
- Pixels: existing ground tiles and key-zc1 pixels only. NO new Imagine images in this step (the 4 top-down moss slab plates come in step 3). No hand-typed colours, no procedural textures.
- Tool: extend `tools/terrain-from-key` (run.py, build_field.py, gates.py, features.json; the README lists `causeway_field.py` but it is missing on main: create it inside the tool and wire it into run.py with a `--zone c` / causeway mode). Never a side script, never a hand recipe. Use tools/object-gate and tools/world-graph where they apply (add the terrain to the Zone C World Graph JSON).

## Build
1. Ground shape matching the key: rises, dips and steps of the path as painted (from MoGe-2 metric depth on causeway pixels + the slab lips in the causeway mask), relief <= 3 m.
2. Playable corridor: continuous walkable ribbon along the causeway, slope <= 16 deg, no invisible walls, edges blended (no sticker edges).
3. LODs on the same hull: no silhouette pop / morph (approach-sequence test), max triangles near the player and in view, fewer far and hidden.
4. Phone budget: under 80 draw calls for the scene, report triangles per LOD.
5. Staging: if you need a local server, use `tools/terrain-from-key/serve.py --port 8771` (NOT 8996, 8994, 8997, 8981, 8982: other steps use them). Live index.html untouched.

## Verify (blocking, real headless renders after the loading screen is gone)
- Renders at the key camera and at +8, +30, +60 m along the path; before/after sheet next to the key (16:9 + phone portrait 720x1600).
- Key-camera IoU of the rendered path vs the causeway mask (target >= 0.75; report the number).
- UV stretch per distance band (0-8, 8-30, 30-60, 60+ m). Expect still > 1.3 far until the moss plates exist: report it honestly as a known open item, not a pass.
- Draw calls, triangles (near / mid / far), gates.py results, approach-sequence LOD pop result, timing per stage.
- Never write PASS if any blocking check fails. Stop at PASS or after 2 attempts with an honest REPORT.md.

## Deliver
- steps/zone-c/03-terrain/: REPORT.md (numbers before/after, time, cost: 0 Imagine), sheets, renders, numbers.json.
- learn/ and README updates for anything learned (ALWAYS IMPROVE).
- Local commits on branch `zc/03-terrain`. Do NOT push, do NOT merge, do NOT touch other worktrees (tower step runs in wt/tower-vision-1010). The orchestrator pushes and opens the PR.
