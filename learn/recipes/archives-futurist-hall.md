# video — futuristic Archives hall

Status: validated. The high-tech hall film passed the seam row and the scale row. It does not fill a 720×1600 phone. The prompt text was not stored.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | Archives futuristic hall, 2026-10-04 |
| Commit | `2158259` |
| Date | 2026-10-04 |
| Size | hall loop 640×1424, 24 fps, 289 frames, 12.000 s. Still 640×1424. Source clip 640×1424, 145 frames, 6.041667 s. |
| Tries | 3 image calls. 3 video calls. 1 video file. Ping-pong is ffmpeg, not another Imagine call. |
| CLI | session Imagine. Not `generate` or `edit` from a stored command. |
| Image refs | not stored |

## Prompt

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node --test packs/common/archives/archives.test.mjs` | menu film never enlarges on a 720x1600 phone | 640×1424. Cover 1.125. Contain, scale 1, fills false, CSS 320×712. A 1080×1920 fixture still covers below scale 1. |
| `node --test packs/common/archives/archives.test.mjs` | hall loop seam stays under the loop gate | first-to-last MAE 1.813. Frame 0 to 3 s MAE 9.98. |
| `node --test packs/common/archives/archives.test.mjs` | a menu pauses world videos and the paw glow does not scale | hold pauses sky, gate, and Bolt. No `scale(`. No `plate.jpg`. Glow and bob keyframes present. |
| Chrome 360×800 dpr 2 | playing film | video CSS 320×712 at (20, 44), readyState 4. Gap pixel (35, 38, 51). Brightest row stays 723–724 / 1424. |

## Gotchas

A 9:20 video call and a 1080p video call fail before a file exists. A 720p image-to-video of this hall arrived as 640×1424, and its first frame was not its last (MAE 14.445). Reverse the clip after the first frame and concatenate. Do not optical-flow the join. Do not scale the 640×1424 frame up to 720×1600.

The paw files from the previous step stay. A new glow would be a new image call and can put a black square back.

## Reuse

Every later menu calls `setScreen(name, true)` on the archives module. Swap the still and the loop together, both at 640×1424, first frame equal to the last. Keep scale at 1 when cover would exceed 1.
