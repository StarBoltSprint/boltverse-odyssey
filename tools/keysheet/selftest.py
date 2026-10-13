#!/usr/bin/env python3
"""keysheet selftest: synthetic detectors + the zd-terrace sheet (key passes itself, a flat-bar render fails)."""
import sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent; sys.path.insert(0, str(HERE))
import detect as D, check as C
rows = []
def row(n, ok, v=None):
    rows.append(bool(ok)); print(("PASS " if ok else "FAIL ") + n + ("" if v is None else f"  ({v})"))
L = np.full((200, 300), 30.0); lab = np.stack([L, L * 0, L * 0], -1); R = np.ones_like(L, bool)
L2 = L.copy(); L2[50:60, 20:280] = 90
row("straight_bar finds a flat bar", D.straight_bar(L2, lab, R, {"thr_L": 70, "min_w_frac": 0.3, "max_h": 12})["count"] == 1)
L3 = L.copy()
for x in range(20, 280, 30):
    L3[50:58 + (x % 7), x:x + 25] = 90
row("straight_bar ignores broken bulging lip", D.straight_bar(L3, lab, R, {"thr_L": 70, "min_w_frac": 0.3, "max_h": 12})["count"] == 0)
L4 = L.copy(); L4[40:60, 20:200] = 90; L4[100:118, 40:220] = 90
row("band counts 2 slabs", D.band(L4, lab, R, {"thr_L": 70, "min_w": 60, "min_h": 6})["count"] == 2)
L5 = np.full((200, 300), 60.0); L5[80:130, 100:130] = 5
row("dark_rect finds a doorway", D.dark_rect(L5, lab, R, {"dark_rel": 0.45, "w_min": 10, "w_max": 70, "h_min": 14})["count"] == 1)
L6 = L.copy()
for x in range(20, 280, 20):
    L6[60:100, x:x + 4] = 90
row("drips counts 13 icicles", D.drips(L6, lab, R, {"thr_L": 70, "min_len": 12, "max_w": 8})["count"] == 13)
F = HERE.parents[1] / "tools/gatesuite/fixtures"; SH = HERE / "zones/zd-terrace/sheet.json"
row("zd-terrace: key passes its own sheet", all(r["ok"] for r in C.check(F / "key-zd1-b.jpg", SH)))
row("zd-terrace: spec-final render fails", not all(r["ok"] for r in C.check(F / "spec-final-render.jpg", SH)))
print(f"{sum(rows)}/{len(rows)}"); sys.exit(0 if all(rows) else 1)
