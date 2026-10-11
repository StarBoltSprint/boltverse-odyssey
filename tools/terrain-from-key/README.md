# tools/terrain-from-key

Zone B heightfield from the key image. Method and steps: [`docs/METHOD/terrain-from-key.md`](../../docs/METHOD/terrain-from-key.md).

| File | Role |
| --- | --- |
| `run.py` | Entry point: build the field, run the gates, write the step folder. |
| `mask_depth.py` | Colour ground mask and optional depth. |
| `build_field.py` | Skyline fill and field composer. |
| `geom.py` | Camera axes and rays (convention checked at start). |
| `gates.py` | Terrain gates (silhouette, depth order, features, LOD pop, approach, repetition, corridor, vertex cost). |
| `features.json` | Named features the gate checks. |
| `height-splat.mjs`, `keyed-field.mjs` | Runtime pieces copied into `staging/`. |
| `staging/` | Staging page served beside the live preview (live `index.html` untouched). |
| `serve.py` | Local server for staging (`--port 8767`). |
| `capture_play.mjs` | Loading-then-terrain play captures through the capture gate. |
