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
| `causeway_field.py` | Zone C deck, then the moss plates (`apply_plates`). Does not run the dune composer. |
| `camera_solve.py` | LSD / lip attempt. Rejected on Zone C (moss breaks the lips). MoGe is the lock. |
| `gates.py` | Terrain gates (silhouette, depth order, features, LOD pop, approach, repetition, corridor, vertex cost). |
| `features.json` | Named features the gate checks. |
| `height-splat.mjs`, `keyed-field.mjs` | Runtime pieces copied into `staging/`. |
| `staging/` | Staging page served beside the live preview (live `index.html` untouched). |
| `serve.py` | Local server for staging (`--port 8767`). `--zone c --port 8771` serves the causeway page. |
| `capture_play.mjs` | Loading-then-terrain play captures through the capture gate. PNG names include the pixel size. |
| `sheet.py` | Key still beside one terrain frame. |

Zone C plates (the kept height field stays on disk; this does not call MoGe):

```bash
python3 tools/terrain-from-key/run.py --zone c --attempt 1
python3 tools/terrain-from-key/serve.py --zone c --port 8771
node tools/terrain-from-key/capture_play.mjs http://127.0.0.1:8771/?along=0 steps/zone-c/03-terrain/renders along0 1280 720
python3 tools/terrain-from-key/run.py --zone c --score
node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/scene.yaml --url http://127.0.0.1:8771/?along=0 --out steps/zone-c/03-terrain/object-gate
```

`--score` writes CIEDE2000 from the 16:9 key-camera render and sets `pass` only when that row and `object-gate/report.json` are both clear. Path IoU uses the deck. The saved path also copies the far lip, and that copy is not the silhouette. Station stretch is reference px/m over the material in use, not the two-axis foreshortening of the pitch. The 8 m sharpness pose stands at eye height on the plate field. A ray back along the pitched view goes under the mesh.

The system `python3` has no torch. Rebuilding the height field needs the venv that loads MoGe-2 (`/workspace/.venv-sam2`). Depth Anything V2 Large is a cached comparison number only. Do not rebuild the field to change plates.
