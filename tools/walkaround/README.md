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

KEEP default is **8** horizontal views at **45°**. A voxel stays when **7 of 8** of those silhouettes agree. Neighbor silhouettes in one elevation band must stay within area **±15%** and height **±8%**. The underside of a flat cut is closed with a rounded cap. Enclosed voids are filled so the back is not a see-through bite. An elevated still (a top view, a 3/4 view) is not hole-filled: a hollow that still shows in that still stays open.

The default surface is **surface nets** on a finer occupancy grid (`max(64, 2×grid)`, capped at 128) plus Taubin smoothing (`--smooth-iters`, default 8). That mesh is invisible shape. Visible color is a nearest sample of the original PNG, chosen per fragment. `--legacy-voxels` (or `--surface voxels`) keeps the old cube grid and the per-voxel view id.

On a pass the command prints source width and height for every view, hull vertex count, mean seam fraction, and the distance at which magnification stays ≤ 1:

```text
PASS walkaround out=... maxMagnification=0.98 atDistance=3.30 views=8 vertices=12000 seam=0.12 surface=surface-nets depth=png
  source yaw-000.png 160x200 yaw=0.0 elev=0.0
```

Budget: **2–3** walk-around objects per clearing.

## Config

See `config.example.json`.

| Field | Meaning |
| --- | --- |
| `objectSize` | `[width, height, depth]` in world units. |
| `views` | `{file, yawDeg}` for each still. Optional `elevationDeg` (or `elevDeg`) for a top or 3/4 camera. Optional per-view `distance`, `eyeY`, `fovYDeg`. Omitted list: eight `*.png` files in yaw order, 0° then +45°. |
| `camera.distance` / `eyeY` / `fovYDeg` | Shared camera when a view does not set its own. `eyeY` is the legacy horizontal path. `elevationDeg` places the eye on a sphere and replaces `eyeY` for that view. |
| `vote` | Default **7** of the horizontal ring. |
| `grid` | Legacy voxel resolution, and the base for the smooth occupancy grid. Default 32. |
| `subObjects` | Optional parts with their own view set. See below. |
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
| `asset.json` | Cameras (including `elevationDeg` and `group`), placement, approach cap, vertex count, `drawsOwnPixels: false`. Format stays `walkaround-hull-1`. |
| `hull.npz` | `solid` occupancy (the collider), `origin`, `voxelSize`, and per-surface-point `position`, `normal`, `view`, `u`, `v`, `seamView`, `seamWeight`. `viewVol` is the same view id on the grid (−1 = empty). A smooth build also stores `meshVertices`, `meshNormals`, `meshIndices`, `meshGroup`. |
| `mesh.bin` | Smooth mesh only. Little-endian `MSH1`, then vertex count, index count, flags `1`, group count, float32 positions, float32 normals, uint32 indices, uint16 group per vertex. No color in this file. |
| `views/*.png` | Byte copies of the input stills. A sub-object’s files are stored as `{name}-{file}`. |
| `masks/*.png` | Silhouette used to carve. |
| `qc/*.png` | Textured hull from each source camera, plus `qc/behind.png`. |
| `qc/report.json` | Source size per view, vertex and triangle counts, seam fraction, magnification per view, holes, silhouette lock, protrusion flags, sub-objects. |

On the smooth mesh, each fragment picks the source view whose direction best matches the normal, weight `(normal · viewDir)^8`, and keeps it only when that view’s silhouette and z-buffer see the fragment. The second-best view is blended only when its weight is at least **0.65** of the best (a narrow seam). No third view, no mip, no blur. A sub-object samples only its own views. If nothing is visible, the best-facing still is used so the fragment is not left black. The choice does not follow the viewer’s yaw.

`viewVol` is still written, one id per voxel, so an older occupancy raymarcher can load the same `hull.npz`. That path chops the picture on the grid. The draw that keeps the source sharp is the mesh, sampling the PNG at native resolution (`tools/walkaround/web/view.html`).

Sandbox draw:

