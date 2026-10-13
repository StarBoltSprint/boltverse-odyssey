# tools/placer

`placer.py` places kit detail from the automatic key sheet (`tools/keysheet/auto_extract.py`) for any key:
each in-scope L2 element's key-camera ray is cast into the assembled kit (numpy Moller-Trumbore + ground plane);
the pixel footprint at the hit gives metric width / thickness / length:

| L2 source / class | placed as |
|---|---|
| top-hat snow patch (facade snow) | lumpy flattened snow blob aligned to the surface normal |
| big snow element | wider snow blob |
| drip | tapered ice spike from the drip top |
| stone/dark element on the ground | rubble boulder (snow-dusted) |

Snow/rubble join the identity `tread_snow` mesh (+0 draw calls); drips are one ice mesh (+1).
Use through the terrace build: `pieces.py terrace ... --placer SHEETDIR --placer-groups facade_snow,rubble --placer-scope MASK`.

`loop.py VARIANT PORT SHEETDIR` is the keep/revert loop: it toggles groups and the snow gain, renders the key view,
runs `judge.py` + `auto_check.py` and keeps a change only when it helps (judge +0.3, or auto L2 pass +0.02 without
judge loss). About 20-25 s per candidate on the box CPU.
