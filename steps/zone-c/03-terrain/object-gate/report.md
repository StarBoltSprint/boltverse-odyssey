# object-gate report — PASS

URL http://127.0.0.1:8771/?along=0 · adapter zone-c-terrain · 2026-10-11T19:22:47.444Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C causeway" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.9976 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":45696,"textures":8,"geometries":1,"programs":1},"visibleMeshes":1,"sceneTris":45696,"pixelRatio":1} |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C causeway" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9982 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":45696,"textures":8,"geometries":1,"programs":1},"visibleMeshes":1,"sceneTris":45696,"pixelRatio":1} |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| causeway | terrain | PASS |  |

### causeway (terrain) — PASS

hero copy causeway

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=detail moss-top-1.jpg=plate moss-top-2.jpg=plate moss-top-3.jpg=plate moss-top-4.jpg=plate =mask =detail =mask |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 8 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | moss-top-1.jpg gpu 1408x1408 served 1408x1408 original 1408x1408; moss-top-2.jpg gpu 1408x1408 served 1408x1408 original 1408x1408; moss-top-3.jpg gpu 1408x1408 served 1408x1408 original 1408x1408; moss-top-4.jpg gpu 1408x1408 served 1408x1408 original 1408x1408 |  |
| UV stretch <= 1.3 | PASS | max 1.005 |  |
| repetition (capture autocorrelation) | PASS | face y peak 0.1147 at lag 0,-555 px, at the plate period (6.5 m = 278 px) 0.0149; close peak 0.0758 at lag -33,-1 px; low-portrait peak 0.0642 at lag -109,-299 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | PASS | 237.1 px/m of real detail on screen vs 118.5 needed (capture at 9.02 m, zoomed to 237.1 screen px/m, at the capture limit; median of 20 tiles, p25 223.7; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +y 216.5 px/m on causeway, 0/1 surfaces under |  |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
