# Hires-tower step — hero tower re-skinned from the 1024-class face plates, colour + grounding + depth fixed (11 Oct)

SmiR approved ONE step (bot-army brainstorm, `/workspace/bolt-army/BRIEF-1011.md`). Placement is NOT in this step (do not touch the staging layout).
Read FIRST: steps/multiview-tower-1011/REPORT.md + numbers.json + turnaround.jpg + sheet-phone.jpg + gate/report.md (this is the BASE), SPEC-MULTIVIEW-TOWER-1011.md, GROK.md, tools/common/align/README.md, tools/imagine-to-3d/README.md.
Key image: `/workspace/zb-bible-1008/key-city3.jpg`. Run and extend the repo tools (tools/common/align/ metrics.py strict_score, camera.py, relief.py; tools/imagine-to-3d/ fusion.py, vision_mesh.py, moge_depth.py; tools/object-gate/; tools/placement-from-key/ sam2/moge helpers). Import, never copy code; never a hand recipe.

## Base (multiview-tower-1011, kept)
Watertight solid 9672 tris, 0 open edges, h/w 3.699, relief on 4 faces (gate +x 0.517 / −x 0.443 / +z 0.163 / −z 0.32), float 2.45 m at (87.8, −98.7), d/w 0.79, gate5 11/21 FAIL, vision not called (frames black). Installed at `kc-staging/zb-tower3/objects1/vision/tower.glb`. Keep the visual-hull shape; change only what the goals below need.

## New face plates (Imagine, 11 Oct 17:40–17:45, verified on disk) — ZERO new Imagine in this step
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/face-front-1024.jpg` — 720×1280 (Imagine returned it smaller; use as is, never upscale-and-claim).
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/face-back-1024.jpg` — 1008×1792.
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/face-right-1024.jpg` — 1008×1792 (narrow stone side with cables).
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/face-left-1024.jpg` — 1008×1792 = face-right mirrored (SmiR decision). Record it as "mirrored right" in the report.
- `face-left-REJECTED.jpg` in the same folder MUST NOT be used for anything.
First open and describe each plate (what face it paints, isolation on neutral bg, full height or not, crown/base visible) and confirm it matches the corresponding sheet panel (NCC / silhouette h/w vs the multiview panel). If a plate does not show its face, REPORT it and leave the old panel for that face (honest FAIL) — never invent.

## Goals
1. Hi-res skin. Replace the low-res sheet panels (≈2.4 px/m) with the new plates. Keep the visual-hull shape. Mask each plate (SAM2; say which fallback if any), rectify to its face (orthographic, vertical edges vertical, ground line level, same height as the solid), reproject each face's OWN plate at NATIVE resolution (never downscale; atlas size follows the plates; a phone texture budget overrun is reported, not solved by downscaling). Relief per face from MoGe-2 on that face's own plate only (moge_depth.py; DA V2 internal comparison only). Seam colour-match as before (Reinhard on overlap strip, logged ΔE before/after, feathered). The front region visible in the key keeps the key projection where it covers; the new front plate fills only what the key does not cover. Report px/m per face (target: ≥ 4× the multiview 2.4 px/m).
2. Colour / lighting. The play and gate captures were near black / reddish (gate Lab 0.1, 0.5, −0.1 vs key 34.9, 11.4, 0.6). Find the root cause (material type / lights / colour space sRGB vs linear / flipY / normal map sign / exposure / tone mapping) and fix it in the tool, not by hand. Bars: ortho captures albedo Lab ΔE vs the matching plate < 10; 8 m capture not black (mean L* > 15); visible px/m measured > 0. Re-check that atlas orientation in three.js (flipY false) matches the Blender renders.
3. Grounding. Worst float < 0.5 m at every probe column, never buried. If the terrain under the footprint is a pit, flatten a small plinth from the terrain tile under the footprint (record the edit, keep it local) rather than float or bury.
4. Proportions. d/w into 0.45–0.70 using the side plates' widths at the same height as the front width (key). Fix the geometry from the plates, never by stretching textures. Report h/w (stay 3–5) and d/w.
5. Ladder. Only if a plate actually paints it (check front/back/right plates). Otherwise record "ladder not painted" and leave the checklist item as FAIL — do not invent geometry.

## Bars (blocking) — max 3 rounds, cheap 2D checks before Blender/browser
- gate5 (`tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml`, fusion page) → ZERO fails.
- `strict_score` (metrics.py, with the Grok-vision yes/no) ≥ 0.70 on EVERY view: key, hero, 30 m, 8 m, side. Only call vision once captures are not black. Grok vision total < $0.10 for the whole step, cached by image hash, logged in learn/quota-log.md.
- UV stretch ≤ 1.3 on all faces, watertight, float < 0.5 m, h/w 3–5, d/w 0.45–0.70, relief non-zero on every visible axis, phone budget passes (hero 1 draw call).
If a bar is missed after 3 rounds: finish the tools, report honest numbers and stop. Never loosen a bar or a metric.

## Rules (all SmiR, binding)
Relief ONLY from the painted pixels of the exact Imagine image, never invented or procedural-on-top. MoGe-2 (MIT) default depth; SAM2 ok; DA V2 internal only. ZERO new Imagine generation. Textures native res, no UV stretch > 1.3. Dense triangles near the player; cut only hidden/off-screen/far; LOD keeps identical silhouette. Local commits only on this branch; live tree (live game main.mjs) untouched; never push, merge, or reset --hard. Never nvdiffrast. Record licences in tool READMEs. Placement/staging layout is out of scope.

## Report — steps/hires-tower-1011/
- `REPORT.md`: honest PASS/FAIL, before (multiview-tower-1011 numbers) vs after per view: strict_score, vision yes/no, px/m per face, Lab ΔE per ortho capture, colour root cause + fix, relief per axis, h/w d/w, float + plinth edit, UV stretch per face, ladder finding, gate5 full fail list, phone budget (texture MB), seam ΔE, which plate fed which face, rounds, seconds, Grok vision cost.
- `numbers.json` (same keys as multiview-tower-1011 numbers.json plus per-face px/m and ΔE).
- `sheet-phone.jpg`: phone portrait play render beside the key crop.
- `turnaround.jpg`: 4-angle turnaround (front, left, back, right) beside the 4 face plates, RE-RENDERED from the final installed glb after any UV change (same orientation as three.js sees it).
If the tower passes all gates, run the dataset export (dataset/i23d/...). Append the lesson to learn/failures.md or learn/recipes/, update tool READMEs. Commit locally.
