# rock — zone A kit-driven hulls

Status: validated for the boulder and the stone. The crest set did not pass the sheet, so it is not in this recipe.

| Field | Value |
| --- | --- |
| Asset kind | `rock` |
| Take | Zone A step 3 |
| Commit | `5aae7e0` (assets `0372e8f`, tool `3f43008`) |
| Date | 2026-10-03 |
| Size | keyed plates 512 for the boulder and the stone, 384 for the two pebble cutouts |
| Tries | stone orbit: one cook. boulder: one rejected round still, then one kept still; yaw 135 and yaw 315 one retry each, first still kept. crest: two cooks, not shipped. pebbles: one rejected crystal, one rejected shadow, then two keeps. |
| CLI | `edit` |
| Image refs | ground tile as image 1 for V0. Each later yaw uses V0 and the previous yaw. Roles are in the untracked prompt file. |

## Prompt

not stored in this tracked file. Verbatim text is in `/workspace/grokcli/next/METHOD/rocks-prompts.local.md` and `/workspace/grokcli/out/zoneA-step3/provenance.json`.

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/objsheet/sheet.py` | boulder keep | keepMean 0.9221, keepMin 0.8921 |
| `python3 tools/walkaround/build.py` | boulder magnification | maxMagnification 0.9900, vertices 6080, seam 0.107 |
| `python3 tools/objsheet/sheet.py` | stone keep | keepMin 0.8974 |
| `python3 tools/walkaround/build.py` | stone magnification | maxMagnification 0.9889, vertices 9416, seam 0.095 |
| `python3 tools/rocks/selftest.py` | placement | crest 6, boulder 16, stone 28, pebble 40, cv 0.271 |
| phone chase 412×915 DPR 2 | presented mag | 0.998 sky upper, drawCalls 10, texMB 236.4 |

## Gotchas

A dark opaque rock fails the walkaround hole row at the default 0.04 luma cut. Set `bgThreshold` to -1 in the rock config so the mask follows alpha. Do not flood-fill.

Objsheet area is the pixel count, not the bbox product. Scale plates down only.

If the short orbit view is also the densest, shrinking the tall plates breaks the area lock. Two cooks, then stop. That is why the crest is absent.

## Reuse

Copy `python3 tools/rocks/build.py --kit <id>`, the placer, and `packs/<pack>/play/rocks.js`. Swap the kit, the numbers file, and the Imagine stills. Do not copy the Howling Eclipse views into another biome.
