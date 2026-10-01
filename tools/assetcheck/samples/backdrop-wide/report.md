# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## ring.png

Kind `backdrop`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `4200`
- height: `48`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[4200, 48]`
- onScreen: `[720.0, 30.0]`
- mask: `{'width': 4200, 'height': 48, 'area': 201600, 'rows': [0, 47], 'cols': [0, 4199], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.625`
- magnificationLimit: `1.0`

### backdrop — FAIL

- width: `4200`
- height: `48`
- webglMaxTexture: `4096`
- splitNeeded: `True`
- verticalMagnification: `0.625`
- seam: `{'seam': 0.3333, 'interior': 0.0, 'ratio': 0.3333}`
- screen: `[720, 1600]`
- FAIL backdrop width=4200 exceeds WebGL max texture 4096; split before upload

## Failures

- ring.png: FAIL backdrop width=4200 exceeds WebGL max texture 4096; split before upload

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
