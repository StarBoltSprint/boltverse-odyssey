# Take note — tools/03-library-intake — 2026-10-12

## Quota and turns

Quota row from `learn/quota-log.md` (events.jsonl did not carry turn, tool, or token counts):

`| 2026-10-12 | tools-03-library-intake | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 838.9 | events.jsonl |`

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| library intake refusal guards | other | one self-test pass | see quota-log | accepted |

## This step

- Step: tools/03-library-intake
- Accepted because: `python3 tools/library/selftest.py` exit 0 and `python3 tools/library/selftest_intake.py` exit 0. `python3 tools/layout/selftest.py` exit 0. No Imagine calls.
- Recipe appended: none. This step did not cook an Imagine plate.
- Failure appended: `2026-10-12 — library add accepted a part with no run PASS`

## Biggest waste

The session log counts 0 tool calls, so the quota row cannot show the self-test runs. The measured wall time is 838.9 s. The guards themselves are the small `require_intake` check.

## Reuse next time

- Recipes to copy: none. The refusal table is in `tools/library/README.md`.
- Library ids to place: `fixture-solid` is still the synthetic test id. Its new fields are stubs, not measurements of the rock.
- Failures that would have caught this take earlier: the new intake self-test. Before it, report PASS was enough to register a part.

## Added this take

- New recipes: none
- New failure entries: library add accepted a part with no run PASS
- Confirmed: path-string layout specs still match `tools/layout/sample/good/clearing.json`. No existing recipe row covered intake refusal.
