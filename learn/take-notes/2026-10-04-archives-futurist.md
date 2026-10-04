# Take note — Archives futuristic hall — 2026-10-04

## Quota and turns

Quota row from `python3 tools/quota/quota.py` on `archives-futurist-20261004-2155.jsonl`. The log did not count the Imagine calls. Measured spend in this session, separate from that row: 3 image calls, 3 video calls, 1 video file (640×1424, then a 12 s ping-pong). Two image calls were not used.

| Date | Step | Commit | Turns | Tool calls | Image gens | Video gens | Tokens in | Tokens out | Wall s | Log |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 | archives-futurist | 2158259 | 0 | 223 | 0 | 0 | 339018 | 101368 | n/a | archives-futurist-20261004-2155.jsonl |

| Item | Kind | Turns or tries | Quota spent | Result |
| --- | --- | --- | --- | --- |
| Hall stills | other | 3 image calls. Two returned 576×1280. The video pin is the third. | 2026-10-04 archives-futurist 2158259 turns 0 tools 223 images 0 videos 0 tokens_in 339018 tokens_out 101368 wall_s n/a | accepted as the video pin |
| Hall clip | other | 3 video calls. Two rejected before a file. One file 640×1424, seam MAE 14.445. | same quota row | accepted after ping-pong |
| Taller plate | other | the same two image calls | same quota row | rejected. Stop. |

## This step

- Step: Archives futuristic hall, 2026-10-04. Owner 2026-10-04 21:54.
- Accepted because: `node --test packs/common/archives/archives.test.mjs` 13 pass, 0 fail. Root `npm test` exit 0. `npm --prefix tools/playcheck test` 51 pass, 0 fail. Seam MAE 1.813, mid MAE 9.98. Phone video CSS 320×712 at scale 1. Paw opacity 0.05 to 0.72, translateY −2.5 px at 1400 ms. `plate.jpg` not in the pause image list.
- Recipe appended: `learn/recipes/archives-futurist-hall.md`.
- Failure appended: `2026-10-04 — a 640×1424 menu film still cannot cover 720×1600`.

## Biggest waste

Two video calls died before a file, and two image calls returned 576×1280 when the plate needed to be at least 720×1600. That miss is `learn/failures.md`, the 640×1424 cover entry. The gothic 720×1280 entry is the same class from the previous step.

## Reuse next time

- Recipes to copy: `learn/recipes/archives-futurist-hall.md`. The older `archives-menu-loop.md` is the gothic film.
- Library ids to place: none. The film is a menu backdrop.
- Failures that would have caught this take earlier: the 720p cover entry. A 9:20 or 1080p call still returns no file.

## Added this take

- New recipes: `learn/recipes/archives-futurist-hall.md`.
- New failure entries: `2026-10-04 — a 640×1424 menu film still cannot cover 720×1600`.
- `learn/geometry.md` was not changed. The level-horizon row already says 0.50. This window’s brightest row measured 0.508 and stayed on that row.
- Judge: `python3 tools/judge/judge.py` exited 1 on the known `grok -p` argv. No new score. Existing note: `feedback/2026-10-04-judge.md`. New note for the aspect allow-list: `feedback/2026-10-04-imagine-video-aspect.md`.
