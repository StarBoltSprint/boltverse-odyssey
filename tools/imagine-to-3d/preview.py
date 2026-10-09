"""Quick offline preview of a strata .bin LOD (painter's algorithm, flat sun shading). python3 preview.py <prefix> <out.png> [lod]"""
import sys, json, numpy as np
from PIL import Image, ImageDraw
pre, out = sys.argv[1:3]; lod = int(sys.argv[3]) if len(sys.argv) > 3 else 0
g = json.load(open(pre + "-geo.json")); a = np.fromfile(pre + ".bin", np.float32).reshape(-1, 6)
L = g["lods"][lod]; v = a[L["offset"]:L["offset"] + L["verts"], :3].reshape(-1, 3, 3).astype(np.float64)
pl = a[L["offset"]:L["offset"] + L["verts"], 3].reshape(-1, 3)[:, 0]
sun = np.array([0.8, 0.35, 0.45]); sun /= np.linalg.norm(sun)
ims = []
for az, el in [(20, 6), (110, 25), (200, 45)]:
    A, E = np.radians(az), np.radians(el)
    f = np.array([np.sin(A) * np.cos(E), -np.sin(E), np.cos(A) * np.cos(E)])  # view dir
    r = np.cross([0, 1, 0], f); r /= np.linalg.norm(r); u = np.cross(f, r)
    u = u if u[1] > 0 else -u
    W, H = 700, 420; s = 4.0
    P = v @ np.stack([r, u, f], 1)
    n = np.cross(v[:, 1] - v[:, 0], v[:, 2] - v[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    vis = np.ones(len(n), bool)
    n = n * np.sign(-(n @ f))[:, None]   # two-sided for the preview
    sh = np.clip(n @ sun, 0, 1) * 0.75 + 0.22
    col = np.where(pl[:, None] < 0, [[0.95, 0.72, 0.55]], [[0.85, 0.5, 0.35]]) * sh[:, None]
    im = Image.new("RGB", (W, H), (120, 110, 150)); d = ImageDraw.Draw(im)
    order = np.argsort(-P[:, :, 2].max(1))
    for i in order:
        if not vis[i]: continue
        pts = [(W / 2 + p[0] * s, H * 0.8 - p[1] * s) for p in P[i]]
        d.polygon(pts, fill=tuple(int(c * 255) for c in np.clip(col[i], 0, 1)))
    ims.append(im)
Wt = Image.new("RGB", (700, 420 * 3)); [Wt.paste(im, (0, k * 420)) for k, im in enumerate(ims)]; Wt.save(out)
