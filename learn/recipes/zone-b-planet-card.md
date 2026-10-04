# cutout — zone B planet card

Status: IN TEST. One keyed planet video on the Ember Mesa chase. It does not replace sky v1.

| Field | Value |
| --- | --- |
| Asset kind | `cutout` |
| Take | Zone B planet fix |
| Commit | PLANETSHA |
| Date | 2026-10-05 |
| Size | 1280×720, 24 fps, 6.041667 s, 145 frames. On-screen geometric size 720×405 at magnification 0.5625. |
| Tries | 3 images, 2 videos. The second still did not turn the clouds. The first video idled. One image slot left unused. |
| CLI | `generate` then `edit` then video. Session files only. Prompt text is not in this repo. |
| Image refs | Poster and loop ends = session image 1. Mid keyframe at 3 s = session image 3. Shipped video = session video 2. |

## Prompt

not stored

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| phone pair `pair.json` | media dt | 1.415 s → 5.246 s, dt 3.830 s, spinning true, paused false |
| phone pair | active videos | 4 and 4 |
| phone pair | scale | geometric 0.5625; projected width 752.14 / native 1280 = 0.588 |
| phone pair | aspect | native 1.7777778, geometric screen 1.7777778 |
| phone pair | place | heading 180°, elevation 13°, 560 m, pitch −3.81°, presented mag 0.9818 |
| disk, rows 90–380 cols 200–540 | motion | mean abs 5.21, fraction above 12 is 0.108; ring-top mean abs 0.205 |
| root `npm test` | suite | exit 0 |
| `cd tools/playcheck && npm test` | suite | 43 pass, 0 fail |

## Gotchas

Pin a frame in the middle of the clip. Ends alone hold still.

Proof playback omits `debug=1`. That flag skips the upload, and the browser then throttles the clock. A wait that subtracts the start time fails when the 6 s loop wraps. Wait for a window ahead of the first grab.

Key from green excess. A luma cut eats the night side. Alpha 0.004 with blending off hides the card in the fog pass. Face the card to the camera or the ring flattens. Scale stays at most 1. A larger look is a tighter native frame, not an enlarge.

The arch streak in `arch-under.jpg` is the lintel skin. Leave the sky shader.

## Reuse

Copy `planet.json` placement, `planetCover`, the camera-facing key-4 card, and the touch `play()` path. Swap the video for `{PAINT}`. Keep one decoder, LINEAR, no mipmaps, and the draw order dome → planet → haze → world.
