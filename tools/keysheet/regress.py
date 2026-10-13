#!/usr/bin/env python3
"""Regression only: the AUTO sheet must find every element of the hand-written Zone D list.
usage: python3 tools/keysheet/regress.py AUTO_SHEET_DIR [HAND_SHEET=zones/zd-terrace/sheet.json]
A hand element is FOUND when the auto regions (L1 forms + L2 elements) that lie >= 30% inside it cover >= 60% of it
(drips/bands may be split into many auto pieces). 'straight_bar' entries are absence checks and are skipped.
The hand masks of band/drips/dark_rect are coarse boxes (they cover the terrace, not the element), so those kinds are
FOUND by count instead: auto L2 elements >= 80% inside the box with the matching auto shape/class
(band: wide snow, w/h >= 3; drips: tall thin snow/ice h/w >= 1.5; dark_rect: L below the key's 25th pct)."""
import json, sys
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from auto_check import l2masks  # noqa: E402


def _wh(e):
    x0, y0, x1, y1 = e["bbox_px"]; return x1 - x0 + 1, y1 - y0 + 1


RULES = {"band": (3, lambda e, lp: e["class"] == "snow" and _wh(e)[0] >= 3 * _wh(e)[1]),
         "drips": (5, lambda e, lp: e["class"] in ("snow", "ice") and _wh(e)[1] >= 1.5 * _wh(e)[0]),
         "dark_rect": (2, lambda e, lp: e["lab"][0] < lp)}


def regress(auto_dir, hand=HERE / "zones/zd-terrace/sheet.json", need=0.6):
    auto_dir, hand = Path(auto_dir), Path(hand); hs = json.loads(hand.read_text())
    L1 = cv2.imread(str(auto_dir / "L1.png"), 0); regs = [L1 == i for i in range(1, int(L1.max()) + 1)] + list(l2masks(auto_dir))
    areas = np.array([r.sum() for r in regs]); rows = []
    sh = json.loads((auto_dir / "sheet.json").read_text()); els2 = [e for e in sh["elements"] if e["level"] == 2]; n1 = int(L1.max())
    k = cv2.imread(str(auto_dir / "key1024.png")); from skimage.color import rgb2lab
    Lp25 = float(np.percentile(rgb2lab(k[:, :, ::-1] / 255.0)[..., 0], 25))
    for e in hs["elements"]:
        if e.get("kind") == "straight_bar":
            continue
        H = cv2.resize(cv2.imread(str(hand.parent / e["mask"]), 0), L1.shape[::-1], interpolation=cv2.INTER_NEAREST) > 127
        if e["kind"] in RULES:
            need_n, ok = RULES[e["kind"]]; hits = []
            for el, r in zip(els2, regs[n1:]):
                if r.sum() and (r & H).sum() >= 0.8 * r.sum() and ok(el, Lp25):
                    hits.append(el["id"])
            rows.append({"id": e["id"], "kind": e["kind"], "auto_matches": len(hits), "need": need_n, "found": len(hits) >= need_n, "examples": hits[:6]})
            continue
        U = np.zeros_like(H); n = 0
        for r, a in zip(regs, areas):
            if a and (r & H).sum() >= 0.3 * a:
                U |= r; n += 1
        cov = float((U & H).sum() / max(H.sum(), 1))
        rows.append({"id": e["id"], "kind": e["kind"], "coverage": round(cov, 3), "auto_regions": n, "found": cov >= need})
    return {"pass": all(r["found"] for r in rows), "rows": rows}


if __name__ == "__main__":
    r = regress(*sys.argv[1:]); print(json.dumps(r, indent=1)); sys.exit(0 if r["pass"] else 1)
