# object-gate report — FAIL

URL http://127.0.0.1:8772/?along=0 · adapter zone-c-solids · 2026-10-12T08:26:32.850Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C solids" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.9976 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":101952,"textures":9,"geometries":6,"programs":2},"visibleMeshes":6,"sceneTris":101952,"pixelRatio":1} |  |
| draw calls 720x1600 | PASS | 11 draws (max 12) |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C solids" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9982 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":11,"triangles":101952,"textures":9,"geometries":6,"programs":2},"visibleMeshes":6,"sceneTris":101952,"pixelRatio":1} |  |
| draw calls 412x915 | PASS | 11 draws (max 12) |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows | PENDING rows |
|---|---|---|---|---|
| arch-left | rock | FAIL | UV stretch <= 1.3, visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, oblique-profile, untextured-area |  |
| arch-right | rock | FAIL | UV stretch <= 1.3, visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, oblique-profile, untextured-area |  |
| cliff-left | rock | FAIL | UV stretch <= 1.3, approach morph 300->10 m, oblique-profile, untextured-area |  |
| gorge-rock | rock | FAIL | UV stretch <= 1.3, approach morph 300->10 m, oblique-profile, untextured-area |  |
| cliff-right | rock | FAIL | UV stretch <= 1.3, approach morph 300->10 m, oblique-profile, untextured-area |  |

### arch-left (rock) — FAIL

hero copy arch-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | FAIL | -y 1.333, -x 1.333, +x 1.333, +y 1.333 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.0685 at lag 258,47 px; face x peak 0.064 at lag 104,-126 px; close peak 0.1029 at lag 0,-13 px; low-portrait peak 0.0841 at lag -96,64 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 83.1 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 73.9; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst -x 29.5 px/m on arch-left, 9/9 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-left: 67 frames, min IoU 0.804, jumps at 285 m (0.81), 257.2 m (0.89), 232.1 m (0.80), 209.5 m (0.91) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-left -0.80 m at -11.2,-14.6 |  |
| hidden face plate #5 arch-left-inner | PASS | 3168 tris inner 2398, back 770; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-05-arch-left-inner.jpg |  |
| hidden face plate #11 leaf | PASS | 1412 tris side 1412; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-11-leaf.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 778 tris bottom 778; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-left tris 6128 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-left +x 2.8 -x 2.8 +z 0.4 -z 2.8 |  |
| triangle-quality | PASS | tris 6128 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.574 m (need 0.5); 8m yaw 75 residual 0.389 m (need 0.5); 30m yaw 45 residual 1.743 m (need 0.5); 30m yaw 75 residual 1.555 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 78.58% of 989858px; 30m bad 80.72% of 366229px; hero bad 78.70% of 877759px; orbit bad 73.56% of 905129px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### arch-right (rock) — FAIL

hero copy arch-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | FAIL | -z 1.333, +x 1.333, -x 1.333, -y 1.333 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.1401 at lag -47,308 px; face x peak 0.1526 at lag -16,-2 px; close peak 0.5758 at lag 0,15 px; low-portrait peak 0.5558 at lag 0,-13 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | 111.0 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 89.1; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +x 35.1 px/m on arch-right, 7/9 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-right: 67 frames, min IoU 0.72, jumps at 244.4 m (0.72), 232.1 m (0.91), 199 m (0.91), 189.1 m (0.82) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst arch-right -0.80 m at 6.6,-15.4 |  |
| hidden face plate #6 arch-right-inner | PASS | 1278 tris inner 1034, back 244; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-06-arch-right-inner.jpg |  |
| hidden face plate #12 fern | PASS | 1159 tris side 1159; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-12-fern.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 310 tris bottom 310; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | arch-right tris 2944 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | arch-right +x 1.6 -x 1.6 +z 2.8 -z 2.8 |  |
| triangle-quality | PASS | tris 2944 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.227 m (need 0.5); 8m yaw 75 residual 0.05 m (need 0.5); 30m yaw 45 residual 0.968 m (need 0.5); 30m yaw 75 residual 1.227 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 20.75% of 1149655px; 30m bad 47.37% of 99805px; hero bad 90.91% of 505755px; orbit bad 29.30% of 915614px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### cliff-left (rock) — FAIL

