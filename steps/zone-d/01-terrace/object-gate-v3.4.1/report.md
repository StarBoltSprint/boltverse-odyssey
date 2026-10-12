# object-gate report — FAIL

URL http://127.0.0.1:8971/ · adapter zd-preview-1012 · 2026-10-12T13:12:04.698Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| HUD text 412x915 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 412x915 | PASS | "Zone D — terrace block" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9883 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":5,"triangles":30700,"textures":5,"geometries":2,"programs":3},"visibleMeshes":2,"sceneTris":30700,"pixelRatio":1} |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 540x1200 | PASS | "Zone D — terrace block" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9879 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":5,"triangles":30700,"textures":5,"geometries":2,"programs":3},"visibleMeshes":2,"sceneTris":30700,"pixelRatio":1} |  |
| perf: report 540x1200 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| live preview untouched during the gate run | PASS | 13 files the live page loads unchanged |  |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| terrace | building | FAIL | visible px/m (phone sharpness from >= 8 m, final render), key checklist: every item verified on a current capture |

### terrace (building) — FAIL

hero copy zd-terrace-lod0 · sheet `/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.4.1/terrace/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 3 placed copies |  |
| texture roles declared | PASS | plate-front-v34.jpg=plate t1-right-v34.jpg=plate plate-side-v34.jpg=plate top.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 4 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | plate-front-v34.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; t1-right-v34.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; plate-side-v34.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; top.jpg gpu 1024x1024 served 1024x1024 original 1024x1024 |  |
| UV stretch <= 1.3 | PASS | max 1.269 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.3792 at lag 29,0 px; face x peak 0.1529 at lag -23,0 px; close peak 0.4428 at lag -44,0 px; low-portrait peak 0.4259 at lag -38,0 px (max 0.75, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 108.4 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 15 tiles, p25 102.2; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: plate sampling worst +y 18.8 px/m on zd-terrace-lod0, 60/60 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 3 copies, none within 7 m of another |  |
| approach morph 300->10 m | PASS | zd-terrace-lod0: 67 frames, min IoU 0.972; zd-terrace-lod1: 67 frames, min IoU 0.972 |  |
| shadow cast | PASS | 30948 ground pixels in this object's shadow (53.7% of the probe view) |  |
| shadow world-fixed | PASS | shadow mask IoU 1.000 after moving the player 27 m (min 0.9) |  |
| shadow colour neutral (not violet) | PASS | shadow multiply r 0.738 g 0.764 b 0.771, chroma 0.043 (max 0.18) |  |
| grounding (no floating) | PASS | 0/3 copies float; worst zd-terrace-lod0 0.00 m at 7.6,-15.1 |  |
| mesh sealed (non-manifold / open edges) | PASS | zd-terrace-lod0 tris 79792 nonManifold 0 open 0; zd-terrace-lod1 tris 30698 nonManifold 0 open 0; zd-terrace-lod2 tris 16462 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | PASS | zd-terrace-lod0 +x 0.497 -x 0.498 +z 1.556 -z 0; zd-terrace-lod1 +x 0.463 -x 0.478 +z 1.545 -z 0; zd-terrace-lod2 +x 0.347 -x 0.38 +z 1.5 -z 0 |  |
| checklist camera framed on the target | PASS | close cover 86.5%, low-portrait cover 88.0%, far cover 25.2%, ortho-front cover 81.3%, ortho-side cover 72.1% |  |
| key checklist: every item verified on a current capture | FAIL | volume: no recorded pass; doorways: no recorded pass; cornices: no recorded pass; colours: no recorded pass; base: no recorded pass | Look at /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.4.1/terrace/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/zd-terrace-1012/tools/object-gate/specs/zone-d/records/terrace.verified.yaml (copy /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.4.1/terrace/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 27 object L*a*b* 2.6,0.8,-4.1 key 26.4,0.9,-16.8 (report only) |  |
