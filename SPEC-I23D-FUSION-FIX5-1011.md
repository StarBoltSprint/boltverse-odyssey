# Fusion fix 5 — new method: Grok-native solid + SAM2 mask + photometric relief (11 Oct)

Zone B hero tower facade (zoneb-tower-hero, the broad slab just left of the road centre in key-city3). This is a CHANGE OF METHOD, not a 5th retry of the old one.
Why: fix 4 (steps/fusion-fix3-1011/REPORT.md) failed a 4th time: 112-triangle prism, relief 0 on every axis, alignment hero 0.53 / 30 m 0.53 / 8 m 0.53 (bar 0.70). The Grok-native test (branch cursor/grok-native-1011, /workspace/grokcli/wt/grok-native-1011/steps/grok-native-1011/REPORT.md + numbers.json) gave a watertight textured solid, mask IoU 0.749 vs SAM2, parametric prism silhouette 0.79, photometric normals from 4 Imagine relights, $0.02 of Grok vision; but its mask leaked into neighbour blades and fine relief was coarse. Merge the two.

Local commits only on this branch. NO new Imagine generation (zero Imagine calls). Live tree untouched. Never push, merge to main, or reset --hard. Keep Grok vision calls lean (target < $0.20 total; log cost per call in numbers.json and learn/quota-log.md).

## FIRST STEP
`git merge cursor/grok-native-1011` into this branch. It conflicts only in learn/failures.md and learn/quota-log.md: keep BOTH sides (all entries). Run tools/grok-native/selftest.py and the existing imagine-to-3d / object-gate selftests, commit the merge, then continue.

## Inputs (all existing)
- Key: key-city3.jpg (also /workspace/grok-native-1011/imagine/key-city3.jpg).
- Relights + clay + seg plates: /workspace/grok-native-1011/imagine/ (relight-left/right/top/front, clay, seg). Registration recipe: tools/grok-native/register.py (relight-front NCC 0.45 — down-weight or drop it if it hurts the normals; say which).
- Hidden-face plates: the existing multi-view Imagine plates already used by tools/imagine-to-3d for this tower (see /workspace/i23d-auto/zoneb-tower-vision/inputs.json and imagine-requests.json).
- Grok-native cached outputs: /workspace/grokcli/wt/grok-native-1011/steps/grok-native-1011/work/ (vision.json, pick.json, proposals.json, parametric/, normals.npy, moge.npy, sam.npy). Reuse the vision cache; re-call Grok vision only where this spec needs new answers.

## Method (implement INSIDE tools/imagine-to-3d — run the tool, extend it, never a hand recipe)
Add a mode, e.g. `python tools/imagine-to-3d/auto.py --method fusion5 ...` (or a `fusion5.py` stage wired into auto.py), importing from tools/grok-native/ rather than copying code.
1. **Solid** = Grok-native parametric scan-then-code prism (tools/grok-native/parametric.py): measured outline from the mask (taper, bite side/depth, cap slant), height/depth from vision, metric scale m_per_px. Watertight.
2. **Mask** = SAM2 prompted with the Grok vision proposal box (pick.json), then CUT against neighbour blades to fix the leak: ask Grok vision once for a split line and/or per-blade boxes of the neighbours, run SAM2 per neighbour, subtract them, keep the connected component under the hero box. Report IoU vs the old mask and vs the fusion reference, and a mask overlay jpg. Leak check: zero mask pixels inside any neighbour box.
3. **Relief** = a dense displaced FRONT shell (separate from the solid's back/sides, sealed onto it). Triangle rule: dense where the player looks (front, lower 60 m, at least ~0.15–0.25 m per vertex near 8 m view), coarser up high; respect the phone budget in docs/METHOD.md / tools/perf. Displacement = Frankot–Chellappa integration of the photometric normals (tools/grok-native/normals.py), scaled to METRES by an affine fit onto MoGe-2 (MIT, default model in tools/common/vision_models.py — DA V2 Large only as an internal comparison, never in shipped output). Relief is applied ONLY under painted features: Grok vision feature boxes (glass, chrome columns, ladder, damage/torn band, cables, ledges) intersected with the SAM2 hero mask. Outside those = flat base wall. Never invent relief (no height bands, no procedural cuts). Clamp to plausible 0.2–2.0 m feature depth; report per-feature depth.
4. **Texture**: front = key-city3 projection from the key camera (feature edges must land on painted edges). Hidden faces (sides, back, top) = the existing multi-view Imagine plates. No procedural colour.
5. **Cheap 2D overlay gate BEFORE Blender**: project the planned mesh (silhouette + relief edges) onto the key crop; if overlay < 0.70, fix parameters first, do not build.
6. **Check-and-correct loop (army pattern), max 3 rounds**: render from the key camera + hero / 30 m / 8 m (object-framed checklist cameras from foundation). A Grok vision JUDGE compares each render with the key crop and returns STRICT JSON only, e.g. `{"view":"8m","errors":[{"feature":"window_3","type":"offset","dx_m":0.2,"dy_m":0,"depth_m":null},{"feature":"bite","type":"too_shallow","delta_m":4}],"score":0.0-1.0}`. A CORRECTOR maps those errors to parameter edits (outline, feature boxes, relief scale, texture offset) and rebuilds. Log every judge JSON + edit in steps/fusion-fix5-1011/rounds/. Stop after round 3 even if failing.
7. **Dataset export (new, automatic)**: for every object that PASSES the gate, the tool writes to `dataset/i23d/<object-id>/<view>/` : image.png (render), depth.npy (metric, from the real mesh), normal.npy/png, mask.png, camera.json (intrinsics + extrinsics, near/far, units m), plus a meta.json (key image, method, licence of every model used). Do it for the key camera + all gate views + a small orbit (e.g. 24 views × 2 lights). Add a selftest. Write docs in tools/imagine-to-3d/README.md ("dataset export, for training our own depth model later"). If the object fails, export nothing but log why.

## Blocking pass (all must hold)
- Alignment >= 0.70 on EVERY view (hero, 30 m, 8 m, side; key camera too).
- Facade relief NON-ZERO on every visible axis in the object gate (median of per-metre spans > 0), and features show >= 0.3 m relief.
- Object gate (gate5) zero fails; mesh watertight; checklist (records/tower-hero-vision.verified.yaml) wedge/ladder/chrome/damage readable.
- Mask leak check passes. Phone budget passes (report triangles + fps estimate for S20 FE).

## Report — steps/fusion-fix5-1011/REPORT.md (+ numbers.json)
Honest PASS/FAIL, numbers per round (alignment per view, relief per axis, mask IoU, triangles, judge scores, Grok vision cost, seconds per stage). Sheets next to the key crop: `sheet-16x9.jpg` AND `sheet-phone.jpg` (phone portrait play render beside the key-city3 crop — REQUIRED). Dataset export path + count. Append the lesson to learn/failures.md or a recipe in learn/recipes/ (ALWAYS IMPROVE), and a tool-feedback note if a tool misreported. Commit locally.
