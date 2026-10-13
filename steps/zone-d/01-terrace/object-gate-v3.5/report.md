# object-gate report — FAIL

URL http://127.0.0.1:8971/ · adapter zd-preview-1012 · 2026-10-13T06:38:48.557Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| HUD text 412x915 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 412x915 | PASS | "Zone D — terrace block" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9865 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":2,"textures":11,"geometries":5,"programs":5},"visibleMeshes":2,"sceneTris":29068,"pixelRatio":1} |  |
| perf: canvas ratio <= cap 412x915 | PASS | canvas ratio 1 (cap 2, device 1) |  |
| perf: ground after the other opaques 412x915 | PASS | ground renderOrder 2, max opaque 0 |  |
| perf: adaptive controller on 412x915 | PASS | adaptive true |  |
| perf: quality kept: adaptive never drops the detail layer 412x915 | PASS | adaptiveCanDropDetail false detailOn true |  |
| perf: default ratio = min(2, device) native, or >= 1.5 + EASU/RCAS to the canvas, no sprint dip 412x915 | PASS | internal 1 canvas 1 device 1 upscale easu-rcas rcas 0.8 sprintDip false |  |
| console 540x1200 | PASS | no console / page errors |  |
| shader compile 540x1200 | PASS | all programs compiled |  |
| HUD text 540x1200 | PASS | "Zone D — terrace block preview" vs "Zone D — terrace block preview" |  |
| title 540x1200 | PASS | "Zone D — terrace block" |  |
| portrait viewport 540x1200 | PASS | inner 540x1200 |  |
| capture ready 540x1200 | PASS | loaded, cover 0.9862 |  |
| budgets 540x1200 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":2,"textures":11,"geometries":5,"programs":5},"visibleMeshes":2,"sceneTris":29068,"pixelRatio":1} |  |
| perf: canvas ratio <= cap 540x1200 | PASS | canvas ratio 1 (cap 2, device 1) |  |
| perf: ground after the other opaques 540x1200 | PASS | ground renderOrder 2, max opaque 0 |  |
| perf: adaptive controller on 540x1200 | PASS | adaptive true |  |
| perf: quality kept: adaptive never drops the detail layer 540x1200 | PASS | adaptiveCanDropDetail false detailOn true |  |
| perf: default ratio = min(2, device) native, or >= 1.5 + EASU/RCAS to the canvas, no sprint dip 540x1200 | PASS | internal 1 canvas 1 device 1 upscale easu-rcas rcas 0.8 sprintDip false |  |
| live preview untouched during the gate run | PASS | 17 files the live page loads unchanged |  |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| terrace | building | FAIL | visible px/m (phone sharpness from >= 8 m, final render), key checklist: every item verified on a current capture |

### terrace (building) — FAIL

hero copy zd-terrace-lod0 · sheet `/workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.5/terrace/capture-sheet.jpg`

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| painted duplicate of geometric feature | PASS | no painted feature on the projected geometry |  |
| select | PASS | 3 placed copies |  |
| texture roles declared | PASS | plate-front-v35.jpg=plate t1-right-v35.jpg=plate plate-side-v35.jpg=plate top.jpg=plate plate-front.jpg=plate t1-right.jpg=plate plate-side.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 7 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | plate-front-v35.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; t1-right-v35.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; plate-side-v35.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; top.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; plate-front.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; t1-right.jpg gpu 1024x1024 served 1024x1024 original 1024x1024; plate-side.jpg gpu 1024x1024 served 1024x1024 original 1024x1024 |  |
| UV stretch <= 1.3 | PASS | max 1.269 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.4725 at lag 29,0 px; face x peak 0.2222 at lag -23,0 px; close peak 0.5072 at lag -33,0 px; low-portrait peak 0.5386 at lag -37,0 px (max 0.75, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 153.7 px/m of real detail on screen vs 154.6 needed (capture at 8 m, zoomed to 309.3 screen px/m; median of 16 tiles, p25 120.0; phone 1080x2400, render pixel ratio 1.5, vfov 58°). Info: plate sampling worst +x 45.3 px/m on zd-terrace-lod0, 60/60 surfaces under | Needs >= 154.6 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 6.6 x 6.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 3 copies, none within 7 m of another |  |
| approach morph 300->10 m | PASS | zd-terrace-lod0: 67 frames, min IoU 0.972; zd-terrace-lod1: 67 frames, min IoU 0.972 |  |
| shadow cast | PASS | 19206 ground pixels in this object's shadow (33.3% of the probe view) |  |
| shadow world-fixed | PASS | shadow mask IoU 1.000 after moving the player 27 m (min 0.9) |  |
| shadow colour neutral (not violet) | PASS | shadow multiply r 0.732 g 0.754 b 0.767, chroma 0.046 (max 0.18) |  |
| grounding (no floating) | PASS | 0/3 copies float; worst zd-terrace-lod0 0.00 m at 7.6,-15.1 |  |
| mesh sealed (non-manifold / open edges) | PASS | zd-terrace-lod0 tris 78160 nonManifold 0 open 0; zd-terrace-lod1 tris 29066 nonManifold 0 open 0; zd-terrace-lod2 tris 14830 nonManifold 0 open 0 |  |
| facade relief >= 0.3 m | PASS | zd-terrace-lod0 +x 0.495 -x 0.498 +z 1.519 -z 0; zd-terrace-lod1 +x 0.437 -x 0.458 +z 1.513 -z 0; zd-terrace-lod2 +x 0.345 -x 0.365 +z 1.5 -z 0 |  |
| checklist camera framed on the target | PASS | close cover 86.5%, low-portrait cover 88.0%, far cover 25.1%, ortho-front cover 81.1%, ortho-side cover 72.0% |  |
| key checklist: every item verified on a current capture | FAIL | volume: no recorded pass; doorways: no recorded pass; cornices: no recorded pass; colours: no recorded pass; base: no recorded pass | Look at /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.5/terrace/capture-sheet.jpg next to the key crop. For each item write pass/fail + note in /workspace/grokcli/wt/zd-terrace-1012/tools/object-gate/specs/zone-d/records/terrace.verified.yaml (copy /workspace/grokcli/wt/zd-terrace-1012/steps/zone-d/01-terrace/object-gate-v3.5/terrace/checklist-todo.yaml: it has the current capture hashes). Fix every fail first. |
| colour vs key crop (CIELAB) | INFO | deltaE 27.56 object L*a*b* 2.2,0.6,-3.6 key 26.4,0.9,-16.8 (report only) |  |
