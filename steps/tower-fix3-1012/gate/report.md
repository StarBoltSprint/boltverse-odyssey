# object-gate report — FAIL

URL http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1 · adapter zb-preview-1008 · 2026-10-12T05:08:53.264Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone B — aperçu (tours phase 1, sans Bolt)" vs "Zone B — aperçu (tours phase 1, sans Bolt)" |  |
| title 540x1200 | PASS | "Zone B — aperçu" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9832 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":25,"triangles":357439,"textures":26,"geometries":18,"programs":24},"visibleMeshes":40,"sceneTris":1562237,"pixelRatio":1} |  |
| perf: canvas ratio <= cap 540x1200 | PASS | canvas ratio 1 (cap 1, device 1) |  |
| perf: sky dome drawn after the opaques 540x1200 | PASS | sky renderOrder 2, max opaque 0.5, depthTest true |  |
| perf: ground after the other opaques 540x1200 | PASS | ground renderOrder 1, max opaque 0.5 |  |
| perf: adaptive controller on 540x1200 | PASS | adaptive true |  |
| perf: quality kept: adaptive never drops the detail layer 540x1200 | PASS | adaptiveCanDropDetail false detailOn true |  |
| perf: default ratio = min(2, device) native, or >= 1.5 + EASU/RCAS to the canvas, no sprint dip 540x1200 | PASS | internal 1 canvas 1 device 1 upscale native rcas 0.8 sprintDip false |  |
| live preview untouched during the gate run | PASS | 108 files the live page loads unchanged |  |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| tower-hero | building | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, shadow cast, relief-texture alignment, key checklist: every item verified on a current capture |

### tower-hero (building) — FAIL

hero copy inst-tower-hero#0 · sheet `/workspace/grokcli/wt/tower-vision-1010/steps/tower-fix3-1012/gate/tower-hero/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | albedo.png=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | albedo.png gpu 2583x1744 served 2583x1744 original 163x419 |  |
| UV stretch <= 1.3 | PASS | max 1.298 |  |
| scene self-report vs measured | PASS | scene claims 5.39 px/m; measured visible (sampling) 6.9 px/m (detail tile 5.39 px/m does not count) |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.3993 at lag 3,-45 px; face x peak 0.3721 at lag 1,27 px; close peak 0.5652 at lag 3,-55 px; low-portrait peak 0.6075 at lag -33,0 px (max 0.75, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 41.3 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 4 tiles, p25 38.0; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: plate sampling worst +z 6.9 px/m on inst-tower-hero#0, 5/5 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | inst-tower-hero#0: 67 frames, min IoU 0.911, jumps at 11.3 m (0.92) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| shadow cast | FAIL | 0 ground pixels outside the object mask (0.0% of the probe view); inside-mask darkened 0; any darkened 0 | castShadow = true on every LOD; the ground must receive (receiveShadow / ground shader lookup). The probe ignores pixels under the object mask, so the contact has to fall on open ground. |
| grounding (no floating) | PASS | 0/1 copies float; worst inst-tower-hero#0 0.00 m at 88.5,-98.5 |  |
| mesh sealed (non-manifold / open edges) | PASS | inst-tower-hero tris 28320 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | PASS | inst-tower-hero +x 2.851 -x 2.832 +z 0 -z 0.496 |  |
| facade crispness (axis-aligned >= 0.72, 2-8 offset planes) | PASS | inst-tower-hero +x axis 0.999 planes 6 -x axis 0.911 planes 6 +z axis 0.966 planes 4 -z axis 0.939 planes 9 |  |
| proportions vs spec | PASS | hOverW, dOverW in range on every copy reason from plates |  |
| relief-texture alignment | FAIL | hero 0.1945; 30m 0.2655; 8m 0; side 0.0978 | A relief edge must lie on a painted edge. Move the feature box in the vision JSON. Do not invent bars. |
| checklist camera framed on the target | PASS | close cover 100.0%, low-portrait cover 55.3%, far cover 28.1%, ortho-front cover 60.3%, ortho-side cover 60.4% |  |
| key checklist: every item verified on a current capture | FAIL | wedge: recorded FAIL; chrome: recorded FAIL; damage: recorded FAIL; sand: recorded FAIL; N/A ladder: absent from every plate (No plate paints a ladder. Cables on the right plate are not rails.) | Look at /workspace/grokcli/wt/tower-vision-1010/steps/tower-fix3-1012/gate/tower-hero/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/tower-vision-1010/tools/object-gate/specs/zone-b/records/tower-hero-vision.verified.yaml (copy /workspace/grokcli/wt/tower-vision-1010/steps/tower-fix3-1012/gate/tower-hero/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 17.63 object L*a*b* 21,1,-2.5 key 34.9,11.4,0.6 (report only) |  |
