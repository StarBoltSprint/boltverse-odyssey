"""Edge-ring luminance. A dark sticker outline FAILs.

FAIL when the ring mean luminance is under 0.55 times the interior mean.
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def measure(rgb, mask, ring=3, ratio=0.55):
    rgb = np.asarray(rgb, np.float32)
    if rgb.size and float(np.max(rgb)) > 1.5:
        rgb = rgb / 255.0
    m = np.asarray(mask, bool)
    if m.ndim == 3:
        m = m[..., 0]
    if m.shape != rgb.shape[:2]:
        m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((rgb.shape[1], rgb.shape[0]), Image.NEAREST)) > 127
    if int(m.sum()) < 30:
        return dict(ok=False, reason="empty", ring=None, interior=None, ratio=None)
    luma = rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722 if rgb.ndim == 3 else rgb
    dist = ndi.distance_transform_edt(m)
    border = m & (dist <= ring) & (dist > 0)
    inner = m & (dist > ring * 3)
    if int(inner.sum()) < 10:
        inner = m & (dist > ring)
    rl = float(luma[border].mean()) if border.any() else 0.0
    il = float(luma[inner].mean()) if inner.any() else 0.0
    got = (rl / il) if il > 1e-4 else 1.0
    ok = bool(got >= ratio)
    return dict(ok=ok, ring=round(rl, 4), interior=round(il, 4), ratio=round(got, 4), minRatio=ratio)
