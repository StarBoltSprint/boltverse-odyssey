# object-gate report — FAIL

URL http://127.0.0.1:8971/ · adapter zd-preview-1012 · 2026-10-12T09:23:13.724Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| HUD text 412x915 | FAIL | "Zone D â€” terrace block preview" vs "Zone D — terrace block preview" | Update the HUD/title text to describe what the build contains today. |
| title 412x915 | FAIL | "" | Update <title>. |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 1 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":3,"triangles":19664,"textures":3,"geometries":4,"programs":3},"visibleMeshes":10,"sceneTris":99392,"pixelRatio":1} |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | FAIL | "Zone D â€” terrace block preview" vs "Zone D — terrace block preview" | Update the HUD/title text to describe what the build contains today. |
| title 540x1200 | FAIL | "" | Update <title>. |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 1 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":3,"triangles":19664,"textures":3,"geometries":4,"programs":3},"visibleMeshes":10,"sceneTris":99392,"pixelRatio":1} |  |
| perf: report 540x1200 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| live preview untouched during the gate run | PASS | 9 files the live page loads unchanged |  |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| terrace | building | FAIL | texture roles declared, visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating), mesh sealed (non-manifold / open edges), facade relief >= 0.3 m, checklist camera framed on the target, key checklist: every item verified on a current capture |

### terrace (building) — FAIL

hero copy zd-terrace-lod0/zd-terrace-lod0-terrace-lod0_3 · sheet `/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v2/terrace/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 9 placed copies |  |
| texture roles declared | FAIL | map blob:http://127.0.0.1:8971/d5bc0f92-09c5-4c8a-be6e-6841f143413e; map blob:http://127.0.0.1:8971/cdb01e23-12c8-4449-a181-083e697ac5bb; map blob:http://127.0.0.1:8971/14900e41-3cd0-4ae5-9516-b031b166d0f9; map blob:http://127.0.0.1:8971/6592a8d5-418d-46b7-9777-3c6860346926; map blob:http://127.0.0.1:8971/f6fca177-2788-433a-a533-c5defc96cef6; map blob:http://127.0.0.1:8971/4a30c4ab-23ab-41d9-b88a-8bd8ca6e3a5a; map blob:http://127.0.0.1:8971/562dee9b-db95-4cb9-8d35-0b5c5634f772; map blob:http://127.0.0.1:8971/6d902943-43ab-457a-81e7-0defc4afa611; map blob:http://127.0.0.1:8971/2f383fcd-a936-497 | Declare every texture in the spec `textures:` with a role (plate / detail / tile / normal / mask / emit / env). Only `plate` counts as native Imagine px/m. |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 9 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | no plate |  |
| UV stretch <= 1.3 | PASS | max 1.000 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.1158 at lag 273,-102 px; face x peak 0.1496 at lag 27,1 px; close peak 0.5092 at lag -24,0 px; low-portrait peak 0.5461 at lag -19,0 px (max 0.75, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 68.0 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 20 tiles, p25 55.4; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: no plate surface sampled | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 9 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | zd-terrace-lod0/zd-terrace-lod0-terrace-lod0_3: 67 frames, min IoU 0.831, jumps at 285 m (0.83), 257.2 m (0.86), 232.1 m (0.86), 220.5 m (0.85); zd-terrace-lod1/zd-terrace-lod1-terrace-lod1_3: 67 frames, min IoU 0.831, jumps at 285 m (0.83), 257.2 m (0.86), 232.1 m (0.86), 220.5 m (0.85) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| shadow cast | PASS | 29268 ground pixels in this object's shadow (50.8% of the probe view) |  |
| shadow world-fixed | PASS | shadow mask IoU 1.000 after moving the player 27 m (min 0.9) |  |
| shadow colour neutral (not violet) | PASS | shadow multiply r 0.738 g 0.762 b 0.771, chroma 0.044 (max 0.18) |  |
| grounding (no floating) | FAIL | 3/9 copies float; worst zd-terrace-lod0/zd-terrace-lod0-terrace-lod0_3 5.80 m at -7.6,-15.1 | Sink each copy below its LOWEST footprint corner (worst needs 6.10 m), fill concave bases, add sand drift. |
| mesh sealed (non-manifold / open edges) | FAIL | zd-terrace-lod0-terrace-lod0_1 tris 43614 nonManifold 0 open 4170; zd-terrace-lod0-terrace-lod0_2 tris 23332 nonManifold 0 open 1664; zd-terrace-lod0-terrace-lod0_3 tris 2070 nonManifold 0 open 222; zd-terrace-lod1-terrace-lod1_1 tris 13830 nonManifold 0 open 2504; zd-terrace-lod1-terrace-lod1_2 tris 5832 nonManifold 0 open 972; zd-terrace-lod1-terrace-lod1_3 tris 2070 nonManifold 0 open 222; zd-terrace-lod2-terrace-lod2_1 tris 5180 nonManifold 0 open 1646; zd-terrace-lod2-terrace-lod2_2 tris 1392 nonManifold 0 open 484; zd-terrace-lod2-terrace-lod2_3 tris 2070 nonManifold 0 open 222 | Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export. |
| facade relief >= 0.3 m | FAIL | zd-terrace-lod0-terrace-lod0_1 +x 0 -x 0 +z 0 -z 0; zd-terrace-lod0-terrace-lod0_2 +x 1.356 -x 1.938 +z 0 -z null; zd-terrace-lod0-terrace-lod0_3 +x null -x null +z null -z 0; zd-terrace-lod1-terrace-lod1_1 +x 0 -x 0 +z 0 -z 0; zd-terrace-lod1-terrace-lod1_2 +x 1.347 -x 1.935 +z 0 -z null; zd-terrace-lod1-terrace-lod1_3 +x null -x null +z null -z 0; zd-terrace-lod2-terrace-lod2_1 +x 0 -x 0 +z 0 -z 0; zd-terrace-lod2-terrace-lod2_2 +x 1.333 -x 1.933 +z 0 -z null; zd-terrace-lod2-terrace-lod2_3 +x null -x null +z null -z 0 | Model the relief (fins, ledges, recessed bays, cornices, strata) in the geometry; a plate on a flat face reads as a picture. |
| checklist camera framed on the target | FAIL | close: empty frame; target covers 24.1% < 25%; low-portrait: empty frame; target covers 24.4% < 25%; far: empty frame; target covers 24.1% < 25%; ortho-side: empty frame | Frame each checklist camera on the target AABB (close 8 m, low portrait, far, ortho faces). Perspective cover >= 25%. Ortho faces >= 60% and not black. |
| key checklist: every item verified on a current capture | FAIL | volume: no recorded pass; doorways: no recorded pass; cornices: no recorded pass; colours: no recorded pass; base: no recorded pass | Look at /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v2/terrace/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/zd-terrace-1012/tools/object-gate/specs/zone-d/records/terrace.verified.yaml (copy /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v2/terrace/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 29.2 object L*a*b* 1.2,0.2,-2.1 key 26.4,0.9,-16.8 (report only) |  |
