# assetcheck

Result: **PASS**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## ../../../../lock/bolt-back.jpg

Kind `still`. Asset **WARN**.

Grandfathered (`lock/`). Owner KEEP. Do not recook or replace this file because of a WARN.

### basic — WARN

- codec: `jpeg`
- container: `jpg`
- pixFmt: `None`
- mode: `RGB`
- width: `1152`
- height: `1712`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `False`
- losslessRequired: `True`
- bandingFraction: `0.0`
- WARN basic lossless required, codec=jpeg container=jpg

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[1152, 1712]`
- onScreen: `[200.0, 360.0]`
- mask: `{'width': 1152, 'height': 1712, 'area': 1972224, 'rows': [0, 1711], 'cols': [0, 1151], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.2103`
- magnificationLimit: `1.0`

## Warnings

Informational. Not a recook order.

- ../../../../lock/bolt-back.jpg: WARN basic lossless required, codec=jpeg container=jpg

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
