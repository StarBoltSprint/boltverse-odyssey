# object-gate API: the stable contract (v1.5)

Every tool that makes or changes a 3D object calls this API. That includes the Imagine-to-3D modules `classify`, `views`, `coarse`, `pbr`, `compare`, `fixloop` and `keyvideo`. Do not re-implement a check: import it. `API_VERSION` (in `gate.mjs`, also the `version` field in `package.json`) follows two rules:

- **minor** = additions only. Old callers keep working.
- **major** = a breaking change. It ships with a migration note in this file and a row in `docs/METHOD/decisions-log.md`.

What counts as API: the exports listed below, the spec and profile fields, the report JSON shape, and the row `id`s. Anything else (internal helpers, the human `check` text, `lib/probe.js` internals) can change.

## Imports

```js
import { gateObject, gateScene, loadScene, resolveObject, loadProfile, listProfiles,
         toMarkdown, checkId, CHECK_IDS, API_VERSION,
         screenPxPerM, scoreVisible, resolveView,             // 1.2 (scoreVisible takes an 8th arg `render` since 1.3)
         perfRows } from "<repo>/tools/object-gate/gate.mjs";   // 1.4
import { gateAndFix, fixPlan, FIX_ACTIONS } from "<repo>/tools/object-gate/hooks/imagine-to-3d.mjs";
```

Python pipelines use the CLIs instead: `cli.mjs` and `hooks/imagine-to-3d.mjs`. `rescore.mjs --run <out> --scene <yaml>` re-scores a finished run under the current texel policy without re-rendering (writes `report-rescored.json` / `.md`).

**CLI exit codes**

| Code | `cli.mjs` | hook CLI |
|---|---|---|
| 0 | PASS | PASS and exported |
| 1 | FAIL | FAIL; nothing exported |
| 2 | bad invocation | bad invocation |
| 3 | — | NEEDS_REVIEW (a vision or owner step) |

## Functions

| Export | Signature | Use |
|---|---|---|
| `listProfiles()` | `() → string[]` | The object types that have a profile. A **classify** module must return one of these. |
| `loadProfile(type)` | `(string) → cfg` | The profile, `_base` merged in: thresholds plus `checklistTemplate`. **pbr** reads `cfg.texel` for its px/m target. **views** reads `cfg.checklist.captures`. |
| `resolveObject(spec, specDir?)` | `(spec) → resolved` | A spec merged with its profile (`spec.thresholds` override the profile). Relative paths are resolved against `specDir`. |
| `loadScene(yamlPath)` | `(string) → scene` | Reads a scene yaml and resolves every object spec in it. |
| `gateScene(scene, opts)` | `async → report` | Runs the full gate on one page. `opts` takes `{url, out, only:[ids], fast, log}`. `fast` skips the 300→10 m morph and is for iteration only: the final gate always runs without it. |
| `gateObject(spec, opts)` | `async → report` | Gates one object. `opts` takes `{adapter (abs path), url, out, fast, specDir, dir, hud, title, log}`. |
| `fixPlan(report)` | `report → {verdict, report, items[]}` | Turns each FAIL row into a fix action: `{object, id, check, action, auto, what, detail, hints}`. |
| `gateAndFix({...})` | `async → {status, exported, rounds, stuck?, review?, plan?}` | The mandatory final stage: gate, run the fix loop, re-gate, and export on PASS only. Arguments: `scene`, `object`, `fix(plan, planPath)`, `exportFn(report)`, `maxRounds` (3), `maxSameDefect` (2), `url`, `out`, `fast`. `status` is `PASS`, `FAIL` or `NEEDS_REVIEW`. |
| `FIX_ACTIONS` | `[{re, action, auto, what}]` | The table from check to action. A **fixloop** module switches on `action` (or on the row `id`), never on the check text. |
| `checkId(check)` / `CHECK_IDS` | | Maps a check to its stable row id. |
| `screenPxPerM(cfg.texel, view, d)` (1.2) | `→ number` | Phone screen px per metre at distance `d`: `phone.h / phone.devicePixelRatio × view.renderPixelRatio / (2 d tan(vfov/2))`. **pbr** uses it at `cfg.texel.minViewM` as its plate px/m target (Zone B: 155 px/m at 8 m). |
| `resolveView(cfg.texel, adapter.view)` (1.2) | `→ {renderPixelRatio, fovDeg, source}` | The game's render pixel ratio and base vfov (profile override first, then the adapter). |
| `scoreVisible(t, R, view, texelRows, repRows, footprints, spec, render?)` (1.2; `render` 1.3) | `→ {rows, perSurface}` | The three policy-`visible` rows from saved measurements (pure, no page). `render` = the 8 m capture result (`visible.json.render`); without it the 1.2 sampling rule applies. |
| `perfRows(report, perfReport, viewport)` (1.4; quality rows 1.5) | `→ void` | Adds the phone perf runtime rows from a page's `window.__perfReport()` (`{canvasRatio, dpr, cap, adaptive, skyOrder, groundOrder, maxOpaqueOrder, skyDepthTest, adaptiveCanDropDetail, sprintDip}`). `null` gives one INFO row. `gateScene` calls it for every viewport. |
| `toMarkdown(report)` | | Renders `report.md`. |

