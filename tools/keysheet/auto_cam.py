#!/usr/bin/env python3
"""Auto key camera from MoGe-2 (torch venv): intrinsics (fx, fy, cx, cy in px of the 1024 key frame) + metric depth.
usage: /workspace/.venv-sam2/bin/python tools/keysheet/auto_cam.py KEY1024.png OUT.json
No hand-solved camera: the scene builder puts the camera at the origin (OpenCV x right, y down, z forward ->
three.js X, -Y, -Z) with this vertical fov; every element is back-projected with the same depth."""
import json, sys
from pathlib import Path
import numpy as np, torch
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]; sys.path.insert(0, str(ROOT / "tools"))
from common.vision_models import load_moge2
img, out = sys.argv[1], sys.argv[2]
im = Image.open(img).convert("RGB"); W, H = im.size; im2 = im.copy(); im2.thumbnail((512, 512))
x = torch.from_numpy((np.asarray(im2, np.float32) / 255.0).transpose(2, 0, 1).copy())
with torch.inference_mode():
    o = load_moge2().infer(x, resolution_level=0, use_fp16=False, force_projection=True, apply_mask=False)
K = o["intrinsics"].cpu().numpy().reshape(3, 3)            # normalised (fraction of width / height)
fx, fy, cx, cy = K[0, 0] * W, K[1, 1] * H, K[0, 2] * W, K[1, 2] * H
fov_y = float(2 * np.degrees(np.arctan(H / 2 / fy)))
Path(out).write_text(json.dumps({"W": W, "H": H, "fx": float(fx), "fy": float(fy), "cx": float(cx), "cy": float(cy), "fov_y_deg": fov_y,
                                  "convention": "camera at origin, OpenCV x right y down z forward; three.js = (x, -y, -z)", "from": "moge-2 vitl intrinsics"}, indent=1))
print(json.dumps({"fov_y_deg": round(fov_y, 2), "fx": round(float(fx), 1)}))
