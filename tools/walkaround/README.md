# Walk-around hull

One command turns a folder of still views of **one** object into a closed invisible hull the sandbox can load. It does not call Imagine. It does not cook views. It is not for Bolt. Bolt stays `lock/bolt-gallop-cycle.mp4`.

Law: [`biome/docs/59-invisible-depth-carrier.md`](../../biome/docs/59-invisible-depth-carrier.md). Method: [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md) (walk-around hull, Script). Clearing placement (Rocky Clearing take 3 KEEP): [`biome/docs/61-free-clearing-walk.md`](../../biome/docs/61-free-clearing-walk.md). Boulders only. Bolt stays a keyed video.

The hull is a depth/occlusion carrier. It has no color, no texture, no lighting. Every visible pixel is a nearest sample of an original PNG. This is not a license for procedural or mesh-drawn worlds.

Do not point this at the live hang `https://boltverse-odysseyyyy.grok.me`.

## Command

```bash
python3 tools/walkaround/build.py \
  --views <views-dir> \
  --config <config.json> \
  --out <out-dir> \
  --model /path/to/depth_anything_v2_small.onnx
```

Needs `numpy` and `pillow`. Depth Anything V2 also needs `onnxruntime` and the Small ONNX (`pixel_values`, ImageNet mean/std, near = white). The ONNX is not in the repo. Inference may resize internally for the depth network only. The color PNGs are never resized.

`--depth-dir` accepts precomputed near=white PNG depth maps with the **same file names and the same pixel size** as the views. A size mismatch is a FAIL. Do not pass `--model` and `--depth-dir` together.

KEEP default is **8** views at **45°**. The voxel stays when **7 of 8** silhouettes agree. Neighbor silhouettes must stay within area **±15%** and height **±8%**. The underside of a flat cut is closed with a rounded cap. Holes are filled so the back is not a see-through bite.

Budget: **2–3** walk-around objects per clearing.

## Config

See `config.example.json`.

| Field | Meaning |
| --- | --- |
| `objectSize` | `[width, height, depth]` in world units. |
| `views` | `{file, yawDeg}` for each still. Omitted: eight `*.png` files in yaw order, 0° then +45°. |
| `camera.distance` / `eyeY` / `fovYDeg` | Fixed cameras the stills were shot from. |
| `vote` | Default **7**. |
| `grid` | Voxel resolution along each axis. Default 32. |
| `approach.minDistance` | Nearest eye distance from the origin. Omit it and the tool picks the nearest distance that keeps magnification ≤ 1. |
| `viewport` | Screen width, height, vertical fov for the magnification check and the QC renders. Default: the source still’s own size and the camera fov. Do not set this above the still. KEEP stills in doc 60 are 1248×1584. |
| `placement.position` | Fixed world position. Collision radius is written from the hull. |

## Pixels — never upscale

Imagine pixels must not be enlarged or degraded.

- Source files are copied byte-for-byte. JPEG and any non-PNG still are refused.
- Sampling is nearest-neighbor at native resolution. No blur kernel. No mipmaps. No lossy re-encode.
- A narrow seam may mix the two nearest source pixels. It never averages the set of views.
- Screen texel density at the allowed approach stays at or below one source pixel per screen pixel.
- Magnification of a view is the hull’s projected height or width in screen pixels, divided by that still’s silhouette height or width. The max of those ratios is the view’s magnification.
- `qc/report.json` records `magnification.perView[].maxMagnification`. Every value must be **≤ 1.0**.
- Above 1.0 the command prints `FAIL upscale`, writes the report, and exits non-zero. `approach.capDistance` in the report is the nearest legal eye distance. Cap zoom and approach there. QC PNGs are rendered at that legal distance so the check images are not themselves an upscale.

## Output

| File | What |
| --- | --- |
| `asset.json` | Cameras, placement, approach cap, `drawsOwnPixels: false`. |
| `hull.npz` | `solid` occupancy, `origin`, `voxelSize`, and per-surface-point `position`, `normal`, `view`, `u`, `v`, `seamView`, `seamWeight`. `viewVol` is the same view id on the grid (−1 = empty). |
| `views/*.png` | Byte copies of the input stills. |
| `masks/*.png` | Silhouette used to carve. |
| `qc/yaw-000.png` … | Textured hull from each source yaw, plus `qc/behind.png`. |
| `qc/report.json` | Magnification per view, interior hole pixels, gap-reentry fraction, coverage, silhouette lock. |

`view` is chosen per surface point from the fixed cameras, weight `(normal · viewDir)^8`. It does not read the viewer’s yaw. `u`/`v` are native pixel coordinates of the voxel center. A renderer should project the hit point into that view and `texelFetch` the original PNG (nearest). Fallback is the nearest facing view. The sample is never left black on purpose: a missed silhouette falls back to the nearest facing still.

Sandbox draw:

1. Depth pass on `solid` only. Color writes off. The hull contributes occlusion, not pixels.
2. Color pass samples `views[viewVol]` at the hit point’s projection. No lighting term. No yaw-based texture switch.

## Synthetic test

The repo has no Imagine rock views from the 2026-09-30 tests. `make_synthetic.py` writes a bumpy ellipsoid (black void, 8 yaws) for the command to chew on. Those PNGs are not Imagine pixels.

```bash
python3 tools/walkaround/make_synthetic.py --out /tmp/synthetic-rock
python3 tools/walkaround/build.py \
  --views /tmp/synthetic-rock/views \
  --config /tmp/synthetic-rock/config.json \
  --depth-dir /tmp/synthetic-rock/depth \
  --out /tmp/synthetic-rock/out
```

A checked-in run of that synthetic set lives in `testdata/synthetic-rock/`.