## Row ids (stable)

| Group | Row ids |
|---|---|
| Selection | `select`, `gate.crash` |
| Textures | `textures.roles`, `textures.filtering`, `textures.native-size` |
| Texel density | `texel.visible-px-per-m` (policy `visible`, default since 1.2), `texel.unique-px-per-m` (policy `unique`), `texel.stretch`, `texel.self-report` |
| Repetition | `repetition.visible-radius`, `repetition.visible-neighbours` (policy `visible`), `repetition.uv` (policy `unique`), `repetition.captures` |
| Morph | `morph` |
| Shadows | `shadow.light`, `shadow.cast`, `shadow.world-fixed`, `shadow.colour` |
| Grounding | `grounding` |
| Geometry | `geometry.sealed`, `geometry.relief`, `geometry.proportions` |
| Effects | `effects.imagine-texture`, `effects.no-colour-literals` |
| Checklist | `checklist.written`, `checklist.key-crop`, `checklist.verified`, `checklist.colour` |
| Runtime | `runtime.console`, `runtime.shader`, `runtime.hud`, `runtime.title`, `runtime.portrait`, `runtime.budgets` (INFO), `runtime.live-untouched` |
| Phone perf (from `window.__perfReport()`, INFO `perf.report` when absent) | `perf.canvas-ratio`, `perf.sky-order`, `perf.ground-order`, `perf.adaptive`, `perf.quality-kept` (FAIL if the adaptive controller can drop the detail layer), `perf.default-ratio` (FAIL below min(2, device) or with a sprint dip), see [phone-perf.md](../../docs/METHOD/phone-perf.md) |

## Report JSON (`<out>/report.json`)

```jsonc
{ "tool": "object-gate", "version": 1, "apiVersion": "1.5", "url": "...", "adapter": "...", "out": "/abs/dir",
  "startedAt": "ISO", "finishedAt": "ISO", "verdict": "PASS|FAIL",
  "runtime": [ { "id": "runtime.shader", "check": "shader compile 412x915", "status": "PASS|FAIL|INFO", "detail": "...", "hints": [] } ],
  "objects": [ { "id": "mesa", "type": "rock", "verdict": "PASS|FAIL", "hero": "mesa-0",
                 "files": { "captures": { "close": { "img": "...png", "mask": "...png", "cover": 0.31, "hash": "dHash hex", "pose": {} } },
                            "sheet": ".../capture-sheet.jpg" },
                 "rows": [ { "id": "...", "check": "...", "status": "...", "detail": "...", "hints": ["..."] } ] } ] }
```

The per-object folder `<out>/<id>/` also holds the raw measurements: `boxes.json` (1.2, copy world boxes), `visible.json` (1.2, view + per-surface need vs visible px/m; 1.3 adds `render`), `cap-visible-8m.png` (1.3), `texel.json`, `repetition.json`, `morph.json`, `shadow.json`, `grounding.json`, `geometry.json`, the `cap-*.png` captures with their masks, the `face-*.png` ortho views, `capture-sheet.jpg` and `checklist-todo.yaml`. A **compare** or **keyvideo** module can read these files instead of re-rendering.

## Object spec (yaml or object)

```yaml
id: mesa                      # unique in the scene
type: rock                    # one of listProfiles()
select: {names: "^mesa-", exclude: "drifts"}   # regex on scene object names (InstancedMesh / LOD / Mesh roots)
hero: mesa-0                  # optional: copy used for captures (default: nearest to spawn)
keyCrop: /abs/or/relative/crop.png             # the object's crop of the biome key still
textures:                     # EVERY texture the object samples, with a role
  - {match: "regex on url or uniform name", role: plate|detail|tile|normal|mask|emit|env, source: "/imagine/original.png"}
  - {match: "uZbPool", role: plate, classes: ["+x","-x","+z","-z"], pool: {cellM: 12, sharedSelect: {names: "^inst-m[2346]-lod0-"}, files: [...]}}
  - {match: "mesaA-front\\.jpg", role: plate, projected: {metresAcross: 107.07}}
checklist:                    # one item per visible key feature (copy the profile's checklistTemplate)
  - {id: volume, feature: "...", captures: [far, close]}
record: records/mesa.verified.yaml             # default records/<id>.verified.yaml
proportions: {hOverW: [2.9, 5.0]}              # optional
thresholds: {texel: {minViewM: 6}}             # optional, may only tighten (or add `waivers:` with a reason)
viewMinM: {"+y": {m: 40, reason: "roof never seen from closer than 40 m"}}   # optional (1.2): per-class closest view
visibleView: {hero: mesa-L-mid, towardXZ: [-51.1, 9.6], aimHeightM: [4, 6]}   # optional (1.3): which copy / side / height the 8 m render capture aims at
selfReportKey: m2                              # optional: compare with the scene's own px/m claim
imagineSources: ["/imagine/"]                  # effects: allow-listed Imagine folders
```

