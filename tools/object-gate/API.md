# object-gate API: the stable contract (v1.1)

Every tool that makes or changes a 3D object calls this API. That includes the Imagine-to-3D modules `classify`, `views`, `coarse`, `pbr`, `compare`, `fixloop` and `keyvideo`. Do not re-implement a check: import it. `API_VERSION` (in `gate.mjs`, also the `version` field in `package.json`) follows two rules:

- **minor** = additions only. Old callers keep working.
- **major** = a breaking change. It ships with a migration note in this file and a row in `docs/METHOD/decisions-log.md`.

What counts as API: the exports listed below, the spec and profile fields, the report JSON shape, and the row `id`s. Anything else (internal helpers, the human `check` text, `lib/probe.js` internals) can change.

## Imports

```js
import { gateObject, gateScene, loadScene, resolveObject, loadProfile, listProfiles,
         toMarkdown, checkId, CHECK_IDS, API_VERSION } from "<repo>/tools/object-gate/gate.mjs";
import { gateAndFix, fixPlan, FIX_ACTIONS } from "<repo>/tools/object-gate/hooks/imagine-to-3d.mjs";
```

Python pipelines use the CLIs instead: `cli.mjs` and `hooks/imagine-to-3d.mjs`.

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
| `toMarkdown(report)` | | Renders `report.md`. |

## Row ids (stable)

| Group | Row ids |
|---|---|
| Selection | `select`, `gate.crash` |
| Textures | `textures.roles`, `textures.filtering`, `textures.native-size` |
| Texel density | `texel.unique-px-per-m`, `texel.stretch`, `texel.self-report` |
| Repetition | `repetition.uv`, `repetition.captures` |
| Morph | `morph` |
| Shadows | `shadow.light`, `shadow.cast`, `shadow.world-fixed`, `shadow.colour` |
| Grounding | `grounding` |
| Geometry | `geometry.sealed`, `geometry.relief`, `geometry.proportions` |
| Effects | `effects.imagine-texture`, `effects.no-colour-literals` |
| Checklist | `checklist.written`, `checklist.key-crop`, `checklist.verified`, `checklist.colour` |
| Runtime | `runtime.console`, `runtime.shader`, `runtime.hud`, `runtime.title`, `runtime.portrait`, `runtime.budgets` (INFO), `runtime.live-untouched` |

## Report JSON (`<out>/report.json`)

```jsonc
{ "tool": "object-gate", "version": 1, "apiVersion": "1.1", "url": "...", "adapter": "...", "out": "/abs/dir",
  "startedAt": "ISO", "finishedAt": "ISO", "verdict": "PASS|FAIL",
  "runtime": [ { "id": "runtime.shader", "check": "shader compile 412x915", "status": "PASS|FAIL|INFO", "detail": "...", "hints": [] } ],
  "objects": [ { "id": "mesa", "type": "rock", "verdict": "PASS|FAIL", "hero": "mesa-0",
                 "files": { "captures": { "close": { "img": "...png", "mask": "...png", "cover": 0.31, "hash": "dHash hex", "pose": {} } },
                            "sheet": ".../capture-sheet.jpg" },
                 "rows": [ { "id": "...", "check": "...", "status": "...", "detail": "...", "hints": ["..."] } ] } ] }
```

The per-object folder `<out>/<id>/` also holds the raw measurements: `texel.json`, `repetition.json`, `morph.json`, `shadow.json`, `grounding.json`, `geometry.json`, the `cap-*.png` captures with their masks, the `face-*.png` ortho views, `capture-sheet.jpg` and `checklist-todo.yaml`. A **compare** or **keyvideo** module can read these files instead of re-rendering.

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
thresholds: {texel: {nearPxPerM: 160}}         # optional, may only tighten (or add `waivers:` with a reason)
selfReportKey: m2                              # optional: compare with the scene's own px/m claim
imagineSources: ["/imagine/"]                  # effects: allow-listed Imagine folders
```

A scene yaml adds `url`, `adapter` (a path), `hud`, `title`, `runtime.viewports`, `liveDir` (optional) and `objects: [spec files]`.

## Adapters

An adapter makes one game page reachable. See the README, section "Writing an adapter". The Imagine-to-3D staging viewer needs its own adapter (one object on a ground plane, `liveDir` unset, `path` around the object).

## Rules every caller follows

1. **Gate the staging copy, never the live preview.** Never edit live preview files in place. Work in a staging copy (its own folder or port), point `url` at it, and swap it into live (copy, then rename) only after `verdict === "PASS"`. The `exportFn` of `gateAndFix` is that swap. When an adapter sets `liveDir`, the gate FAILs `runtime.live-untouched` if any live file changes while it runs. This is lesson 2026-10-09 17:14.
2. Thresholds come from `loadProfile`. A module does not hard-code px/m, repeat or IoU limits.
3. Only PASS objects are exported, shown or merged. `NEEDS_REVIEW` means the `checklist.verified` items need a vision or owner pass recorded in `records/<id>.verified.yaml`. Those recorded passes expire when a capture changes (dHash above 12).
4. If the same defect FAILs twice, stop and report it (`maxSameDefect`). Do not loop.
