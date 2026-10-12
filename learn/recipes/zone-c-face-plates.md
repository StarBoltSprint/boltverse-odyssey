# cutout — Zone C face plates #5–#15

Status: kit-gate passed 2026-10-12. Owner validation of `sheet-plates.jpg` is still open. Do not build 3D from these files until SmiR keeps the sheet.

| Field | Value |
| --- | --- |
| Asset kind | cutout |
| Take | zc/04-plates |
| Commit | `ee823769` |
| Date | 2026-10-12 |
| Size | 1024×1024, eleven plates. Four of them were mirror-padded from a 1008×1024 tool file. |
| Tries | 13 Imagine calls. One retry each on the right arch and the right wall, then stop. |
| CLI | `image_edit` |
| Image refs | one square PIL crop of `key-zc1.jpg` per plate. Crops and boxes: `steps/zone-c/04-plates/crops.json`. |

## Prompt

not stored. Palette and prompt text stay out of this file. The framing for each plate is the table in `SPEC-ZC-PLATES-1012.md`.

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 steps/zone-c/04-plates/check-plates.py` | eleven JPEGs, min side, file size, variance, sheet | PASS; each plate 1024×1024; sheet 1760×1686; `imagine_calls` 13 in `numbers.json` |

## Gotchas

A crop that is one pixel off square comes back 1008 on the short side. Trim the crop to an exact square before the edit. An edit that should unroll an arch inner face keeps the opening or the whole canyon. Two tries, then keep the closer file and stop. The contact sheet is assembled in code.

## Reuse

Copy the crop-then-edit order. Do not recook moss #1–#4. Do not send these plates into a mesh step before the owner keeps the sheet.
