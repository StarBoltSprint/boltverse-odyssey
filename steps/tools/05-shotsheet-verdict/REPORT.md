# tools/05-shotsheet-verdict

Verdict: PASS

Each build can emit an Art Director shot-sheet verdict from `tools/objsheet`. The pixel contact sheet is unchanged. No Imagine. No push. No merge.

| # | Done when | Measured |
| --- | --- | --- |
| 1 | Cells, in order: key, 45°, grazing, 8 m, 3 m up | PASS. `sheet.py --build terrace-block` wrote those five `view` strings. |
| 2 | Each cell has `view`, `plate_path`, `render_path`, `status`, `defects` | PASS. Key plate `plates/key.jpg`, render null. `3 m up` plate null, render `renders/close3m-up.png`. |
| 3 | Fresh sheet `verdict` PENDING, defects empty | PASS. Status `PENDING`, `defects` `[]` on every cell. |
| 4 | PENDING blocks the intake stub and library add | PASS. `verdict.py intake` exit 1, `REFUSE PENDING`. `build_manifest` raises `LibraryError` containing `PENDING`. |
| 5 | KEEP with empty defects allows intake | PASS. Stub returns `allow: true`. `build_manifest` returns id `shot-gate`. Manifest schema unchanged. |
| 6 | FAIL lists defects and does not enter the library | PASS. Defects `door void too deep`, `texel mush at the cornice`. Stub `allow: false`. Library error includes `texel mush at the cornice`. |
| 7 | `python3 tools/objsheet/selftest.py` exits 0 | PASS. Repo rock `keepMin=0.9939`. `python3 tools/library/selftest.py` exits 0. |
| 8 | No Imagine, no push, no merge | Held. Pixel sheet with `--build` still PASS, `keepMin=0.9939`. |

`python3 tools/objsheet/sheet.py --views tools/walkaround/testdata/synthetic-rock/views --config tools/walkaround/testdata/synthetic-rock/config.json --out /tmp/objsheet-build-flag --build terrace-block` exit 0. It wrote `/tmp/objsheet-build-flag/shot-verdict.json` beside the existing `report.json` and `sheet.png`.

Decree brief: `steps/tools/05-shotsheet-verdict/decree-brief.md`. No local decrees file. Nothing invented.

Quota: no session ndjson in this step. `tools/quota/quota.py` was not run. No number was invented.

Phone preview: not frozen. This step has no play page.
