"""Grade a close plate to a key crop, then feather it onto the elevation plate.

The terrace pixel mapping (origins, door span, wall top) comes from the block profile.
Running this as a script writes the same paths the terrace cook wrote. The self-test
calls grade() on arrays and does not touch those plates.
"""
import json
import os
import sys
import numpy as np
from PIL import Image


def mapping_from_profile(prof):
    S = float(prof["mPerPx"])
    FX0 = float(prof["frontOrigin"]["col"])
    FY0 = float(prof["frontOrigin"]["row"])
    close = prof["close"]
    K2 = float(close["pxPerMNum"]) / float(close["doorHeightM"])
    C2 = float(close["centreCol"])
    G2 = float(close["groundRow"])
    XC2 = float(close["centreXM"])
    X2A = XC2 - float(close["spanA"]) / K2
    X2B = XC2 + float(close["spanB"]) / K2
    y1 = prof["tiers"][0]["y1Row"]
    Y1 = (FY0 - float(y1)) * S
    feather = prof.get("feather", {})
    return dict(
        K2=K2, C2=C2, G2=G2, XC2=XC2, S=S, FX0=FX0, FY0=FY0,
        X2A=X2A, X2B=X2B, Y1=Y1,
        edgeM=float(feather.get("edgeM", 0.8)),
        topBandM=float(feather.get("topBandM", 0.6)),
    )


def grade(key, src, old, g):
    """key, src, old are float RGB in 0..1. Returns (feathered, graded), both 0..1."""
    km, ks = key.reshape(-1, 3).mean(0), key.reshape(-1, 3).std(0)
    sm, ss = src.reshape(-1, 3).mean(0), src.reshape(-1, 3).std(0)
    graded = (src - sm) / ss * ks + km
    L = lambda a: a.mean(-1)
    kp5, gp5 = np.percentile(L(key), 5), np.percentile(L(graded), 5)
    if gp5 < kp5:
        m = L(graded).mean()
        w = np.clip((m - L(graded)) / (m - gp5), 0, 1)[..., None]
        graded = graded + w * (kp5 - gp5)
    graded = np.clip(graded, 0, 1)
    K2, C2, G2, XC2 = g["K2"], g["C2"], g["G2"], g["XC2"]
    S, FX0, FY0 = g["S"], g["FX0"], g["FY0"]
    h, w = src.shape[:2]
    jj, ii = np.mgrid[0:h, 0:w]
    x = XC2 + (ii - C2) / K2
    y = (G2 - jj) / K2
    ox = np.clip(FX0 + x / S, 0, old.shape[1] - 1).astype(int)
    oy = np.clip(FY0 - y / S, 0, old.shape[0] - 1).astype(int)
    o = old[oy, ox]
    wx = np.clip(np.minimum(x - g["X2A"], g["X2B"] - x) / g["edgeM"], 0, 1)
    wy = np.clip((g["Y1"] - y) / g["topBandM"], 0, 1)
    wt = (np.minimum(wx, wy) ** 1.0)[..., None]
    wt = np.where((y > g["Y1"])[..., None], 0, wt)
    out = np.clip(graded * wt + o * (1 - wt), 0, 1)
    return out, graded


def _repo_root():
    p = os.path.abspath(__file__)
    for _ in range(8):
        p = os.path.dirname(p)
        if os.path.isdir(os.path.join(p, "tools", "gate")):
            return p
    raise SystemExit("repo root not found")


def main(argv=None):
    """Cwd is the terrace step. Writes plates/v32/t1-right-v33.jpg and work/colour-v33.json."""
    a = list(sys.argv[1:] if argv is None else argv)
    step = "."
    prof_path = os.path.join(_repo_root(), "tools", "imagine-to-3d", "profiles", "terrace-zd.json")
    if "--step" in a:
        step = a[a.index("--step") + 1]
    if "--profile" in a:
        prof_path = a[a.index("--profile") + 1]
    prof = json.load(open(prof_path))
    g = mapping_from_profile(prof)
    P = os.path.join(step, "plates")
    key = np.asarray(Image.open(os.path.join(P, "key-b-crop.png")).convert("RGB"), np.float32) / 255
    src = np.asarray(Image.open(os.path.join(P, "v32", "t1-right.jpg")).convert("RGB"), np.float32) / 255
    old = np.asarray(Image.open(os.path.join(P, "plate-front.jpg")).convert("RGB"), np.float32) / 255
    out, graded = grade(key, src, old, g)
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(
        os.path.join(P, "v32", "t1-right-v33.jpg"), quality=95)
    L = lambda im: im.mean(-1)

    def stats(im):
        l = L(im)
        return dict(
            meanRGB=im.reshape(-1, 3).mean(0).round(3).tolist(),
            blueMinusRed=round(float((im[..., 2] - im[..., 0]).mean()), 3),
            lumaStd=round(float(l.std()), 3),
            p5=round(float(np.percentile(l, 5)), 3),
            p95=round(float(np.percentile(l, 95)), 3),
        )

    h, w = src.shape[:2]
    jj, ii = np.mgrid[0:h, 0:w]
    x = g["XC2"] + (ii - g["C2"]) / g["K2"]
    y = (g["G2"] - jj) / g["K2"]
    wx = np.clip(np.minimum(x - g["X2A"], g["X2B"] - x) / g["edgeM"], 0, 1)
    wy = np.clip((g["Y1"] - y) / g["topBandM"], 0, 1)
    r = dict(
        keyCrop=stats(key),
        t1RightOriginal=stats(src),
        t1RightGraded=stats(graded),
        servedInnerPanel=stats(out[(wx >= 1) & (wy >= 1)][:, None, :]),
    )
    os.makedirs(os.path.join(step, "work"), exist_ok=True)
    json.dump(r, open(os.path.join(step, "work", "colour-v33.json"), "w"), indent=1)
    print(json.dumps(r))
    return 0


if __name__ == "__main__":
    sys.exit(main())
