"""Blocking gate: painted icicle streaks without geometry ("ghost icicles").

python3 -m tools.gate streaks <bands.json> <icicles.json> [--tex plate=path ...] [--out j]

Thresholds are the v3.4 detector (do not loosen): a streak >= 0.15 m needs a cone of the
same tier/side within max(0.2 m, half its width). PASS iff no ghosts.
"""
import json
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def detect(img, band, mpp):
    r0, rows, c_lo, c_hi = band["row0"], band["rows"], band["c_lo"], band["c_hi"]
    top = max(0, r0 - 6)
    sub = img[top:r0 + rows, c_lo:c_hi]
    ref = np.percentile(sub, 30, axis=1, keepdims=True)
    br = (sub > 80) & (sub > ref + 40)
    br = br | (np.roll(br, 1, 0) & np.roll(br, -1, 0))
    if band.get("mask"):
        mk = np.asarray(Image.open(band["mask"]).convert("L").resize((img.shape[1], img.shape[0]))) > 127
        br &= ndi.binary_erosion(mk, iterations=2)[max(0, r0 - 6):r0 + rows, c_lo:c_hi]
    run = np.zeros(sub.shape[1])
    st = np.zeros(sub.shape[1], int)
    for j in range(sub.shape[1]):
        col = np.r_[False, br[:, j], False].astype(int)
        d = np.diff(col)
        s_, e_ = np.flatnonzero(d == 1), np.flatnonzero(d == -1)
        if len(s_):
            k = np.argmax(e_ - s_)
            run[j] = e_[k] - s_[k]
            st[j] = s_[k]
    minpx = 0.15 / mpp
    lab, n = ndi.label(run >= minpx)
    out = []
    for i in range(1, n + 1):
        js = np.flatnonzero(lab == i)
        jc = js[np.argmax(run[js])]
        if len(js) * mpp > 1.5:
            continue
        out.append(dict(
            col=int(c_lo + jc), c0=int(c_lo + js[0]), c1=int(c_lo + js[-1]),
            r0=int(top + st[jc]), r1=int(top + st[jc] + run[jc]),
            lenM=round(float(run[jc] * mpp), 3), widthM=round(float(len(js) * mpp), 3),
            cols=[(int(c_lo + j), round(float(run[j] * mpp), 3), int(top + st[j])) for j in js],
        ))
    return out


def run(bands, ici, texmap=None):
    res = []
    bad = 0
    for b in bands:
        img = np.asarray(Image.open((texmap or {}).get(b["plate"], b["tex"])).convert("L"), np.float32)
        key = "x" if b["side"] == "front" else "z"
        cones = np.array([c[key] for c in ici if c["tier"] == b["tier"] and c["side"] == b["side"]] or [1e9])
        for s in detect(img, b, abs(b["b"])):
            x = b["a"] + b["b"] * s["col"]
            d = float(np.min(np.abs(cones - x)))
            if d > max(0.2, s["widthM"] / 2):
                res.append(dict(plate=b["plate"], tier=b["tier"], side=b["side"], coord=round(x, 3), **s, nearestConeM=round(d, 3)))
                bad += 1
    return dict(pass_=bad == 0, ghosts=bad, list=res)


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    tm = {}
    if "--tex" in a:
        i = a.index("--tex") + 1
        while i < len(a) and "=" in a[i]:
            k, v = a[i].split("=", 1)
            tm[k] = v
            i += 1
    r = run(json.load(open(a[0])), json.load(open(a[1])), tm)
    r["pass"] = r.pop("pass_")
    if "--out" in a:
        json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
    shown = dict(ghostStreaks=r["ghosts"], pass_=r["pass"], first=r["list"][:6])
    print(json.dumps(shown))
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
