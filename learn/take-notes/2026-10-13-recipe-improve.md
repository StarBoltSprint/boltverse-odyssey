# Take note — tools/08-recipe-improve — 2026-10-13

No Imagine cook. No owner reaction, so `learn/taste.md` was not changed. Phone preview was not frozen: this step has no play tree. The work is uncommitted on `99346a47`. No push, no merge.

## Quota and turns

Copied from `learn/quota-log.md`. The counter does not see turns or tool calls in this session's `events.jsonl`, so those cells are 0. Those cells were not invented upward.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-13 | tools-08-recipe-improve | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 674.5 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| recipe-improve gate | other | 1 self-test pass | row above | accepted |

## This step

- Step: `steps/tools/08-recipe-improve`
- Accepted because: `node tools/recipe-improve/selftest.mjs` exit 0. Regression 28/32 → 30/32 rejected on `perf/perf.quality-kept`. Tie 28/32 rejected. Adopt 28/32 → 30/32 wrote `learn/proposals/ground-relief-pass.proven.json` with `proven: true`. `docs/METHOD` tree hash unchanged.
- Recipe appended: `learn/recipes/recipe-improve.md`
- Failure appended: none

## Biggest waste

The first self-test passed. The three fixture proposals are the whole proof. No second cook.

## Reuse next time

- Recipes to copy: `learn/recipes/recipe-improve.md`. Command is `node tools/recipe-improve/cli.mjs --recipe <id> --inputs <inputs.json> --proposal <file>`.
- Library ids to place: none. The tool does not register an object.
- Failures that would have caught this take earlier: none in the log. The new gate is the check.

## Added this take

- New recipes: `learn/recipes/recipe-improve.md`
- New failure entries: none
- Tool improvement: `tools/recipe-improve` keeps a variant only when its points are higher and no blocking check goes to FAIL. A tie keeps the current recipe. The proven diff stays under `learn/proposals/`.
