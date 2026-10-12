# tools/library

Registers a validated object so another zone can place it by id instead of recooking it.

The tool does not call Imagine, does not run assetcheck / objsheet / walkaround, and does not draw. `add` reads report files that those tools already wrote.

```bash
python3 tools/library/library.py add --intake intake.json
python3 tools/library/library.py list
python3 tools/library/library.py check
python3 tools/library/library.py check --id fixture-solid
```

Exit **0** when `add` writes a manifest or `check` finds every object still PASS (lock WARNs allowed). Exit **1** when a report is refused or a recheck fails. Exit **2** when the command is not understood.

`add` refuses any FAIL that is not a grandfathered `lock/` WARN (`locked: true` or a `lock/` path). Objsheet and walkaround must have `"ok": true`. Walkaround magnification above 1.0 is refused.

A layout spec lists `{ "library": "<id>" }` where it would list an `asset.json` path. Path strings keep the previous behaviour. `resolve_spec_entry` returns that same string, or the registered paths for an id. Law and the reuse steps: [`biome/library/README.md`](../../biome/library/README.md). Schema: [`biome/library/schema.json`](../../biome/library/schema.json).

`add` also refuses the part unless all six intake guards hold. Visual KEEP alone is not enough. A fixture may stub the fields; this command does not open the PNGs or the meshes.

| Guard | Refuse when |
| --- | --- |
| Art Director KEEP | `art_director` is not `KEEP`, and no gate report carries a KEEP flag |
| Run PASS | `run.verdict` is not `PASS` from `object-gate` or `tools/gate` |
| Collision | no box with `space: "local"`, or `ground_anchor` / `min_clearance_m` is missing |
| Camera layer | `camera_layer` is not `key` or `approach` (play-check shot kinds) |
| LOD chain | lod0/1/2 triangle counts are missing, or outline diff at 15 m or 40 m is not 0 px |
| Textures | a texture is under 1024 native pixels, or `mipmaps` is not true |

An intake may name `shotSheet` (a `tools/objsheet` shot-verdict JSON). While that verdict is `PENDING`, or the Art Director marked it `FAIL`, `add` refuses. `KEEP` with empty defects is the only sheet that passes. Omitting `shotSheet` leaves the previous add path unchanged. The manifest schema does not gain a field.

## Block KEEP

`kind: "block"` registers a block-builder KEEP into the same library. The manifest (`library-block/1`) stores:

- `glbs.lod0` / `lod1` / `lod2`
- `plates` (front, side, and any other named view), each file native **1024×1024**
- `profile.id` and `profile.path` (the block-builder JSON profile)
- `gate.path` and the stored verdict
- `contentHash`, SHA-256 of those glb, plate, profile, and gate bytes

`add` refuses a gate report that is not PASS. A lock WARN (`locked: true`, or a `lock/` path) is stored as WARN. `check --id` re-reads the files, re-checks the gate, and re-hashes the bytes. `resolve_registered` returns those paths. It does not copy them and it does not call Imagine.

## Honest limits

- Verdicts, texture sizes, and LOD outline diffs are the JSON you point at. This command does not open the PNGs or the meshes.
- `check` confirms the paths exist and the reports still pass. It does not rebuild the hull.
- An empty library `check` exits 0. That is not a zone.

## Self-test

```bash
python3 tools/library/selftest.py
python3 tools/library/selftest_intake.py
python3 tools/layout/selftest.py
```

`selftest_intake.py` proves each bad fixture is refused: KEEP with a run FAIL, run PASS with no KEEP, missing local boxes / `ground_anchor` / `min_clearance_m`, missing camera layer, outline diff above 0 at 15 m or 40 m, missing per-LOD triangle counts, texture under 1024 or without mipmaps. A complete fixture is accepted.

The layout self-test must stay green: a spec that still uses path strings writes the same `clearing.json`.
