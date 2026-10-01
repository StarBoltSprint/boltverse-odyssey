# tools/layout

Writes and checks one `clearing.json` per zone. The file is the placement. Builders do not type object coordinates by hand.

The tool computes **invisible shape only**: positions, yaw, scale, relief height, and collider circles. It does not draw, shade, or colour a world pixel. Every visible pixel stays an Imagine asset named by the file. The top-down PNG is a kitchen diagram of that shape, not a play view and not an Imagine still.

Law: [`biome/docs/63-layout-file-and-validator.md`](../../biome/docs/63-layout-file-and-validator.md) and [`biome/docs/62-open-world-zones-process.md`](../../biome/docs/62-open-world-zones-process.md). Hull manifests come from [`tools/walkaround`](../walkaround/README.md).

Python 3.10+. Standard library only. `numpy` is optional: if a walkaround folder has `hull.npz` and numpy imports, the footprint radius is the XZ extent of the occupancy. Otherwise the manifest's `footprint` or `placement.collisionRadius` is the circle.

## Commands

From the repo root:

```bash
python3 tools/layout/layout.py generate \
  --spec tools/layout/testdata/spec.json \
  --out /tmp/zone

python3 tools/layout/layout.py check \
  --clearing /tmp/zone/clearing.json \
  --out /tmp/zone
```

`check` writes `report.md`, `report.json`, and `debug-topdown.png`. It prints one `PASS` or `FAIL` row per rule. Exit **0** when every row passes. Exit **1** when any row fails. Exit **2** when the file or an asset cannot be read.

Paste `report.md`. A layout PASS does not open a play URL.

`python3 tools/layout/selftest.py` rebuilds the synthetic zone and checks the committed samples.

## What the spec asks for

`testdata/spec.json` is the worked spec. Keys stay generic. No paint word is a key.

| Block | Meaning |
| --- | --- |
| `zone` | Circle, centre, radius, 0.90 m tiles, relief amplitude and seed. |
| `ring.radius_m` | Centreline of the edge ring. |
| `gates` | Bearing, opening width (chord metres), frame asset, `leads_to`. |
| `hero` | Body width and radius. Width is the largest gap the ring may leave, apart from gates. |
| `categories` | Assets plus count or a fill, scale band, and for interiors an annulus `band_m`. |
| `limits` | Spawn clearance, minimum gap, path width, gate-cone length and half-angle, yaw and scale epsilon. |
| `view` | 720×1600, vertical fov, `mag_max`, follow distance `boom_m`, eye height. |

Categories used by the sample: `ring`, `exit` (gate jambs), `mid`, `near`, `hero`. Counts live in the spec. Doc 61's walk-around interior budget is the `hero` budget (sample max 3). The edge ring is not that budget.

Asset paths point at a walkaround `asset.json` (or the same shape of manifest). The loader reads, in order:

1. `sourcePx.width` / `sourcePx.height` on the manifest (silhouette pixels, not a padded frame).
2. Else `qc/report.json` → `silhouetteLock.perView`, using the **smallest** width and height so the magnification check stays conservative.
3. Else the first camera's frame size. A full frame is larger than the silhouette, so this **under-estimates** magnification. Prefer a silhouette.

Footprint: `footprint` circle or convex polygon, else `hull.npz` when numpy is present, else `placement.collisionRadius`.

## What generate writes

Schema `clearing/1`. Placement fields sit on the doc 63 objects. `tools/playcheck` (when that tree is present) reads this file as `--layout`. Its reader treats `position` as **`[x, z]`**, heading **0 = +z** and **90 = +x**, `edge_ring.hulls[].width_deg`, `interior_objects[].radius_m`, and gate `width_m` as a chord. Those fields are always written. Extra keys (`colliders`, `scale`, `base_y_m`, `limits`, `hero`, `variants`, `budgets`, fog `instances`) are ignored by that reader.

`base_y_m` is the relief height. It is not stuffed into `position`, because that slot's second component is z.

The same seed writes the same bytes. Interior positions and relief use seeded 2D simplex. The noise does not draw.

## Check rows