1. The occupancy grid is the collider. It is not the picture.
2. Color pass projects the mesh fragment into the chosen still and `texelFetch`s the original PNG (nearest, one mip level). No lighting term. No yaw-based texture switch.

## Source gates

These run after the stills are decoded and before any voxel is carved. A failure writes `qc/report.json` and does not write `asset.json`. The same checks are on the object sheet, so a session sees them before the build. Skipping the sheet does not skip them here.

| Gate | FAIL |
| --- | --- |
| Frame margin | Unfilled mask within **3%** of any side, or touching the frame. Cropped source views carve the hull. |
| Interior holes | Enclosed transparent pixels above **0.2%** of the interior, on a horizontal still. The build does not paint those pixels closed. A top or 3/4 still (pitch ≥ 25°) may show a real opening; that opening is recorded and is not this fail. Horizontal carving still flood-fills enclosed dark pixels for the occupancy vote; the hole fraction is stored from the unfilled mask and fails first. |
| File size | Width or height above **2048**, measured from the decoded file. |
| Handedness | `right` is not `cross(forward, worldUp)`, or a point on +X at yaw 0 is not screen-right. Bearing 90 selects yaw 90, not yaw 270. After the QC renders, a view that matches its horizontal mirror better than the source (by more than 0.02 mean absolute error) also fails. A tie on a symmetric solid is not a fail. |

`asset.json` records `handedness` (`schema` `walkaround-basis-1`) and `footprint` (`type` circle, `source` `hull-xz`). `placement.collisionRadius` is that ground radius. `placement.boundingRadius` is the 3D bound and is not the collider.

## How Grok uses it

One solid, one hull. Every copy of that solid is an instance. A camera-facing card is not a volume. `tools/playcheck` row `solids_world_locked` fails a solid whose screen crop stays the same across a 5° orbit step.

1. `python3 tools/objsheet/sheet.py --views … --config … --out …` and stop unless it exits 0.
2. `python3 tools/walkaround/build.py --views … --config … --out hulls/<object>`. Read `qc/report.json`. Magnification ≤ 1. `sourceGates` and `handedness` are PASS.
3. `python3 tools/layout/layout.py generate` then `layout.py check`. Colliders are the hull footprint, one per instance. A circle the size of `edge_ring.radius_m` is a ring wall and fails `collider_eq_visual`.
4. In the play view, copy `tools/walkaround/runtime/hullmesh.js` and `tools/walkaround/runtime/basis.mjs` together. Mount each asset once. Pass every placement of that asset to `setInstances`. Nothing draws until that call. `collide` uses the footprint. Do not stop the hero on `edge_ring.radius_m`.

```js
import { mountHull } from "./hullmesh.js";
import { chaseBasis } from "./basis.mjs";

const rock = await mountHull(gl, "hulls/rock/asset.json");
rock.setInstances(placements);
rock.draw(viewProjection, 0, idRgb);
const hit = rock.collide(heroX, heroZ, heroRadius);
const basis = chaseBasis(headingDeg);
```

`placements` entries are `{ id, position, yaw_deg, scale, base_y_m }`. `position` is `[x, z]` or `[x, y, z]`. Repeated stones of one asset are one mount and one static matrix buffer.

`chaseBasis`: heading 0 looks along +Z, heading 90 looks along +X, `right = cross(forward, worldUp)`. If steering feels backwards, negate the turn input. Do not negate `right`. A stored camera whose right is the mirror is refused at load. View index follows yaw: bearing 90 selects the yaw-90 still, not yaw 270.

When [`biome/docs/65-render-quality.md`](../../biome/docs/65-render-quality.md) is on main, repeated draws follow that instancing law. Until then this runtime is the volume contract. Far-band cards with no collider stay the impostor path in [doc 62](../../biome/docs/62-open-world-zones-process.md). A solid that can stop the hero is a hull.

Sampling stays `texelFetch` of the original PNG. Code does not draw, shade, or colour a pixel. Magnification stays ≤ 1 on a 720×1600 view. Imagine stills are at most 2048 px on a side, measured from the file.

## Elevation

