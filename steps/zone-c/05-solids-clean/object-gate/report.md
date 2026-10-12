# object-gate report — FAIL

URL http://127.0.0.1:8772/?along=0 · adapter zone-c-solids · 2026-10-12T08:35:07.272Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C solids" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.9976 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":100864,"textures":9,"geometries":6,"programs":3},"visibleMeshes":6,"sceneTris":100864,"pixelRatio":1} |  |
| draw calls 720x1600 | PASS | 11 draws (max 12) |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C solids" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9982 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":100864,"textures":9,"geometries":6,"programs":3},"visibleMeshes":6,"sceneTris":100864,"pixelRatio":1} |  |
| draw calls 412x915 | PASS | 11 draws (max 12) |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows | PENDING rows |
|---|---|---|---|---|
| arch-left | rock | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, oblique-profile, untextured-area |  |
| arch-right | rock | FAIL | repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, oblique-profile, untextured-area |  |
| cliff-left | rock | FAIL | approach morph 300->10 m, oblique-profile, untextured-area |  |
| gorge-rock | rock | FAIL | approach morph 300->10 m, oblique-profile, untextured-area |  |
| cliff-right | rock | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, oblique-profile, untextured-area |  |

### arch-left (rock) — FAIL

hero copy arch-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.148 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.0819 at lag -29,-33 px; face x peak 0.1223 at lag 2,200 px; close peak 0.4817 at lag 0,-300 px; low-portrait peak 0.1508 at lag -4,103 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 78.4 px/m of real detail on screen vs 118.5 needed (capture at 8.87 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 65.8; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 77.1 px/m on arch-left, 5/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-left: 67 frames, min IoU 0.836, jumps at 244.4 m (0.88), 232.1 m (0.86), 199 m (0.84), 170.6 m (0.87) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-left -0.80 m at -11.2,-16.6 |  |
| hidden face plate #5 arch-left-inner | PASS | 3080 tris inner 2290, back 790; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-05-arch-left-inner.jpg |  |
| hidden face plate #11 leaf | PASS | 1494 tris side 1494; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-11-leaf.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 756 tris bottom 756; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-left tris 6120 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-left +x 2.8 -x 2.8 +z 2.8 -z 1.2 |  |
| triangle-quality | PASS | tris 6120 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.798 m (need 0.5); 8m yaw 75 residual 0.4 m (need 0.5); 30m yaw 45 residual 1.809 m (need 0.5); 30m yaw 75 residual 1.548 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 65.42% of 993350px; 30m bad 70.77% of 352063px; hero bad 81.08% of 870059px; orbit bad 58.95% of 944321px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### arch-right (rock) — FAIL

hero copy arch-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.268 |  |
| repetition (capture autocorrelation) | FAIL | face z peak 0.638 at lag 21,0 px; face x peak 0.1466 at lag -17,-2 px; close peak 0.7249 at lag 0,-14 px; low-portrait peak 0.7563 at lag 0,-13 px (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 90.6 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 18 tiles, p25 79.5; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +x 99.8 px/m on arch-right, 3/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-right: 67 frames, min IoU 0.819, jumps at 285 m (0.94), 257.2 m (0.87), 244.4 m (0.91), 232.1 m (0.86) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-right -0.80 m at 6.6,-15.4 |  |
| hidden face plate #6 arch-right-inner | PASS | 1244 tris inner 992, back 252; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-06-arch-right-inner.jpg |  |
| hidden face plate #12 fern | PASS | 1068 tris side 1068; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-12-fern.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 296 tris bottom 296; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-right tris 2860 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-right +x 2 -x 2 +z 2.8 -z 2.8 |  |
| triangle-quality | PASS | tris 2860 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.227 m (need 0.5); 8m yaw 75 residual 0.05 m (need 0.5); 30m yaw 45 residual 0.931 m (need 0.5); 30m yaw 75 residual 0.264 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 40.10% of 1141013px; 30m bad 50.17% of 96808px; hero bad 95.68% of 475886px; orbit bad 30.15% of 906637px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### cliff-left (rock) — FAIL

hero copy cliff-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.078 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.0862 at lag 5,34 px; face x peak 0.3053 at lag 0,24 px; close peak 0.3279 at lag 0,-15 px; low-portrait peak 0.2179 at lag -3,16 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | WARN | 58.6 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 48.4; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 32.1 px/m on cliff-left, 5/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-left: 67 frames, min IoU 0.848, jumps at 285 m (0.88), 270.8 m (0.87), 257.2 m (0.89), 232.1 m (0.87) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst cliff-left -0.80 m at -12.2,-38.8 |  |
| hidden face plate #7 wall-left | PASS | 2168 tris back 2168; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-07-wall-left.jpg |  |
| hidden face plate #9 waterfall | PASS | 8666 tris side 8666; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-09-waterfall.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 1750 tris bottom 1750; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-left tris 14752 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-left +x 2.4 -x 2 +z 2.8 -z 2.4 |  |
| triangle-quality | PASS | tris 14752 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.217 m (need 0.5); 8m yaw 75 residual 0.239 m (need 0.5); 30m yaw 45 residual 1.784 m (need 0.5); 30m yaw 75 residual 1.478 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 0.02% of 1152000px; 30m bad 13.12% of 767604px; hero bad 9.51% of 1145474px; orbit bad 7.13% of 1097002px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### gorge-rock (rock) — FAIL

hero copy gorge-rock

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.041 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.1235 at lag -1,-24 px; face x peak 0.1025 at lag -55,-47 px; close peak 0.2564 at lag 1,13 px; low-portrait peak 0.242 at lag 1,12 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | WARN | 62.1 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 19 tiles, p25 43.8; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 17.8 px/m on gorge-rock, 5/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | gorge-rock: 67 frames, min IoU 0.822, jumps at 285 m (0.82), 244.4 m (0.85), 232.1 m (0.91), 209.5 m (0.88) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst gorge-rock -0.69 m at -0.2,-74.4 |  |
| hidden face plate #10 mist | PASS | 13448 tris side 13448; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-10-mist.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 3312 tris bottom 3312; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #14 gorge-closure | PASS | 3960 tris back 3960; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-14-gorge-closure.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | gorge-rock tris 24680 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | gorge-rock +x 2.4 -x 1.6 +z 1.6 -z 2.4 |  |
| triangle-quality | PASS | tris 24680 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.299 m (need 0.5); 8m yaw 75 residual 0.403 m (need 0.5); 30m yaw 45 residual 1.492 m (need 0.5); 30m yaw 75 residual 1.647 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 1.78% of 1152000px; 30m bad 31.03% of 923108px; hero bad 0.79% of 1096615px; orbit bad 32.71% of 1034997px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### cliff-right (rock) — FAIL

hero copy cliff-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | PASS | max 1.116 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.3218 at lag -143,28 px; face x peak 0.2065 at lag 36,-18 px; close peak 0.1255 at lag -49,-28 px; low-portrait peak 0.1641 at lag 46,-3 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 55.2 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 52.1; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 42.8 px/m on cliff-right, 5/5 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-right: 67 frames, min IoU 0.757, jumps at 270.8 m (0.76), 232.1 m (0.84), 220.5 m (0.90), 179.6 m (0.81) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst cliff-right -0.80 m at 12.2,-32.2 |  |
| hidden face plate #8 wall-right | PASS | 628 tris back 628; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-08-wall-right.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 314 tris bottom 314; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #15 planet | PASS | 5186 tris side 5186; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-15-planet.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-right tris 6756 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-right +x 1.2 -x 1.6 +z 1.2 -z 0.4 |  |
| triangle-quality | PASS | tris 6756 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.246 m (need 0.5); 8m yaw 75 residual 0.18 m (need 0.5); 30m yaw 45 residual 1.073 m (need 0.5); 30m yaw 75 residual 0.572 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 34.09% of 1152000px; 30m bad 25.16% of 348881px; hero bad 61.48% of 643240px; orbit bad 6.48% of 1139740px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |
