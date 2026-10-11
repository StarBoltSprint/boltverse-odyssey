"""Screen-space sun. The disc, the halo, and the shaft colour are texels from the existing Imagine atlas.

The engine stores only where that disc sits and how strong it is. No colour is typed. No image is generated.
"""
import json, os

import sample

# sky7-atlas.png cells, measured in sky1/sky7-info.json. Fractions of that atlas, not a colour.
ATLAS_INFO = "sky1/sky7-info.json"
ATLAS_IMAGE = "sky1/sky7-atlas.png"


def sun_uv(img):
    """Brightest warm pixel in the horizon band. Returns x, y from the top, as frame fractions."""
    import numpy as np
    y = sample.luma(img)
    h, w = y.shape
    y0, y1 = int(0.30 * h), int(0.62 * h)
    x0 = int(0.40 * w)
    crop = img[y0:y1, x0:]
    luma = y[y0:y1, x0:]
    warm = (crop[..., 0] > crop[..., 2] + 0.04) & (luma > 0.45)
    score = np.where(warm, luma, 0.0)
    if float(score.max()) <= 0:
        score = luma
    iy, ix = np.unravel_index(int(score.argmax()), score.shape)
    return [round((x0 + ix + 0.5) / w, 4), round((y0 + iy + 0.5) / h, 4)]


def _atlas(out_dir):
    """Walk up from the pack until sky1/sky7-info.json is on disk. The live preview holds the atlas."""
    here = os.path.abspath(out_dir)
    for _ in range(6):
        info = os.path.join(here, ATLAS_INFO)
        image = os.path.join(here, ATLAS_IMAGE)
        if os.path.exists(info) and os.path.exists(image):
            doc = json.load(open(info))
            return image, doc["atlas"]["sun"], doc["atlas"]["ray"]
        parent = os.path.dirname(here)
        if parent == here:
            break
        here = parent
    return None, None, None


def build(key_path, out_dir, sky=None, light=None, plates=None, game=None):
    img = sample.load_rgb(key_path)
    uv = sun_uv(img)
    image, sun_rect, ray_rect = _atlas(out_dir)
    if image is None and sky:
        image, sun_rect, ray_rect = _atlas(os.path.dirname(os.path.abspath(sky)))
    requests = []
    if image is None:
        requests.append({
            "id": "sun-atlas",
            "purpose": "Existing sun disc, halo, and shaft card.",
            "feature": "sun",
            "source": os.path.abspath(key_path),
            "prompt": "Use the sun cell and the ray cell already in sky7-atlas.png. Do not paint a new sun.",
            "count": 0,
        })
    return {
        "id": "sun",
        "enabled": image is not None,
        "flag": "sun",
        "uv": uv,
        "intensity": 0.42,
        "rim": 0.4,
        "atlas": ATLAS_IMAGE if image else None,
        "atlasFile": image,
        "sunRect": sun_rect,
        "rayRect": ray_rect,
        "source": os.path.abspath(key_path),
        "requests": requests,
    }


def selftest(check):
    import numpy as np
    img = np.zeros((40, 80, 3), np.float32)
    img[:, :, 2] = 0.3
    img[16:20, 52:56] = (1.0, 0.75, 0.4)
    uv = sun_uv(img)
    check(0.6 < uv[0] < 0.75, "sun x " + str(uv))
    check(0.35 < uv[1] < 0.55, "sun y " + str(uv))
