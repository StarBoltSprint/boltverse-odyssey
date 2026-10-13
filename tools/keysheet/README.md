# tools/keysheet — key feature sheets (any zone, fully local)

1. Author `zones/<zone>.json`: every visible element of the key (id, kind, `what` = shape/thickness/colour/position,
   box = SAM2 prompt + search window as key fractions, params, pass rule). Kinds: region | band | dark_rect | drips | straight_bar.
2. `python3 tools/keysheet/extract.py zones/<zone>.json KEY.jpg zones/<zone>/` -> SAM2 (sam2.1 hiera small via
   /workspace/.venv-sam2) element masks + `sheet.json` (bbox/area/centroid/Lab colour + detector values measured on the key).
3. `python3 tools/keysheet/check.py RENDER.png zones/<zone>/sheet.json` -> one blocking row per element.
4. gatesuite: build.json `"keysheet": "tools/keysheet/zones/<zone>/sheet.json"` -> section `keyfeatures` (missing = FAIL).
Selftest: `python3 tools/keysheet/selftest.py` (the key must pass its own sheet).
