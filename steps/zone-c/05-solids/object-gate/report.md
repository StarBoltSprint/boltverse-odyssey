# object-gate report — FAIL

URL http://127.0.0.1:8772/?along=0 · adapter zone-c-solids · 2026-10-12T04:32:43.697Z

## Runtime
| Check | Status | Detail | Fix hints |
|---|---|---|---|
| console 720x1600 | PASS | no console / page errors |  |
| shader compile 720x1600 | PASS | all programs compiled |  |
| title 720x1600 | PASS | "Zone C solids" |  |
| portrait viewport 720x1600 | PASS | inner 720x1600 |  |
| capture ready 720x1600 | PASS | loaded, cover 0.9976 |  |
| budgets 720x1600 (report only, quality first) | INFO | {"renderInfo":{"calls":7,"triangles":56228,"textures":8,"geometries":4,"programs":3},"visibleMeshes":6,"sceneTris":60724,"pixelRatio":1} |  |
| draw calls 720x1600 | PASS | 7 draws (max 12) |  |
| perf: report 720x1600 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |
| console 412x915 | PASS | no console / page errors |  |
| shader compile 412x915 | PASS | all programs compiled |  |
| title 412x915 | PASS | "Zone C solids" |  |
| portrait viewport 412x915 | PASS | inner 412x915 |  |
| capture ready 412x915 | PASS | loaded, cover 0.9982 |  |
| budgets 412x915 (report only, quality first) | INFO | {"renderInfo":{"calls":7,"triangles":56228,"textures":8,"geometries":4,"programs":3},"visibleMeshes":6,"sceneTris":60724,"pixelRatio":1} |  |
| draw calls 412x915 | PASS | 7 draws (max 12) |  |
| perf: report 412x915 | INFO | page has no window.__perfReport(); phone perf rows skipped | Expose window.__perfReport() (see tools/perf/phone-bench/README.md) so the gate can check canvas ratio and draw order. |

## Objects

| Object | Type | Verdict | FAIL rows | PENDING rows |
|---|---|---|---|---|
| arch-left | rock | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating), mesh sealed (non-manifold / open edges) | hidden face pending-plate #5 arch-left-back, hidden face pending-plate #6 arch-left-sides, hidden face pending-plate #15 solids-contact |
| arch-right | rock | FAIL | repetition (capture autocorrelation), visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating), mesh sealed (non-manifold / open edges) | hidden face pending-plate #7 arch-right-back, hidden face pending-plate #8 arch-right-sides, hidden face pending-plate #15 solids-contact |
| cliff-left | rock | FAIL | approach morph 300->10 m, grounding (no floating) | hidden face pending-plate #9 cliff-left-back, hidden face pending-plate #10 cliff-left-sides, hidden face pending-plate #15 solids-contact |
| gorge-rock | rock | FAIL | repetition (capture autocorrelation), approach morph 300->10 m, grounding (no floating), mesh sealed (non-manifold / open edges) | hidden face pending-plate #11 gorge-rock-back, hidden face pending-plate #12 gorge-rock-sides, hidden face pending-plate #15 solids-contact |
| cliff-right | rock | FAIL | visible px/m (phone sharpness from >= 8 m, final render), approach morph 300->10 m, grounding (no floating), mesh sealed (non-manifold / open edges) | hidden face pending-plate #13 cliff-right-back, hidden face pending-plate #14 cliff-right-sides, hidden face pending-plate #15 solids-contact |

### arch-left (rock) — FAIL

