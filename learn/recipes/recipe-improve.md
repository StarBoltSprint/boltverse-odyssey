# tool — recipe A/B against one proposal

Status: validated. No Imagine cook. The prompt was not stored because none was sent.

| Field | Value |
| --- | --- |
| Asset kind | other (recipe overlay scorer) |
| Take | tools/08-recipe-improve |
| Commit | not committed. Parent `99346a47`. |
| Date | 2026-10-13 |
| Size | no image |
| Tries | 1 |
| CLI | none |
| Image refs | none |

## Prompt

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node tools/recipe-improve/selftest.mjs` | reject blocking regression | exit 0; `ground-quality-drop` 28/32 → 30/32; `perf/perf.quality-kept` FAIL; decision `keep_current` |
| `node tools/recipe-improve/selftest.mjs` | reject tie | 28/32 = 28/32; regressions 0; decision `keep_current` because `tie` |
| `node tools/recipe-improve/selftest.mjs` | adopt when strictly better | `ground-relief-pass` 28/32 → 30/32; relief FAIL → PASS; `proven: true`; `methodEdited: false` |
| `node tools/recipe-improve/selftest.mjs` | logs written | JSON + md for the three ids under `learn/recipe-improve/`; `docs/METHOD` tree hash unchanged |

## Gotchas

A higher total does not win when any blocking check goes to FAIL. The self-test's proven file is a fixture win. It is not a lock of `docs/METHOD/ground.md`.

Points are PASS 2, WARN 1, FAIL 0. INFO is omitted. PENDING on a shot sheet scores as FAIL.

## Reuse

```bash
node tools/recipe-improve/cli.mjs \
  --recipe <id> \
  --inputs <inputs.json> \
  --proposal learn/proposals/<id>.json \
  --id <comparison-id>
```

Same plates, kit, and scene on both arms. Omit a report key on the proposal to reuse the baseline measurement. Director folds `learn/proposals/<id>.proven.json` only after a real cook. The tool does not apply the diff.
