# Boltverse orchestrator v0

A small chief for SmiR's in-house AIs. You give it a list of parts (a hull, a wing, a barrel, a door, a plinth). It reads `AI-REGISTRY.json` and says which specialised AI should handle each part.

It is pure Python 3 plus numpy. A normal laptop can run it. It does not download anything and it does not call a model.

## What v0 does

- Loads the registry into typed, read-only objects.
- Routes each part to at most one AI.
- By default only `validated` AIs are eligible. `in_progress` is eligible only if you pass `--allow-unvalidated` / `allow_unvalidated=True`.
- `failed`, `superseded`, and missing weights are never called. They are reported with a plain reason. (`checkpoint_missing` in the file counts as missing weights.)
- Writes `NO AI YET` when nothing routable exists for that part type. Engine, antenna, wing, and hull/body are in that bucket today. Crate has an entry, but the weights are missing, so it is also `NO AI YET`.
- If several AIs qualify, validated wins over in progress, then the lower CPU time, then the earlier row in the registry. The other qualified AIs are listed as alternatives.
- Can walk the plan with a mock adapter (placeholder values, `"_mock": true`) or, on the machine that has the weights, a command adapter.

On the registry shipped here, a simple ship looks like this:

| part | result |
|---|---|
| hull/body, wing, engine, antenna | NO AI YET |
| barrel | `barrel-B2` (validated). `barrel-B1` is superseded and is not called |
| door | NO AI YET. `door-D1` failed. `door-D2` is in progress |
| plinth | `plinth-shape-v2`, with `plinth-camera-v1` as the alternative (both validated, neither has a CPU time, shape is listed first) |

## What v0 does not do

- It does not run a real AI. Checkpoints live on another machine and are not opened here.
- It does not generate a ship, a mesh, or a texture.
- It does not train anything.
- It does not delete or edit registry rows, and it does not move checkpoints.
- It does not chain the plinth camera and the plinth shape net into one pipeline. One part gets one chosen AI. The other is an alternative.
- It does not search the long English description of an AI. A part matches the `family` field (plus a few aliases: socle, tonneau, porte, tint, colour, pieces, crates). The old shape classifier mentions "wing" and "antenna" in a sentence; that does not make it a wing AI, and it is superseded anyway.

## Run the example

From this directory:

```bash
python -m boltverse_orchestrator plan \
  --registry examples/AI-REGISTRY.json \
  --parts examples/simple_ship_parts.json \
  --out /tmp/ship.plan.json

python -m boltverse_orchestrator run \
  --registry examples/AI-REGISTRY.json \
  --parts examples/simple_ship_parts.json \
  --mock \
  --out /tmp/ship.report.json
```

You get a short summary on the terminal and a JSON file. `plan.json` / `report.json` in the current directory are the defaults if you omit `--out`.

Tests (offline):

```bash
python -m pytest
```

## Plug in a real adapter

Do this on the machine that has the `.npz` weights. v0 still will not import the training code for you. Point a command at the in-house script you already trust:

```python
from boltverse_orchestrator import (
    CommandAdapter,
    load_parts,
    load_registry,
    route,
    run_plan,
)

registry = load_registry("AI-REGISTRY.json")
plan = route(load_parts("parts.json"), registry)
barrel = registry.get("barrel-B2")
adapters = {
    "barrel-B2": CommandAdapter(
        barrel,
        "python3 /workspace/s4/barrel/score_one.py --checkpoint {checkpoint} --payload {payload}",
    ),
}
report = run_plan(plan, adapters, mock=False)
```

Placeholders in the command: `{ai_id}` `{checkpoint}` `{family}` `{entry_point}` `{payload}`. The template is split into arguments first, then filled in, and it is run with `shell=False`. `load()` does not execute the command and does not read the checkpoint.

Parts you did not pass an adapter for, when `mock=False`, hit a stub. The stub raises `NotImplementedError` for that part only. The rest of the run continues.

Leave `mock=True` (the CLI `--mock` flag) on any machine that does not have the weights. You get the documented fields, empty, with `"_mock": true`.

## Layout

```
boltverse_orchestrator/registry.py     load and query
boltverse_orchestrator/router.py       Part, Plan, route
boltverse_orchestrator/adapters.py     Adapter, MockAdapter, CommandAdapter, stub
boltverse_orchestrator/orchestrate.py  run_plan and the CLI
examples/AI-REGISTRY.json              inventory copy (not modified by the tool)
examples/simple_ship_parts.json        the simple ship
```

The proposal column in the registry (KEEP / ARCHIVE) is not a routing signal. A failed AI marked KEEP stays unroutable.
