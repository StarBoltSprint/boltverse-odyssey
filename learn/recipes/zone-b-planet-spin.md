# cutout — zone B planet spin

Status: IN TEST. One keyed planet video on the Ember Mesa chase. It does not replace sky v1. The card placement stays `learn/recipes/zone-b-planet-card.md`.

| Field | Value |
| --- | --- |
| Asset kind | `cutout` |
| Take | Zone B planet spin |
| Commit | `89bb49a` |
| Date | 2026-10-05 |
| Size | 1280×720, 24 fps, 6.041667 s, 145 frames. Geometric scale 0.5625. |
| Tries | 1 video. Still edits staged the storm; they are not the loop. |
| CLI | Session video, then `ffmpeg -map 0:v:0 -c:v copy -an`. Prompt text is not in this repo. |
| Image refs | Opening frame is also the last frame. Mid frames put the storm at the centre, on the right, and off the disk. |

## Prompt

not stored

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| frame diff | disk, 0.00 s to 1.50 s | mean abs 17.70; full frame 6.78 |
| frame diff | disk, 1.50 s to 3.00 s | mean abs 15.34; full frame 4.82 |
| seam | frame 0 to frame 144 | full-frame mean abs 2.02; disk 2.50 |
| chase `planetInfo` | scale and aspect | 0.5625; 1.7777778 / 1.7777778 |
| chase `planetInfo` | place | heading 180°, elevation 13°, 560 m; projected 752.14×423.08 |
| chase `perf` | budget | videos 4; drawCalls 10; texture bytes 256963736 |

## Gotchas

A mean diff near 3 can be a glow. Read the storm's longitude on a 2×2 before calling it a spin.

Pin the storm at different longitudes, and pin the opening frame as the last frame. Ends alone, or one mid frame, hold the disk still.

The ring glow keeps a little of the screen colour. `planetCover` cuts green excess from 0.02 to 0.10. The disk and both moons stay under 0.01, so the tighter ramp does not open a hole. Strip audio and the attached picture with a stream copy.

The last second settles onto the opening frame. That settle is the seam. Do not trim it off or the loop pops.

## Reuse

Copy this loop's keyframe order for the next planet: left, centre, right, far side, opening frame again. Keep one decoder, LINEAR, no mipmaps, and the draw order dome → planet → haze → world.
