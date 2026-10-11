# Scene-strict step — rebuild the Zone B scene like the key + strict facade measure (11 Oct)

SmiR approved ONE step doing both: (A) make the staging scene look like the key, (B) harden the facade measure so a bad mesh cannot pass.
Read FIRST: steps/week2-1011/REPORT.md + numbers.json + both phone sheets (`sheet-phone.jpg`, `placement-sheet-phone.jpg`), steps/terrain-key2-1011/REPORT.md, GROK.md, tools/common/align/README.md.
Key image: `/workspace/zb-bible-1008/key-city3.jpg`. Run and extend the tools (tools/common/align/, tools/placement-from-key/, tools/imagine-to-3d/, tools/object-gate/, tools/terrain-from-key/). Import the existing metrics.py / camera.py / search.py — no copied code, never a hand recipe.

Week-2 honest diagnosis (from SmiR's review of the sheets): facade numbers 0.704–0.743 are MISLEADING — on the phone sheet the Grok tower reads as a column of horizontal stripes and the MoGe-2 version is in pieces; neither looks like the key towers, so metrics.py is too lenient. Side relief is 0. Placement 0.32 framebuffer: the camera is right now, the SCENE is wrong — the shot faces a cliff on the right, towers are packed to the left, almost no sky (skyTop 0.27). The key shows an avenue in the centre, towers on BOTH sides, lots of sky.

The worktree already has cursor/terrain-key-1011 merged (commit f0dffca0): the PASSed terrain-key2 heightfield is `steps/terrain-key2-1011/data/height.{bin,json}`, staging under tools/terrain-from-key/staging/. MoGe-2 is now the depth default (`vision_models.DEFAULT_DEPTH`, `load_default_depth()`). Note: tools/imagine-to-3d/fusion.py still calls `DR.disparity(None, "dav2-large", ...)` — any shipped relief must go through MoGe-2 instead; fix that call path if this step uses it.

Rules (all SmiR, binding): relief ONLY from the painted pixels of the exact Imagine image, sitting under its pixel feature, never invented or procedural-on-top. MoGe-2 (MIT) default depth; DA V2 Large internal comparison only; SAM2 ok. ZERO new Imagine generation (use the multi-view plates already on disk). Textures at native res, no UV stretch > 1.3. Dense triangles near the player; cut only hidden/off-screen/far; LOD swaps keep identical silhouette. Phone budget must pass. Local commits only on this branch; live tree (main.mjs of the live game) untouched; never push, merge, or reset --hard. Grok vision total < $0.10 for the whole step, logged in learn/quota-log.md. Never nvdiffrast. Record licences in tool READMEs.

## PART A — scene layout like the key (placement)
Rebuild the Zone B staging layout to match key-city3.jpg:
1. Sunken avenue axis in the centre of frame, running toward the low sun.
2. Towers lining BOTH sides of the avenue — the right-hand blade row MUST be present.
3. Ringed spire in front of the sun.
4. Mesas framing left and right at distance.
5. Dunes on the sides from the PASSed terrain-key2 heightfield (do not rebake the terrain).
6. Wreck and rail in the near sand.
7. Lots of sky: sky in the top ~45% of the frame like the key (measure the key's sky fraction with the existing mask; target within 0.1).
Camera: standing IN the avenue using the solved week-2 camera (FOV 88°, pitch ≈7.7° down, eye 1.77 m above the local terrain, roll 0.17°) looking down the avenue axis — NOT facing a cliff. Re-derive the shot yaw/position from the avenue axis in the heightfield, not from the old yaw 78°.
Each object's image position and depth order come from SAM2 instance masks + MoGe-2 depth on the key (tools/placement-from-key: sam2_boxes.py, moge_depth.py, depth_lift.py). Unproject each mask's foot/centroid through the solved camera to get world x/z and scale; ground every object on the heightfield (no floating/sinking).
Search: CMA-ES (search.py) must evaluate on the REAL staging framebuffer — headless three.js capture of the staging page after the scene-ready signal — NOT software boxes. Batch/cached captures are fine; keep max 3 rounds per job. Log trials to jsonl.
Phone: instancing so the staging scene is ≤ 12 draw calls on the phone portrait frame (report renderer.info).
Bar (blocking): weighted silhouette IoU ≥ 0.75 on the staging framebuffer vs key masks, ZERO inverted depth pairs (vs MoGe-2 order), sky fraction within 0.1 of the key, draw calls ≤ 12 on phone, no float/sink > 0.5 m.

## PART B — strict facade measure + side relief
1. Add a BLOCKING visual check to tools/common/align/metrics.py (new `strict` score; the old score stays as a component) so a striped, fragmented or stair-stepped mesh cannot pass 0.70. At least:
   - outline continuity / connected-component count of the rendered silhouette (and of its edge map) vs the key crop;
   - horizontal-stripe periodicity detection (row-profile FFT / autocorrelation peak) — penalise bands not present in the key crop;
   - edge-orientation histogram match vs the key tower crop;
   - a Grok vision yes/no gate "does this render look like the tower in the key crop?" (cheap, one call per view at most, total < $0.10, cached by image hash, logged).
   Add selftests: the week-2 striped Grok render and the fragmented MoGe-2 render MUST FAIL the strict check; the key crop itself (and a clean extruded silhouette of the key mask) MUST PASS. Re-score week-2's renders and report the strict numbers as the new "before".
2. Relief on side faces only from the painted pixels of the SIDE Imagine plates already on disk (existing multi-view plates — find them in the fusion/fusion-fix steps' inputs). Project each side plate onto its own face; no new Imagine image; nothing invented where no painted feature exists. Report relief per axis honestly (+x, −x, +z, −z); target ≥ 0.3 m on features and non-zero on every visible axis.
3. Point gate5 at THIS mesh: fix tools/object-gate/specs/zone-b/tower-hero-vision-scene.yaml (it still points at the tower3-1010 page) so it loads the scene-strict facade mesh; run gate5 and report every fail.
4. Re-measure browser grounding on this mesh (float < 0.5 m; it was 74 m before).
Bar (blocking): strict metric ≥ 0.70 on EVERY view (key, hero, 30 m, 8 m, side), real relief on every visible axis, gate5 zero fails, browser float < 0.5 m, phone budget passes.

If a bar is missed: finish the tools, report honest numbers and stop. Do not loosen a bar or a metric to pass.

## Report — steps/scene-strict-1011/REPORT.md + numbers.json
Honest PASS/FAIL per job (facade, placement). Before (week-2 numbers AND week-2 renders re-scored with the strict metric) vs after, per view. Sky fraction key vs render. Depth-pair list. Draw calls. Relief per axis. gate5 output. Browser float. Trials, seconds, Grok vision cost.
Sheets REQUIRED: `steps/scene-strict-1011/sheet-phone.jpg` (facade, phone portrait play render beside the key) and `steps/scene-strict-1011/placement-sheet-phone.jpg` (staging phone portrait beside key-city3), plus `sheet-16x9.jpg`. If the facade passes all gates, run the dataset export (dataset/i23d/...). Append the lesson to learn/failures.md or learn/recipes/, update tool READMEs. Commit locally.
