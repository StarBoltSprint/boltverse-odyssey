# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## morph.mp4

Kind `turntable`. Asset **FAIL**.

### basic — PASS

- codec: `h264`
- container: `mp4`
- pixFmt: `yuv444p`
- mode: `None`
- width: `64`
- height: `96`
- fps: `12.0`
- frames: `6`
- durationSec: `0.5`
- lossless: `False`
- losslessRequired: `False`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 96]`
- onScreen: `[16.0, 20.0]`
- mask: `{'width': 33, 'height': 33, 'area': 797, 'rows': [32, 64], 'cols': [16, 48], 'fillHeight': 0.3438, 'fillArea': 0.1297}`
- compared: `mask`
- magnification: `0.6061`
- magnificationLimit: `1.0`

### alpha — PASS

- key: `black`
- alphaMin: `255`
- alphaMax: `255`
- plateFraction: `0.8703`
- plateColor: `[0.0, 0.0, 0.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.8703`
- haloThicknessPx: `0.0`

### morph — FAIL

- framesMeasured: `8`
- areaCV: `0.8313`
- heightMin: `30`
- heightMax: `135`
- jumps: `[{'index': 1, 'areaJump': 0.521, 'heightJump': 0.5161, 'iou': 0.104}, {'index': 2, 'areaJump': 0.0877, 'heightJump': 0.0667, 'iou': 0.0}, {'index': 3, 'areaJump': 0.9194, 'heightJump': 0.9375, 'iou': 0.1008}, {'index': 4, 'areaJump': 2.3501, 'heightJump': 0.629, 'iou': 0.1845}, {'index': 5, 'areaJump': 0.7968, 'heightJump': 0.3366, 'iou': 0.1349}, {'index': 6, 'areaJump': 0.2347, 'heightJump': 0.763, 'iou': 0.1915}, {'index': 7, 'areaJump': 0.9194, 'heightJump': 0.9375, 'iou': 0.1008}]`
- limits: `{'areaJump': 0.15, 'heightJump': 0.08, 'iou': 0.75}`
- FAIL morph frame 1 areaJump=0.521 heightJump=0.5161 iou=0.104

## Failures

- morph.mp4: FAIL morph frame 1 areaJump=0.521 heightJump=0.5161 iou=0.104

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
