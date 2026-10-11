"""Sample colours and scalars from an Imagine image. Nothing here is a typed tint."""
import os, sys
import numpy as np
from PIL import Image


def _ensure_skimage():
    """The default python does not see the box site-packages. Same skimage the lighting tools use."""
    try:
        import skimage.color  # noqa: F401
        return
    except ModuleNotFoundError:
        pass
    for c in (
        "/workspace/.venv-of/lib/python3.13/site-packages",
        "/home/box/.local/lib/python3.13/site-packages",
    ):
        if os.path.isdir(os.path.join(c, "skimage")) and c not in sys.path:
            sys.path.insert(0, c)
            return


_ensure_skimage()


def load_rgb(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255.0


def srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def luma(lin):
    # not a colour: Rec.709 luma weights
    lin = np.asarray(lin, np.float32)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]


def lin_to_srgb(c):
    c = np.clip(np.asarray(c, np.float32), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1.0 / 2.4) - 0.055)


def _crop(img, rect):
    h, w = img.shape[:2]
    x0, y0, x1, y1 = rect
    xa, xb = int(x0 * w), max(int(x1 * w), int(x0 * w) + 1)
    ya, yb = int(y0 * h), max(int(y1 * h), int(y0 * h) + 1)
    xb, yb = min(w, xb), min(h, yb)
    return img[ya:yb, xa:xb]


def mean_rect(img, rect):
    crop = _crop(img, rect).reshape(-1, 3)
    if len(crop) == 0:
        raise ValueError("empty rect")
    rgb = [round(float(v), 6) for v in crop.mean(0)]
    return rgb


def colour(img, rect, image):
    rgb = mean_rect(img, rect)
    lin = [round(float(v), 6) for v in srgb_to_lin(np.array(rgb))]
    return {
        "rgb": rgb,
        "linear": lin,
        "source": {"image": image, "method": "mean-rect", "rect": [round(float(v), 6) for v in rect]},
    }


def luma_percentile(img, p, image):
    y = luma(srgb_to_lin(img))
    value = round(float(np.percentile(y, p)), 6)
    return {"value": value, "source": {"image": image, "method": "luma-percentile", "p": float(p)}}


def lab_bands(img, image, n=8):
    """Mean a* b* of the key inside each lightness slice. Used by the LUT. Colours stay sampled."""
    from skimage.color import rgb2lab
    lab = rgb2lab(img.astype(np.float64))
    L = lab[..., 0]
    bands = []
    for i in range(n):
        lo, hi = i * (100.0 / n), (i + 1) * (100.0 / n)
        m = (L >= lo) & (L < hi if i < n - 1 else L <= hi)
        if int(m.sum()) < 16:
            continue
        sl = lab[m]
        bands.append({
            "L0": lo, "L1": hi,
            "a": round(float(sl[:, 1].mean()), 4),
            "b": round(float(sl[:, 2].mean()), 4),
            "n": int(m.sum()),
            "source": {"image": image, "method": "lab-band", "L0": lo, "L1": hi},
        })
    return bands