hero copy arch-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008 |  |
| UV stretch <= 1.3 | PASS | max 1.284 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.3284 at lag 8,65 px; face x peak 0.1784 at lag -6,-45 px; close peak 0.1659 at lag -22,-9 px; low-portrait peak 0.1138 at lag -15,46 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | the surface shows no detail at all (13 tiles flat, e.g. black or unlit): 0.0 px/m of real detail on screen vs 118.5 needed (capture at 8.06 m, zoomed to 237.1 screen px/m; median of 0 tiles, p25 0.0; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 50.6 px/m on arch-left, 1/1 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-left: 67 frames, min IoU 0.8, jumps at 199 m (0.82), 170.6 m (0.82) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst arch-left 3.06 m at -9.1,-21.2 | Sink each copy below its LOWEST footprint corner (worst needs 3.35 m), fill concave bases, add sand drift. |
| hidden face pending-plate #5 arch-left-back | PENDING | 2144 tris back 2144; plate file not on disk | Cook Imagine plate #5 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #6 arch-left-sides | PENDING | 2003 tris side 962, grazing 1041; plate file not on disk | Cook Imagine plate #6 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #15 solids-contact | PENDING | 270 tris bottom 270; plate file not on disk | Cook Imagine plate #15 before this face can pass. Do not invent the pixels. |
| mesh sealed (non-manifold / open edges) | FAIL | arch-left tris 5520 nonManifold 6 open 0 | Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export. |
| facade relief >= 0.5 m | PASS | arch-left +x 1.799 -x 2.264 +z 2.009 -z 2.079 |  |

### arch-right (rock) — FAIL

hero copy arch-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008 |  |
| UV stretch <= 1.3 | PASS | max 1.000 |  |
| repetition (capture autocorrelation) | FAIL | face z: no object area >= 48x48 px in the capture; face x: no object area >= 48x48 px in the capture; close peak 0.169 at lag -15,-19 px; low-portrait peak 0.2096 at lag -15,-23 px (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | the surface shows no detail at all (9 tiles flat, e.g. black or unlit): 0.0 px/m of real detail on screen vs 118.5 needed (capture at 8.04 m, zoomed to 237.1 screen px/m; median of 0 tiles, p25 0.0; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: no plate surface sampled | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | arch-right: 67 frames, min IoU 0.7, jumps at 270.8 m (0.70), 244.4 m (0.77), 232.1 m (0.79), 199 m (0.79) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst arch-right 2.54 m at 8.2,-10.6 | Sink each copy below its LOWEST footprint corner (worst needs 2.84 m), fill concave bases, add sand drift. |
| hidden face pending-plate #7 arch-right-back | PENDING | 1352 tris back 1352; plate file not on disk | Cook Imagine plate #7 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #8 arch-right-sides | PENDING | 1261 tris grazing 647, side 614; plate file not on disk | Cook Imagine plate #8 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #15 solids-contact | PENDING | 150 tris bottom 150; plate file not on disk | Cook Imagine plate #15 before this face can pass. Do not invent the pixels. |
| mesh sealed (non-manifold / open edges) | FAIL | arch-right tris 3468 nonManifold 6 open 0 | Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export. |
| facade relief >= 0.5 m | PASS | arch-right +x 0.61 -x 0.489 +z 0.882 -z 2.986 |  |

### cliff-left (rock) — FAIL

hero copy cliff-left

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008 |  |
| UV stretch <= 1.3 | PASS | max 1.257 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.1253 at lag 0,44 px; face x peak 0.1164 at lag 16,-94 px; close peak 0.1099 at lag 13,31 px; low-portrait peak 0.1716 at lag 14,-42 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | PASS | 132.4 px/m of real detail on screen vs 118.5 needed (capture at 8.04 m, zoomed to 237.1 screen px/m; median of 17 tiles, p25 46.4; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 22.2 px/m on cliff-left, 1/1 surfaces under |  |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-left: 67 frames, min IoU 0.724, jumps at 270.8 m (0.76), 257.2 m (0.72), 244.4 m (0.80), 232.1 m (0.79) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst cliff-left 5.91 m at -9.7,-44.2 | Sink each copy below its LOWEST footprint corner (worst needs 6.21 m), fill concave bases, add sand drift. |
| hidden face pending-plate #9 cliff-left-back | PENDING | 1214 tris back 1214; plate file not on disk | Cook Imagine plate #9 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #10 cliff-left-sides | PENDING | 852 tris side 522, grazing 330; plate file not on disk | Cook Imagine plate #10 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #15 solids-contact | PENDING | 162 tris bottom 162; plate file not on disk | Cook Imagine plate #15 before this face can pass. Do not invent the pixels. |
| mesh sealed (non-manifold / open edges) | PASS | cliff-left tris 3112 nonManifold 0 open 0 |  |
| facade relief >= 0.5 m | PASS | cliff-left +x 1.777 -x 1.498 +z 1.286 -z 1.076 |  |

### gorge-rock (rock) — FAIL

hero copy gorge-rock

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008 |  |
| UV stretch <= 1.3 | PASS | max 1.281 |  |
| repetition (capture autocorrelation) | FAIL | face z peak 0.625 at lag 56,184 px; face x peak 0.2617 at lag -22,-71 px; close peak 0.2327 at lag -21,-50 px; low-portrait: no object area >= 48x48 px in the capture (max 0.65, at plate period 0.5) | Visible periodic tiling: replace the tiled plate with unique full-res Imagine sections; break any remaining repeat with a second Imagine variant + low-frequency mask.<br>If the capture angle is unusable, fix the spec `hero:` or the object's front axis. |
| visible px/m (phone sharpness from >= 8 m, final render) | PASS | 157.6 px/m of real detail on screen vs 118.5 needed (capture at 8.03 m, zoomed to 237.1 screen px/m; median of 1 tiles, p25 157.6; phone 1080x2400, render pixel ratio 1, vfov 51.47°). Info: plate sampling worst +z 12.6 px/m on gorge-rock, 1/1 surfaces under |  |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | gorge-rock: 67 frames, min IoU 0.738, jumps at 270.8 m (0.79), 257.2 m (0.79), 209.5 m (0.75), 199 m (0.76) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst gorge-rock 6.21 m at -3.5,-56.6 | Sink each copy below its LOWEST footprint corner (worst needs 6.51 m), fill concave bases, add sand drift. |
| hidden face pending-plate #11 gorge-rock-back | PENDING | 686 tris back 686; plate file not on disk | Cook Imagine plate #11 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #12 gorge-rock-sides | PENDING | 675 tris side 430, grazing 245; plate file not on disk | Cook Imagine plate #12 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #15 solids-contact | PENDING | 98 tris bottom 98; plate file not on disk | Cook Imagine plate #15 before this face can pass. Do not invent the pixels. |
| mesh sealed (non-manifold / open edges) | FAIL | gorge-rock tris 1900 nonManifold 4 open 0 | Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export. |
| facade relief >= 0.5 m | PASS | gorge-rock +x 0.689 -x 0.71 +z 0.879 -z 0.868 |  |

### cliff-right (rock) — FAIL

hero copy cliff-right

| Check | Status | Detail | Fix hints |
|---|---|---|---|
| select | PASS | 1 placed copies |  |
| texture roles declared | PASS | key-zc1.jpg=plate |  |
| texture filtering (mips, trilinear, anisotropy = max, no resize) | PASS | 1 textures trilinear + aniso 16 |  |
| plates not downscaled vs Imagine originals | PASS | key-zc1.jpg gpu 1792x1008 served 1792x1008 original 1792x1008 |  |
| UV stretch <= 1.3 | PASS | max 1.284 |  |
| repetition (capture autocorrelation) | PASS | face z peak 0.2702 at lag 9,322 px; face x peak 0 at lag -2,-301 px; close peak 0.4151 at lag -1,-12 px; low-portrait peak 0.3978 at lag 1,12 px (max 0.65, at plate period 0.5) |  |
| visible px/m (phone sharpness from >= 8 m, final render) | FAIL | no steep surface of cliff-right found at 4/5/3/6/7/8/2.5 m above the ground on its path-facing side. Info: plate sampling worst +z 32.7 px/m on cliff-right, 1/1 surfaces under | Needs >= 118.5 px/m of visible detail at 8 m. Unique plates: one native 1024x1024 Imagine plate covers at most 8.6 x 8.6 m. Layered materials: raise the detail layer's density or keep its distance fade beyond 8 m. Never upscale. |
| repetition (visible): identical plate pixels never within 30 m | PASS | no plate repeats inside the radius (one shared plate set per type allowed) |  |
| repetition (visible): neighbours never share plates (< 7 m) | PASS | 1 copies, none within 7 m of another |  |
| approach morph 300->10 m | FAIL | cliff-right: 67 frames, min IoU 0.824, jumps at 244.4 m (0.82), 179.6 m (0.85), 125.4 m (0.87), 107.5 m (0.88) | A LOD swap or variant swap changes the silhouette. Keep one silhouette at every distance (LOD1 = decimated LOD0 with the same cuts, or no swap), crossfade if a swap is unavoidable. |
| grounding (no floating) | FAIL | 1/1 copies float; worst cliff-right 14.36 m at 14,-29.6 | Sink each copy below its LOWEST footprint corner (worst needs 14.66 m), fill concave bases, add sand drift. |
| hidden face pending-plate #13 cliff-right-back | PENDING | 416 tris back 416; plate file not on disk | Cook Imagine plate #13 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #14 cliff-right-sides | PENDING | 337 tris grazing 171, side 166; plate file not on disk | Cook Imagine plate #14 before this face can pass. Do not invent the pixels. |
| hidden face pending-plate #15 solids-contact | PENDING | 30 tris bottom 30; plate file not on disk | Cook Imagine plate #15 before this face can pass. Do not invent the pixels. |
| mesh sealed (non-manifold / open edges) | FAIL | cliff-right tris 1028 nonManifold 2 open 0 | Weld, heal coincident faces, cap open loops in Blender (heal_manifold) before export. |
| facade relief >= 0.5 m | PASS | cliff-right +x 1.836 -x 0.931 +z 0.433 -z 0.433 |  |
