# tools/relief

Redo the sandbox relief from [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md). Review only. Not a hang.

## Assets

| File | What |
| --- | --- |
| `assets/relief/plate0.png` | Locked still. Frame index 12 of the Imagine plate video. 1280×720. |
| `assets/relief/depth-plate.png` | Test-1 depth of that still. Near = white. |
| `assets/relief/panorama-138.png` | Test 2c KEEP. 3916×720. Plate window x=1355 is byte-identical to `plate0.png`. |
| `assets/relief/depth-panorama-138.png` | Depth of that panorama. Plate window locked to `depth-plate.png`. Sides softened. |

No plate video. The video drifts and the loop snaps. Bolt stays `lock/bolt-gallop-cycle.mp4` and is never on this carrier.

## Depth

Needs `onnxruntime`, `numpy`, `pillow`, and a Depth Anything V2 Small ONNX (input `pixel_values`). The ONNX is not in the repo.

```bash
python3 tools/relief/bake_depth.py \
  --color assets/relief/panorama-138.png \
  --lock assets/relief/depth-plate.png \
  --lock-x 1355 \
  --model /path/to/depth_anything_v2_small.onnx \
  --out assets/relief/depth-panorama-138.png
```

The 3916 image is inferred as tiles at x = 0, 960, 1920, 2636 (1280 wide, 320 overlap, height 700, cosine blend).

## Outpaint

Imagine image-to-image only. Do not ask it to pan.

1. Center `plate0.png` in a wider black canvas (the first seed was 2120×720).
2. Extend one side. Search scale and offset for the lowest overlap MAE.
3. Hard-paste every pixel that was already kept, including the whole plate window. Do not blend the center.
4. Repeat until the strip is 3916×720 and the plate still sits at x=1355.

Accepted seams were about overlap MAE 0.02–3.5. Plate MAE stays 0.

## Viewer

Raw WebGL2. No Three.js. Constants are in the doc: grid 857×158 on the panorama, AMP 0.9, FOV 46°, eye z 6.2, yaw clamped to about −31.27°..+30.55°, Bolt keyed on top with depth test off. A texture wider than 4096 must be split. The 138° file is 3916, so it is one texture.
