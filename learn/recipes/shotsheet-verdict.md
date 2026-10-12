# tool — shot-sheet visual verdict

Status: validated. No Imagine cook. The prompt was not stored because none was sent.

| Field | Value |
| --- | --- |
| Asset kind | other (Art Director JSON on `tools/objsheet`) |
| Take | tools/05-shotsheet-verdict |
| Commit | not committed. Parent `a0676f9f`. |
| Date | 2026-10-12 |
| Size | five cells, no image |
| Tries | 1 |
| CLI | none |
| Image refs | none |

## Prompt

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `python3 tools/objsheet/selftest.py` | shot-verdict, then the existing pixel rows | exit 0; repo rock keepMin 0.9939 |
| `python3 tools/objsheet/verdict.py intake` | PENDING | exit 1, REFUSE PENDING |
| `python3 tools/objsheet/verdict.py intake` | KEEP, defects empty | exit 0, ALLOW KEEP |
| `python3 tools/objsheet/verdict.py fill --verdict FAIL` | defects listed | `door void too deep`; `texel mush at the cornice`; library add refused |
| `python3 tools/objsheet/sheet.py --build terrace-block` | shot-verdict.json | PENDING; views key, 45°, grazing, 8 m, 3 m up; pixel keepMin 0.9939 |
| `python3 tools/library/selftest.py` | add without shotSheet | exit 0 |

## Gotchas

A missing `shotSheet` key on a library intake still adds. Only a present sheet is gated. KEEP with a defect string is refused before the file is written. FAIL with an empty defect list is refused the same way.

`verdict` on this JSON is PENDING, KEEP, or FAIL. The pixel `report.json` still uses `ok`. Do not read one as the other.

## Reuse

`python3 tools/objsheet/verdict.py emit --build <id> --out <dir>/shot-verdict.json` with `--plate VIEW=PATH` and `--render VIEW=PATH` for whichever of the five views exist. Fill KEEP or FAIL after the Art Director looks. Pass the file as `shotSheet` on library intake. The next biome swaps the paths only.
