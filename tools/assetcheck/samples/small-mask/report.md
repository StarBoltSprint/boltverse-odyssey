# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## small-mask.png

Kind `cutout`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGBA`
- width: `640`
- height: `900`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — FAIL

- screen: `[720, 1600]`
- frame: `[640, 900]`
- onScreen: `[200.0, 700.0]`
- mask: `{'width': 140, 'height': 220, 'area': 30800, 'rows': [377, 596], 'cols': [250, 389], 'fillHeight': 0.2444, 'fillArea': 0.0535}`
- compared: `mask`
- magnification: `3.1818`
- magnificationLimit: `1.0`
- FAIL resolution magnification=3.1818 limit=1.0 source=140x220 rows=377-596 frame=640x900 onScreen=200x700 fillHeight=0.2444

### alpha — FAIL

- key: `alpha`
- alphaMin: `0`
- alphaMax: `255`
- unkeyedBlackFraction: `0.0`
- plateFraction: `0.9465`
- plateColor: `[0.0, 0.0, 0.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.9465`
- haloThicknessPx: `0.0`
- edgeGreenFraction: `0.0`
- edgeBandPx: `3`
- FAIL alpha solid background plate fraction=0.9465 rectangularity=0.947

## Failures

- small-mask.png: FAIL resolution magnification=3.1818 limit=1.0 source=140x220 rows=377-596 frame=640x900 onScreen=200x700 fillHeight=0.2444
- small-mask.png: FAIL alpha solid background plate fraction=0.9465 rectangularity=0.947

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
