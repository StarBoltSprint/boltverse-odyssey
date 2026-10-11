# tools/terrain-from-key

Zone B heightfield from the key image. Method and steps: [`docs/METHOD/terrain-from-key.md`](../../docs/METHOD/terrain-from-key.md).

| File | Role |
| --- | --- |
| `run.py` | Entry point: build the field, run the gates, write the step folder. |
| `mask_depth.py` | Colour ground mask and optional depth. |
| `build_field.py` | Skyline fill and field composer. |
| `geom.py` | Camera axes and rays (convention checked at start). |
| `moge_ground.py` | MoGe-2 metric plane on the causeway: eye height, pitch, field of view. |
| `sam_masks.py` | SAM2 small masks for the solids in one key still. |
| `causeway_field.py` | Zone C deck only. Does not run the dune composer. |
| `camera_solve.py` | LSD / lip attempt. Rejected on Zone C (moss breaks the lips). MoGe is the lock. |
| `gates.py` | Terrain gates (silhouette, depth order, features, LOD pop, approach, repetition, corridor, vertex cost). |
| `features.json` | Named features the gate checks. |
| `height-splat.mjs`, `keyed-field.mjs` | Runtime pieces copied into `staging/`. |
| `staging/` | Staging page served beside the live preview (live `index.html` untouched). |
| `serve.py` | Local server for staging (`--port 8767`). `--zone c --port 8771` serves the causeway page. |
| `capture_play.mjs` | Loading-then-terrain play captures through the capture gate. PNG names include the pixel size. |
| `sheet.py` | Key still beside one terrain frame. |

Zone C:

```bash
/workspace/.venv-sam2/bin/python tools/terrain-from-key/run.py --zone c
python3 tools/terrain-from-key/serve.py --zone c --port 8771
node tools/terrain-from-key/capture_play.mjs http://127.0.0.1:8771/?along=0 steps/zone-c/03-terrain/renders along0 1280 720
```

The system `python3` has no torch. The venv above is the one that loads MoGe-2. Depth Anything V2 Large is a cached comparison number only.
