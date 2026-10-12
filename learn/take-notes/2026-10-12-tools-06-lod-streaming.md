# Take note — tools/06-lod-streaming — 2026-10-12

No Imagine cook. No owner reaction, so `learn/taste.md` was not changed. Phone preview was not frozen: this step has no play tree. The work is uncommitted on `a0676f9f`. No push, no merge.

## Quota and turns

Copied from `learn/quota-log.md`. The counter does not see `turn_started` in this session log, so turns and tool calls are 0. Those cells were not invented upward.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-12 | tools-06-lod-streaming | n/a | 0 | 0 | 0 | 0 | n/a | n/a | 628.5 | events.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| lodstream gate | other | 1 self-test pass | row above | accepted |

## This step

- Step: `steps/tools/06-lod-streaming`
- Accepted because: `node tools/lodstream/selftest.mjs` exit 0. Good diffPx 0/0, hitPx 61504/7744, tris 13/12/12. Outline-diff exit 1, 15 m diffPx 46128. Over-budget lod0 80001 exit 1. Missing mipmaps exit 1.
- Recipe appended: none. No Imagine prompt was sent.
- Failure appended: `2026-10-12 — LOD meshes had no offline outline, budget, or mipmap gate` in `learn/failures.md`.

## Biggest waste

The first self-test passed. The extra in-process rows (coarser triangle count, 512 px plate, tight `lod0Max`) are the checks that keep a stub from passing the four named fixtures only.

## Reuse next time

- Recipes to copy: none. Command is `node tools/lodstream/selftest.mjs`.
- Library ids to place: none. The report is an intake file. It does not register an object.
- Failures that would have caught this take earlier: the new `learn/failures.md` row. `tools/object-gate/py/lod_gate.py` still allows a small XOR fraction and needs rendered passes.

## Added this take

- New recipes: none
- New failure entries: LOD meshes had no offline outline, budget, or mipmap gate
- Tool improvement: `tools/lodstream` (0 px silhouette at 15 m and 40 m, triangle budget default 80000, mipmaps and 1024 Imagine px)
