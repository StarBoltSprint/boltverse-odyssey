# ruin — zone A gate monolith

Status: IN TEST. Do not mark this validated.

| Field | Value |
| --- | --- |
| Asset kind | ruin gate |
| Take | Zone A step 4b, 2026-10-04 |
| Commit | `6e5ddf0` |
| Date | 2026-10-04 |
| Size | authored height 28 m, mesh span 27.7 m, opening 7.314 × 18.558 m |
| Tries | 4 image calls, 0 video. Front attempt 1 rejected. |
| CLI | `python3 tools/ruins/build.py --kit howling-eclipse` |
| Image refs | front elevation, side elevation, one surface plate. Sections reused. |

## Prompt

not stored in this tracked file. The calls are in the untracked step 4b note and in the out-of-repo provenance for this step.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/ruins/selftest.py` | gate approach, parts | 48.932 m, 14 parts |
| play gallop, heading 32 | blocked, opening | blocked 0, min distance to opening centre 0.014 m, speed 4.4 |
| play snapshot | drawCalls, texMB, ruinLoadMs | 16, 282.8, 449.5 |
| close-up | worst mag | 14.99 on the elevation at 3.265 m. Target missed. Reported. |

## Gotchas

The eclipse mark stayed above the lintel after two cooks. Stop. Do not spend a third plate on the same miss. A keep radius around the gate blocks the opening. Walls are mesh edges in `packs/zone-a/play/collide.js`. One 28 m plate cannot stay at magnification 1 a few metres from a jamb. A second surface plate raises the thickness faces only.

## Reuse

Swap the kit numbers and the plates. Keep the loft, the atlas pack, and the mesh-edge walls. Do not copy the step 4 arch.
