# tools/kit — key image + spec → relief kit (GLB) + contact sheet + metrics

```bash
python3 tools/kit/kit.py build --key zd-bible-1012/key-zd1-b.jpg --spec tools/kit/specs/zd-tier-v5.json \
  --mask tier_plus_cornice_mask.png --fit-camera --out out/zd-tier
# --fit (+ --door door_mask.png) fills width/recess from SAM masks + key lines, clamped by rule depths
```

Writes `kit-lod0.glb`, `kit-lod1.glb`, `kit-lod2.glb`, `contact.jpg` (key+IoU overlay, keycam, near 3 m, oblique 45°, grazing, chase) and `metrics.json`.
Exit 0 PASS, 1 a gate failed (files still written), 2 usage.

| Module | Does |
|---|---|
| `fit.py` | SAM mask → ground edge → width; Sobel step lines in the mask; door mask → recess; **rule clamps** (rise 2–3 m, tread 1.5–3.5 m, recess ≤ 2.5 m) because monocular depth inflates; `fit_camera` searches the key camera against the mask. |
| `build.py` | Pieces: stepped tiers, recess (carved as 4 closed blocks), cornice **seated on a support block**, thick rounded drifts with a draping lip, icicles of mixed length (beta distribution, many short). Real displacement along normals from the library height maps (triplanar) + per-block push, **faded with distance** from the play spine. |
| `geom.py` | Closed subdivided boxes, cones, welding, normals, open-edge count. |
| `render.py` | CPU camera + silhouette + flat-shaded contact views + metrics (IoU raw/closed, dE flat vs key, triangles per LOD, open edges, texture px/m, repetition). |
| `glb.py` | Dependency-free GLB writer (Y-up). |
| `shader/hexTriplanar.js` | three.js `onBeforeCompile` patch: triplanar + hex tiling (same math as the material bake) + key gain; `probePxPerM()` for the **live** texel check. |
| `legacy/` | The 2026-10-13 Blender scripts (v1–v6), verbatim, for provenance. |

Gates: `iou_closed ≥ 0.85`, `iou_raw ≥ 0.75`, `open_edges == 0`, lod0 ≤ budget (90k), texture ≥ 500 px/m. `px_per_m_live` is `null` here on purpose: it is only filled by the viewer probe.

## Honest limits (2026-10-13)
- The parametric box tiers give **IoU 0.46 raw / 0.55 closed** on Zone D. The v4 Blender build reached 0.75/0.87 because it extruded the **SAM outline** of tier 1; that outline extrusion is still only in `legacy/relief5.py`–`relief6.py`. Port it next (`pieces()` → polygon extrude from `fit.hit_plane`).
- The contact sheet is flat-shaded mean colour, not the textured shader. Art judgement still needs the play build.
- Adaptive tessellation is per-LOD, not per-face: lod0 is uniform `res_m[0]`, so budget is controlled by `res_m` (0.22 m → 83.6k tris on Zone D).

## Self-test
```bash
python3 tools/kit/selftest.py
```
