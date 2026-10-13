# tools/08-recipe-improve

Verdict: PASS

Package: `tools/recipe-improve`. It A/Bs one `docs/METHOD/<id>.md` recipe against one overlay from `learn/proposals/`. Both arms take the same plates, kit, and scene. The recipe file is read and hashed. A strict win writes `learn/proposals/<id>.proven.json` for Director. This step did not edit `docs/METHOD`.

Score: PASS = 2, WARN = 1, FAIL = 0. INFO rows are left out. Both arms use the union of check keys, so the max is the same. Object-gate `runtime[]` and `objects[].rows[]` are scored from the report JSON. Rows whose id starts with `perf.` are dropped and replaced by `perfRows` (`tools/object-gate/gate.mjs`) when the arm has a `__perfReport`. A missing report becomes the INFO row `perf.report` and adds no points. A shot-sheet verdict (`objsheet-shot-verdict/1`) adds the sheet verdict plus the five cells. KEEP scores as PASS. FAIL and PENDING score as FAIL. `python3 tools/objsheet/verdict.py intake` must agree (KEEP exit 0, FAIL or PENDING exit 1).

Adopt when the variant's points are higher and `blockingRegressions` is empty. A blocking regression is a FAIL on the variant when the current arm did not FAIL, or a PASS on the current arm that the variant dropped. WARN is not a blocking status. Equal points keep the current recipe. A higher total with one blocking FAIL keeps the current recipe.

Decree brief: `steps/tools/08-recipe-improve/decree-brief.md`. No local decrees file. Nothing was invented.

No Imagine calls. No push. No merge.

## Measured rows

| # | Done when | Result |
| --- | --- | --- |
| 1 | Package is `tools/recipe-improve`. Current recipe and one proposal run on the same inputs. | CLI `--recipe ground` read `docs/METHOD/ground.md` sha256 `cf934379179faeba63b18b7d89185e380d4d22146a694b819f3005915f5e5229`. Both arms hashed the same two plates, `biome/kits/howling-eclipse.json`, and `tools/recipe-improve/fixtures/scene.json`. `sameInputs` true. Param overlay stayed in memory (`baselineTextSha256` = `variantTextSha256`). |
| 2 | A blocking regression is rejected even when the total is higher. | `ground-quality-drop`: 28/32 → 30/32, `perf/perf.quality-kept` PASS → FAIL (`detailOn` false via `perfRows`). Decision `keep_current`, because `blocking_regression`. No proven file. |
| 3 | A tie is rejected. | `ground-param-tie`: label param changed, measurements reused, 28/32 = 28/32, regressions 0. Decision `keep_current`, because `tie`. Shot intake `ALLOW KEEP` exit 0. |
| 4 | A strictly better variant is adopted and a proven patch is emitted. | `ground-relief-pass`: 28/32 → 30/32, regressions 0. `object/ground/geometry.relief` FAIL → PASS. Stretch stayed FAIL. Decision `adopt_variant`. `learn/proposals/ground-relief-pass.proven.json` has `proven: true`, `methodEdited: false`, and a unified diff against `docs/METHOD/ground.md`. |
| 5 | Every comparison writes JSON and markdown under `learn/`. | `learn/recipe-improve/selftest-reject-regression.json` + `.md`, `selftest-reject-tie.json` + `.md`, `selftest-adopt.json` + `.md`. Each log has inputs, both scores, the per-check table, and the decision. |
| 6 | `docs/METHOD` stays byte-identical. | Tree hash of `docs/METHOD` matched before and after the self-test. `ground.md` and `sky.md` sha256 matched. Unknown recipe `not-a-recipe` exited 2. |
| 7 | Phone perf and the shot sheet are real calls, not a second copy of those checks. | Perf rows come from `perfRows` on the v62 `__perfReport` shape, viewport 412×915. Shot sheets go through `tools/objsheet/verdict.py intake`. |
| 8 | Self-test exits 0. No Imagine, no push, no merge. | `node tools/recipe-improve/selftest.mjs` printed `PASS recipe-improve selftest reject-on-regression reject-on-tie adopt-when-strictly-better logs-written`. No image or video generation. Worktree was not pushed or merged. |

## Command

```bash
node tools/recipe-improve/selftest.mjs
```

Kit gate comment in the spec is `node tools/recipe-improve/selftest.mjs`.

## Limits

The three `learn/proposals/ground-*.json` files are self-test fixtures. The proven patch records that fixture win. It is not an owner lock of the ground recipe. A live page is not opened: object-gate is scored from report JSON, and phone perf is scored by calling `perfRows` on a `__perfReport` object. Phone preview was not frozen: this step has no play tree.
