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
| `serve.py` | Local server for staging (`--port 8767`). |
| `capture_play.mjs` | Loading-then-terrain play captures through the capture gate. |

## Generic path (2026-10-13, tools/11)
- Per-zone config: `zones/<zone>.json`. `zone-b.json` holds every value that used to be hard-wired in `run.py` /
  `mask_depth.py` (paths, sand/sky colour rules, slab/sun/tower bands): `TFK_ZONE=zone-b python3 run.py` is unchanged.
- `generic.py --zone zone-d` (or `--config` / `--key`): masks from the key itself (`masks_auto.py`: MoGe-2 MIT ground
  plane by RANSAC + MoGe-2's own sky mask, SAM2 Apache box refine when it agrees; Lab colour-cluster fallback offline),
  then rim relief per azimuth + flat spine, gates, `data/height.bin|json`, `masks.jpg`. Never touches a live page.
- `python3 selftest.py`: Zone B bit-identical regression vs the frozen pre-refactor `tests/legacy_mask_depth_1011.py`
  (real key-city3 + synthetic), generic good/bad fixtures, Zone D offline run.