| Row | FAIL when |
| --- | --- |
| `ring_closed` | A 1° ray from the centre misses the visual ring or the collider ring outside a gate, or the missed arc is longer than `hero.width_m`. Both gaps are printed. |
| `collider_eq_visual` | A collider has no object, an object has no collider, the centre or radius differs by more than 2 cm, or an outward ray hits a collider more than 0.5 m before any visual. The invisible-stop distance and heading are printed. |
| `gate` | Frame asset or `frame_ids` missing, the opening chord is narrower than the hero and the path, or a collider's angular span enters the opening. |
| `path` | Clearance from the spawn point to the gate mouth is under half `path_width_m`. |
| `gate_cone` | A solid circle meets the cone in front of a gate. |
| `spawn_clearance` | A solid surface is inside the spawn disk. |
| `separation` | An interior overlaps another solid, or the air gap is under `min_gap_m`. Adjacent ring pieces may overlap; that is how the ring closes. |
| `relief` | `base_y_m` is not the simplex relief at that xz (tolerance 0.5 mm). |
| `mag` | On-screen magnification at the closest follow-camera distance exceeds `view.mag_max`. |
| `variety` | A neighbour matches asset, yaw (within epsilon), and scale together, or a category's variants are not spread (counts differ by more than 1). |
| `fog_band` | Fewer than 20 patches, or an instance sits outside the annulus. |
| `near_lens` | Spawn surface is closer than `near_lens.cull_m`. |
| `budgets` | A category count is outside the range copied into the file. |
| `playcheck_data` | The 1° `width_deg` test from `tools/playcheck/src/layout.mjs` misses. **Data half only.** |
| `bolt_paths` | `bolt.gallop` or `bolt.idle` is empty. This does not open the files. |

## Magnification

Square-pixel focal length from `view.height` and `view.fov_y_deg`. World height and width at `scale`, divided by the closest distance, times that focal length, divided by `sourcePx`.

Closest distance is the follow camera: scaled footprint radius + `hero.radius_m` + `view.boom_m`, combined with the vertical gap between eye height and the object's mid height. If the manifest also has `approach.capDistance` and `approach.maxMagnification`, that figure is computed at the same distance and the **larger** of the two magnifications is kept.

If the play camera can move closer than `boom_m`, the row is optimistic. Set `boom_m` to the real minimum.

## Samples

| Path | What |
| --- | --- |
| `sample/good/` | Seed 11. 16/16 PASS. Closed ring, clear gate, magnification 0.61 at the worst object. |
| `sample/broken/` | The same file after `mutate.py`. Exit 1. |

The broken edit is intentional: visuals removed on headings [40°, 143°), colliders kept; one neighbour cloned; one near object scaled to 4; one mid object lifted to `base_y_m` 3.5; the hero moved onto the gate centreline; the gate frame cleared. Measured on this seed: visual gap **104°** at 42.5°, collider gap **0°**, **16** collider-only ids, invisible stop **17.37 m** at heading 42.5°. See `sample/broken/NOTES.md`.

## Honest limits

- A paired object and collider can still be invisible in the play view. Take 8 passed a data check while the phone showed an empty ring, a stop near 17 m, and no gate. This tool would have failed the **file** faults in `sample/broken` (missing visuals, extra colliders, blocked gate). It cannot see a draw call that writes nothing. Rendered pixels are `tools/playcheck` when that command is on the tree (`node tools/playcheck/run --layout clearing.json`). It is not on this branch (open PR #132, not merged). The good sample was loaded with that PR's `normalizeLayout` + `ringRays`: 0 missed 1° rays. The broken sample misses 104. The selftest runs the same import when `tools/playcheck/src/layout.mjs` is on the tree. Until a framebuffer run exits 0, do not claim that PASS. `playcheck_data` is only the data half of that reader's ring test.
- The diagram is drawn by this process (filled circles, lines). It is not the phone.
- Ring closure samples every 1°. A crack thinner than that sample can pass `max_gap_deg: 0` only if no sample lands in it. The hero-width test uses the measured run of missed samples.
- A polygon manifest is placed and checked as its bounding circle (the ring, the path, and the separation row all use that circle). Height is used for relief and magnification, not for a 3D intersection. The occupancy grid inside `hull.npz` is not the collider the check walks, beyond that one radius.
- Fog streaks, blur, WebGL errors, and whether a texture actually appears are outside this tool.
- `sourcePx` taken from a camera frame instead of a silhouette makes `mag` look safer than the phone.
