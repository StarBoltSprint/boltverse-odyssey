# tools/09-build-ticket — compact Grok Build spec

Branch `tools/09-build-ticket` off origin/main @ 99346a4. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine.** Tools only — do not touch zone-d terrace / rune-pillar geometry.

## Goal

Per-object **build ticket**: one `ticket.json` living in the object worktree (or object out dir), plus JSON Schema + validator CLI. Director-approved Studio org tool: fields fill in order; each field blocks the next; commit-stamped fields auto-reset on new commit.

Prefer new package `tools/build-ticket/` (schema, validator CLI, selftest, tiny fixtures). Do not break `tools/object-gate` / `tools/playcheck` APIs; may *read* their JSON shapes.

## Fields (order is mandatory; each blocks the next)

Status per field: `pending` | `pass` | `fail` (or field-specific verdicts below). A later field may not leave `pending` / be filled while any earlier field is `pending` or `fail`.

1. **`plates`** — list of plates `{id, path, ad_precheck: "KEEP"|"FAIL"|"pending", notes?}`. Art Director pre-check per plate. Field PASSes only when every plate is KEEP.
2. **`placement`** — Level Designer, filled **before** build:
   - `path` (route / spine refs), `min_clearances` (e.g. headroom_m, width_m), `ground_m` (must be `0`), `colliders` (list from plates/depth)
   - **`budget`**: `{ lod0_tri_cap` (e.g. pillar ≤ 25000), `texture_mb_share` (share of zone 300 MB) }`
3. **`build`** — `{ commit: "<full or 7+ hex sha>" }` — the object build commit (HEAD at build time).
4. **`gates`** — `{ status, commit, object_gate` (object-gate JSON / path), `clearance` (blocking check vs placement), `budget_check` (vs placement.budget) }`. FAIL if clearance violated or tris/texture over budget. Gates **refuse to run** (validator exit ≠ 0, status fail/refused) if `shots.commit` or `build.commit` ≠ current git HEAD of the ticket's repo (when a git root is provided / discovered).
5. **`play`** — Playtester run `{ status: "KEEP"|"FAIL"|"pending", commit, timecodes: [{t, note}], notes? }` — commit-stamped.
6. **`shots`** — `{ status: "KEEP"|"FAIL"|"pending", commit, sheet_paths: […], ad_verdict: "KEEP"|"FAIL"|"pending" }` — shot sheet + Art Director KEEP; commit-stamped. Gates refuse when this commit ≠ HEAD.
7. **`phone`** — `{ status: "fps unverified"|"pass"|"fail"|"pending", commit, perf_report? }` — `__perfReport()` result; default / empty = **`fps unverified`** until filled; commit-stamped.
8. **`go`** — SmiR go `{ text, timestamp` (ISO-8601), `executed_by: "Director" }` — only when all prior fields pass (phone may be `fps unverified` or `pass`; not `fail`/`pending`).

## Validator rules

- **Order**: reject out-of-order fill (e.g. setting `gates` while `placement` pending/fail).
- **Stale commit**: reject if a commit-stamped field's `commit` ≠ current HEAD (when checking that field / running gates).
- **Auto-reset on new commit**: when validator sees HEAD ≠ `build.commit` (or an explicit `--commit` / detected new HEAD after build), reset `gates`, `play`, `shots`, `phone` to `pending` (clear prior pass data / stamps). Do not wipe `plates` / `placement` / `build` unless asked.
- **Budget**: gates FAIL when measured lod0 tris > `placement.budget.lod0_tri_cap` or texture MB > `placement.budget.texture_mb_share`.
- **Clearance**: gates FAIL when measured clearances violate `placement.min_clearances` or `ground_m !== 0`.
- CLI: `node tools/build-ticket/cli.mjs validate <ticket.json> [--git-dir <repo>]` exit 0 = valid+consistent; exit 1 = rule fail; exit 2 = bad invocation. Emit short JSON summary to stdout.
- Optional helpers: `init`, `set-field` that enforce the same rules (nice-to-have; validate + selftest are required).

## Schema

- `tools/build-ticket/schema/ticket.v1.schema.json` (JSON Schema draft-07 or 2020-12).
- Document field order + reset rules in `tools/build-ticket/README.md` (short).

## Self-tests (must prove bad output fails)

`node tools/build-ticket/selftest.mjs` exits 0 and proves:

| Case | Expect |
|---|---|
| Out-of-order fill (e.g. gates filled while plates pending) | REJECT / exit 1 |
| Stale commit stamp (shots.commit or build.commit ≠ HEAD) | REJECT; gates refuse |
| New commit after build | auto-reset gates/play/shots/phone → pending |
| Over-budget build (tris or texture MB over placement.budget) | gates FAIL |
| Clearance violation (headroom / ground ≠ 0) | gates FAIL |
| Happy path: all fields in order, commits match HEAD, under budget, clearances OK | validate exit 0 |

Use tiny fixtures under `tools/build-ticket/fixture/` (no real meshes; synthetic numbers). Prefer a temp git repo inside the selftest for HEAD checks.

## Deliverables

- `tools/build-ticket/` (schema, cli, selftest, fixtures, README)
- `steps/tools/09-build-ticket/REPORT.md` with table (case | expect | result) and schema path
- Local commit(s) on `tools/09-build-ticket`

<!-- kit-gate: node tools/build-ticket/selftest.mjs -->
<!-- kit-gate-outdir: steps/tools/09-build-ticket -->

## Done when

- Self-tests exit 0 proving the five failure cases + happy path
- Schema file exists and matches the 8 fields + budget
- REPORT.md filled honestly
- `git diff --stat 99346a4..HEAD` stays in `tools/build-ticket/` and `steps/tools/09-build-ticket/`
- No Imagine; no push/merge

END: branch, HEAD sha, schema path, compact schema summary, self-test exit code.
