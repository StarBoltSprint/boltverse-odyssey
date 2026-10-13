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

## Outline-mask mode (v4 shaping port + v6 snow)
`specs/zd-tier-outline.json` + `specs/zd/*.png` (SAM tier, door, cornice, key snow masks):
```bash
python3 tools/kit/kit.py build --key zd-bible-1012/key-zd1-b.jpg --spec tools/kit/specs/zd-tier-outline.json --out out/zd-tier
```
`outline.py`: masks are back-projected through the **key camera** (alt3d-1013 MoGe camera, verified to the pixel against `legacy/kitfit3.py`) onto the wall plane (tier) and the overhang plane (cornice), then extruded as **clean 2.5-D cells**: each cell has its own front and back depth, walls are split at every depth level, so the solid is watertight (0 open edges). The door recess is cells at 2.5 m; stone blocks are running-bond cells stepped **behind** the outline (0–0.3 m, joints deeper), so relief never grows the silhouette and never spikes. `carve_depth` keeps each cell only as deep as the key mask still covers its top (visual-hull carving), so tread tops do not show where the key shows none. The cornice is seated on a support block, limited to columns the key shows as wall. Per-vertex `_SNOW` (v6 rule: key snow mask seen from the key camera, or a lifted up face) and `_ICE` (down faces of the cornice) go into the GLB; `shader/hexTriplanar.js` mixes the snow tile by `_snow`.

Zone D 2026-10-13: **IoU 0.787 raw / 0.882 closed (0.871 with the v4 `iou4.py` definition)**, 0 open edges, lod0 82.3k / lod1 23.8k / lod2 8.4k tris, snow ratio key 0.395 vs model 0.380 (3.8%, gate 10%). v4 was 0.747 / 0.869; v6 0.741 / 0.849 with snow off by 62%.

## Honest limits (2026-10-13)
- Parametric box mode (no `outline`) is still 0.46 / 0.55 on Zone D; use outline mode when masks exist.
- Outline mode leaves upper tiers off (`upper_tiers: false`), as the v4 key-cam match did; they add ~2x extra area at the key camera. Turning them on is a play-build choice.
- Close views read as stepped cells (0.13 m) with flat cells at the outline edge; there is no texture displacement on top yet. Art Director has not seen it.
- `drifts.outline_k` is 0: lifting drifts past the key outline cost 0.03 IoU; the drift volume comes from the mask.
- 230 non-manifold edges (cells meeting at one edge after carving) are reported, not gated; 0 open edges.
- The shader snow mix is string-tested in node, not compiled in WebGL here.
- The contact sheet is flat-shaded mean colour, not the textured shader. Art judgement still needs the play build.
- Adaptive tessellation is per-LOD, not per-face: lod0 is uniform `res_m[0]`, so budget is controlled by `res_m` (0.22 m → 83.6k tris on Zone D).

## Self-test
```bash
python3 tools/kit/selftest.py
```
