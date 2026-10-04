# video — Archives menu hall loop

Status: validated. The hall film and the paw glow passed the rows below. The prompt text was not stored.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | Archives polish, 2026-10-04 |
| Commit | filled when this step is committed |
| Date | 2026-10-04 |
| Size | hall loop 720×1280, 24 fps, 145 frames, 6.041667 s. Still 720×1280. Paw glow 944×1088. |
| Tries | 2 image calls. 3 video calls. 1 video file. |
| CLI | session Imagine. Not `generate` or `edit` from a stored command. |
| Image refs | not stored |

## Prompt

```
not stored
```

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node --test packs/common/archives/archives.test.mjs` | menu film covers a 9:16 phone and never enlarges on a tall one | 720×1280. 360×800 dpr 2: contain, scale 1, fills false. 360×640 dpr 2: cover, scale 1. |
| `node --test packs/common/archives/archives.test.mjs` | hall loop seam stays under the loop gate | first-to-last MAE 1.8. Frame 0 to 3 s MAE 9.986. |
| `node --test packs/common/archives/archives.test.mjs` | a menu pauses world videos and the paw glow does not scale | hold pauses sky, gate, and Bolt. Paw opacity 0.22–0.58. No `scale(`. |
| Chrome 360×800 dpr 2 | playing film, world hidden | video CSS 360×640 at (0, 80), readyState 4. Band pixel rgb(31, 28, 41). |

## Gotchas

Imagine video accepts 9:16 and 720p. A 9:20 call and a 1080p call fail before a file exists. 720p 9:16 arrives as 720×1280, so a 720×1600 phone cannot be covered at magnification ≤ 1. Hide the world canvas and matte the gap from the still’s own corners. Do not scale the video up.

The paw is a second copy of one Imagine glow, screen-blended, opacity only. A video on the paw would be a fifth decoder during play.

## Reuse

Every later menu calls `setScreen(name, true)` on the archives module. The film, the pause of world videos, and the paw glow stay. Swap only the still and the loop for another hall. Keep the first frame equal to the last, and keep both at the video’s aspect.
