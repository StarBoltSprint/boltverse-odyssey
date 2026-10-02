# Geometry lock

Owner-approved **2026-10-02**. Practice. Not an xAI seal. The short form is rail 12 in [`spec.md`](../spec.md). This page is the long form. Do not cook from it.

It sits on the pages that already exist. It does not replace them.

| Page | What it still owns |
| --- | --- |
| [`biome/docs/24-camera-1point.md`](../biome/docs/24-camera-1point.md) | Sprint Video A is a conical 1-point lock-off. The Frost cone formula `w(y) = k(y − 0.38)` is that sealed teacher. |
| [`biome/docs/23-plate-geo-qc.md`](../biome/docs/23-plate-geo-qc.md) | The dash hang gate. Thresholds stay sealed. |
| [`biome/docs/20-default-plate-proportions.md`](../biome/docs/20-default-plate-proportions.md) and [`20b`](../biome/docs/20b-frost-aurora-proportions.md) | Frame measures. `withersFrac ~0.10` is the chase-plate fraction. φ is an audit. |
| [`biome/prompts/camera-1point.txt`](../biome/prompts/camera-1point.txt) | The pitched sprint paste. Do not rewrite it. |
| [`biome/docs/COLD_START-camera.md`](../biome/docs/COLD_START-camera.md) | The paste order before a sprint hang. |
| [`VISTA.md`](../VISTA.md) | Shader moon clearance at 0.36. That discard is not a cook horizon. |

## Horizon

A **level** camera puts the horizon at **50%** of the frame height.

On **720×1600** that row is **y = 800**.

A horizon at **0.382** (`1/φ²`), at **0.38**, or at **1/3** means the camera is **pitched**. Verticals converge. Never mix that horizon with a level 1-point plate.

The Frost aurora KEEP measured a road diamond near **0.38**. That number stays in laws 20, 20b, 24, and 43 as the pitched cone those plates were sealed on. Law 23 still walks the dashes toward 0.38 and does **not** fail a fitted VP.y against 0.382 (fat tubes sit near 0.62). Do not retarget that judge to 0.50.

A **new** level plate uses 0.50. A new plate may use 0.38 only when the pitch in degrees is written in the spec and in the prompt.

`VISTA.md` discards the moon below 0.36. Pass that number only when a pitched check is the thing being asked. It is not the level row.

## Attitude

| Attitude | What it is | Where |
| --- | --- | --- |
| 1-point | Looking down one axis. One vanishing point. Verticals parallel. | Chase plates and ground plates that show a horizon. Level horizon **0.50**. |
| 2-point | A corner, level. Two vanishing points, both on the horizon. | 3/4 orbit views. Elevation locked (below). |
| 3-point | Tilted. Three vanishing points. | Hero shots only: drone, planet arrival. |
| Orthographic | Straight down. No vanishing point. No horizon. | Ground tiles. |

Sprint Video A stays the law 24 cone: one point, lock-off, not 2-point, not 3-point. A level chase plate is that cone with the horizon at 0.50. The sealed Frost plate is the same cone with a stated historical pitch (diamond at 0.38). Do not mix the two in one prompt.

## Sky

Imagine has no panorama and no documented pixel width. A 2k token is not a width. Measure the file.

Rectilinear slices, horizontal field **≤ 60°**. Wider than about **70°** stretches the edges.

Close the circle with:

- **8** slices
- **60°** horizontal field
- **45°** step
- **25%** overlap, because `(60 − 45) / 60 = 0.25`
- `8 × 45 = 360`

An equirectangular image exists only in code. Width = **2 ×** height (`2π / π`).

Focal length in pixels, from the measured width:

```
f_px = (W / 2) / tan(HFOV / 2)
```

Example: W = 720, HFOV = 60° → `360 / tan(30°) = 360√3 ≈ 623.538`.

Law 64’s 22.7° line (`required_px = play_width / (hfov / 360)`, about 11500 px on a 720 px view) is the magnification budget for a narrow slice. It is not this closing set.

