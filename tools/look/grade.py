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


def display_luma(img):
    img = np.asarray(img, np.float32)
    return 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]


def match_lut(scene, key, protect=0.0, n=256):
    """Map the scene's display luma onto the key's luma. protect blends the shoulder back toward identity."""
    ys = display_luma(scene).ravel()
    yk = display_luma(key).ravel()
    qs = np.linspace(0.0, 1.0, 1024)
    src_q = np.quantile(ys, qs)
    key_q = np.quantile(yk, qs)
    src_q = np.maximum.accumulate(src_q + np.linspace(0.0, 1e-5, src_q.size))
    xs = (np.arange(n) + 0.5) / n
    rank = np.interp(xs, src_q, qs)
    out = np.interp(rank, qs, key_q).astype(np.float32)
    if protect > 0:
        w = np.clip((xs - 0.50) / 0.35, 0.0, 1.0) * float(protect)
        out = out * (1.0 - w) + xs.astype(np.float32) * w
    out = np.maximum.accumulate(np.clip(out, 0.0, 1.0))
    return out


def toe_lift(lut, amount, knee=0.18):
    """Lift the darkest luma so the first histogram bin is not one screenshot step over the key."""
    if amount <= 0:
        return lut
    xs = (np.arange(lut.size) + 0.5) / lut.size
    w = np.clip(1.0 - xs / knee, 0.0, 1.0)
    return np.maximum.accumulate(np.clip(lut + float(amount) * w, 0.0, 1.0)).astype(np.float32)


def apply_match(scene, lut):
    """Same scale the match shader uses: display rgb times (lut(y) / y)."""
    y = display_luma(scene)
    xs = (np.arange(lut.size) + 0.5) / lut.size
    y2 = np.interp(y, xs, lut).astype(np.float32)
    scale = (y2 / np.maximum(y, 1e-4))[..., None]
    return np.clip(scene * scale, 0.0, 1.0).astype(np.float32)


def write_match(path, lut):
    n = int(lut.size)
    img = np.repeat(lut.reshape(1, n, 1), 3, axis=2)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    Image.fromarray(np.clip(img * 255.0, 0, 255).astype(np.uint8)).save(path)
    return {"file": os.path.basename(path), "n": n, "method": "luma-cdf"}


def build(key_path, out_dir, game_path=None, protect=0.0, round_n=1, toe=0.0):
    key = sample.load_rgb(key_path)
    if game_path:
        scene = sample.load_rgb(game_path)
        lut = toe_lift(match_lut(scene, key, protect=protect), toe)
        graded = apply_match(scene, lut)
        match = write_match(os.path.join(out_dir, "match.png"), lut)
        # Identity 3D LUT so an old shader that still samples lut.png stays neutral.
        bands = sample.lab_bands(key, os.path.abspath(key_path))
        lut3 = write_lut(os.path.join(out_dir, "lut.png"), bands, 0.0)
        thr = sample.luma_percentile(key, 99.5, os.path.abspath(key_path))
        return {
            "id": "grade",
            "enabled": True,
            "flag": "grade",
            "curve": "match",
            "exposure": 1.0,
            "lutStrength": 0.0,
            "distance": distance(graded, key),
            "reference": "game",
            "game": os.path.abspath(game_path),
            "round": int(round_n),
            "protect": float(protect),
            "toe": float(toe),
            "match": match,
            "lut": lut3,
            "bloom": {"strength": 0.0, "strengthCap": BLOOM_CAP, "scale": 0.25, "threshold": thr, "enabled": False},
        }
    feat = fit(key, os.path.abspath(key_path), None)
    lut = write_lut(os.path.join(out_dir, "lut.png"), feat["bands"], feat["lutStrength"])
    feat["lut"] = lut
    return feat
