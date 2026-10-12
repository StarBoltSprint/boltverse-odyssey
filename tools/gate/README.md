# tools/gate

Block checks moved off the terrace step. Thresholds are the ones already in force. Do not loosen them.

```
python3 -m tools.gate streaks <bands.json> <icicles.json> [--tex plate=path]
python3 -m tools.gate volume <renderdir>
python3 -m tools.gate sliver <mesh.obj>
python3 -m tools.gate uvmirror <mesh.obj>
python3 -m tools.gate icicles <icicles.json> <bands.json>
python3 -m tools.gate repetition <image.png>
python3 -m tools.gate outline <lodA.obj> <lodB.obj>
python3 tools/gate/selftest.py
```

Terrace scripts under `steps/zone-d/01-terrace/work/` and `tools/object-gate/py/ghost_streaks.py` are thin wrappers. `tools/object-gate/adapters/block-gate.mjs` shells the same CLI.
