# object-gate report — FAIL

URL http://127.0.0.1:8971/ · adapter zd-preview-1012 · 2026-10-12T09:45:08.649Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| HUD text 412x915 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 412x915 | PASS | "Zone D — terrace block" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9885 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":4,"triangles":26524,"textures":4,"geometries":2,"programs":3},"visibleMeshes":2,"sceneTris":26524,"pixelRatio":1} |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 540x1200 | PASS | "Zone D — terrace block" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9879 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":4,"triangles":26524,"textures":4,"geometries":2,"programs":3},"visibleMeshes":2,"sceneTris":26524,"pixelRatio":1} |  |
| perf: report 540x1200 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| live preview untouched during the gate run | PASS | 12 files the live page loads unchanged |  |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| terrace | building | FAIL | UV stretch <= 1.3, visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, facade relief >= 0.3 m, checklist camera framed on the target, key checklist: every item verified on a current capture |

### terrace (building) — FAIL

hero copy zd-terrace-lod0 · sheet `/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.1/terrace/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 3 placed copies |  |
| texture roles declared | PASS | plate-front.jpg=plate plate-side.jpg=plate top.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 3 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | plate-front.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; plate-side.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; top.jpg gpu 1024x1024 served 1024x1024 original 1024x1024 |  |
| UV stretch <= 1.3 | FAIL | -y 2.448, +y 4.669, -y 2.448, +y 4.669 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.4576 at lag -30,0 px; face x peak 0.1244 at lag 70,1 px; close peak 0.6151 at lag -14,0 px; low-portrait peak 0.6105 at lag -28,0 px (max 0.75, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 68.0 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 20 tiles, p25 55.4; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: plate sampling worst +y 23.0 px/m on zd-terrace-lod0, 45/45 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 3 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | zd-terrace-lod0: 67 frames, min IoU 0.825, jumps at 285 m (0.89), 270.8 m (0.84), 232.1 m (0.82), 199 m (0.84); zd-terrace-lod1: 67 frames, min IoU 0.825, jumps at 285 m (0.89), 270.8 m (0.84), 232.1 m (0.82), 199 m (0.84) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| shadow cast | PASS | 30879 ground pixels in this object's shadow (53.6% of the probe view) |  |
| shadow world-fixed | PASS | shadow mask IoU 1.000 after moving the player 27 m (min 0.9) |  |
| shadow colour neutral (not violet) | PASS | shadow multiply r 0.738 g 0.764 b 0.771, chroma 0.043 (max 0.18) |  |
| grounding (no floating) | PASS | 0/3 copies float; worst zd-terrace-lod0 0.00 m at 1.8,-15.1 |  |
| mesh sealed (non-manifold / open edges) | PASS | zd-terrace-lod0 tris 75422 nonManifold 0 open 0; zd-terrace-lod1 tris 26522 nonManifold 0 open 0; zd-terrace-lod2 tris 12338 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | FAIL | zd-terrace-lod0 +x 0.114 -x 0.113 +z 1.533 -z 0; zd-terrace-lod1 +x 0.092 -x 0.09 +z 1.519 -z 0; zd-terrace-lod2 +x 0 -x 0 +z 1.5 -z 0 | Model the relief (fins, ledges, recessed bays, cornices, strata) in the geometry; a plate on a flat face reads as a picture. |
| checklist camera framed on the target | FAIL | close: target covers 13.6% < 25%; low-portrait: target covers 8.5% < 25%; far: target covers 22.7% < 25% | Frame each checklist camera on the target AABB (close 8 m, low portrait, far, ortho faces). Perspective cover >= 25%. Ortho faces >= 60% and not black. |
| key checklist: every item verified on a current capture | FAIL | volume: no recorded pass; doorways: no recorded pass; cornices: no recorded pass; colours: no recorded pass; base: no recorded pass | Look at /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.1/terrace/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/zd-terrace-1012/tools/object-gate/specs/zone-d/records/terrace.verified.yaml (copy /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.1/terrace/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 25.55 object L*a*b* 3.6,1,-5.3 key 26.4,0.9,-16.8 (report only) |  |
