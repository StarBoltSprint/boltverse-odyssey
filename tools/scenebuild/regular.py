#!/usr/bin/env python3
"""tools/scenebuild/regular.py - 'too regular' detector: render vs key on the key's stone segments (L1 stone).
Stats per image, inside the same masks:
  block_cv     : robust spread (IQR/median) of block areas (blocks = components between dark joints, black top-hat)
  joint_jitter : CV of the spacing between horizontal joint lines (row profile peaks) -> regular courses ~ 0
  stripe_peak  : max / mean of the column-profile FFT (repeating vertical joints = stripes)
  sil_hf       : high-frequency energy fraction of the skyline (first non-sky row per column)
FAIL a stat when render is < 0.6 x key (variance / jitter / silhouette) or stripe_peak > 1.5 x key.
usage: regular.py RENDER.png SHEETDIR [--out json]"""
import json, sys
from pathlib import Path
import numpy as np, cv2


def stats(img, M):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    bh = cv2.morphologyEx(g, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
    thr = np.percentile(bh[M], 80) if M.any() else 0; J = (bh > max(thr, 6)) & M
    n, lab, st, _ = cv2.connectedComponentsWithStats((M & ~J).astype(np.uint8), 4)
    areas = st[1:, 4][st[1:, 4] >= 12].astype(float)
    q1, q2, q3 = np.percentile(areas, [25, 50, 75]) if len(areas) > 3 else (0, 1, 0)
    block_cv = float((q3 - q1) / max(q2, 1e-6))                                    # robust size spread (IQR / median)
    rows = J.sum(1).astype(float); rows = np.convolve(rows, np.ones(3) / 3, "same")
    pk = [i for i in range(1, len(rows) - 1) if rows[i] > rows[i - 1] and rows[i] >= rows[i + 1] and rows[i] > rows.max() * 0.3]
    d = np.diff(pk); joint_jitter = float(d.std() / d.mean()) if len(d) > 2 else 0.0
    cols = J.sum(0).astype(float); cols -= cols.mean(); sp = np.abs(np.fft.rfft(cols))[3:len(cols) // 4]
    stripe = float(sp.max() / (sp.mean() + 1e-6)) if len(sp) else 0.0
    sky = np.abs(g - g[:4].mean(0, keepdims=True)) > 25                     # skyline: first non-sky row per column
    top = np.array([np.argmax(sky[:, x]) if sky[:, x].any() else np.nan for x in range(g.shape[1])]); top = top[np.isfinite(top)]
    if len(top) > 16:
        f = np.abs(np.fft.rfft(top - top.mean())) ** 2; sil = float(f[len(f) // 8:].sum() / (f[1:].sum() + 1e-9))
    else:
        sil = 0.0
    return {"block_cv": round(block_cv, 3), "joint_jitter": round(joint_jitter, 3), "stripe_peak": round(stripe, 2), "sil_hf": round(sil, 4)}


def check(render, sd):
    sd = Path(sd); sh = json.loads((sd / "sheet.json").read_text()); L1 = cv2.imread(str(sd / "L1.png"), 0)
    els1 = [e for e in sh["elements"] if e["level"] == 1]
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "keysheet")); from auto_check import l2masks
    els2 = [e for e in sh["elements"] if e["level"] == 2]; M = np.zeros(L1.shape, bool)
    for e, m in zip(els2, l2masks(sd)):            # key stone segments (L2), fallback L1 stone forms
        if e.get("class") == "stone":
            M |= m
    if M.sum() < 2000:
        for i, e in enumerate(els1, 1):
            if e.get("class") == "stone":
                M |= L1 == i
    key = cv2.imread(str(sd / "key1024.png")); ren = cv2.imread(str(render))
    if ren.shape[:2] != M.shape:
        ren = cv2.resize(ren, M.shape[::-1])
    k, r = stats(key, M), stats(ren, M); fails = []
    for s_ in ("block_cv", "joint_jitter", "sil_hf"):
        if r[s_] < 0.6 * k[s_]:
            fails.append(s_)
    if r["stripe_peak"] > 1.5 * max(k["stripe_peak"], 1e-6):
        fails.append("stripe_peak")
    return {"key": k, "render": r, "too_regular": fails, "ok": not fails}


if __name__ == "__main__":
    rep = check(sys.argv[1], sys.argv[2]); print(json.dumps(rep))
    if "--out" in sys.argv:
        Path(sys.argv[sys.argv.index("--out") + 1]).write_text(json.dumps(rep, indent=1))
