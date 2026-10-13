# tools/lodstream

Offline LOD and texture-streaming gate for Engine Phase 2. It reads three meshes and a texture checklist. It does not draw a play view and it does not call Imagine.

This is a new package, not a new row inside `tools/object-gate`. Object-gate compares rendered depth passes (`py/lod_gate.py`) on a live scene. This gate takes lod0, lod1, and lod2 meshes directly, which is what a tools-side intake has before the scene exists.

The silhouette test reuses the outline half of `tools/object-gate/py/lod_gate.py`: XOR of the two hit masks. The limit here is **0 px**. `lod_gate.py` still allows a small fraction and a 4 px blob; this package does not. The mask is 540×960 and the vertical field is 58°, the same morph mask and game field as `tools/object-gate/profiles/_base.yaml`. Interior depth pops are not part of this row. The gate is silhouette match only.

```bash
node tools/lodstream/gate.mjs --manifest tools/lodstream/fixtures/good/manifest.json --out /tmp/lodstream-good.json
node tools/lodstream/selftest.mjs
```

Exit **0** when every row passes. Exit **1** when a measured row fails. Exit **2** when the manifest cannot be read.

## What it refuses

| Row | Rule |
| --- | --- |
| `outline-15m` | lod0 vs lod1 at 15 m, four yaws. `diffPx` must be 0, and the finer mask must cover some pixels. |
| `outline-40m` | lod1 vs lod2 at 40 m, same rule. |
| `lod0-tris` | Triangle count of lod0 must be ≤ `profile.lod0Max`. Default profile is 80000. |
| `lod-monotone` | A coarser LOD must not have more triangles than the finer one. Equal counts pass. |
| `texture-native` | Each texture is an Imagine plate, width and height both ≥ 1024. |
| `texture-mipmaps` | Each texture has `mipmaps: true`. |

Camera distance is eye to the union bounding-box centre. Yaw 0 looks along −Z. `padTriangles` on a mesh adds that many degenerate triangles to the count and does not draw them. It cannot lower a count.

## Report

`--out` is a `lodstream-report/1` JSON file. `playcheck` and `library` are the intake blocks. This command does not register a library object and does not start playcheck.

## Fixtures

| Manifest | Expected |
| --- | --- |
| `fixtures/good` | PASS. 13 / 12 / 12 triangles, same box, 1024 plate with mipmaps. |
| `fixtures/outline-diff` | FAIL. lod1 is a taller box, so the 15 m switch is not 0 px. The 40 m pair matches. |
| `fixtures/over-budget` | FAIL. lod0 counts 80001. The silhouette still matches. |
| `fixtures/missing-mipmaps` | FAIL. Plate is 1024. `mipmaps` is false. |
