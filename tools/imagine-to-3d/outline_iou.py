"""Outline IoU of a strata mesa vs the key crop (key-city3 crop-L).
Key: rock = not sky (sky: b > 1.03 g) and not tower (dark neutral); skyline per column (tower columns interpolated),
region below the skyline = silhouette. Mesa: orthographic side silhouette of LOD1 from 36 azimuths; best fit over
azimuth, scale and offset (the key frame cuts the massif, so the mesa may extend past the crop edges).
python3 outline_iou.py <crop.png> <prefix> [prefix2 ...]  -> json {iou, az, ...}"""
import sys, json, numpy as np
from PIL import Image
BAND = 30   # px below the lowest key skyline point
TOWER_COLS = [(180, 295), (325, 340)]   # crop-L: tower occluders (columns excluded from scoring, measured by hand)
def key_skyline(path):
    a = np.asarray(Image.open(path).convert("RGB"), float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    H, W = r.shape
    sky = b > 1.03 * g
    tower = (r < 75) & (np.abs(r - b) < 22) & (g < 70)
    rock = ~sky & ~tower
    sk = np.full(W, np.nan)
    for x in range(W):
        col = rock[:, x]
        # first row from the top where rock holds for >= 6 rows
        run = np.convolve(col.astype(int), np.ones(6, int), "valid") == 6
        idx = np.nonzero(run)[0]
        tw = tower[:, x].mean()
        if len(idx) and tw < 0.35 and not any(a0 <= x < a1 for a0, a1 in TOWER_COLS): sk[x] = idx[0]
    ok = ~np.isnan(sk); xs = np.arange(W)
    sk = np.interp(xs, xs[ok], sk[ok])
    return sk, H, W, ok
def mesa_skyline(prefix, az, lod=1, n=400):
    g = json.load(open(prefix + "-geo.json")); a = np.fromfile(prefix + ".bin", np.float32).reshape(-1, g.get("stride", 6))
    L = g["lods"][lod]; v = a[L["offset"]:L["offset"] + L["verts"], :3].astype(np.float64)
    A = np.radians(az); r = np.array([np.cos(A), 0, -np.sin(A)])
    u = v @ r; y = v[:, 1]
    t = v.reshape(-1, 3, 3)
    tu = t @ r; ty = t[:, :, 1]
    lo, hi = u.min(), u.max(); bins = np.linspace(lo, hi, n + 1); top = np.zeros(n)
    # max height over each u bin from triangle vertices + edge samples
    for k in range(3):
        for s in np.linspace(0, 1, 6):
            uu = tu[:, k] * (1 - s) + tu[:, (k + 1) % 3] * s; yy = ty[:, k] * (1 - s) + ty[:, (k + 1) % 3] * s
            ix = np.clip(((uu - lo) / (hi - lo) * n).astype(int), 0, n - 1); np.maximum.at(top, ix, yy)
    return (bins[:-1] + bins[1:]) / 2, top
def iou_fit(sk, H, W, mu, mt, ok=None):
    global OK
    if ok is not None: OK = ok
    best = (0, None)
    ytop = mt.max(); wm = mu[-1] - mu[0]
    for sc in np.linspace(0.6, 2.2, 65):          # mesa height in crop px = sc * (H - min(sk))
        hp = sc * (H - sk.min()) / ytop             # px per metre
        if not (0.9 * W <= wm * hp <= 1.3 * W): continue   # key: the massif fills the crop width (cut at the left edge): fit the WHOLE mesa, no zooming into a flat corner
        for base in np.linspace(H * 0.85, H * 1.6, 31):   # foot row (may be below the frame: dunes cover it)
            for off in np.linspace(-wm * hp, W, 80):  # crop x of the mesa's left edge
                xs = np.arange(W); um = mu[0] + (xs - off) / hp
                h = np.interp(um, mu, mt, left=0, right=0)
                ms = np.clip(base - h * hp, 0, H)
                ks = sk
                Y = min(H, ks[OK].max() + BAND)      # score the skyline band only (rows above key-skyline max + BAND)
                inter = np.sum(np.clip(Y - np.maximum(np.minimum(ms, Y), ks), 0, None)[OK]); uni = np.sum((Y - np.minimum(ms, ks))[OK])
                i = inter / uni
                if i > best[0]: best = (i, dict(scale=round(float(sc), 3), base=round(float(base), 1), off=round(float(off), 1)))
    return best
if __name__ == "__main__":
    crop = sys.argv[1]; sk, H, W, ok = key_skyline(crop); OK = ok; out = {}
    for pre in sys.argv[2:]:
        res = []
        for az in range(0, 360, 15):
            mu, mt = mesa_skyline(pre, az)
            i, p = iou_fit(sk, H, W, mu, mt); res.append((i, az, p))
        res.sort(key=lambda t: -t[0]); i, az, p = res[0]
        mu, mt = mesa_skyline(pre, az)
        out[pre] = dict(iou=round(float(i), 3), az=az, **p, hOverW=round(float(mt.max() / (mu[-1] - mu[0])), 3))
        print(pre, out[pre], flush=True)
    print(json.dumps(out))
