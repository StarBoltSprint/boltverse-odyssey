"""Element detectors shared by extract.py (on the key) and check.py (on the render). Pure numpy/OpenCV/skimage.
Each detector gets the Lab image, the element region (bool) and params, and returns a measurement dict with `count`."""
import cv2, numpy as np


def lab_of(bgr):
    from skimage.color import rgb2lab
    return rgb2lab(bgr[:, :, ::-1] / 255.0)


def _cc(mask, keep):
    n, _, st, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    return [st[i].tolist() for i in range(1, n) if keep(st[i])]


def region(L, lab, R, p):
    """Colour surface (e.g. stone): Lab mean/std of the mid-lightness pixels of the region."""
    v = L[R]; lo, hi = np.percentile(v, [10, 75]) if v.size else (0, 0)
    sel = R & (L >= lo) & (L <= hi)
    return {"count": int(sel.any()), "lab": [float(lab[..., k][sel].mean()) if sel.any() else 0.0 for k in range(3)],
            "L_std": float(L[sel].std()) if sel.any() else 0.0}


def band(L, lab, R, p):
    """Bright horizontal bands (snow slabs/treads/canopies): pixels >= thr, opened by a min_w x min_h rectangle."""
    b = (L >= p["thr_L"]) & R
    o = cv2.morphologyEx(b.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (p["min_w"], p["min_h"])))
    comps = _cc(o, lambda s: True)
    th = [c[3] for c in comps]
    return {"count": len(comps), "boxes": comps[:16], "thick_px_median": float(np.median(th)) if th else 0.0,
            "bright_frac": float(b[R].mean()) if R.any() else 0.0}


def dark_rect(L, lab, R, p):
    """Dark rectangles (doorways, openings): L < dark_rel * median(L in region), opened 5 px, fill >= 0.6."""
    med = float(np.median(L[R])) if R.any() else 0.0
    d = ((L < p["dark_rel"] * med) & R).astype(np.uint8)
    d = cv2.morphologyEx(d, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    comps = _cc(d, lambda s: p["w_min"] <= s[2] <= p["w_max"] and s[3] >= p["h_min"] and s[4] >= 0.6 * s[2] * s[3])
    return {"count": len(comps), "boxes": comps[:16]}


def drips(L, lab, R, p):
    """Narrow bright vertical drips (icicles): bright runs >= min_len px tall, <= max_w px wide, outside bands."""
    b = ((L >= p["thr_L"]) & R).astype(np.uint8)
    v = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, p["min_len"])))
    v = cv2.morphologyEx(v, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (2, 1)))
    wide = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (p["max_w"] * 4, 3)))
    v[wide > 0] = 0
    comps = _cc(v, lambda s: s[2] <= p["max_w"])
    return {"count": len(comps)}


def straight_bar(L, lab, R, p):
    """NEGATIVE element: straight bright horizontal bars (flat strip under a lip). count must be 0."""
    b = ((L >= p["thr_L"]) & R).astype(np.uint8)
    W = int(R.any(0).sum())
    o = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(8, int(W * p["min_w_frac"])), 2)))
    bars = []
    for x, y, w, h, a in _cc(o, lambda s: True):
        sub = o[y:y + h, x:x + w] > 0
        top = np.argmax(sub, 0); bot = h - 1 - np.argmax(sub[::-1], 0)
        if h <= p["max_h"] and np.std(top) < 1.0 and np.std(bot) < 1.0:
            bars.append([x, y, w, h])
    return {"count": len(bars), "boxes": bars[:8]}


KINDS = {"region": region, "band": band, "dark_rect": dark_rect, "drips": drips, "straight_bar": straight_bar}
