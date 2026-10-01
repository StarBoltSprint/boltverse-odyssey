# Object library

One validated object, reused by id in every zone that needs it. Cook the Imagine views once. Do not recook the same object for the next clearing.

This folder holds no biome style. Ids, paths, and report verdicts only. Prompt prose stays in the file `source.promptRef` points at. It is not copied into the manifest.

## What a builder does

1. Cook the object's Imagine views (8 yaws, every 45°). Gate them:
   - `python3 tools/assetcheck/check.py` on the stills
   - `python3 tools/objsheet/sheet.py` on the view set
   - `python3 tools/walkaround/build.py` after that sheet exits 0
2. `python3 tools/library/library.py add --intake <intake.json>`
   `add` accepts the object only when assetcheck, objsheet, and the walkaround `qc/report.json` are PASS. A WARN on a `lock/` file, or `locked: true`, is allowed. Anything else is refused. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`. A WARN is not a recook.
3. Later zones name the id. They do not name a new cook.

```json
"hero": {
  "count": 1,
  "assets": [{ "library": "fixture-solid" }],
  "scale": [0.9, 1.1],
  "band_m": [9.0, 11.5]
}
```

`python3 tools/layout/layout.py generate` resolves the id to that object's `asset.json` and writes `library_id` on the placed record. A path string in `assets` is unchanged. If the category omits `scale` and every entry is a library id, the manifest scale band is the band. If the category sets `scale`, that band wins.

`python3 tools/library/library.py list` prints ids and verdicts. `check` re-reads the report files and the view set. A missing file or a report that no longer PASSes is FAIL.

## Manifest

Schema: [`schema.json`](schema.json) (`library-object/1`). One folder per id: `biome/library/<object-id>/manifest.json`.

| Field | Meaning |
| --- | --- |
| `source.imagineIds` | Imagine job ids. Not prompt text. |
| `source.promptRef` | Path of the prompt file. |
| `views` | View directory, file names, yaw step 45°. |
| `shape.method` | Walkaround surface name (`surface-nets` or `legacy-voxels`). |
| `shape.walkaround` | Output directory of `tools/walkaround/build.py`. |
| `reports` | Paths and verdicts for assetcheck, objsheet, and walkaround. |
| `scale` | Min, max, and default. Layout uses this only when the zone spec omits `scale`. |
| `collider` | Circle radius in metres. Invisible shape. |
| `lod.billboardViews` | Far impostor view file names. Not drawn by this tool. |
| `asset` | `asset.json` the layout places. |

`fixture-solid` is a synthetic test object. Its pixels are not Imagine. Do not hang it. See that folder's README.

## Honest limits

- `add` does not re-run the measure tools. It reads `ok` and the check statuses in the reports you pass. A report that says PASS for a different file can be recorded. `check` notices a later FAIL in that same file. It does not prove the stills are the subject.
- The library does not copy PNGs. If the view path moves, `check` FAILs until the manifest is updated.
- Reuse is the asset path and the collider recorded on the manifest. Layout's loader still prefers `hull.npz` for the placed radius when numpy can read it, then `footprint`, then `placement.collisionRadius`. Those can differ by a few centimetres. The manifest does not override that loader.
- Code still does not draw the object. The zone places the invisible shape. Visible pixels stay the Imagine views (or, for `fixture-solid`, the synthetic PNGs).