A scene yaml adds `url`, `adapter` (a path), `hud`, `title`, `runtime.viewports`, `liveDir` (optional) and `objects: [spec files]`.

## Texel policy (profile `texel.policy`, SmiR decision 2026-10-09 20:19)

`visible` (default for every type, set in `_base.yaml`):

- **Visible px/m.** Every plate surface viewed from `minViewM` (8 m) or farther must be at least as sharp as the phone screen: plate sampling px/m ≥ `screenPxPerM(t, view, d)` for a 1080 × 2400 phone (`phone.devicePixelRatio` 2.625, CSS 411 × 914) at the game's render pixel ratio and base vfov. Closer views are exempt: slight blur right against a wall is accepted. There is no camera distance limit, so every surface is scored at `minViewM` unless the spec sets `viewMinM` for that class, with a reason.
- **No visible repetition, instead of unique pixels.** One shared plate set per object type is allowed. Identical plate pixels never appear within `repeatRadiusM` (30 m): a plate that tiles with a period under 30 m FAILs, and so does a pool whose ortho facade view correlates above `repetition.maxAtTileLag` at the cell period. Neighbouring copies of the same set closer than `neighbourRadiusM` (7 m) FAIL.
- Imagine plates are 1024 × 1024 native (`plateNative`). At 155 px/m, one plate covers at most about 6.6 × 6.6 m.

`unique` keeps the earlier rule (`minPxPerM` 64, `nearPxPerM` 128 within `nearM` of the path) for comparison.

**Material method A/B (2026-10-09).** A layered / hybrid method (tiling Imagine materials + unique macro plates + stochastic hex tiling, per `arch-research-1008/q18-answer.md`) is being A/B tested against unique section plates. Callers do not change: the gate measures visible px/m and repetition on the final render, so the same rows and ids apply to both methods.

**Render-based visible px/m (1.3, default `texel.visibleMeasure: render`).** The gate aims at a steep surface of the hero copy (raycast, |normal.y| < 0.6, 2.5–8 m above the ground, on the side facing the player path or `visibleView.towardXZ`) and stands so the eye is exactly `minViewM` (8 m) from that point. It optically zooms the game camera so the capture shows `renderHeadroom` (2) × the needed screen px/m. A zoom at the same distance is the same as a sharper screen: the LOD, the distance fades of a detail layer and the finer mips stay the game's own. Effects are hidden for the shot. `analyze.py visible_px` then measures the detail really present in the pixels: per 64 px tile, the largest down/up-sample factor k that loses under 10 % of the tile's detail energy; visible px/m = screen px/m ÷ k, median over the textured tiles inside the object mask and the central band of the frame (15–85 % across, 30–70 % down). Calibration: 1024² Imagine plates magnified 1.5–2.5× read a median 1.0× their true px/m (p10 0.75, p90 1.35); a soft plate reads lower because it carries less detail. Output: `cap-visible-8m.png` (+ mask) and `visible.json.render`. The plate-sampling numbers stay in the row detail as info. `visibleMeasure: sampling` keeps the 1.2 behaviour. `rescore.mjs --render <dir>` takes `<dir>/<id>/render.json` from a separate capture run.

**Screenshots from other tools (A/B sheets):** `node visible-shot.mjs --img shot.png --dist 8 --fov <deg> [--height H] [--pr 1] [--mask m.png] [--rect x0,y0,x1,y1]` runs the same estimator. A shot proves at most its own screen px/m (`height × pr / (2 dist tan(fov/2))`); a 540 × 1200, dpr 1, 58° shot at 8 m shows 135 px/m and cannot prove 155. The CLI then prints the fov to shoot with (about 27° at 8 m for 1200 px).

## Adapters

An adapter makes one game page reachable. See the README, section "Writing an adapter". Since 1.2 an adapter may export `view()` → `{renderPixelRatio, fovDeg, source}` (the game's own numbers; Zone B reads `biome.json` `camera.pixelRatioCap` = 1.5 and fov 58). The Imagine-to-3D staging viewer needs its own adapter (one object on a ground plane, `liveDir` unset, `path` around the object).

## Rules every caller follows

1. **Gate the staging copy, never the live preview.** Never edit live preview files in place. Work in a staging copy (its own folder or port), point `url` at it, and swap it into live (copy, then rename) only after `verdict === "PASS"`. The `exportFn` of `gateAndFix` is that swap. When an adapter sets `liveDir`, the gate FAILs `runtime.live-untouched` if any file the live page actually loads (every same-origin request during the gate) changes while it runs. Since 1.3 other files in the same folder (staging copies, test pages) are listed as ignored, not failed. This is lesson 2026-10-09 17:14.
2. Thresholds come from `loadProfile`. A module does not hard-code px/m, repeat or IoU limits (the px/m target is `screenPxPerM` at `minViewM`).
3. Only PASS objects are exported, shown or merged. `NEEDS_REVIEW` means the `checklist.verified` items need a vision or owner pass recorded in `records/<id>.verified.yaml`. Those recorded passes expire when a capture changes (dHash above 12).
4. If the same defect FAILs twice, stop and report it (`maxSameDefect`). Do not loop.
