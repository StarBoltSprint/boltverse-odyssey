# ruin — zone A Eclipse Gate and wreck

Status: in test. The verbatim Imagine lines are not stored in this file.

| Field | Value |
| --- | --- |
| Asset kind | `hull/ship` |
| Take | Zone A step 4 |
| Commit | `f247ee3` |
| Date | 2026-10-03 |
| Size | gate front 832×1248; sections 1024×1024; wreck skins copied from the sealed Howl plates |
| Tries | 6 image calls, 0 video. Side elevation rejected once, kept on the second try. |
| CLI | `image_gen` |
| Image refs | none (generations). Wreck skins are the sealed Howl files, not a new edit. |

## Prompt

not stored

The calls that were sent are in the untracked file `/workspace/grokcli/next/METHOD/ruins-prompts.local.md` and in `/workspace/grokcli/out/zoneA-step4/provenance.json`. Do not copy them here.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/ruins/build.py --kit howling-eclipse` | corridor clear, both objects | gate keep 15.176 m, approach 11.508 m, height 7.4 m; wreck keep 18.141 m, approach 11.201 m, height 3.997 m |
| `python3 tools/ruins/selftest.py --kit howling-eclipse` | opening, pier difference, Howl pass, part ids | 13 parts, openingClear, howlPass |
| play snapshot, legal boom 6.2 m | frame mag | 0.998 (sky upper). Ruin at the proof eyes: gate 0.251 and 0.566, wreck about 0.74 to 0.93 |

## Gotchas

The side plate's first cook was a three-quarter gateway. The second cook is the edge-on slab. Stop there.
An opening that touches the frame is not found by a corner flood. The loft uses the between-jamb span.
Do not grow the keep by the chase boom. The gate keep already sits 0.9 m off the corridor edge.

## Reuse

Swap `tools/ruins/numbers/<id>.json` and the inbox plates. The Howl wreck reuses `tools/hard-objects` and does not recook those JPEGs.
