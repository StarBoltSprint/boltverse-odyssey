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

A layout spec lists `{ "library": "<id>" }` where it would list an `asset.json` path. Path strings keep the previous behaviour. Law and the reuse steps: [`biome/library/README.md`](../../biome/library/README.md). Schema: [`biome/library/schema.json`](../../biome/library/schema.json).

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
