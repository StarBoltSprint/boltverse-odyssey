# tools/build-ticket

Per-object build ticket. One `ticket.json` in the object worktree. The schema is [`schema/ticket.v1.schema.json`](schema/ticket.v1.schema.json). The validator does not call `tools/object-gate` or `tools/playcheck`. `gates.object_gate` may be that report JSON, or a path string.

## Field order

Each field blocks the next. A later field stays `pending` while any earlier field is `pending` or `fail`.

| # | Field | Pass when |
| --- | --- | --- |
| 1 | `plates` | Every plate `ad_precheck` is `KEEP`. |
| 2 | `placement` | Path, `min_clearances` (`headroom_m`, `width_m`), `colliders`, and `budget` are filled, and `ground_m` is `0`. |
| 3 | `build` | `commit` is a full sha or 7+ hex. |
| 4 | `gates` | `status` is `pass`, clearances hold, tris and texture are inside `placement.budget`, and the commit stamps match HEAD. |
| 5 | `play` | `status` is `KEEP`, with `commit` and `timecodes`. |
| 6 | `shots` | `status` and `ad_verdict` are `KEEP`, with `commit` and `sheet_paths`. |
| 7 | `phone` | `pass`, or `fps unverified` when no fps measurement is in yet. Not `fail` or `pending`. |
| 8 | `go` | `text`, ISO-8601 `timestamp`, `executed_by` `Director`. Phone may be `fps unverified` or `pass`. |

`placement.budget.lod0_tri_cap` is a triangle count (a pillar is at or under 25000). `texture_mb_share` is this object's megabyte share of the zone 300 MB pool. Gates fail when measured `lod0_tris` is over the cap or measured `texture_mb` is over that share. Equal to the cap is inside the budget. A measured clearance under `min_clearances`, or a `ground_m` other than `0`, fails gates.

## Commit stamps and reset

`build`, `gates`, `play`, `shots`, and `phone` carry `commit`. When a git root is passed (`--git-dir`), discovered from the ticket path, or overridden with `--commit`:

- A stamped `commit` that is not HEAD is a stale reject.
- Gates do not run when `build.commit` or a filled `shots.commit` is not HEAD. Summary status is `refused`.
- When HEAD is not `build.commit`, the validator sets `gates`, `play`, `shots`, and `phone` back to `pending` and writes the file. `plates`, `placement`, and `build` stay. `go` is not wiped; the order rule then rejects a `go` that is still filled.

## CLI

From the repo root:

```bash
node tools/build-ticket/cli.mjs init <ticket.json> [--object <id>] [--force]
node tools/build-ticket/cli.mjs set-field <ticket.json> <field> --json '<json>' [--git-dir <repo>] [--commit <sha>]
node tools/build-ticket/cli.mjs validate <ticket.json> [--git-dir <repo>] [--commit <sha>]
node tools/build-ticket/selftest.mjs
```

Stdout is one JSON summary. Exit `0` means the ticket is valid and consistent. Exit `1` is a rule failure (order, stale commit, budget, clearance, a field that failed). Exit `2` is a bad invocation, missing file, or invalid JSON.

`set-field` refuses a write when an earlier field is not a pass. `validate` is what the self-test proves.
