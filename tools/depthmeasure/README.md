# depthmeasure: real relief depth vs apparent relief (70 % rule) + grazing outline break

```
python3 -m tools.depthmeasure.measure tools/depthmeasure/terrace-doorwall.spec.json a.glb:old b.glb:new --out DIR
```

- **Renders** each GLB headless at phone settings: DPR 2.6, internal ratio 1.5, vfov 48. Views are 45° and grazing (15°), with the camera 3 m and 8 m from the wall centre. They are auto-framed from the wall pixels found in the model (`auto_frame`, `facing`).
- **Measures:** it reads back float world-position and uv buffers of the same frame (the depth buffer, in metres).
- **Per relief (plate-pixel region in the spec):**
  - `apparent_m` comes from the MoGe-2 metric depth of the plate (`moge_depth`), which is independent of the mesh;
  - `real_m` comes from the mesh points under those pixels, relative to the wall plane fitted under `wall_box`;
  - PASS needs `real >= 0.7 x apparent`.
  - Kinds: `recess` (door), `protrusion` (cornice, snow cap, icicles), `texture` (joint depth, p95-p5).
- **Outline (grazing views):** the silhouette must leave the wall plane by at least `outline_break_m` (0.3 m).
- **Output:** `DIR/depth-table.json` and `DIR/<label>-<view>.jpg`.

## Limits
- The shipped spec reads plate-front-v35 pixels. The v3.5 tier-1 door panel is mapped to `front2` (t1-right-v35), which has no MoGe depth file. A model must therefore texture the piece from plate-front-v35, or a spec for its own plate and depth must be added.
- `stone-joints` apparent depth is capped at 0.2 m, because the MoGe high-pass reads 2.3 m of noise at this range.
