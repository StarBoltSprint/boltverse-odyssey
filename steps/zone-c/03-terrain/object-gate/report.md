# object-gate report — FAIL

URL http://127.0.0.1:8771/?along=0 · adapter zone-c-terrain · 2026-10-11T17:27:57.384Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C causeway" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.3045 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":45696,"textures":1,"geometries":1,"programs":1},"visibleMeshes":1,"sceneTris":45696,"pixelRatio":1} |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C causeway" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.3046 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":1,"triangles":45696,"textures":1,"geometries":1,"programs":1},"visibleMeshes":1,"sceneTris":45696,"pixelRatio":1} |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows |
|---|---|---|---|
| causeway | terrain | FAIL | texture filtering (mips, trilinear, anisotropy = max, no resize), plates not downscaled vs Imagine originals, repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render) |

### causeway (terrain) — FAIL

hero copy causeway

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | albedo.png=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | FAIL | albedo.png: anisotropy 8 < max 16 | tex.generateMipmaps = true; tex.minFilter = LinearMipmapLinearFilter; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(). Never draw a plate through a resized canvas. |
| plates not downscaled vs Imagine originals | FAIL | albedo.png: served 113x205 < Imagine original 1792x1008 (downscaled); albedo.png gpu 113x205 served 113x205 original 1792x1008 | Ship the Imagine output at its native size (lossless or q>=95). Record the original path in tex-manifest.json / spec `source:`. |
| UV stretch <= 1.3 | PASS | max 1.004 |  |
| repetition (capture autocorrelation) | FAIL | face z: no object area >= 48x48 px in the capture; face x: no object area >= 48x48 px in the capture; close: object covers 0.0% of the close capture (capture angle unusable); low-portrait: object covers 0.4% of the low-portrait capture (capture angle unusable) (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | no steep surface of causeway found at 4/5/3/6/7/8/2.5 m above the ground on its path-facing side. Info: plate sampling worst +y 2.0 px/m on causeway, 1/1 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
