# tools/recipe-improve

A/B one `docs/METHOD` recipe against one candidate from [`learn/proposals`](../../learn/proposals/README.md). Both arms use the same plates, kit, and scene. The recipe file is read and hashed. A win writes a proven patch for Director. The tool leaves `docs/METHOD` unchanged.

```bash
node tools/recipe-improve/cli.mjs \
  --recipe ground \
  --inputs tools/recipe-improve/fixtures/ground-inputs.json \
  --proposal learn/proposals/ground-relief-pass.json \
  --id selftest-adopt

node tools/recipe-improve/selftest.mjs
```

`--recipe` is the stem of `docs/METHOD/<id>.md` (`ground`, `sky`, and the other sheets). Exit 0 when the comparison log is written. Exit 2 on a bad invocation, an unknown recipe, or a shot sheet that `tools/objsheet/verdict.py intake` cannot read. `keep_current` is still exit 0. The decision is in the log.

## What is scored

| Source | When | How |
| --- | --- | --- |
| object-gate report JSON | Required on the inputs. The variant reuses it when the proposal omits `objectGate`. | Each `runtime[]` row and each `objects[].rows[]` row. Rows whose id starts with `perf.` are dropped so phone perf is scored only from `perfRows`. |
| `__perfReport` | When the arm has a perf object. | `perfRows` from `tools/object-gate/gate.mjs` on viewport `[412, 915]` unless `inputs.viewport` sets another pair. A missing report becomes the INFO row `perf.report`, which is not scored. |
| Shot-sheet verdict | When the arm has an `objsheet-shot-verdict/1` sheet. | Five cells plus the sheet verdict. `python3 tools/objsheet/verdict.py intake` must agree: KEEP exits 0, FAIL or PENDING exits 1. |

Points per scored row: PASS = 2, WARN = 1, FAIL = 0. INFO is omitted. A shot cell or verdict of KEEP scores as PASS. FAIL and PENDING score as FAIL. PENDING is a blocking fail because intake refuses it. Both arms are scored on the union of check keys, so the denominator matches.

## Keep or adopt

Adopt only when the variant's points are higher and `blockingRegressions` is empty.

A blocking regression is a check the variant FAILs when the current arm did not FAIL, or a PASS on the current arm that the variant dropped. WARN is not a blocking status. A tie (equal points, no regression) keeps the current recipe. A higher total with one blocking regression keeps the current recipe.

Logs (every comparison): `learn/recipe-improve/<id>.json` and `learn/recipe-improve/<id>.md`. They record the inputs, both scores, the per-check diff, and `keep_current` or `adopt_variant`.

On `adopt_variant` the tool writes `learn/proposals/<proposal-id>.proven.json` with `proven: true` and a unified diff. Director folds that diff. This tool does not apply it.

## Self-test fixtures

`learn/proposals/ground-quality-drop.json` raises the gate score and turns `detailOn` off, so `perf.quality-kept` FAILs. The variant is rejected.

`learn/proposals/ground-param-tie.json` changes a label and reuses every measurement. Equal score. Rejected.

`learn/proposals/ground-relief-pass.json` turns `geometry.relief` from FAIL to PASS and leaves the other blocking checks in place. Adopted. The proven file is the self-test's win artifact.

No Imagine call. No edit to `docs/METHOD`.
