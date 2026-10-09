"""Visual hull heightfield for an organic object (mesa/butte) from Imagine ortho plates.
front (+Z camera), side (+X camera, right side), back (-Z camera), top (straight down, image up = -Z).
Height H(x,z) = min(front(x), side(z), back(x), terrace(d)) inside the top footprint, d = distance to the footprint edge.
The terrace profile is read from the plates' own silhouettes (edge -> centre), so ledges follow the footprint contour.
"""
import json, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from masks import load, rock_mask

def clean_profile(mask, min_run=6):
    # drop thin horizontal strands (sand ridge lines): require a vertical run of min_run px
    m = ndi.binary_opening(mask, structure=np.ones((min_run, 1)))
    m = ndi.binary_opening(m, structure=np.ones((1, 5)))
    any_ = m.any(0)
    top = np.where(any_, m.argmax(0), -1)
    return m, top

def build(plates, height_m, grid_m=0.4, sink_m=8.0, pexp=3.4, wobble_min=0.74, back_w=0.5):
    P = {k: load(v) for k, v in plates.items()}
    M = {}; T = {}
    for k in ("front", "side", "back"):
        M[k], T[k] = clean_profile(rock_mask(P[k]))
    base_row = int(np.median([np.nonzero(M[k].any(1))[0].max() for k in M]))
    top_row = int(np.median([T[k][T[k] >= 0].min() for k in T]))
    pxm = (base_row - top_row) / height_m           # plate px per metre (all three views share the camera distance)
    prof = {}
    for k in ("front", "side", "back"):
        t = T[k].astype(np.float32); valid = t >= 0
        h = np.where(valid, (base_row - t) / pxm, 0.0)
        cols = np.nonzero(valid)[0]; c0, c1 = cols.min(), cols.max()
        h = ndi.median_filter(h, 5)
        prof[k] = dict(h=h, c0=int(c0), c1=int(c1), cx=(c0 + c1) / 2.0)
    half_w = max((prof[k]["c1"] - prof[k]["c0"]) / 2 / pxm for k in prof)
    # top footprint -> radial wobble rho(theta) (organic outline), shrink-only, smoothed
    tm = rock_mask(P["top"]); tm = ndi.binary_fill_holes(ndi.binary_closing(tm, iterations=6))
    ys, xs = np.nonzero(tm)
    tcx, tcy = (xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2
    tpx = (xs.max() - xs.min()) / ((prof["front"]["c1"] - prof["front"]["c0"]) / pxm)
    edge = tm & ~ndi.binary_erosion(tm)
    ey, ex = np.nonzero(edge)
    th = np.arctan2(ey - tcy, ex - tcx); rr = np.hypot(ey - tcy, ex - tcx)
    bins = 360; bi = ((th + np.pi) / (2 * np.pi) * bins).astype(int) % bins
    rmax = np.zeros(bins); np.maximum.at(rmax, bi, rr)
    rmax = np.where(rmax > 0, rmax, np.nan)
    idx = np.arange(bins); ok = ~np.isnan(rmax)
    rmax = np.interp(idx, idx[ok], rmax[ok], period=bins)
    rmax = ndi.gaussian_filter1d(rmax, 6, mode="wrap")
    rho = np.clip(rmax / np.percentile(rmax, 90), wobble_min, 1.0)
    n = int(np.ceil(half_w * 1.1 / grid_m))
    ax = (np.arange(-n, n + 1) * grid_m).astype(np.float32)
    X, Z = np.meshgrid(ax, ax)                      # rows = z, cols = x
    def extents(k, sign):
        p = prof[k]; cols = np.arange(len(p["h"])); u = sign * (cols - p["cx"]) / pxm
        return u, p["h"]
    ux, hx = extents("front", 1.0)                   # x = +u
    uz, hz = extents("side", 1.0)                    # z3 = +u (three local z = -z3; side camera on +X, right = -z_local)
    ubx, hbx = extents("back", -1.0)                 # x = -u (camera on -Z looking +Z)
    TH = np.arctan2(Z, X); RHO = rho[((TH + np.pi) / (2 * np.pi) * bins).astype(int) % bins]
    H = np.full(X.shape, -1.0, np.float32)
    hmax = min(hx.max(), hz.max())
    for lev in np.arange(0.05, hmax + 1e-3, 0.08):
        sx = ux[hx >= lev]; sz = uz[hz >= lev]; sb = ubx[hbx >= lev]
        if len(sx) == 0 or len(sz) == 0: break
        x0, x1, z0, z1 = sx.min(), sx.max(), sz.min(), sz.max()
        if len(sb) and back_w > 0:                   # blend in the back view's x extents (it sees the same x span mirrored)
            x0 = (1 - back_w) * x0 + back_w * sb.min(); x1 = (1 - back_w) * x1 + back_w * sb.max()
        cx, cz, rx, rz = (x0 + x1) / 2, (z0 + z1) / 2, max((x1 - x0) / 2, 0.2), max((z1 - z0) / 2, 0.2)
        q = (np.abs(X - cx) / rx) ** pexp + (np.abs(Z - cz) / rz) ** pexp
        inside = q ** (1.0 / pexp) <= RHO
        H = np.where(inside, lev, H)
    H = ndi.gaussian_filter(np.maximum(H, 0), 0.6)
    H = np.where(H > 0.05, H, -sink_m)
    meta = dict(pxm=float(pxm), tpx=float(tpx), base_row=base_row, top_row=top_row, half_w=float(half_w), grid_m=grid_m,
                n=int(2 * n + 1), height_m=height_m, plate_cx={k: prof[k]["cx"] for k in prof}, top_c=[float(tcx), float(tcy)], pexp=pexp, wobble_min=wobble_min, back_w=back_w,
                sink_m=sink_m)
    return H.astype(np.float32), ax, meta, prof, M

def iou_views(H, ax, meta, prof, M):
    """silhouette gate: re-project the hull outline into each plate and compare with the plate outline
    (plate profile column-filled down to the base row, the same outline the hull was cut from)."""
    out = {}
    pxm = meta["pxm"]; base = meta["base_row"]
    for k, sil, sgn in (("front", H.max(0), 1), ("back", H.max(0), -1), ("side", H.max(1), 1)):
        W = M[k].shape[1]
        cols = np.arange(W); u = sgn * (cols - prof[k]["cx"]) / pxm
        hs = np.interp(u, ax, sil, left=0, right=0)
        hp = prof[k]["h"] * ((cols >= prof[k]["c0"]) & (cols <= prof[k]["c1"]))
        a = np.clip(hs, 0, None); b = np.clip(hp, 0, None)
        out[k] = float(np.minimum(a, b).sum() / max(1e-6, np.maximum(a, b).sum()))
    return out

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("--plates", required=True); ap.add_argument("--height", type=float, default=45)
    ap.add_argument("--out", required=True); a = ap.parse_args()
    plates = json.load(open(a.plates))
    H, ax, meta, prof, M = build(plates, a.height)
    meta["iou"] = iou_views(H, ax, meta, prof, M)
    np.save(a.out + "-H.npy", H); json.dump(meta, open(a.out + "-meta.json", "w"), indent=1)
    v = (np.clip(H, 0, None) / H.max() * 255).astype(np.uint8); Image.fromarray(v).save(a.out + "-H.png")
    print(json.dumps(meta, indent=1))
