"""No-repetition check for the detail layer.
1) Texture-space: synthesise 6x6 detail periods of the luma ratio with (a) plain tiling and (b) the shader's hex tiling
   (same math as gdHex, numpy port), then autocorrelate: peak at the tile period lattice / background p99.
2) Screen-space (optional): top-down capture difference (after - before) autocorrelation at the projected period.
python3 repeat_check.py <slice.jpg> [rotDeg] [out.json]"""
import sys, json, numpy as np
from PIL import Image
sl = sys.argv[1]; rotMax = np.radians(float(sys.argv[2]) if len(sys.argv) > 2 else 180)
R = np.asarray(Image.open(sl), np.float32)[..., 0] / 255.0 * 2.0      # luma ratio
N = R.shape[0]; P = 6; S = 128                                          # 6 periods, 128 samples per period
def hash4(p):
    # numpy port of gHash4 with uGroundSeed = 1008 % 997 = 11
    p4 = np.stack([p[..., 0], p[..., 1], p[..., 0], p[..., 1]], -1) * np.array([0.1031, 0.1030, 0.0973, 0.1099]) + 11 * 0.00731
    p4 = p4 - np.floor(p4)
    d = (p4 * (p4[..., [3, 2, 0, 1]] + 33.33)).sum(-1, keepdims=True); p4 = p4 + d
    out = (p4[..., [0, 0, 1, 2]] + p4[..., [1, 2, 2, 3]]) * p4[..., [2, 1, 3, 0]]
    return out - np.floor(out)
def samp(u):   # nearest-texel wrap fetch (enough for structure)
    ij = np.floor(np.mod(u, 1.0) * N).astype(int) % N
    return R[ij[..., 1], ij[..., 0]]
y, x = np.mgrid[0:P * S, 0:P * S] / S
st = np.stack([x, y], -1)
plain = samp(st)
s = st * 3.4641016; sk = np.stack([s[..., 0], -0.57735027 * s[..., 0] + 1.15470054 * s[..., 1]], -1)
base = np.floor(sk); t = sk - base; tz = 1 - t[..., 0] - t[..., 1]
sg = (tz <= 0).astype(float); s2 = 2 * sg - 1
w = np.stack([-tz * s2, sg - t[..., 1] * s2, sg - t[..., 0] * s2], -1)
vs = [base + np.stack([sg, sg], -1), base + np.stack([sg, 1 - sg], -1), base + np.stack([1 - sg, sg], -1)]
taps = []
for v in vs:
    h = hash4(v * np.array([1.731, 9.137]) + 0 * 17.31 + 3.7)
    a = (h[..., 0] * 2 - 1) * rotMax
    cen = np.stack([v[..., 0], (v[..., 1] + 0.57735027 * v[..., 0]) / 1.15470054], -1) / 3.4641016
    d = st - cen; c, sn = np.cos(a), np.sin(a)
    u = np.stack([c * d[..., 0] - sn * d[..., 1], sn * d[..., 0] + c * d[..., 1]], -1) + cen + h[..., 1:3] * 7.0
    taps.append(samp(u))
taps = np.stack(taps, -1)
W = (1 + (taps - 1) * 0.6) * w ** 7; W /= W.sum(-1, keepdims=True)
hexi = (taps * W).sum(-1)
def periodicity(img):
    a = img - img.mean(); F = np.fft.fft2(a); ac = np.real(np.fft.ifft2(F * np.conj(F))); ac /= ac[0, 0]
    lat = [ac[i * S % ac.shape[0], j * S % ac.shape[1]] for i in range(0, 3) for j in range(0, 3) if (i, j) != (0, 0)]
    mask = np.ones_like(ac, bool)
    for i in range(-1, 2):
        for j in range(-1, 2): pass
    bg = np.abs(ac[S // 4: -S // 4, S // 4: -S // 4])
    return dict(latticePeakMean=round(float(np.mean(lat)), 3), latticePeakMax=round(float(np.max(lat)), 3), bgP99=round(float(np.percentile(bg, 99)), 3))
res = dict(slice=sl, rotMaxDeg=round(float(np.degrees(rotMax)), 1), plainTiling=periodicity(plain), hexTiling=periodicity(hexi),
           stdPlain=round(float(plain.std()), 3), stdHex=round(float(hexi.std()), 3))
Image.fromarray(np.clip(np.concatenate([plain, hexi], 1) * 127.5, 0, 255).astype(np.uint8)).save(sl.replace(".jpg", "-repeat-check.png").replace("/gdet/", "/gdet-check/") if "--save" in sys.argv else "/tmp/rc.png")
print(json.dumps(res))
