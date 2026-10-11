# object-gate report — FAIL

URL http://127.0.0.1:8996/tower3-1010/index-tower3.html?visionKey=1 · adapter zb-preview-1008 · 2026-10-11T12:04:12.032Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone B — aperçu (tours phase 1, sans Bolt)" vs "Zone B — aperçu (tours phase 1, sans Bolt)" |  |
| title 540x1200 | PASS | "Zone B — aperçu" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9828 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":19,"triangles":500141,"textures":26,"geometries":18,"programs":21},"visibleMeshes":40,"sceneTris":2034965,"pixelRatio":1} |  |
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
| tower-hero | building | FAIL | UV stretch <= 1.3, scene self-report vs measured, repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), grounding (no floating), facade relief >= 0.3 m, proportions vs spec, relief-texture alignment, checklist camera framed on the target, key checklist: every item verified on a current capture |

### tower-hero (building) — FAIL

hero copy inst-tower-hero#0 · sheet `/workspace/grokcli/wt/tower-vision-1010/steps/fusion-fix5-1011/gate/tower-hero/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | albedo.png=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | albedo.png gpu 2560x720 served 2560x720 original 163x419 |  |
| UV stretch <= 1.3 | FAIL | -z 7.846, +z 7.846, -y 99, -x 99 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| scene self-report vs measured | FAIL | scene claims 5.89 px/m; measured visible (sampling) 0.1 px/m (detail tile 512 px/m does not count) | The scene's own texel number is misleading: compute it from the plate's unique pixels over the surface's metres, never from a tiled detail texture. |
| repetition (capture autocorrelation) | FAIL | face z peak 0.3909 at lag -1,35 px; face x peak 0.7692 at lag -41,-2 px; close peak 0.3028 at lag 34,1 px; low-portrait: object covers 1.0% of the low-portrait capture (capture angle unusable) (max 0.75, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | no steep surface of inst-tower-hero#0 found at 4/5/3/6/7/8/2.5 m above the ground on its path-facing side. Info: plate sampling worst +x 0.1 px/m on inst-tower-hero#0, 5/5 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| shadow cast | PASS | 15062 ground pixels in this object's shadow (26.1% of the probe view) |  |
| shadow world-fixed | PASS | shadow mask IoU 1.000 after moving the player 18 m (min 0.9) |  |
| shadow colour neutral (not violet) | PASS | shadow multiply r 0.725 g 0.756 b 0.792, chroma 0.089 (max 0.18) |  |
| grounding (no floating) | FAIL | 1/1 copies float; worst inst-tower-hero#0 74.23 m at 419.6,-263.8 | Sink each copy below its LOWEST footprint corner (worst needs 74.53 m), fill concave bases, add sand drift. |
| mesh sealed (non-manifold / open edges) | PASS | inst-tower-hero tris 264684 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | FAIL | inst-tower-hero +x 0 -x 0 +z 0 -z 0.591 | Model the relief (fins, ledges, recessed bays, cornices, strata) in the geometry; a plate on a flat face reads as a picture. |
| facade crispness (axis-aligned >= 0.72, 2-8 offset planes) | PASS | inst-tower-hero +x axis 0.736 planes 6 -x axis 0.862 planes 1 +z axis 1 planes 1 -z axis 0.979 planes 5 |  |
| proportions vs spec | FAIL | inst-tower-hero#0 hOverW 1.91 not in 3-5; inst-tower-hero#0 dOverW 0.25 not in 0.45-0.7 | Scale the solid in Blender to the spec ratios (never by spending more images). |
| relief-texture alignment | FAIL | hero 0.0948; 30m 0.0948; 8m 0.1385; side 0.2116 | A relief edge must lie on a painted edge. Move the feature box in the vision JSON. Do not invent bars. |
| checklist camera framed on the target | FAIL | close: empty frame; target covers 2.5% < 25%; low-portrait: empty frame; target covers 1.0% < 25%; far: target covers 23.0% < 25%; ortho-front: target covers 47.1% < 60%; ortho-side: target covers 22.9% < 60% | Frame each checklist camera on the target AABB (close 8 m, low portrait, far, ortho faces). Perspective cover >= 25%. Ortho faces >= 60% and not black. |
| key checklist: every item verified on a current capture | FAIL | wedge: recorded FAIL; ladder: recorded FAIL; chrome: recorded FAIL; damage: recorded FAIL; sand: recorded FAIL | Look at /workspace/grokcli/wt/tower-vision-1010/steps/fusion-fix5-1011/gate/tower-hero/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/tower-vision-1010/tools/object-gate/specs/zone-b/records/tower-hero-vision.verified.yaml (copy /workspace/grokcli/wt/tower-vision-1010/steps/fusion-fix5-1011/gate/tower-hero/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 18.74 object L*a*b* 16.2,11.5,1.7 key 34.9,11.4,0.6 (report only) |  |
