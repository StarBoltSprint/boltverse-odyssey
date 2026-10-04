# Take note — Archives polish — 2026-10-04

## Quota and turns

Quota row from `python3 tools/quota/quota.py` on `archives-polish-20261004-2036.jsonl`. The log did not count the Imagine calls. Measured spend in this session, separate from that row: 2 image calls, 3 video calls, 1 video file (720×1280, 6.041667 s).

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | archives-polish | a6d14e0 | 0 | 223 | 0 | 0 | 496222 | 115012 | n/a | archives-polish-20261004-2036.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Hall loop | other | 1 video file, 2 rejected video calls | 2026-10-04 archives-polish a6d14e0 turns 0 tools 223 images 0 videos 0 tokens_in 496222 tokens_out 115012 wall_s n/a | accepted |
| Paw glow | other | 1 image call | same quota row as the hall loop | accepted |
| 9:20 hall still | other | 1 image call, 576×1280 | same quota row as the hall loop | rejected as the live fallback |

## This step

- Step: Archives polish, 2026-10-04. Shared menu film and paw glow.
- Accepted because: root `npm test` exit 0 (archives tests 13 pass). `npm --prefix tools/playcheck test` 51 pass, 0 fail. Seam MAE 1.8, mid MAE 9.986. Phone 360×800 dpr 2: video 360×640 at scale 1, readyState 4, world canvas hidden, band pixel rgb(31, 28, 41).
- Recipe appended: `learn/recipes/archives-menu-loop.md`.
- Failure appended: `2026-10-04 — a 720p menu video cannot cover a 720×1600 phone`.

## Biggest waste

Two video calls died before a file existed: aspect `9:20`, then resolution `1080p`. The third call, 720p `9:16`, is the film. That miss is `learn/failures.md`, 2026-10-04, the 720p cover entry.

## Reuse next time

- Recipes to copy: `learn/recipes/archives-menu-loop.md`.
- Library ids to place: none. The film is a menu backdrop, not a placed solid.
- Failures that would have caught this take earlier: the new 720p cover entry. A 9:20 or 1080p video call will not return a taller frame.

## Added this take

- New recipes: `learn/recipes/archives-menu-loop.md`.
- New failure entries: `2026-10-04 — a 720p menu video cannot cover a 720×1600 phone`.
- Judge: `python3 tools/judge/judge.py` exited 1 (`grok -p` is `--single`). A same-prompt call under the 128 KiB argument cap, parsed with `--parse-reply`, was `FAIL gate: score 4 < 7; keep is false`, `matches_refs` true. The defects are the previous hall. Not recooked. Tool note: `feedback/2026-10-04-judge.md`.
