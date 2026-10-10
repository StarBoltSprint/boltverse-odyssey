"""Bake the ground close-range detail slices from existing seamless Imagine tiles (native 928 px, never resized).
Per slice one RGB JPEG (q95, 4:4:4):
  R = luminance detail ratio / 2  (Imagine luma / its wrap-blurred low-pass, mean exactly 1 -> 0.5)
  G,B = tangent normal x,y (0.5 + 0.5 n) from Depth Anything V2 Small height (seamless: tile + half-rolled tile, crossfaded)
Run: python3 bake_detail.py <outdir> [--src DIR] [--slices slices.json] [--pxm 512]
imagine-to-3d (2026-10-10): src dir / slice table / px/m are arguments now (defaults = the Zone B ground bake);
slices.json = [[name, srcStem, lowpassSigmaPx, heightAmpM, [bandLoPx, bandHiPx]], ...]."""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from depth_relief import session, disparity
def _arg(k, d):
    return sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
SRC = os.path.join(_arg("--src", "/workspace/zb-preview-1008/mesas/hybrid"), "")
PXM = float(_arg("--pxm", "512"))
# name, src, low-pass sigma for the luma ratio (px), height amplitude (m), height band-pass (px)
SLICES = [
  ("sand",  "m_sand",  40, 0.006, (1.0, 60)),
  ("scree", "m_scree", 64, 0.025, (1.0, 90)),
  ("grit",  "m_face",  48, 0.010, (1.0, 60)),
]
if "--slices" in sys.argv: SLICES = [tuple(x[:4]) + (tuple(x[4]),) for x in json.load(open(_arg("--slices", "")))]
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
sess, kind = session(); rep = {"model": kind, "pxPerM": PXM, "slices": {}}
def srgb2lin(a): return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
for name, src, sig, amp, (f0, f1) in SLICES:
    img = Image.open(SRC + src + ".png").convert("RGB"); W, H = img.size
    a = np.asarray(img, np.float32) / 255.0
    lum = (srgb2lin(a) @ np.array([0.2126, 0.7152, 0.0722], np.float32))
    low = ndi.gaussian_filter(lum, sig, mode="wrap")
    ratio = lum / np.maximum(low, 1e-4); ratio /= ratio.mean()
    ratio = np.clip(ratio, 0.0, 1.999)
    # seamless depth: model on the tile and on the half-rolled tile, crossfade away from each one's borders
    d0 = disparity(sess, kind, img)
    r = np.roll(np.roll(a, H // 2, 0), W // 2, 1)
    d1 = disparity(sess, kind, Image.fromarray((r * 255).astype(np.uint8)))
    d1 = np.roll(np.roll(d1, -(H // 2), 0), -(W // 2), 1)
    def bw(n):
        t = np.minimum(np.arange(n), n - 1 - np.arange(n)) / (n / 2)
        return np.clip(t * 2.5, 0, 1)
    w0 = np.outer(bw(H), bw(W)); w1 = np.roll(np.roll(w0, H // 2, 0), W // 2, 1)
    # match scale of the two runs (relative depth) before blending
    hp0 = ndi.gaussian_filter(d0, f0, mode="wrap") - ndi.gaussian_filter(d0, f1, mode="wrap")
    hp1 = ndi.gaussian_filter(d1, f0, mode="wrap") - ndi.gaussian_filter(d1, f1, mode="wrap")
    hp1 *= (np.std(hp0 * w0 * w1) + 1e-6) / (np.std(hp1 * w0 * w1) + 1e-6)
    hp = (hp0 * w0 + hp1 * w1) / np.maximum(w0 + w1, 1e-4)
    hp = ndi.gaussian_filter(hp, 0.0, mode="wrap") - ndi.gaussian_filter(hp, f1, mode="wrap")
    s = np.percentile(np.abs(hp), 99) + 1e-9
    h = np.clip(hp / s, -1, 1) * amp                                   # metres
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * PXM            # dh/dv (rows), m per m
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * PXM            # dh/du (cols)
    n = np.stack([-gx, -gy, np.ones_like(gx)], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
    rgb = np.stack([ratio * 0.5, n[..., 0] * 0.5 + 0.5, n[..., 1] * 0.5 + 0.5], -1)
    Image.fromarray(np.clip(rgb * 255 + 0.5, 0, 255).astype(np.uint8)).save(f"{out}/gdet-{name}.jpg", quality=95, subsampling=0)
    # seam metrics on the packed result (wrap step vs interior step)
    q = np.asarray(Image.open(f"{out}/gdet-{name}.jpg"), np.float32)
    inner = float(np.mean(np.abs(np.diff(q, axis=1)))); wx = float(np.mean(np.abs(q[:, 0] - q[:, -1]))); wy = float(np.mean(np.abs(q[0] - q[-1])))
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    rep["slices"][name] = dict(src=SRC + src + ".png", size=[W, H], tileM=W / PXM, lumRatioStd=round(float(ratio.std()), 3),
        hStdM=round(float(h.std()), 4), slopeP50=round(float(np.percentile(slope, 50)), 1), slopeP95=round(float(np.percentile(slope, 95)), 1),
        seamStepRatioX=round(wx / inner, 2), seamStepRatioY=round(wy / inner, 2))
    print(name, rep["slices"][name], flush=True)
json.dump(rep, open(f"{out}/bake-report.json", "w"), indent=1)
