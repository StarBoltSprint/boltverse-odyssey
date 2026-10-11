"""Feature 3 — equirect sky as the environment, metal and glass only.

A bad pano (edge seam or pole pinch) is feathered from its own pixels and a 360 request is written.
Nothing is generated.
"""
import os
import numpy as np
from PIL import Image

import sample

SEAM_MAX = 0.08
PINCH_MAX = 0.12


def measure(img):
    left = img[:, :8].mean(axis=1)
    right = img[:, -8:].mean(axis=1)
    seam = float(np.mean(np.abs(left - right)))
    pinch = float(max(img[:4].std(), img[-4:].std()))
    return {"seam": round(seam, 5), "pinch": round(pinch, 5), "pass": bool(seam <= SEAM_MAX and pinch <= PINCH_MAX)}


def feather(img):
    out = img.copy()
    w = out.shape[1]
    band = max(4, w // 64)
    avg = (out[:, 0] + out[:, -1]) * 0.5
    for i in range(band):
        t = i / float(band)
        out[:, i] = out[:, i] * t + avg * (1.0 - t)
        out[:, -1 - i] = out[:, -1 - i] * t + avg * (1.0 - t)
    for r in range(2):
        out[r] = out[r] * 0.5 + out[r].mean(axis=0)
        out[-1 - r] = out[-1 - r] * 0.5 + out[-1 - r].mean(axis=0)
    return np.clip(out, 0, 1)


def _intensity(img):
    y = sample.luma(sample.srgb_to_lin(img))
    hi = float(np.percentile(y, 98))
    mid = float(np.percentile(y, 50))
    return round(float(max(0.15, min(1.0, (hi / max(mid, 1e-4)) * 0.12))), 4)


def _request(source):
    return {
        "id": "env-360",
        "purpose": "A seamless Imagine equirect for the metal and glass environment.",
        "feature": "env",
        "source": source,
        "prompt": (
            "Paint a full 360 equirectangular sky in the same light and the same hour as this picture. "
            "The left edge must continue the right edge. The top pole and the bottom pole must not pinch into a streak. "
            "No ground, no dog, no text."
        ),
        "count": 1,
    }


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    if not sky or not os.path.exists(sky):
        return {
            "id": "env", "enabled": False, "flag": "env", "reason": "no equirect",
            "image": None, "requests": [_request(os.path.abspath(key_path))],
        }
    img = sample.load_rgb(sky)
    if img.shape[1] != img.shape[0] * 2:
        img = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((img.shape[0] * 2, img.shape[0]), Image.Resampling.BOX)).astype(np.float32) / 255.0
    row = measure(img)
    requests = []
    if row["pass"]:
        rel = "assets/sky/" + os.path.basename(sky)
        image = rel
    else:
        fixed = feather(img)
        row = {**row, "after": measure(fixed)}
        name = "env-equirect.jpg"
        Image.fromarray((fixed * 255).astype(np.uint8)).save(os.path.join(out_dir, name), quality=90)
        image = name
        requests.append(_request(os.path.abspath(sky)))
    return {
        "id": "env",
        "enabled": True,
        "flag": "env",
        "image": image,
        "source": os.path.abspath(sky),
        "intensity": _intensity(img),
        "seam": row,
        "assign": "metalness>=0.5 or transmission>0 or name glass/chrome",
        "requests": requests,
    }


def selftest(check):
    good = np.zeros((16, 32, 3), np.float32)
    good[:, :] = (0.2, 0.3, 0.4)
    good[:, :8] = good[:, -8:]
    row = measure(good)
    check(row["pass"], "seam pass " + str(row))
    bad = good.copy()
    bad[:, :8] = 0.0
    bad[:, -8:] = 1.0
    bad[0, :, 0] = np.linspace(0, 1, 32)
    row = measure(bad)
    check(not row["pass"], "seam fail")
    fixed = feather(bad)
    check(measure(fixed)["seam"] < row["seam"], "feather")
