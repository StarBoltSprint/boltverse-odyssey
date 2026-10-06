# other — WFC corridor hang

Status: the hang command passed its kitchen rows. No Imagine prompt was sent.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | wfc corridor hang |
| Commit | `a63ac7b` |
| Date | 2026-10-05 |
| Size | zone A ground stills, already cooked (1024×1024). No new file. |
| Tries | 1 |
| CLI | none |
| Image refs | none |

## Prompt

not stored

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/wfc-path/hang_selftest.py` | exit | 0 |
| `python3 tools/layout/layout.py check --world packs/corridor-ab/world.json` | transition | corridors=1 speed_bad=0 ground_bad=0 gate_bad=0 |
| `node --test packs/corridor-ab/play/place.test.mjs` | 3 tests | pass |
| play `?shot=mid` | corridor frame | mode corridor, along 7.2, heading 90, drawCalls 9, glError 0, boltReady true |

## Gotchas

`wfc.py` does not open asset files. `hang.py` does, and a missing ground fails. The clearing stubs are not an organic zone PASS. Headless Chrome needs SwiftShader; `--disable-gpu` has no WebGL2.

## Reuse

Copy the hang command. Swap only the spec's asset paths for stills that already exist. Do not run the solve during play. Do not paint a corridor video in this step.
