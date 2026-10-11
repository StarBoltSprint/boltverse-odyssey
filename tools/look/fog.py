"""Feature 4 — height fog. Band colours are mean rectangles of the key. No volumetric ray march."""
import os

import sample

# Measurement windows on the key frame: near avenue, horizon haze, upper sky.
WINDOWS = (
    ("near", (0.25, 0.62, 0.75, 0.80)),
    ("horizon", (0.20, 0.42, 0.80, 0.56)),
    ("far", (0.20, 0.12, 0.80, 0.28)),
)


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    key = sample.load_rgb(key_path)
    path = os.path.abspath(key_path)
    bands = []
    for name, rect in WINDOWS:
        colour = sample.colour(key, rect, path)
        colour["name"] = name
        bands.append(colour)
    near = sample.luma(bands[0]["linear"])
    far = sample.luma(bands[2]["linear"])
    fall = round(float(max(0.02, min(0.12, 0.02 + abs(float(near - far)) * 0.4))), 4)
    return {
        "id": "fog",
        "enabled": True,
        "flag": "fog",
        "bands": bands,
        "heightFalloff": fall,
        "requests": [],
    }


def selftest(check):
    import tempfile
    import numpy as np
    from PIL import Image
    img = np.zeros((40, 40, 3), np.float32)
    img[:12, :, 2] = 0.45
    img[16:24, :, 0] = 0.55
    img[26:, :, 0] = 0.6
    img[26:, :, 1] = 0.35
    with tempfile.TemporaryDirectory() as d:
        key = os.path.join(d, "key.png")
        Image.fromarray((img * 255).astype(np.uint8)).save(key)
        feat = build(key, d)
        check(len(feat["bands"]) == 3, "bands")
        check(0.02 <= feat["heightFalloff"] <= 0.12, "falloff")
        import colour_check
        hits = []
        colour_check.verify_json("fog", {"bands": feat["bands"]}, hits, {})
        check(not hits, "fog colour " + str(hits))
