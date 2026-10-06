# Corridor A→B — magnification and chase smoothness

Verdict: PASS

Date: 2026-10-06. Pack `packs/corridor-ab`, with the zone A ruin plate and hull sampler where the same assets are drawn. No new Imagine pixels. Sky video files were left at their stored resolution.

## How it was measured

`tools/playcheck` drives `window.__play` on a clearing layout. This pack exposes `window.__corridor` and a waypoint corridor, so that walk cannot script it. Playcheck unit tests: 49 pass. `tools/playcheck/src/ruinwalk.test.mjs` does not load here (`playwright-core` is not installed). Walkaround was not rebuilt: the sealed 512² rock views stay the source, and this step does not recook a hull.

The corridor table is `packs/corridor-ab/play/measure-mag.mjs` (walk and sprint, headings every 10° plus 82°, 127°, and 165°). Visible hits only. Magnification limit is 1.0. Focal length is 1793.5 px (720×1600, vertical FOV 48.08°).

The earlier main readings of 2.09 and 1.42 at headings 82° and 127° were the zone A ridge eye (ground layer, 2026-10-04). They do not appear on this chase. At the sprint start (x 6.71, heading 82° and 127°, boom 6.166 m) every visible hit is at or under 1. Ground at the rest eye is 0.397. Bolt at boom 6.1 m is 0.541.

Phone line on the captured stills: drawCalls 7, texMB 184.5, activeVideos 4. Law 65 caps are 12 draws, 260 MB, and 4 videos.

## Before the fix

Coarse grid (8 m, every 10°, plus 82° and 127°). `before.json`.

| Surface | Worst mag | Distance | Where |
| --- | --- | --- | --- |
| wreck | 110.3 | 0.232 m | walk and sprint, x 30.7, heading 60° |
| arch | 43.07 | 0.267 m | walk and sprint, x 30.7, heading 127° |
| gate elevation | 2.95 | 16.593 m | walk and sprint, x 54.7, heading 330° |

516 poses were over 1, of which 334 had a real face distance above 0.2 m. A first sweep also printed magnifications in the hundreds at a distance of 0.05 m. That figure was the eye inside a ruin box, floored at 5 cm. The face distance is the roof or a pier. Those rows are not texel counts.

Ground, Bolt, stones, and the horizon seats were under 1 on that grid.

## What changed

The gate already has a close plate at 183 texels per metre (art floor about 10 m). The elevation is 36.6 texels per metre and was still shown until magnification passed 3. The blend now starts at 0.92 and is fully on the plate at 1.0. The 16.6 m row drops under 1. Zone A uses the same shader and the same switch.

Near rocks: the eye may slide inside a cone ±40° of the rest chase and the boom may run from 4.8 m to 7.45 m. Eye height stays 3.5 m. A tie keeps the rest eye. A full-disk search can clear the rocks by moving to the other shoulder; that leaves the “behind Bolt” framing, so the cone stops at ±40°. The boom cap is the lower-third line (body screen Y at 7.45 m is still under the line; 8.5 m is not).

Hull views sample with `textureGrad` from the derivatives of the local position, so the per-fragment view pick no longer leaves the mip undefined. Hull and ruin skins ask for anisotropy up to 8. Source textures stay full size. Sky videos are uploaded as stored, linear, no mip, and were not scaled or recompressed.

The chase follows the rigid parent (Bolt’s boom, including the turn and the sprint) every frame, up to one kinematic step. A collision shove larger than that step, and the offset from the rock cone, ease at 3.4 m/s. A tall-monolith pitch step eases at 0.85 rad/s. Still shots snap to the settled eye. An earlier ease of the whole eye in world space let the boom fall to 2.21 m during a 150°/s turn. The trace after the split stays above 5.7 m on the straight run and 6.5 m at the sample inside the turn.

`frame()` passed a `yaw` that `placeCamera` had made local, so the page threw before the first still. The sky draw now takes `cam.yaw`.

## After the fix — still over the limit

Fine grid (walk and sprint, every 2 m, every 10°). `after.json`. These rows need denser Imagine art. The boom is already on the cap, or the opening is narrower than the art floor. Textures were not enlarged. The monolith and the wreck were not shrunk.

| Surface | Poses over 1 | Worst mag | Distance | Boom | Art floor | Worst pose |
| --- | --- | --- | --- | --- | --- | --- |
| arch | 927 | 34.616 | 0.333 m | 7.4 m | 11.75 m | walk, x 32.7, heading 60° |
| wreck | 1307 | 73.957 | 0.346 m | 7.4 m | 26.13 m | sprint, x 38.7, heading 110° |
| gate plate | 134 | 1.737 | 5.641 m | 6.166 m | 10 m | sprint, x 60.7, heading 190° |
| boulder | 4 | 1.131 | 3.632 m | 7.4 m | 512² views | walk, x 40.7, heading 120°, `boulder:256264` |

Every remaining gate row is closer than the plate’s 10 m floor. Stones, horizon rocks, ground, and Bolt have no row over 1. Headings 82° and 127° at the sprint start stay under 1.

## Camera trace

`camera-trace.json`. Scripted 9 s, 540 frames, dt 1/60. Walk, sprint acceleration, a joystick turn, then a straight sprint, with a 1.2 m shove at t = 6 s.

| | |
| --- | --- |
| spikes | 0 |
| max position step | 0.599 m |
| max pitch step | 0.0615 rad |
| max frame work | 4.07 ms |
| mean frame work | 0.49 ms |
| min boom on the straight run (t 0.5–5.5 s) | 5.742 m |

Streaming still plants rocks at 14 m and eases them in over 1.15 s. The trace’s step times stay under a 16 ms frame.

## Proof frames

Captured from the play page at 720×1600, software WebGL, `canvas.toDataURL`. `sprint.mp4` is 2 s of `?shot=film` (24 frames, 12 fps).

| File | Heading | Boom | x |
| --- | --- | --- | --- |
| `sprint-start.jpg` | 90° | 6.166 m | 6.725 |
| `walk-start.jpg` | 90° | 6.166 m | 6.725 |
| `hdg-082.jpg` | 82° | 6.166 m | 6.706 |
| `hdg-127.jpg` | 127° | 6.166 m | 6.706 |
| `close-boulder-120.jpg` | 120° | 7.4 m | 40.680 |
| `close-arch-060.jpg` | 60° | 7.2 m | 32.705 |
| `close-wreck-110.jpg` | 110° | 6.8 m | 38.686 |
| `close-gate-190.jpg` | 190° | 5.2 m | 60.697 |
| `sprint.mp4` | film, sprint along the run | | |

Rest pitch on the open run is −0.159 rad. Eye height is 3.5 m. The arch still raises pitch when the monolith is in the cone (0.061 rad on the arch close-up).