A view with `elevationDeg` (degrees above the horizon, 90 = top) is carved as a mandatory mask: a voxel whose center lands on the background of that still is removed. Pitch at or above 25° is elevated. Those stills are locked only against other stills in the same 15° pitch band. One top view is not compared to the side ring. Horizontal stills still flood-fill enclosed holes. Elevated stills do not, so a ring or a bowl can stay open.

## Sub-objects

A protruding part can bring its own stills. The parent stills stay the body. The part is meshed in its own frame, moved so `localAttach` sits on `joint`, and the parent voxels that the part occupies past the joint are cleared (`overlap` defaults to 1.5 parent voxels). `axis` is stored so a runtime can rotate the part. This command does not animate it.

```json
"subObjects": [
  {
    "name": "spur",
    "config": "spur/config.json",
    "viewsDir": "spur/views",
    "joint": [0.48, 0.08, 0.0],
    "localAttach": [-0.08, 0.0, 0.0],
    "axis": [0.0, 1.0, 0.0]
  }
]
```

Sub-objects are built only with the smooth surface. `--legacy-voxels` plus `subObjects` is a FAIL.

A 3-voxel opening flags narrow parts (`qc/report.json` → `protrusions`). A flag is a bbox and a suggested joint. It does not cook stills and it does not cut the hull.

## Flags

| Flag | Effect |
| --- | --- |
| `--surface nets` | Default. Surface nets + Taubin. |
| `--surface voxels` / `--legacy-voxels` | Occupancy raymarch, per-voxel view id. |
| `--surface-grid N` | Occupancy resolution for the smooth hull. |
| `--smooth-iters N` | Taubin iterations. Default 8. Displacement stays inside 1.75 voxels. |
| `--depth-relief F` | Inward depth recess as a fraction of local thickness. Default 0.35 on nets when depth is present, 0.10 on voxels. |

Depth only recesses. It does not add shell outside the silhouettes. On the smooth path, with at least four depth views, a voxel moves inward only when two of them agree. A depth set that would delete more than 60% of the solid is rejected.

## Depth numbers in `qc/report.json`

Every method, including the default, writes the same depth block. Adding the numbers does not move the default mesh.

| Field | Meaning |
| --- | --- |
| `depthMetrics.units` | `metres`. |
| `depthMetrics.perView[].nearM` | Closest camera-space z of that view's shipped surface, in metres. |
| `depthMetrics.perView[].farM` | Farthest camera-space z of that view's shipped surface, in metres. |
| `depthMetrics.perView[].meanOffsetM` | Mean depth-refine recess for that view, metres along camera z. |
| `depthMetrics.perView[].maxOffsetM` | Max of that recess. |
| `depthMetrics.refinement.meanOffsetM` | Mean of the per-view means, over views that had a depth map. |
| `depthMetrics.refinement.maxOffsetM` | Max of the per-view maxima. |
| `depthMetrics.refinement.applied` | True only when the depth carve kept the solid. False when depth was skipped, the carve was rejected, or the method is an optional shape (those do not recess). |
| `depthMetrics.refinement.source` | `skipped`, `png`, or `depth-anything-v2`. Same value as `depthRefine`. |
| `depthMetrics.refinement.depthRelief` | The fraction of local thickness the carve is allowed to use. |
| `depthMetrics.bboxDepth` | World-Z extent of the shipped mesh, or of the occupancy solid when there is no mesh. Metres. |
| `depthMetrics.bboxMin` / `bboxMax` | That axis-aligned box. |
| `depthMin`, `depthMax`, `depthRange` | Minimum `nearM` and maximum `farM` across views. Copied onto `hull` as well. |

`tools/reportview` reads `depthRange`, or `depthMin` and `depthMax`, on the report or on `hull`. The per-view metres, the two offsets, and `bboxDepth` are the fields that page can show from `depthMetrics`.

The offset is how far the depth target sits behind the visual-hull front. It is not a second surface. `nearM` and `farM` describe the surface that was actually written.

## Optional shape

Omit `--shape` and the build is the silhouette volume, surface nets, and Taubin, as above. These flags do not change that path.

