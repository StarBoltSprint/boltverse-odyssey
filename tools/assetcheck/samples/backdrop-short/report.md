# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## short.png

Kind `backdrop`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `1024`
- height: `80`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — FAIL

- screen: `[720, 1600]`
- frame: `[1024, 80]`
- onScreen: `[400.0, 600.0]`
- mask: `{'width': 1024, 'height': 80, 'area': 81920, 'rows': [0, 79], 'cols': [0, 1023], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `7.5`
- magnificationLimit: `1.0`
- FAIL resolution magnification=7.5000 limit=1.0 source=1024x80 rows=0-79 frame=1024x80 onScreen=400x600 fillHeight=1.0000

### backdrop — FAIL

- width: `1024`
- height: `80`
- webglMaxTexture: `4096`
- splitNeeded: `False`
- verticalMagnification: `7.5`
- seam: `{'seam': 0.0, 'interior': 0.0, 'ratio': 0.0}`
- screen: `[720, 1600]`
- FAIL backdrop vertical magnification=7.5000 sourceHeight=80 onScreenHeight=600

## Failures

- short.png: FAIL resolution magnification=7.5000 limit=1.0 source=1024x80 rows=0-79 frame=1024x80 onScreen=400x600 fillHeight=1.0000
- short.png: FAIL backdrop vertical magnification=7.5000 sourceHeight=80 onScreenHeight=600

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
