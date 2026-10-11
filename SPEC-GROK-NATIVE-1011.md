# Grok-native test on ONE tower (11 Oct), new stage tools/grok-native/
Goal (SmiR): get the same results as MoGe-2/SAM2 using ONLY the xAI ecosystem + classic non-ML code we write. Read q31-answer.md (the plan from Grok chat), GROK.md, docs/METHOD/foundation-tools.md.
Inputs (already generated, DO NOT generate more Imagine images): /workspace/grok-native-1011/imagine/ (key-city3.jpg 1280x720; clay, seg, relight-left/right/top/front at 1792x1008: scale by 0.714 and re-register each to the key with classic feature/ECC alignment before use).
Target: the same fusion tower as tools/imagine-to-3d (zoneb-tower-hero).
1. Grok vision (xAI API, via the existing helper if one exists): camera/FOV, metric anchors (tower height vs dunes), feature boxes as JSON.
2. Masks: seeds from seg.jpg + Grok vision boxes, refined with classic GrabCut/graph-cut/edge-snapping (OpenCV). Grok vision checks the overlay (1-2 rounds).
3. Normals: classic photometric stereo from the 4 relights (registered), plus form from clay.jpg as a prior. Integrate the normals to a height map (Frankot-Chellappa or Poisson).
4. Geometry: a Grok-written Blender/three.js tower from silhouette + height + features, watertight, with the key image projected on top. Render-compare loop judged by Grok vision, at most 3 rounds.
5. BASELINE: run the same tower with MoGe-2 + SAM2 (foundation tools). Compare: mask IoU against SAM2, depth/normal error on the facade, relief/texture alignment, silhouette IoU against the key, time and cost per stage.
6. Deliver: a side-by-side sheet (Grok-native | MoGe/SAM | key) at 16:9 + phone, REPORT.md with the numbers and an honest verdict. Local commits. No new Imagine images.

## Addendum 13:02: read q31-followup-answer.md. Also try the "scan-then-code" path: a Grok-vision scene graph + clay measurements, then PARAMETRIC tower code (no dense mesh), and report its time and accuracy next to the other two.
