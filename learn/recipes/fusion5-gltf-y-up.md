# other — fusion5 glTF Y-up

Status: the axis fix only. The tower gate still FAILs. Do not treat the mesh as a KEEP.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | fusion-fix5-1011 |
| Date | 2026-10-11 |
| CLI | `blender --background --python tools/imagine-to-3d/fusion5_blender.py` |

## What was checked

Blender's glTF exporter converts Z-up to Y-up, `(x, y, z) -> (x, z, -y)`. A mesh already stored as three.js Y-up comes out on its side. Feed Blender `(x, -z, y)` so the loaded file matches the three.js camera frame.

After that export, the object-gate relief row matched the local measure (−z 0.591 m, other axes 0) and crispness passed. The first export, before the inverse, reported relief on +x and −x and failed crispness. That was the same mesh lying down.

## QC rows passed

Crispness on the upright GLB only. Alignment, two-axis relief, grounding, and the checklist did not pass. See `steps/fusion-fix5-1011/REPORT.md`.
