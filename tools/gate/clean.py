"""Clean painted icicle streaks that received no cone, using neighbouring real pixels.

Image bounds follow the plate size (a 1024 plate still clips at size-2, the old 1022).
The script entry writes the terrace v34 plates when cwd is the terrace step.
The self-test calls clean_one() on a small array and does not rewrite those plates.
"""
import json
import os
import sys
import numpy as np
import cv2
from PIL import Image

from tools.gate import streaks as GS


def clean_one(a, Lm, c0, c1, r0, r1, it, log, plate):
    """a is float RGB, edited in place via the returned array. Lm is its luma."""
    H, W = Lm.shape
    c0, c1 = max(1, c0 - 2), min(W - 2, c1 + 2)
    ra, rb = max(1, r0 - 2), min(H - 2, r1 + 4)
    w = c1 - c0 + 1
    cands = [
        (Lm[ra:rb, c0 + o:c1 + o + 1].mean() + 0.02 * abs(o), o)
        for o in range(-80, 81, 4)
        if abs(o) >= w + 4 and c0 + o >= 0 and c1 + o < W
    ]
    if not cands:
        return a
    _, off = min(cands)
    ref = np.percentile(Lm[ra:rb, max(0, c0 - 40):min(W, c1 + 40)], 30) + 40
    m = np.zeros(Lm.shape, np.uint8)
    m[ra:rb, c0:c1 + 1] = (Lm[ra:rb, c0:c1 + 1] > ref - 10) * 255
    if it >= 8:
        m[ra:rb, c0:c1 + 1] = 255
    m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    if not m.any():
        return a
    src = np.roll(a, -off, axis=1)
    ys, xs = np.nonzero(m)
    y0, y1 = max(1, ys.min()), min(H - 2, ys.max())
    x0, x1 = max(1, xs.min()), min(W - 2, xs.max())
    ring = cv2.dilate(m, np.ones((5, 5), np.uint8)) > m
    fused = Lm[ring].mean() > ref if ring.any() else False
    if not fused and it < 3:
        dst = np.clip(a, 0, 255).astype(np.uint8)[..., ::-1].copy()
        s8 = np.clip(src, 0, 255).astype(np.uint8)[..., ::-1]
        out = cv2.seamlessClone(
            s8[y0:y1 + 1, x0:x1 + 1].copy(), dst, m[y0:y1 + 1, x0:x1 + 1].copy(),
            ((x0 + x1 + 1) // 2, (y0 + y1 + 1) // 2), cv2.NORMAL_CLONE,
        )
        a = out[..., ::-1].astype(np.float32)
        how = "poisson"
    else:
        wg = cv2.GaussianBlur((m > 0).astype(np.float32), (0, 0), (3.0 if w > 10 else 1.0) if it < 8 else 0.5)[..., None]
        a = src * wg + a * (1 - wg)
        how = "footprint-feather"
    log.append(dict(plate=plate, pass_=it, footprintPx=int((m > 0).sum()), bbox=[int(x0), int(y0), int(x1), int(y1)], donorDx=int(off), method=how))
    return a


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    step = a[a.index("--step") + 1] if "--step" in a else "."
    SRC = {
        "plate-front": "plates/plate-front.jpg",
        "t1-right": "plates/v32/t1-right-v33.jpg",
        "plate-side": "plates/plate-side.jpg",
    }
    OUT = {
        "plate-front": "plates/v34/plate-front-v34.jpg",
        "t1-right": "plates/v34/t1-right-v34.jpg",
        "plate-side": "plates/v34/plate-side-v34.jpg",
    }
    def P(rel):
        return os.path.join(step, rel)
    A = {p: np.asarray(Image.open(P(SRC[p])).convert("RGB")).astype(np.float32) for p in SRC}
    bands = json.load(open(P("work/terrace-lod0-bands.json")))
    ici = json.load(open(P("work/terrace-lod0-icicles.json")))
    LOG = []
    for g in [g for g in json.load(open(P("work/terrace-lod0-ghosts.json"))) if "c0" in g]:
        A[g["plate"]] = clean_one(A[g["plate"]], A[g["plate"]].mean(2), g["c0"], g["c1"], g["r0"], g["r1"], 0, LOG, g["plate"])
    res = {}
    for it in range(1, 13):
        tm = {}
        for p in OUT:
            Image.fromarray(np.clip(A[p], 0, 255).astype(np.uint8)).save(P(OUT[p]), quality=95)
            tm[p] = P(OUT[p])
        r = GS.run(bands, ici, tm)
        res["pass%d" % it] = r["ghosts"]
        if not r["ghosts"]:
            break
        for g in r["list"]:
            A[g["plate"]] = clean_one(A[g["plate"]], A[g["plate"]].mean(2), g["c0"], g["c1"], g["r0"], g["r1"], it, LOG, g["plate"])
    report = dict(passes=res, fills=LOG)
    json.dump(report, open(P("work/clean-report.json"), "w"), indent=1)
    summary = dict(passes=res, fills=len(LOG), poisson=sum(l["method"] == "poisson" for l in LOG), feather=sum(l["method"] != "poisson" for l in LOG))
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
