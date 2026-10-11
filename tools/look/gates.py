"""Blocking look gates. They read a real framebuffer, never a synthetic pregrade.

Mean luma and the 16-bin luma histogram must sit within ±10% of the key.
God-ray visibility must stay above the floor and must keep most of the scene's shafts.
Contact shadows must darken the sand at the tower feet.
"""
import os
import numpy as np
from PIL import Image

import sample

BINS = 16
MEAN_TOL = 0.10
# A bin whose key mass is at least this uses a relative ±10% band.
# Smaller bins use an absolute band so an empty tail cannot fail the frame.
HIST_MASS = 0.02
HIST_ABS = 0.01
# Sky-band 98th percentile. The crushed grade sat at 0.48; the key and the look-off frame sit above 0.60.
GODRAY_FLOOR = 0.50
GODRAY_KEEP = 0.80
CONTACT_DELTA = 0.03
CONTACT_MIN = 2


def display_luma(img):
    img = np.asarray(img, np.float32)
    return 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]


def _hist(y):
    h, _ = np.histogram(np.clip(y, 0, 1), bins=BINS, range=(0, 1))
    return h.astype(np.float64) / max(float(h.sum()), 1.0)


def luma_rows(frame, key):
    yf, yk = display_luma(frame), display_luma(key)
    mf, mk = float(yf.mean()), float(yk.mean())
    rel = (mf - mk) / max(mk, 1e-6)
    hf, hk = _hist(yf), _hist(yk)
    bins = []
    ok = abs(rel) <= MEAN_TOL
    for i, (a, b) in enumerate(zip(hf, hk)):
        tol = MEAN_TOL * b if b >= HIST_MASS else HIST_ABS
        passed = abs(float(a) - float(b)) <= tol + 1e-9
        bins.append({"i": i, "frame": round(float(a), 4), "key": round(float(b), 4), "tol": round(float(tol), 4), "pass": passed})
        ok = ok and passed
    return {
        "pass": ok,
        "meanFrame": round(mf, 4),
        "meanKey": round(mk, 4),
        "meanRel": round(rel, 4),
        "meanTol": MEAN_TOL,
        "bins": bins,
    }


def godray_score(img):
    """How bright the sky shafts still are. A crushed grade pulls this percentile down."""
    h = img.shape[0]
    y = display_luma(img[int(0.06 * h):int(0.46 * h)])
    if y.size == 0:
        return 0.0
    return round(float(np.percentile(y, 98)), 4)


def godray_rows(frame, scene, key):
    score = godray_score(frame)
    scene_score = godray_score(scene) if scene is not None else None
    key_score = godray_score(key) if key is not None else None
    keep = None if scene_score is None else round(GODRAY_KEEP * scene_score, 4)
    floor_ok = score + 1e-9 >= GODRAY_FLOOR
    keep_ok = True if keep is None else score + 1e-9 >= keep
    return {
        "pass": bool(floor_ok and keep_ok),
        "score": score,
        "floor": GODRAY_FLOOR,
        "scene": scene_score,
        "keep": keep,
        "key": key_score,
    }


def _runs(mask):
    runs, start = [], None
    for i, on in enumerate(mask):
        if on and start is None:
            start = i
        elif not on and start is not None:
            runs.append((start, i - 1))
            start = None
    if start is not None:
        runs.append((start, len(mask) - 1))
    return runs


def contact_rows(img):
    """A tower foot is a dark vertical mass whose sand just underneath is darker than the sand beside it."""
    h, w = img.shape[:2]
    y = display_luma(img)
    y0, y1 = int(0.32 * h), int(0.78 * h)
    band = y[y0:y1]
    if band.size == 0:
        return {"pass": False, "towers": 0, "hit": 0, "reason": "empty"}
    dark = band.min(axis=0) < 0.22
    hits = []
    for a, b in _runs(dark):
        if b - a + 1 < max(4, w // 80):
            continue
        span = y[:, a:b + 1].mean(axis=1)
        base = None
        for row in range(min(h - 3, int(0.90 * h)), int(0.28 * h), -1):
            if span[row] < 0.22:
                base = row + 1
                break
        if base is None or base >= h - 2:
            continue
        pad = max(2, int(0.018 * h))
        foot = y[base:min(h, base + pad), a:b + 1]
        width = b - a + 1
        side_x0 = min(w - 2, b + 1 + width)
        side_x1 = min(w, side_x0 + width)
        if side_x1 - side_x0 < 3:
            side_x1 = max(0, a - width)
            side_x0 = max(0, side_x1 - width)
        side = y[base:base + pad, side_x0:side_x1]
        if foot.size == 0 or side.size == 0:
            continue
        delta = float(side.mean() - foot.mean())
        hits.append({"x0": int(a), "x1": int(b), "row": int(base), "delta": round(delta, 4), "pass": delta >= CONTACT_DELTA})
    ok_n = sum(1 for t in hits if t["pass"])
    return {
        "pass": ok_n >= CONTACT_MIN,
        "towers": len(hits),
        "hit": ok_n,
        "need": CONTACT_MIN,
        "delta": CONTACT_DELTA,
        "feet": hits[:8],
    }


def load(path):
    return sample.load_rgb(path)


def evaluate(frame, key, scene=None, pack=None):
    """frame, key, scene are sRGB float images. pack is look.json when present."""
    rows = []
    ref = None
    if pack is not None:
        ref = ((pack.get("features") or {}).get("grade") or {}).get("reference")
    if ref == "synthetic-pregrade":
        rows.append({"id": "frame", "pass": False, "detail": "grade.reference is the synthetic pregrade"})
    elif ref is not None and ref != "game":
        rows.append({"id": "frame", "pass": False, "detail": "grade.reference is %s" % ref})
    else:
        rows.append({"id": "frame", "pass": True, "detail": "real framebuffer"})
    luma = luma_rows(frame, key)
    rows.append({"id": "luma", "pass": luma["pass"], "detail": luma})
    rays = godray_rows(frame, scene, key)
    rows.append({"id": "godrays", "pass": rays["pass"], "detail": rays})
    feet = contact_rows(frame)
    rows.append({"id": "contact", "pass": feet["pass"], "detail": feet})
    return {"pass": all(r["pass"] for r in rows), "rows": rows}


def main(argv):
    import argparse, json
    ap = argparse.ArgumentParser()
    ap.add_argument("--key", required=True)
    ap.add_argument("--frame", required=True, help="Real presented framebuffer. Not a synthetic pregrade.")
    ap.add_argument("--scene", help="Same camera before the grade, used as the god-ray keep reference.")
    ap.add_argument("--pack", help="look.json. reference synthetic-pregrade fails.")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    frame, key = load(a.frame), load(a.key)
    scene = load(a.scene) if a.scene else None
    pack = json.load(open(a.pack)) if a.pack else None
    doc = evaluate(frame, key, scene, pack)
    if a.out:
        os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
        json.dump(doc, open(a.out, "w"), indent=1, default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o))
    summary = []
    for r in doc["rows"]:
        item = {"id": r["id"], "pass": bool(r["pass"])}
        if r["id"] == "luma":
            item["mean"] = r["detail"].get("meanFrame")
            item["rel"] = r["detail"].get("meanRel")
        if r["id"] == "godrays":
            item["score"] = r["detail"].get("score")
            item["keep"] = r["detail"].get("keep")
        if r["id"] == "contact":
            item["hit"] = r["detail"].get("hit")
            item["towers"] = r["detail"].get("towers")
        summary.append(item)
    print(json.dumps({"pass": bool(doc["pass"]), "rows": summary}))
    return 0 if doc["pass"] else 1
