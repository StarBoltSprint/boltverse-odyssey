# Multiview-tower step — hero tower as ONE watertight solid from the 10-Oct multi-view Imagine plates (11 Oct)

SmiR approved ONE step: build the Zone B hero tower from the real hidden-face Imagine images. Placement is NOT in this step (do not touch the staging layout).
Read FIRST: steps/scene-strict-1011/REPORT.md + numbers.json + sheet-phone.jpg, steps/week2-1011/REPORT.md, GROK.md, tools/common/align/README.md, tools/imagine-to-3d/README.md.
Key image: `/workspace/zb-bible-1008/key-city3.jpg`. Run and extend the repo tools (tools/common/align/ metrics.py strict_score, camera.py, search.py, relief.py; tools/imagine-to-3d/ fusion.py; tools/object-gate/; tools/placement-from-key/ sam2/moge helpers). Import, never copy code; never a hand recipe.

## Diagnosis (why every step so far failed)
Every step looked for the tower's side faces in the 4 relight plates `/workspace/grok-native-1011/imagine/relight-*.jpg`. Those are ALL FRONT views (left/right name the light, not the face). So the sides never had a real image: zero relief on +x/−x/+z, stretched pixels, h/w 1.91, d/w 0.25. Do NOT use the relight plates for any side/back/top face.

## The real multi-view plates (generated with Imagine on 10 Oct, verified on disk)
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/sheet-turnaround.jpg` (1792×1008) — ONE orthographic turnaround sheet, 4 equal panels left→right on light grey: **1 front, 2 left profile, 3 back, 4 right profile** (prompt + panel order in `/workspace/i23d-auto/zoneb-tower-hero/imagine-requests.json`, id `sheet-turnaround`). Front panel is a check only; the key projection stays the front.
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-top.jpg` (1152×1728) — requested as orthographic top-down roof view. WARNING: on inspection it looks like a raised 3/4 view of the tower, not a clean roof plan. Verify what it actually paints; use only the roof/crown pixels it really shows.
- `/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-under.jpg` (1152×1728) — under-ledge / soffit view (looks like two crops: upper soffits and the crown). Verify and use only what it really paints, for the bottom/under-ledge faces.
- Already cut panels from an earlier run (check they match the sheet before reuse): `/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-left.jpg`, `_src-view-back.jpg`, `_src-view-right.jpg` (720×1280) with rembg masks `*.rembg.png`.
If a plate does not show the face it is supposed to show, REPORT it and leave that face out (honest FAIL) — never invent a face. ZERO new Imagine generation in this step.

## Goal — hero tower as one watertight solid
1. Front: key-city3 projection through the solved camera (FOV 88°, pitch −7.7°, eye 1.77 m, roll 0.17° — the week-2/scene-strict camera; import camera.py).
2. Sides/back: from the matching panel of the turnaround sheet. Split the sheet into its 4 panels (auto-detect the grey gutters, not fixed quarters), mask with SAM2 (rembg ok as a fallback, say which), rectify each panel to its face (orthographic, vertical edges vertical, ground line level, same height as the key front), colour-match the panel's edges to the key front (histogram / Reinhard on the overlapping strip, logged), blend the seams (feathered, no visible line at the corners).
3. Top/bottom: from view-top / view-under, only where they really paint the roof/soffits.
4. Outline and proportions: from Grok-vision measurement of the key crop + the multi-view silhouettes (front width from the key, depth from the left/right profile widths at the same height). Gate bars: h/w 3–5, d/w 0.45–0.70. Fix the proportions from the plates, never by stretching textures.
5. Relief on each face ONLY from that face's own painted pixels: MoGe-2 on each plate for metric relief (vision_models DEFAULT_DEPTH / load_default_depth), SAM2 masks for features (ledges, broken sections, cables). Replace the `DR.disparity(None, "dav2-large", ...)` calls in tools/imagine-to-3d/fusion.py (lines ~608–630) with the MoGe-2 path; DA V2 Large stays an internal comparison only. Report relief per axis (+x, −x, +z, −z, +y): target ≥ 0.3 m on features and non-zero on every visible axis.
6. Grounding: seat the solid on the terrain-key2 heightfield at the tower footprint. No 44 m float: bar float < 0.5 m on every probe column. If the terrain under the footprint is a pit (the 458.5, −507.5 column), flatten a small plinth from the terrain tile under the footprint (record the edit, keep it local to the footprint) rather than float or bury the body.
7. Textures at native plate resolution, UV stretch ≤ 1.3 on ALL faces (the gate measured 7.8 / 99 before). Watertight: no holes, no black faces in ortho captures.

## Bars (blocking) — max 3 rounds, cheap 2D checks before Blender
- gate5 (`tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml`, already on the fusion page) → ZERO fails (it had 12/21 fails in scene-strict).
- `strict_score` (metrics.py, with the Grok-vision yes/no) ≥ 0.70 on EVERY view: key, hero, 30 m, 8 m, side.
- Proportions h/w 3–5, d/w 0.45–0.70; relief non-zero on every visible axis; float < 0.5 m; UV stretch ≤ 1.3; phone budget passes (hero alone, 1 draw call target).
Before each round, run the cheap 2D checks (panel split, silhouette IoU of each panel vs its rendered face, colour delta at seams, stripe detector) and only go to Blender/browser when they pass.
If a bar is missed after 3 rounds: finish the tools, report honest numbers and stop. Never loosen a bar or a metric.

## Rules (all SmiR, binding)
Relief ONLY from the painted pixels of the exact Imagine image, under its pixel feature, never invented or procedural-on-top. MoGe-2 (MIT) default depth; SAM2 ok; DA V2 internal only. ZERO new Imagine generation. Textures native res, no UV stretch > 1.3. Dense triangles near the player; cut only hidden/off-screen/far; LOD keeps identical silhouette. Phone budget must pass. Local commits only on this branch; live tree (live game main.mjs) untouched; never push, merge, or reset --hard. Grok vision total < $0.10 for the whole step, cached by image hash, logged in learn/quota-log.md. Never nvdiffrast. Record licences in tool READMEs. Placement/staging layout is out of scope.

## Report — steps/multiview-tower-1011/
- `REPORT.md`: honest PASS/FAIL, before (scene-strict numbers) vs after per view: strict_score, vision yes/no, relief per axis, proportions h/w d/w, float, UV stretch per face, gate5 full fail list, phone budget, seam colour deltas, which plate fed which face, what each plate really showed (esp. view-top), rounds, seconds, Grok vision cost.
- `numbers.json` (same keys as scene-strict numbers.json plus per-face data).
- `sheet-phone.jpg`: phone portrait play render beside the key crop.
- `turnaround.jpg`: 4-angle turnaround of the built solid (front, left, back, right) beside the 4 sheet panels.
If the facade passes all gates, run the dataset export (dataset/i23d/...). Append the lesson to learn/failures.md or learn/recipes/, update tool READMEs. Commit locally.
