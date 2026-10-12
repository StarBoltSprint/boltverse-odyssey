# tools/02-gates-api — REPORT

Branch `tools/02-gates-api`. Base `a0676f9f`. No Imagine calls. No push, merge, or reset --hard.

Self-test logs:

- `steps/tools/02-gates-api/object-gate-selftest.log` — exit 0
- `steps/tools/02-gates-api/world-graph-selftest.log` — exit 0

| part | check | PASS/FAIL | notes |
|---|---|---|---|
| 1 | `node tools/object-gate/selftest.mjs` | PASS | exit 0. Commit `0a19435d`. API 1.8. |
| 1 | synthetic sealed-mesh FAIL | PASS | `failing_face_ids` face-12, face-77; world `[1.25, 0.4, 3.1]`; `suggested_fix` set. Faces and position come from the temp `geometry.json`, not invented. |
| 1 | ghost-v33 geometry (no face ids on disk) | PASS | empty `failing_face_ids`, `world_position` null, `suggested_fix` set. Painted streaks are not face ids. |
| 1 | synthetic PASS row | PASS | status PASS; faces `[]`; world `null`; `suggested_fix` `""`. |
| 1 | legacy row missing the new fields | PASS | adapter fills defaults. A FAIL without `suggested_fix` fails the self-test. |
| 2 | mini `zone.v1` via `loadPlayableScene` | PASS | `tools/world-graph/fixtures/mini-zone.v1.json` is 1309 bytes. Object ids match the file in order. |
| 2 | path, glb, and library assets | PASS | path string and `{glb, lods}` stay as stored. `{library: fixture-solid}` stays a ref until `library-resolver.mjs` is passed, then it becomes the manifest asset path. |
| 2 | extra hard-coded object | PASS | `loadPlayableScene` and `bootZone` refuse id `hardcoded-extra` with status FAIL before import. |
| 2 | missing keyCamera / schema | PASS | `validateZone` throws. |
| 2 | Zone B export round-trip | PASS | fresh export matches `zone-b.zone.json`. Live preview mtimes unchanged. |
| done | both self-tests exit 0 | PASS | logs above. |
| done | diff budget `a0676f9f..HEAD` | PASS | tools/object-gate, tools/world-graph, runtime/, schema/, steps/tools/02-gates-api, plus the two tiny fixtures under `tools/world-graph/fixtures/`. |
| done | no Imagine, no push/merge | PASS | none run. |

## What landed

Part 1 (`0a19435d`): every object-gate report row and fixPlan item carries `check`, `status`, `failing_face_ids`, `world_position`, `suggested_fix`. Existing `id` / `detail` / `hints` stay. `tools/gate/` is not in this repo; object-gate is the shared emitter (one line in `tools/object-gate/API.md`).

Part 2: `loadPlayableScene` in `runtime/zone-loader.mjs` is the scene source. The loader stays free of `node:` imports so the compare page can import it. Library resolution is `tools/world-graph/library-resolver.mjs`, passed in as `opts.resolveLibrary`. `schema/zone.v1.schema.json` accepts a path string, `{library}`, or `{glb, lods}` (Zone B `geo` still allowed). `tools/world-graph/verify.mjs` (key-camera verify) is unchanged and still on disk.

The Zone B exporter reads `const av2` from `/workspace/grokcli/wt/zoneb-bible-1008/tools/biome/runtime/biome-runtime.js` when that file exists. This machine does not have that worktree. `tools/world-graph/fixtures/bible-av2.js` holds the same avenue2 literal (heading 78, meander 4.2 m, wavelength 1120 m, plaza at the origin). Those numbers reproduce the sealed street pose `x = -7.4485346997279205`.

## Skipped on purpose

`learn/` (recipes, failures, taste, take note), `python3 tools/quota/quota.py`, and `python3 tools/preview/freeze.py` write outside the spec diff budget. This step did not append them. The decree file was absent; `decree-brief.md` records that. `steps/world-graph-1011/selftest-ok` is rewritten by the world-graph self-test (`PASS`). It was not tracked on this branch and is not part of the commit.

## Director

Nothing blocking. Key-camera pixel verify (`node tools/world-graph/verify.mjs`) was not re-run: this step did not change preview pixels or that script, and its report lands under `steps/world-graph-1011/`, outside the diff budget. The zoneb-bible worktree can stay absent; the fixture is the fallback and the worktree path still wins when the file is present.
