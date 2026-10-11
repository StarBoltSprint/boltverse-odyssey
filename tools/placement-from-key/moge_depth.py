#!/usr/bin/env python3
"""MoGe-2 metric depth for the key still. Run with the torch venv."""
import json
import math
import os
import sys

import numpy as np

image, out_npy, out_json, fov_x = sys.argv[1:5]
root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(root, "tools"))
from common.vision_models import depth_moge

arr, hit, seconds = depth_moge(
    image,
    side=640,
    fov_x=float(fov_x),
    resolution_level=4,
    full=True,
)
np.save(out_npy, arr.astype(np.float32))
finite = np.isfinite(arr)
row = {
    "model": "moge-2-vitl",
    "metric": True,
    "shape": list(arr.shape),
    "hit": bool(hit),
    "seconds": round(seconds, 3),
    "fovX": float(fov_x),
    "finite": int(finite.sum()),
    "p50": None if not finite.any() else round(float(np.median(arr[finite])), 2),
}
json.dump(row, open(out_json, "w"), indent=1)
print(json.dumps(row))
