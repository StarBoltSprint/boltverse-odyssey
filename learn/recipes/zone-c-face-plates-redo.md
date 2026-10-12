# cutout — Zone C plates #6 and #8 redo

Status: kit-gate passed 2026-10-12. Nine earlier plates stay as SmiR left them. Do not build 3D from these files.

| Field | Value |
| --- | --- |
| Asset kind | cutout |
| Take | zc/04-plates |
| Commit | `e1043bb4` |
| Date | 2026-10-12 |
| Size | 1024×1024 for plates #6 and #8. Sheet 1760×1686. |
| Tries | 3 Imagine calls (2 on #6, 1 on #8). Running total 16. |
| CLI | `image_edit` |
| Image refs | #6: exact-square stone band `crops/crop-arch-right-band.jpg`, then that edit. #8: `plate-07-wall-left.jpg` and `crops/crop-wall-right-tight.jpg`. |

## Prompt

not stored. Palette and prompt text stay out of this file.

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 steps/zone-c/04-plates/check-plates.py` | eleven JPEGs, min side, file size, variance, sheet | PASS; #6 and #8 native 1024×1024; sheet 1760×1686; `imagine_calls` 16 |

## Gotchas

A crop that still shows the ring's curve comes back with that curve as a shadow. The second edit, which turns the arc into a level joint, is the file to keep. The right wall stayed face-on when the validated left wall was the structure reference and the right-cliff crop excluded the sky. No mirror pass was needed.

## Reuse

Copy the tight square band, then one straighten edit, for an inner arch face. Copy the validated neighbour wall plus a sky-free crop for the opposite wall. Do not overwrite plates SmiR has already kept. Do not send these plates into a mesh step.
