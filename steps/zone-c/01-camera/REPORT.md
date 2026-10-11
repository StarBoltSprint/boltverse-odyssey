# Zone C — camera

Not playable. The painted shell is rejected. Cliffs are imagine-to-3d solids, not terrain relief.

## Lock

MoGe-2 (MIT) on `key-zc1`, causeway pixels only (the yellow box in `horizon.jpg`).

| Measure | Value |
|---|---|
| Vertical field | 51.47° |
| Horizontal field | 81.19° |
| Eye height | 1.508 m |
| Pitch | +7.95° (looks up; same sign as `geom.pitch_for_horizon`) |
| Horizon row | 0.645 of the frame |
| Deck plane RMS | 0.014 m |
| Deck depth | 7.36 m |

The horizon crosses the far lip of the causeway. The gorge and the cliffs stand above it. Sky depth is not used.

## Rejected

`camera_solve.py` (LSD, then luminance lips) did not lock. The moss between the slabs breaks the edges: left residual 77 px, and the two lines meet below the frame. That result is not the camera.

## Run

```bash
python3 tools/terrain-from-key/moge_ground.py --image key-zc1.jpg --out steps/zone-c/01-camera
```

Weights stay outside git (`VISION_MODELS_DIR`, default `/workspace/models/vision`).
