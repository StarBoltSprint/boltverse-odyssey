# object-gate report — FAIL

URL http://127.0.0.1:8996/tower3-1010/index-fusion.html?visionKey=1 · adapter zb-preview-1008 · 2026-10-11T15:15:59.516Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone B — aperçu (tours phase 1, sans Bolt)" vs "Zone B — aperçu (tours phase 1, sans Bolt)" |  |
| title 540x1200 | PASS | "Zone B — aperçu" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9832 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":19,"triangles":500141,"textures":27,"geometries":18,"programs":21},"visibleMeshes":40,"sceneTris":2034965,"pixelRatio":1} |  |
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
| tower-hero | building | FAIL | UV stretch <= 1.3, scene self-report vs measured, repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, shadow cast, grounding (no floating), facade relief >= 0.3 m, proportions vs spec, relief-texture alignment, checklist camera framed on the target, key checklist: every item verified on a current capture |

### tower-hero (building) — FAIL

hero copy inst-tower-hero#0 · sheet `/workspace/grokcli/wt/tower-vision-1010/steps/scene-strict-1011/gate/tower-hero/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | albedo.png=plate normal.png=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | albedo.png gpu 2560x720 served 2560x720 original 163x419; normal.png gpu 1024x1024 served 1024x1024 original 163x419 |  |
| UV stretch <= 1.3 | FAIL | -z 7.846, +z 7.846, -y 99, -x 99 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| scene self-report vs measured | FAIL | scene claims 5.89 px/m; measured visible (sampling) 0.1 px/m (detail tile 512 px/m does not count) | The scene's own texel number is misleading: compute it from the plate's unique pixels over the surface's metres, never from a tiled detail texture. |
| repetition (capture autocorrelation) | FAIL | face z peak 0.3571 at lag 1,-35 px; face x peak 0.9418 at lag -42,-3 px; close: object covers 1.7% of the close capture (capture angle unusable); low-portrait: object covers 0.9% of the low-portrait capture (capture angle unusable) (max 0.75, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | no steep surface of inst-tower-hero#0 found at 4/5/3/6/7/8/2.5 m above the ground on its path-facing side. Info: plate sampling worst +x 0.1 px/m on inst-tower-hero#0, 10/10 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | inst-tower-hero#0: 67 frames, min IoU 0.045, jumps at 11.8 m (0.05) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| shadow cast | FAIL | 0 ground pixels in this object's shadow (0.0% of the probe view) | castShadow = true on every LOD; the ground must receive (receiveShadow / ground shader lookup). |
| grounding (no floating) | FAIL | 1/1 copies float; worst inst-tower-hero#0 44.83 m at 458.5,-507.5 | Sink each copy below its LOWEST footprint corner (worst needs 45.13 m), fill concave bases, add sand drift. |
| mesh sealed (non-manifold / open edges) | PASS | inst-tower-hero tris 264684 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | FAIL | inst-tower-hero +x 0 -x 0 +z 0 -z 0.591 | Model the relief (fins, ledges, recessed bays, cornices, strata) in the geometry; a plate on a flat face reads as a picture. |
| facade crispness (axis-aligned >= 0.72, 2-8 offset planes) | PASS | inst-tower-hero +x axis 0.736 planes 6 -x axis 0.862 planes 1 +z axis 1 planes 1 -z axis 0.979 planes 5 |  |
| proportions vs spec | FAIL | inst-tower-hero#0 hOverW 1.91 not in 3-5; inst-tower-hero#0 dOverW 0.25 not in 0.45-0.7 | Scale the solid in Blender to the spec ratios (never by spending more images). |
| relief-texture alignment | FAIL | hero 0.153; 30m 0.153; 8m 0.2281; side 0.1747 | A relief edge must lie on a painted edge. Move the feature box in the vision JSON. Do not invent bars. |
| checklist camera framed on the target | FAIL | close: empty frame; target covers 1.7% < 25%; low-portrait: empty frame; target covers 0.9% < 25%; far: empty frame; target covers 24.7% < 25%; ortho-front: empty frame; target covers 48.2% < 60%; ortho frame is black; ortho-side: empty frame; target covers 18.9% < 60%; ortho frame is black | Frame each checklist camera on the target AABB (close 8 m, low portrait, far, ortho faces). Perspective cover >= 25%. Ortho faces >= 60% and not black. |
| key checklist: every item verified on a current capture | FAIL | wedge: recorded FAIL; ladder: recorded FAIL; chrome: recorded FAIL; damage: recorded FAIL; sand: recorded FAIL | Look at /workspace/grokcli/wt/tower-vision-1010/steps/scene-strict-1011/gate/tower-hero/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/tower-vision-1010/tools/object-gate/specs/zone-b/records/tower-hero-vision.verified.yaml (copy /workspace/grokcli/wt/tower-vision-1010/steps/scene-strict-1011/gate/tower-hero/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 32.42 object L*a*b* 3.1,5.5,2.6 key 34.9,11.4,0.6 (report only) |  |