| Flag | When to try it | What it does |
| --- | --- | --- |
| `--shape photogrammetry` | The object is rigid and you have four Imagine turntable videos, each 90°, pinned first and last, plus the usual HD stills. An optional top-rise video can be set in config `topRise` or `--top-rise`. | CPU structure-from-motion in the declared cameras, then a star mesh (one radius per direction). The HD stills are projected with the same native-resolution projector as the default. |
| `--shape primitive --primitive box` | The object is a box. A face-on silhouette and a diagonal one differ by more than the ±15% area lock, so that lock is the wrong test. | Fits an invisible box to the silhouettes. Reports silhouette IoU per view and corner-seam warnings. The area lock is waived and recorded. |
| `--shape primitive --primitive cylinder` | The object is a vertical cylinder (axis world Y). | Same fit, round section. A tube lying on its side will not fit. |
| `--compare --shape …` | You want the default and one or more options on the same stills. | Writes `qc/report.json` (`comparison.schema` = `walkaround-compare-1`), `qc/report.md`, and five thumbnails per method under `qc/compare/<method>/` (four sides and one 3/4-high). Recommended = highest score among methods with `ok` true. |

Photogrammetry config (file paths are resolved next to the config, or under `--videos`):

```json
"turntables": [
  {"file": "videos/q0.mp4", "yawStartDeg": 0, "yawEndDeg": 90}
],
"topRise": {"file": "videos/top.mp4", "yawDeg": 0, "elevStartDeg": 20, "elevEndDeg": 70}
```

Four clips are required. `--turntable path:yawStart:yawEnd` four times overrides the config. `--photogram-engine cpu` (default) uses OpenCV on the CPU. `--photogram-engine colmap` shells out to COLMAP with GPU flags off. If `colmap` is not installed, that engine FAILs. It does not switch to `cpu` and it does not switch to the silhouette hull.

A poor registration FAILs in `qc/report.json` (`shape.ok` false, `shape.fallback` set) and the process exits non-zero. The message says the run did not switch methods. Re-run without `--shape photogrammetry` to use the default. Nothing here silently substitutes the default mesh.

Reported for photogrammetry: `registeredFrameRatio`, `meanReprojectionPx`, `pointCount`, `meshFaces`, `holes`, `loopClosureSilhouetteIoU`. The loop check compares the pinned first frame of the first clip with the pinned last frame of the last clip. A turntable whose object changes shape between those frames FAILs even when neighbouring frames still match.

Honest limits:

- The default method is unchanged. Optional shapes are not a better default.
- The star densifier cannot reconstruct a dent or a through-hole. One radius per direction around the centroid.
- There is no GPU in this builder. COLMAP's CPU path is present and untested when the `colmap` binary is absent; the selftest runs the CPU engine.
- Video frames are used for shape only. Colour stays a nearest sample of the HD stills. Code does not draw pixels.
- A box corner is a seam when the two faces pick different stills. The warning is the point of the report.
- Primitive silhouette IoU is the fit measure. The ±15% / ±8% lock remains the default method's gate.
- `--compare` of a failed requested method exits non-zero even if another method scores higher. The report still names the recommendation. It does not copy the failed mesh into the pass.

## Web view

`web/view.html` loads `asset.json`, `mesh.bin`, and the copied PNGs. Serve the asset folder and open the page with `?root=` pointed at it. Sampling is nearest. There is no lighting pass. The page prints `PASS` only when `gl.getError()` stays 0.

## Proof

`proof/` holds before/after stills of the synthetic rock (the only view set checked into this repo). Left is `--legacy-voxels`. Right is surface nets. Same camera. `compare-*-x4.png` is a nearest-neighbor viewing copy of that pair, not an upscale of the asset. `viewing-yaw-090.png` is the same camera and fov drawn into more pixels so the staircase is easier to see. Its magnification is above 1. It is not the legal QC. `bowl-top.png` and `assembly-yaw-090.png` show an elevated opening and a supplied part. `python3 tools/walkaround/selftest.py --proof` regenerates them. The synthetic PNGs are not Imagine pixels.

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