hero copy cliff-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | FAIL | +z 1.333, -x 1.333, +x 1.333, +y 1.333 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.0574 at lag 0,36 px; face x peak 0.254 at lag 0,-22 px; close peak 0.1998 at lag 0,-18 px; low-portrait peak 0.1661 at lag 1,-12 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | WARN | 41.3 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 40.7; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 18.6 px/m on cliff-left, 9/9 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-left: 67 frames, min IoU 0.795, jumps at 285 m (0.80), 257.2 m (0.89), 244.4 m (0.87), 220.5 m (0.89) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst cliff-left -0.80 m at -12.2,-38 |  |
| hidden face plate #7 wall-left | PASS | 2144 tris back 2144; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-07-wall-left.jpg |  |
| hidden face plate #9 waterfall | PASS | 9036 tris side 9036; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-09-waterfall.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 1820 tris bottom 1820; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-left tris 15144 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-left +x 2.4 -x 2 +z 0 -z 1.6 |  |
| triangle-quality | PASS | tris 15144 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.188 m (need 0.5); 8m yaw 75 residual 0.22 m (need 0.5); 30m yaw 45 residual 1.774 m (need 0.5); 30m yaw 75 residual 1.352 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 31.49% of 1152000px; 30m bad 45.85% of 765565px; hero bad 31.79% of 1140155px; orbit bad 19.86% of 1087168px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### gorge-rock (rock) — FAIL

hero copy gorge-rock

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | FAIL | -x 1.333, +x 1.333, +y 1.333, +z 1.333 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.1558 at lag 0,-24 px; face x peak 0.0935 at lag -49,-44 px; close peak 0.5027 at lag 0,28 px; low-portrait peak 0.378 at lag 2,-12 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | WARN | 45.0 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 12 tiles, p25 41.3; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst -x 15.4 px/m on gorge-rock, 9/9 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | gorge-rock: 67 frames, min IoU 0.81, jumps at 285 m (0.81), 244.4 m (0.88), 232.1 m (0.87), 199 m (0.85) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst gorge-rock -0.69 m at -0.2,-74.3 |  |
| hidden face plate #10 mist | PASS | 13802 tris side 13802; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-10-mist.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 3498 tris bottom 3498; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #14 gorge-closure | PASS | 3766 tris back 3766; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-14-gorge-closure.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | gorge-rock tris 24832 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | gorge-rock +x 2.4 -x 1.6 +z 0 -z 1.2 |  |
| triangle-quality | PASS | tris 24832 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.451 m (need 0.5); 8m yaw 75 residual 0.41 m (need 0.5); 30m yaw 45 residual 1.416 m (need 0.5); 30m yaw 75 residual 1.633 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 10.08% of 1152000px; 30m bad 53.45% of 910497px; hero bad 27.15% of 1090198px; orbit bad 51.64% of 1011697px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |

### cliff-right (rock) — FAIL

hero copy cliff-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate plate-atlas.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 2 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008; plate-atlas.jpg gpu 4096x3072 served 4096x3072 original 4096x3072 |  |
| UV stretch <= 1.3 | FAIL | -x 1.333, +x 1.333, +y 1.333, +z 1.333 | Re-unwrap with equal metres per texel on both axes (surface-aware UV). |
| repetition (capture autocorrelation) | PASS | face z peak 0.1022 at lag 24,-214 px; face x peak 0.2132 at lag 33,-17 px; close peak 0.3214 at lag 0,-21 px; low-portrait peak 0.3696 at lag -1,26 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | WARN | 52.1 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 20 tiles, p25 46.4; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst -x 19.4 px/m on cliff-right, 9/9 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-right: 67 frames, min IoU 0.743, jumps at 285 m (0.74), 220.5 m (0.80), 189.1 m (0.82), 162.1 m (0.88) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | PASS | 0/1 copies float; worst cliff-right -0.80 m at 12.2,-30.9 |  |
| hidden face plate #8 wall-right | PASS | 624 tris back 624; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-08-wall-right.jpg |  |
| hidden face plate #13 causeway-underside | PASS | 320 tris bottom 320; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-13-causeway-underside.jpg |  |
| hidden face plate #15 planet | PASS | 5640 tris side 5640; /workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/plate-15-planet.jpg |  |
| mesh sealed (non-manifold / open edges) | PASS | cliff-right tris 7208 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-right +x 1.2 -x 2 +z 1.2 -z 0 |  |
| triangle-quality | PASS | tris 7208 aspect p95 1.414 (max 8) sliver 0 (max 0.02) facing<1px 0 (max 0.05) spike 0 (max 0.03) normal p90 0° (max 42) |  |
| oblique-profile | FAIL | 8m yaw 45 residual 0.248 m (need 0.5); 8m yaw 75 residual 0.18 m (need 0.5); 30m yaw 45 residual 1.01 m (need 0.5); 30m yaw 75 residual 0.558 m (need 0.5) | A face that is a flat card fails the oblique profile. Keep a real ledge (residual ≥ 0.5 m) or drop the view from the blocking list only when the face cannot be walked around. |
| untextured-area | FAIL | 8m bad 43.74% of 1152000px; 30m bad 39.47% of 370435px; hero bad 72.45% of 615691px; orbit bad 11.92% of 1135223px (max 0.50% grey/black/white) | Every visible face needs an Imagine plate. A flat grey wall is a missing map or a UV that misses the atlas cell. |