## Turnaround

| Set | Yaw step |
| --- | --- |
| 8 views | 45° |
| 4 views | 90° |

A 120° set does not pass.

Elevation **+15°**. One distance. One focal length: the **85 mm** class, horizontal field about **24°** (the report allows 23–25). The same light on every view.

Imagine does not document a consistent turntable. A multi-image edit takes at most **5** source images.

The ship KEEP prompt says “eighteen degrees”. That string stays in [`learn/recipes/hull-ship-xai-starship-hero.md`](recipes/hull-ship-xai-starship-hero.md). A new turnaround uses +15°. Do not rewrite the KEEP chain to match.

## Light

One sun. State azimuth and elevation in degrees. State one kelvin. Do not invent a kelvin when the scene did not name one.

```
shadow length = height / tan(elevation)
```

A **45°** sun throws a shadow as long as the object is tall.

## Scale

```
h_px = f_px × H / Z
```

Lock Z and f. Bolt’s withers are about **0.60 m**, measured at the shoulders. State the pixel fraction, then measure the file.

Law 20 `withersFrac ~0.10` stays the chase-plate frame fraction. Do not grow the sprite to hit it (law 56). The 0.60 m figure is the dog, not a reason to enlarge a cutout.

## Ground

Orthographic. Straight down. No vanishing point. No horizon.

A seamless tile is not an Imagine mode. QC the edges. Texel density is pixels per world metre, and it stays constant across the set.

Cook size stays about **0.90 m**. Magnification stays **≤ 1** at 720×1600 (law 56 and the ground-tiles skill).

Do not run the law 23 dash judge on a nadir tile. It looks for three dash tubes and will fail a good tile (law 43). The tile check is `--report texel`. That report is not the hang gate.

## φ and π

Phi and Fibonacci do not fix perspective. They stay an audit in laws 20 and 20b. Pi is only for closing a circle and for converting degrees to radians.

## Reports

`biome/scripts/plate-geo-qc/plate-geo-qc.py` still judges dashes when you pass plates and no `--report`. That path is law 23. Exit 0 hangs. Exit 1 recooks.

These reports print a rail 12 result. They do not rewrite pixels and they do not change the dash thresholds.

```bash
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report horizon --image plate.png
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report horizon --image plate.png --pitch-deg 8
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sky --manifest sky.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report turn --manifest views.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sun --manifest sun.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report texel --manifest tiles.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report scale --manifest scale.json --bolt
python3 biome/scripts/plate-geo-qc/selftest.py
```

| Report | Pass |
| --- | --- |
| `horizon` | Strongest row-mean step within ±0.02 of **0.50**, and no pitch stated. A step near 0.38, 0.382, or 1/3 passes only with a nonzero `--pitch-deg`. A stated pitch on a 0.50 row fails. Strength under 15 luma fails. |
| `sky` | 8 slices, HFOV 60°, step 45°, overlap 0.25, yaws 0, 45, …, 315, every `widthPx` measured and equal, `f_px` from that width. Equirect only when `projection` is `equirect` and width/height is 2. |
| `turn` | 8×45° or 4×90°. Elevation exactly +15°. One distance. HFOV within 24±1. `sourceCount` ≤ 5. Missing width warns and skips `f_px`. Unequal measured widths fail. |
| `sun` | Azimuth, elevation, and one kelvin all stated. Shadow = height / tan(elevation). At 45° the shadow equals the height. Optional images: shading azimuths stay inside a 90° half-plane. |
| `texel` | Density = image width / metres. Relative spread above 0.02 fails. An edge seam uses the assetcheck limits (ratio 2.2 and absolute 12). A horizon step of strength ≥ 15 fails. |
| `scale` | `h_px = f_px × H / Z`. `--bolt` locks H at 0.60 m. A measured fraction more than 0.02 away from `h_px / frameH` fails. No measured fraction warns and still prints the formula. |

`--report` with plate paths exits 2. The dash judge does not read the report flags.
