# object-gate report — FAIL

URL http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1 · adapter zb-preview-1008 · 2026-10-11T16:21:43.978Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone B — aperçu (tours phase 1, sans Bolt)" vs "Zone B — aperçu (tours phase 1, sans Bolt)" |  |
| title 540x1200 | PASS | "Zone B — aperçu" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9595 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":19,"triangles":245129,"textures":27,"geometries":18,"programs":21},"visibleMeshes":40,"sceneTris":1524941,"pixelRatio":1} |  |
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
| tower-hero | building | FAIL | UV stretch <= 1.3, scene self-report vs measured, repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), shadow cast, grounding (no floating), facade crispness (axis-aligned >= 0.72, 2-8 offset planes), proportions vs spec, relief-texture alignment, checklist camera framed on the target, key checklist: every item verified on a current capture |

### tower-hero (building) — FAIL

hero copy inst-tower-hero#0 · sheet `/workspace/grokcli/wt/tower-vision-1010/steps/multiview-tower-1011/gate/tower-hero/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | albedo.png=plate normal.png=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | albedo.png gpu 872x940 served 872x940 original 163x419; normal.png gpu 872x940 served 872x940 original 163x419 |  |
| UV stretch <= 1.3 | FAIL | -y 20.99, -z 1.391, +x 2.785, -x 4.372 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| scene self-report vs measured | FAIL | scene claims 2.41 px/m; measured visible (sampling) 1.7 px/m (detail tile 2.41 px/m does not count) | The scene's own texel number is misleading: compute it from the plate's unique pixels over the surface's metres, never from a tiled detail texture. |
| repetition (capture autocorrelation) | FAIL | face z peak 0.7396 at lag -4,-32 px; face x peak 0.6085 at lag -1,-29 px; close peak 0.5126 at lag -1,-12 px; low-portrait: object covers 1.7% of the low-portrait capture (capture angle unusable) (max 0.75, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | the surface shows no detail at all (20 tiles flat, e.g. black or unlit): 0.0 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 0 tiles, p25 0.0; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: plate sampling worst +z 2.4 px/m on inst-tower-hero#0, 10/10 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | PASS | inst-tower-hero#0: 67 frames, min IoU 0.91 |  |
| shadow cast | FAIL | 0 ground pixels in this object's shadow (0.0% of the probe view) | castShadow = true on every LOD; the ground must receive (receiveShadow / ground shader lookup). |
| grounding (no floating) | FAIL | 1/1 copies float; worst inst-tower-hero#0 2.45 m at 87.8,-98.7 | Sink each copy below its LOWEST footprint corner (worst needs 2.75 m), fill concave bases, add sand drift. |
| mesh sealed (non-manifold / open edges) | PASS | inst-tower-hero tris 9672 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | PASS | inst-tower-hero +x 0.517 -x 0.443 +z 0.163 -z 0.32 |  |
| facade crispness (axis-aligned >= 0.72, 2-8 offset planes) | FAIL | inst-tower-hero +x axis 0.908 planes 14 -x axis 0.907 planes 11 +z axis 0.963 planes 15 -z axis 0.863 planes 7 | Quantise the facade into a few flat planes with vertical steps. One plane is a flat slab; many offset bins is a blobby rock. |
| proportions vs spec | FAIL | inst-tower-hero#0 dOverW 0.79 not in 0.45-0.7 | Scale the solid in Blender to the spec ratios (never by spending more images). |
| relief-texture alignment | FAIL | hero 0.1341; 30m 0.1341; 8m 0.6663; side 0.1398 | A relief edge must lie on a painted edge. Move the feature box in the vision JSON. Do not invent bars. |
| checklist camera framed on the target | FAIL | close: empty frame; target covers 2.7% < 25%; low-portrait: empty frame; target covers 1.7% < 25%; far: empty frame; ortho-front: empty frame; target covers 38.1% < 60%; ortho frame is black; ortho-side: empty frame; target covers 26.2% < 60%; ortho frame is black | Frame each checklist camera on the target AABB (close 8 m, low portrait, far, ortho faces). Perspective cover >= 25%. Ortho faces >= 60% and not black. |
| key checklist: every item verified on a current capture | FAIL | wedge: recorded FAIL; ladder: recorded FAIL; chrome: recorded FAIL; damage: recorded FAIL; sand: recorded FAIL | Look at /workspace/grokcli/wt/tower-vision-1010/steps/multiview-tower-1011/gate/tower-hero/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/tower-vision-1010/tools/object-gate/specs/zone-b/records/tower-hero-vision.verified.yaml (copy /workspace/grokcli/wt/tower-vision-1010/steps/multiview-tower-1011/gate/tower-hero/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 36.5 object L*a*b* 0.1,0.5,-0.1 key 34.9,11.4,0.6 (report only) |  |
