"""Feature 1 — filmic grade + bloom + a 3D LUT derived from the key image.

Picks ACES or AgX by the smaller distance to the key. Exposure, LUT strength, and the
bloom threshold come from that same measurement. No colour is typed.
"""
import os
import numpy as np
from PIL import Image

import curves
import sample


LUT_N = 16
BLOOM_CAP = 0.35
BLOOM_START = 0.12
EXPOSURES = (0.7, 0.85, 1.0, 1.2, 1.45)
LUT_STRENGTHS = (0.0, 0.35, 0.7)


def _resize(img, w=96):
    h = max(1, int(round(img.shape[0] * (w / img.shape[1]))))
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.resize((w, h), Image.Resampling.BOX)).astype(np.float32) / 255.0


def distance(a, b):
    """Mean CIEDE2000. Lower is closer to the key."""
    from skimage.color import rgb2lab, deltaE_ciede2000
    aa, bb = _resize(a), _resize(b)
    h, w = min(aa.shape[0], bb.shape[0]), min(aa.shape[1], bb.shape[1])
    la = rgb2lab(aa[:h, :w].astype(np.float64))
    lb = rgb2lab(bb[:h, :w].astype(np.float64))
    return round(float(deltaE_ciede2000(la, lb).mean()), 4)


def _pregrade(reference, game=None):
    """Linear image the curve has to pull back toward the key. A real render wins over the synthetic."""
    if game is not None:
        return sample.srgb_to_lin(game)
    lin = sample.srgb_to_lin(reference)
    y = sample.luma(lin)
    med = float(np.median(y))
    return lin * (0.18 / max(med, 1e-4))


def _pull(display, bands, strength):
    if strength <= 0 or not bands:
        return display
    from skimage.color import rgb2lab, lab2rgb
    lab = rgb2lab(np.clip(display, 0, 1).astype(np.float64))
    centers = np.array([(b["L0"] + b["L1"]) * 0.5 for b in bands])
    aa = np.array([b["a"] for b in bands])
    bb = np.array([b["b"] for b in bands])
    L = lab[..., 0]
    idx = np.clip(np.searchsorted(centers, L, side="right") - 1, 0, len(centers) - 1)
    lab[..., 1] = lab[..., 1] * (1 - strength) + aa[idx] * strength
    lab[..., 2] = lab[..., 2] * (1 - strength) + bb[idx] * strength
    return np.clip(lab2rgb(lab), 0, 1).astype(np.float32)


def _grade_image(lin, curve, exposure, bands, strength):
    flat = lin.reshape(-1, 3)
    disp = curves.apply_curve(curve, flat, exposure).reshape(lin.shape)
    return _pull(disp, bands, strength).astype(np.float32)


def _proxy(img, w=256):
    if img.shape[1] <= w:
        return img
    h = max(1, int(round(img.shape[0] * (w / img.shape[1]))))
    im = Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.resize((w, h), Image.Resampling.BOX)).astype(np.float32) / 255.0


def fit(key, key_path, game=None):
    # Bands and the bloom threshold stay on the full key so colour_check can re-sample them.
    bands = sample.lab_bands(key, key_path)
    thr = sample.luma_percentile(key, 99.5, key_path)
    key = _proxy(key)
    if game is not None:
        game = _proxy(game)
    pre = _pregrade(key, game)
    best = None
    rows = []
    for curve in ("aces", "agx"):
        for exp in EXPOSURES:
            disp = _grade_image(pre, curve, exp, bands, 0.0)
            d = distance(disp, key)
            rows.append({"curve": curve, "exposure": exp, "lutStrength": 0.0, "distance": d})
            if best is None or d < best["distance"]:
                best = {"curve": curve, "exposure": exp, "lutStrength": 0.0, "distance": d}
    for strength in LUT_STRENGTHS:
        disp = _grade_image(pre, best["curve"], best["exposure"], bands, strength)
        d = distance(disp, key)
        rows.append({"curve": best["curve"], "exposure": best["exposure"], "lutStrength": strength, "distance": d})
        if d < best["distance"]:
            best = {**best, "lutStrength": strength, "distance": d}
    return {
        "id": "grade",
        "enabled": True,
        "flag": "grade",
        "curve": best["curve"],
        "exposure": best["exposure"],
        "lutStrength": best["lutStrength"],
        "distance": best["distance"],
        "search": rows,
        "reference": "game" if game is not None else "synthetic-pregrade",
        "bands": bands,
        "bloom": {
            "strength": BLOOM_START,
            "strengthCap": BLOOM_CAP,
            "scale": 0.25,
            "threshold": thr,
        },
    }


def write_lut(path, bands, strength):
    n = LUT_N
    img = np.zeros((n, n * n, 3), np.float32)
    for b in range(n):
        for g in range(n):
            col = np.stack([
                np.linspace(0, 1, n),
                np.full(n, g / (n - 1)),
                np.full(n, b / (n - 1)),
            ], axis=1).astype(np.float32)
            out = _pull(col.reshape(1, n, 3), bands, strength)[0]
            img[g, b * n:(b + 1) * n] = out
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    Image.fromarray(np.clip(img * 255, 0, 255).astype(np.uint8)).save(path)
    return {"file": os.path.basename(path), "n": n, "layout": "height=N, width=N*N, slice b, row g, column r"}


def build(key_path, out_dir, game_path=None):
    key = sample.load_rgb(key_path)
    game = sample.load_rgb(game_path) if game_path else None
    feat = fit(key, os.path.abspath(key_path), game)
    lut = write_lut(os.path.join(out_dir, "lut.png"), feat["bands"], feat["lutStrength"])
    feat["lut"] = lut
    return feat
