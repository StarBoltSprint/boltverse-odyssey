"""v3.3: t1-right -> t1-right-v33.jpg. (1) per-channel grade to the key-B crop: mean + std matched in each RGB channel
(sets mean, blue-red and contrast), then the black point lifted to the key's 5th-percentile luma. (2) seam feather: near the
panel edges (x -6.07 / 4.23 m, 0.8 m band) and the wall top (y1 4.945 m, 0.6 m band) the texel is blended toward the
plate-front pixel that maps to the SAME facade point (both planar, so the mapping is exact). Real pixels only."""
import numpy as np, json
from PIL import Image
P = 'plates/'
key = np.asarray(Image.open(P + 'key-b-crop.png').convert('RGB'), np.float32) / 255
src = np.asarray(Image.open(P + 'v32/t1-right.jpg').convert('RGB'), np.float32) / 255
old = np.asarray(Image.open(P + 'plate-front.jpg').convert('RGB'), np.float32) / 255
km, ks = key.reshape(-1, 3).mean(0), key.reshape(-1, 3).std(0); sm, ss = src.reshape(-1, 3).mean(0), src.reshape(-1, 3).std(0)
g = (src - sm) / ss * ks + km
L = lambda a: a.mean(-1)
kp5, gp5 = np.percentile(L(key), 5), np.percentile(L(g), 5)
if gp5 < kp5:   # lift the near-black floor to the key's, keeping the top (linear remap of the range below the mean)
    m = L(g).mean(); w = np.clip((m - L(g)) / (m - gp5), 0, 1)[..., None]; g = g + w * (kp5 - gp5)
g = np.clip(g, 0, 1)
# feather toward plate-front at the same facade point
K2, C2, G2, XC2 = 378 / 3.85, 518.5, 775, -0.86; S, FX0, FY0 = 0.0215, 535, 870
X2A, X2B, Y1 = XC2 - 512 / K2, XC2 + 500 / K2, (870 - 640) * S
jj, ii = np.mgrid[0:1024, 0:1024]; x = XC2 + (ii - C2) / K2; y = (G2 - jj) / K2
ox, oy = np.clip(FX0 + x / S, 0, 1023), np.clip(FY0 - y / S, 0, 1023)
o = old[oy.astype(int), ox.astype(int)]
wx = np.clip(np.minimum(x - X2A, X2B - x) / 0.8, 0, 1); wy = np.clip((Y1 - y) / 0.6, 0, 1)
w = (np.minimum(wx, wy) ** 1.0)[..., None]
w = np.where((y > Y1)[..., None], 0, w)   # above the wall top: old plate (cornice pixels), as the geometry there
out = g * w + o * (1 - w)
Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(P + 'v32/t1-right-v33.jpg', quality=95)
def stats(a): l = L(a); return dict(meanRGB=a.reshape(-1, 3).mean(0).round(3).tolist(), blueMinusRed=round(float((a[..., 2] - a[..., 0]).mean()), 3), lumaStd=round(float(l.std()), 3), p5=round(float(np.percentile(l, 5)), 3), p95=round(float(np.percentile(l, 95)), 3))
inner = (wx[..., 0] if wx.ndim == 3 else wx) > 0.99
r = dict(keyCrop=stats(key), t1RightOriginal=stats(src), t1RightGraded=stats(g), servedInnerPanel=stats(out[(wx >= 1) & (wy >= 1)][:, None, :]))
json.dump(r, open('work/colour-v33.json', 'w'), indent=1); print(json.dumps(r, indent=0))
