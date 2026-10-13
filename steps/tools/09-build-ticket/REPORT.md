# tools/09-build-ticket

Verdict: PASS

Package: `tools/build-ticket`. Schema: `tools/build-ticket/schema/ticket.v1.schema.json` (JSON Schema draft 2020-12, `$id` `ticket.v1`).

Eight fields, in order: `plates`, `placement` (includes `budget.lod0_tri_cap` and `budget.texture_mb_share`), `build`, `gates`, `play`, `shots`, `phone`, `go`. A later field must stay `pending` while any earlier field is `pending` or `fail`. `phone` may be `fps unverified` or `pass` before `go`. Gates compare measured `lod0_tris` and `texture_mb` with `>` against the placement budget, and measured clearances with `<` against `min_clearances`. `ground_m` must be `0`. Equal to a cap or a minimum passes.

Commit stamps are `build`, `gates`, `play`, `shots`, and `phone`. When HEAD is not `build.commit`, validate writes `gates`, `play`, `shots`, and `phone` back to `pending` and leaves `plates`, `placement`, `build`, and `go`. A `go` that is still filled then fails the order rule. Gates refuse (`fields.gates` `refused`, exit 1) when `build.commit` or a filled `shots.commit` is not HEAD.

Decree brief: `steps/tools/09-build-ticket/decree-brief.md`. No local decrees file. Nothing was invented.

No Imagine calls. No push. No merge. `tools/object-gate` and `tools/playcheck` were not modified. `gates.object_gate` accepts their JSON object or a path string.

## Measured rows

| Case | Expect | Result |
| --- | --- | --- |
| Out-of-order fill (gates filled while plates pending) | REJECT / exit 1 | Exit 1. Reason `order: gates filled while plates is pending`. Not a stale-commit miss. Fixture `tools/build-ticket/fixture/out-of-order.json`. |
| Stale commit stamp (`shots.commit` ≠ HEAD, `build.commit` = HEAD) | REJECT; gates refuse | Exit 1. `fields.gates` is `refused`. Reasons `stale-commit: shots` and `gates: refused`. File was not reset. |
| New commit after build | auto-reset `gates` / `play` / `shots` / `phone` to pending | Those four were written as `pending`. `plates`, `placement`, and `build.commit` (the previous HEAD) stayed. `go` was not wiped, so exit 1 also reports `order: go filled while gates is pending`, `stale-commit: build`, and `gates: refused`. |
| Over-budget build | gates FAIL | `lod0_tris` 25001 > cap 25000: exit 1, `fields.gates` `fail`. `texture_mb` 12.01 > share 12: exit 1, `fields.gates` `fail`. Happy path at the cap (25000 tris, 12 MB) exits 0. |
| Clearance violation | gates FAIL | Headroom 2.19 < 2.2: exit 1, `fields.gates` `fail`. Measured `ground_m` 0.01: exit 1, `fields.gates` `fail`. `placement.ground_m` 0.5: exit 1, `fields.gates` `fail`, reason `clearance: placement.ground_m 0.5 !== 0`. |
| Happy path | validate exit 0 | Exit 0. Temp git HEAD matched every stamp. Clearances equal the minimums, budget equals the caps, `phone` is `fps unverified`, `go.executed_by` is `Director`. |

## Command

```bash
node tools/build-ticket/selftest.mjs
```

Exit 0. `selftest PASS`.

Also checked: no args, missing path, missing file, and invalid JSON exit 2. A blank `init` ticket validates at exit 0. `set-field gates` on that blank ticket exits 1 and does not write. A schema-invalid `set-field` does not write. Gates may pass while `shots` is still `pending`. An `object_gate` verdict `FAIL` fails gates.

## Limits

Fixtures are synthetic numbers. No meshes. The validator does not open an `object_gate` path and does not run object-gate or playcheck.

Phone preview was not frozen. This step has no play tree. No session ndjson was passed to `tools/quota/quota.py`. `learn/` was not changed: the spec keeps `git diff --stat 99346a4..HEAD` inside `tools/build-ticket/` and `steps/tools/09-build-ticket/`.
