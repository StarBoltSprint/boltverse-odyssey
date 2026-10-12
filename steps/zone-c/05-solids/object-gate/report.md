# object-gate report — FAIL

URL http://127.0.0.1:8772/?along=0 · adapter zone-c-solids · 2026-10-12T06:26:19.641Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C solids" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.9976 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":127904,"textures":9,"geometries":6,"programs":2},"visibleMeshes":6,"sceneTris":127904,"pixelRatio":1} |  |
| draw calls 720x1600 | PASS | 11 draws (max 12) |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C solids" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9982 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":127904,"textures":9,"geometries":6,"programs":2},"visibleMeshes":6,"sceneTris":127904,"pixelRatio":1} |  |
| draw calls 412x915 | PASS | 11 draws (max 12) |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows | PENDING rows |
|---|---|---|---|---|
| arch-left | rock | FAIL | repetition (capture autocorrelation), approach morph 300->10 m |  |
| arch-right | rock | FAIL | approach morph 300->10 m |  |
| cliff-left | rock | FAIL | repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating) |  |
| gorge-rock | rock | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating) |  |
| cliff-right | rock | FAIL | repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m |  |

### arch-left (rock) — FAIL

hero copy arch-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.280 |  |
| repetition (capture autocorrelation) | FAIL | face z peak 0.1107 at lag -12,-4 px; face x peak 0.1524 at lag -14,3 px; close peak 0.1578 at lag 33,-25 px; low-portrait: no object area >= 48x48 px in the capture (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | PASS | 136.3 px/m of real detail on screen vs 118.5 needed (capture at 8.04 m, zoomed to 237.1 screen px/m; median of 8 tiles, p25 132.4; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +x 27.3 px/m on arch-left, 5/5 surfaces under |  |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-left: 67 frames, min IoU 0.773, jumps at 285 m (0.84), 209.5 m (0.80), 179.6 m (0.77) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-left -0.22 m at -6.7,-23 |  |
| hidden face plate #5 arch-left-inner | PASS | 11748 tris back 11568, inner 180; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-05-arch-left-inner.jpg |  |
| hidden face plate #11 leaf | PASS | 13151 tris grazing 12059, side 1092; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-11-leaf.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 1816 tris bottom 1816; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-left tris 27764 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-left +x 2.984 -x 2.918 +z 2.752 -z 2.078 |  |

### arch-right (rock) — FAIL

hero copy arch-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.286 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.2021 at lag 12,-4 px; face x peak 0.1498 at lag 70,-25 px; close peak 0.1829 at lag 22,-6 px; low-portrait peak 0.1559 at lag -38,-2 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | PASS | 124.9 px/m of real detail on screen vs 118.5 needed (capture at 8.02 m, zoomed to 237.1 screen px/m; median of 1 tiles, p25 124.9; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst -x 39.6 px/m on arch-right, 5/5 surfaces under |  |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-right: 67 frames, min IoU 0.684, jumps at 285 m (0.77), 270.8 m (0.79), 257.2 m (0.68), 209.5 m (0.81) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-right -0.25 m at 13.8,-23.4 |  |
| hidden face plate #6 arch-right-inner | PASS | 9538 tris back 9314, inner 224; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-06-arch-right-inner.jpg |  |
| hidden face plate #12 fern | PASS | 10276 tris grazing 9770, side 506; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-12-fern.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 1144 tris bottom 1144; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-right tris 21168 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-right +x 2.93 -x 2.873 +z 2.259 -z 2.836 |  |

### cliff-left (rock) — FAIL

hero copy cliff-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.276 |  |
| repetition (capture autocorrelation) | FAIL | face z peak 0.1175 at lag -64,-198 px; face x peak 0.1456 at lag 3,-38 px; close peak 0.1293 at lag 7,42 px; low-portrait: no object area >= 48x48 px in the capture (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 52.1 px/m of real detail on screen vs 118.5 needed (capture at 2.97 m, zoomed to 237.1 screen px/m; median of 16 tiles, p25 40.7; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 22.1 px/m on cliff-left, 6/6 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-left: 67 frames, min IoU 0.779, jumps at 257.2 m (0.80), 199 m (0.78), 162.1 m (0.83) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst cliff-left 0.69 m at -5.9,-42.9 | Sink each copy below its LOWEST footprint corner (worst needs 0.99 m), fill concave bases, add sand drift. |
| hidden face plate #7 wall-left | PASS | 7938 tris back 7938; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-07-wall-left.jpg |  |
| hidden face plate #9 waterfall | PASS | 5689 tris grazing 5131, side 558; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-09-waterfall.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 500 tris bottom 500; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-left tris 16768 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-left +x 2.817 -x 2.666 +z 2.048 -z 1.73 |  |

### gorge-rock (rock) — FAIL

hero copy gorge-rock

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.278 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.0827 at lag -27,-169 px; face x peak 0.4197 at lag 15,-4 px; close peak 0.105 at lag 41,-78 px; low-portrait peak 0.1825 at lag 42,10 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | the surface shows no detail at all (20 tiles flat, e.g. black or unlit): 0.0 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 0 tiles, p25 0.0; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +x 1.2 px/m on gorge-rock, 7/7 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | gorge-rock: 67 frames, min IoU 0.846, jumps at 285 m (0.85) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst gorge-rock 2.63 m at 2.1,-67.7 | Sink each copy below its LOWEST footprint corner (worst needs 2.93 m), fill concave bases, add sand drift. |
| hidden face plate #10 mist | PASS | 4028 tris grazing 3696, side 332; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-10-mist.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 874 tris bottom 874; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #14 gorge-closure | PASS | 4970 tris back 4826, inner 144; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-14-gorge-closure.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | gorge-rock tris 11504 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | gorge-rock +x 2.891 -x 2.843 +z 1.597 -z 2.007 |  |

### cliff-right (rock) — FAIL

hero copy cliff-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.291 |  |
| repetition (capture autocorrelation) | FAIL | face z peak 0.8779 at lag 0,-18 px; face x peak 0.4497 at lag 0,21 px; close peak 0.7679 at lag 0,-13 px; low-portrait peak 0.8836 at lag -1,12 px (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | no steep surface of cliff-right found at 4/5/3/6/7/8/2.5 m above the ground on its path-facing side. Info: plate sampling worst -z 42.7 px/m on cliff-right, 4/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-right: 67 frames, min IoU 0.662, jumps at 209.5 m (0.66), 179.6 m (0.75), 139 m (0.89), 119.2 m (0.81) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst cliff-right -0.22 m at 13.3,-28.2 |  |
| hidden face plate #8 wall-right | PASS | 2076 tris back 2076; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-08-wall-right.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 360 tris bottom 360; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #15 planet | PASS | 2251 tris grazing 1991, side 260; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-15-planet.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-right tris 5004 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-right +x 2.951 -x 2.73 +z 1.052 -z 1.02 |  |
