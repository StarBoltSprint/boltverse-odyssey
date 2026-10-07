# Wide far-band stream

Date: 2026-10-07

Verdict: PASS

Placement only. The cooked arch, gate, and wreck are reused. Copies recycle. The plain film URL does not start a quest.

| Row | Result |
| --- | --- |
| Births stay at or beyond 92 m and outside the near frustum, including after a turn | `node --test packs/corridor-ab/play/stream.test.mjs` — "a new slot is born beyond the far ring and outside the near frustum", "a turn births across the forward band and stays outside the near frustum" |
| The far band covers both sides of the portrait and the measured half does not grow with charge | Sprint settle laterals span both signs and more than 20 m. `halfWidth(1) === halfWidth(0)` and is `bandHalf(92)` |
| A sprint holds an arch, a gate, and a wreck, at most 3 copies each. A walk look stays short of that ring | Settle sprint counts are at least 1 and at most 3. Walk settle has no gate |
| Rocks per square metre rise from 8 s to 16 s to 24 s | `node --test packs/corridor-ab/play/stream.test.mjs` — "rocks per visible area rise across a long sprint" |
| Draws, textures, and videos stay inside the phone caps | Capture `maxDraw` 9, `texMB` 184.5, `activeVideos` 3. `drawBudget(3)` is 10 |
| An adventure plan still seats one gate. The plain URL does not start a quest | Plan test seats one gate and omits the wreck. Capture `plainUrl` true. Source still requires `adventure=1` |
| 720×1600 clip, top-down plot, count table | `sprint-wide.mp4` is 720×1600, 20 s, 40 frames. `spawn-plot.svg`. `counts.md` |
| Seats stay on the ground | Ruin rise is 0. Rock base stays at −0.35 m. Late frame lower half is not empty (max channel 255) |

Live copies on the film page, straight sprint:

| t (s) | x | speed | arch | gate | wreck |
| --- | --- | --- | --- | --- | --- |
| 1 | 7.6 | 1.65 | 1 | 1 | 1 |
| 8 | 59.3 | 12.18 | 2 | 2 | 2 |
| 16 | 171.1 | 15.77 | 2 | 2 | 2 |
| 20 | 237.8 | 17.56 | 3 | 3 | 3 |

Monument laterals relative to Bolt during that clip: −24.5 m to +22.7 m.
