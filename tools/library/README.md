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

## Block KEEP

`kind: "block"` registers a block-builder KEEP into the same library. The manifest (`library-block/1`) stores:

- `glbs.lod0` / `lod1` / `lod2`
- `plates` (front, side, and any other named view), each file native **1024×1024**
- `profile.id` and `profile.path` (the block-builder JSON profile)
- `gate.path` and the stored verdict
- `contentHash`, SHA-256 of those glb, plate, profile, and gate bytes

`add` refuses a gate report that is not PASS. A lock WARN (`locked: true`, or a `lock/` path) is stored as WARN. `check --id` re-reads the files, re-checks the gate, and re-hashes the bytes. `resolve_registered` returns those paths. It does not copy them and it does not call Imagine.

## Honest limits

- Verdicts are the JSON you point at. This command does not open the PNGs.
- `check` confirms the paths exist and the reports still pass. It does not rebuild the hull.
- An empty library `check` exits 0. That is not a zone.

## Self-test

```bash
python3 tools/library/selftest.py
python3 tools/layout/selftest.py
```

The layout self-test must stay green: a spec that still uses path strings writes the same `clearing.json`.
