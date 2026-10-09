"""Package a hull + GLB + plates for the runtime: copies plates byte-for-byte (no resize, no re-encode),
writes <name>.json with the plate cameras, footprint polygons and per-plate colour gains (applied in the shader)."""
import json, shutil, sys, os, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from masks import load, rock_mask
from PIL import Image
def radial_poly(H, ax, thr, n=96):
    g = ax[1] - ax[0]; m = H > thr; iz, ix = np.nonzero(m)
    cx, cz = ax[ix].mean(), ax[iz].mean(); pts = []
    for k in range(n):
        a = 2 * np.pi * k / n; dx, dz = np.cos(a), np.sin(a); r = 0.0; t = 0.0
        while t < ax.max() * 1.6:
            x, z = cx + dx * t, cz + dz * t
            j = int(round((x - ax[0]) / g)); i = int(round((z - ax[0]) / g))
            if 0 <= i < H.shape[0] and 0 <= j < H.shape[1] and m[i, j]: r = t
            t += g
        pts.append([round(cx + dx * r, 3), round(cz + dz * r, 3)])
    return pts
def srgb2lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
if __name__ == "__main__":
    pre, plates_json, glbdir, dest, name = sys.argv[1:6]
    plates = json.load(open(plates_json)); meta = json.load(open(pre + "-meta.json")); H = np.load(pre + "-H.npy")
    n = H.shape[0]; ax = (np.arange(n) - (n - 1) / 2) * meta["grid_m"]
    os.makedirs(dest, exist_ok=True)
    tex = {}
    means = {}
    for k, p in plates.items():
        ext = os.path.splitext(p)[1]; shutil.copyfile(p, f"{dest}/{name}-{k}{ext}")
        im = Image.open(p); tex[k] = dict(file=f"{name}-{k}{ext}", w=im.size[0], h=im.size[1])
        if k != "detail":
            a = load(p); m = rock_mask(a); means[k] = srgb2lin(a[m]).mean(0)
    gains = {k: [round(float(x), 4) for x in (means["front"] / means[k])] for k in means}
    shutil.copyfile(f"{glbdir}/mesa.glb", f"{dest}/{name}.glb")
    lods = json.load(open(f"{glbdir}/mesa-lods.json"))
    pj = json.load(open(pre + "-proj.json"))
    qc = json.load(open(f"{glbdir}/qc.json")) if os.path.exists(f"{glbdir}/qc.json") else None
    out = dict(meta=meta, tex=tex, gains=gains, lods=lods, heightM=float(H.max()), proj=pj, qc=qc,
               footprint=radial_poly(H, ax, 0.6), footprintBase=radial_poly(H, ax, 0.05))
    json.dump(out, open(f"{dest}/{name}.json", "w"))
    print(json.dumps({k: out[k] for k in ("gains", "lods", "heightM")}))
