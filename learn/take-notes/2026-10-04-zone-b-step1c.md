# Take note — zone B step 1c — 2026-10-04

## Quota and turns

Copied from [`learn/quota-log.md`](../quota-log.md). The command was `python3 tools/quota/quota.py` on this session's `events.jsonl`. Do not read the zero cells as a cook count. That log does not label turns or image generations in the fields the tool counts.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | zone-b-step1c | f184f93 | 0 | 0 | 0 | 0 | n/a | n/a | 2824.6 | events.jsonl |

Cook count, from the untracked provenance file `/workspace/grokcli/out/zoneB/step1c/run/provenance.json`: 4 new `image_gen` calls, 5 reused stills. Prompts were not stored.

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Upper band, 9 slices, 12.0°–30.5° | sky | 4 new calls, 5 reused | quota image cell 0; cook count 4 | installed, IN TEST. Sky check 59 failures |
| Skirt rise 42 m, then alpha fade | ground | 2 (full fog mix, then mix 0.40 and alpha) | same session row | wide join kept. Chase rim remains |
| Desert-floor frame (call 4) | sky | 1 of the 4 calls | same session row | full frame rejected. Sky crop kept as `upper/sky-5.jpg` |

## This step

- Step: Zone B step 1c. Code commits `c405445`, `e0e9123`, `3e162f7`. Report commit `f184f93`.
- Accepted because: the four 720×1600 shots no longer have the zenith band, and the wide shot no longer has the hard ground line. Root `npm test` exit 0. `tools/playcheck` npm test 43/43. Live playcheck exit 1, 24 pass / 7 fail (the `clearing/1` rows). Presented mag 0.993. drawCalls 7. Texture bytes 140712898. Not a QC PASS. Status IN TEST.
- Recipe appended (path, or `none`): none. `tools/sky/check.py` did not pass, so no recipe claims a PASS.
- Failure appended (heading in `learn/failures.md`, or `none`): `2026-10-04 — skirt fogged to one colour leaves a hard edge`.

## Biggest waste

The full mix toward one fog colour. That is the failure entry above. The second try (mix 0.40, alpha 300–460 m) is the stop. Call 4 also spent one Imagine still on a desert floor that could not be installed whole.

## Reuse next time

- Recipes to copy: none new. The zone A sky-ring recipe does not cover this upper band.
- Library ids to place (`tools/library`), instead of recooking: none.
- Failures that would have caught this take earlier: the new skirt-fog entry. Do not mix the far ground fully to the one sampled fog colour.

## Added this take

- New recipes: none.
- New failure entries: skirt fogged to one colour leaves a hard edge.
- Prompt or tool improvement: that failure entry. No geometry change. No new QC number. The step did not only confirm an old row.
- Preview freeze exited 1: `REPORT verdict is missing; freeze waits for PASS`. The report line is `Verdict: IN TEST`. No preview was written. No public URL.
