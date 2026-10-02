# reportview

One static page for one take. It gathers the reports the other tools already wrote, in pipeline order, so they can be read on a phone.

The page displays those reports. It does not measure, resize, regrade, or draw.

```bash
python3 tools/reportview/build.py \
  --take <name> \
  --take-dir <take-folder> \
  --play-url <play url> \
  --date 2026-10-01 \
  --out <dir>
```

Or point at each folder:

```bash
python3 tools/reportview/build.py \
  --take <name> \
  --assetcheck <dir> \
  --objsheet <dir> \
  --objsheet <dir> \
  --walkaround <dir> \
  --layout <dir> \
  --playcheck <dir> \
  --play-url <play url> \
  --out <dir>
```

`--assetcheck`, `--objsheet`, and `--walkaround` can be repeated. A directory that was not passed, and was not found under `--take-dir`, is **NOT RUN**. That is not a PASS.

Exit **0** when `index.html` is written, including when the take itself FAILs. Exit **2** when a passed path is not a directory. The verdict is on the page and on the stdout line (`PASS`, `WARN`, `FAIL`, or `INCOMPLETE`).

## Take folder

```text
<take>/assetcheck/report.json
<take>/objsheet/<object>/report.json
<take>/objsheet/<object>/sheet.png
<take>/walkaround/<object>/qc/report.json
<take>/walkaround/<object>/views/
<take>/layout/report.json
<take>/layout/debug-topdown.png
<take>/layout/clearing.json
<take>/playcheck/report.json
<take>/playcheck/stills/
<take>/playcheck/walk.mp4
```

A single `objsheet/report.json` or `walkaround/qc/report.json` is also found. Objsheet objects and walkaround hulls are joined when `name` matches.

## What is shown

Fields are the ones those tools write. See each tool's README for the check.

| Section | Read from | Shown |
| --- | --- | --- |
| Header | the flags | Take name, date, play URL, verdict. |
| Assets | `assetcheck` `report.json` | Thumbnail when the file can be resolved, resolution, magnification and its `magnificationLimit`, alpha / plate, loop seam and the check's `limits`, codec, tiling / backdrop / morph when that check is present. |
| Objects | `objsheet` `report.json` + `sheet.png`, `walkaround` `qc/report.json` | Proof sheet, each view, guide IoU and `limit`, adjacent area and height against the consistency `limits`, hull-keep fraction, per-view `maxMagnification`. |
| Hull | `qc/report.json` | `depthRefine`, `hull.depthRelief`, `hull.depthMinAgree`, `vertexCount`, `triangleCount`, `smoothIters`, `subObjects`. |
| Layout | `report.json`, `debug-topdown.png`, `clearing.json` | Diagram, zone id, gate count from the file, then check rows. Ring, gate, and collider rows are first. |
| Playcheck | `report.json`, `stills/`, `walk.mp4` | `<video controls playsinline>`, stills, rows. `detail` is the tap text. Law 65 adds `active_videos` (≤ 4), `perf_line` (`Perf: drawCalls, texMB, activeVideos, jsMs`), and `render_source` when playcheck wrote it. A playcheck report with no valid `perfLine` is FAIL on this page. SwiftShader `fps_avg` / `fps_1low` / `frame_ms` are informational. |

A row shows the measured number and the threshold that is stored on that check (`limits`, `magnificationLimit`, `need_m`, `mag_max`, and the same kind of field). Tap the row for a short explanation. A check the report does not contain is **n/a**, not PASS.

`depthRefine` is `skipped`, `png`, or `depth-anything-v2`. The report does not store a numeric near/far depth range. The page says **not recorded** unless a `depthRange` or `depthMin` / `depthMax` field is actually present.

## Verdict

- **FAIL** if any reported check is FAIL.
- **WARN** if nothing failed and a report has WARN. A `lock/` or `locked: true` WARN stays amber. It does not make the page FAIL.
- **INCOMPLETE** if nothing failed and any section is NOT RUN.
- **PASS** only when every section ran and every check passed.

## Output

`index.html` plus `media/` (copies of the stills, the proof sheet, the diagram, and `walk.mp4`). Relative paths only. No server, no CDN, no network fetch. Open the file, or zip the folder.

Asset thumbnails are copied only when the path in the report resolves (next to the report, beside it, or `--asset-root`). A missing file is a grey box, not a drawn stand-in.

## Samples

`sample/pass/` is an all-PASS synthetic take. `sample/fail/` has real FAIL rows plus a `lock/` WARN. Both are written by the self-test. They are not a play build.

```bash
python3 tools/reportview/selftest.py
```

## Honest limits

- The page does not re-run assetcheck, objsheet, walkaround, layout, or playcheck. A wrong number in a report is still that number.
- It does not decide KEEP. A PASS page is not a phone KEEP.
- It does not open the play URL. The URL is text you pass in.
- Walkaround `qc/report.json` has no near/far depth range. Recess fraction and refinement status are what that file stores.
- Contrast ratio's fail line (1.75) is not copied into assetcheck's `limits` object. The page labels that limit as the tool's fail line.
- Nested playcheck stop tables are counted, not expanded into a second checker.
- A joined object needs the same `name` on the objsheet object and the walkaround report. Different names stay separate cards.
