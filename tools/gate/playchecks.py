"""tools/13 play-build gate, blocking checks on the SERVED page (room 2026-10-13):
oblique (real mesh depth vs apparent relief, >= 70 %), texel (>= 150 texels/m within 8 m of the CAMERA),
framing (capsule <= 15 % of frame, lower third, door ROI not occluded), materials (every map present, no magenta/fallback)."""
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

_HP = {}


def apparent_map(path):
    if path not in _HP:
        d = np.load(path).astype(np.float32)
        _HP[path] = np.clip(d - ndi.gaussian_filter(d, 12), -0.6, 0.6)
    return _HP[path]


def oblique(hits, cfg):
    """hits: [i, j, mat, u, v, x, y, z, nx, ny, nz, dist]. Per plate tile: apparent = p95-p5 of MoGe high-pass depth
    under the tile's texels; real = p95-p5 of the hit points' residual from their best plane."""
    T = cfg["tile_px"]; K = cfg["min_real_over_apparent"]; A0 = cfg["min_apparent_m"]
    tiles = {}
    for h in hits:
        mat = h[2]; src = "front" if mat == "front" else "side" if mat == "side" else None
        if not src: continue
        px, py = min(1023, int(h[3] * 1024)), min(1023, int(h[4] * 1024))
        tiles.setdefault((src, px // T, py // T), []).append((px, py, h[5], h[6], h[7]))
    regs = []
    for (src, tx, ty), L in tiles.items():
        if len(L) < 12: continue
        a = np.array([l[2:] for l in L]); hp = apparent_map(cfg["depth"][src])
        app = np.array([hp[l[1], l[0]] for l in L]); apparent = float(np.percentile(app, 95) - np.percentile(app, 5))
        c = a.mean(0); _, _, vt = np.linalg.svd(a - c, full_matrices=False); res = (a - c) @ vt[2]
        real = float(np.percentile(res, 95) - np.percentile(res, 5))
        if apparent < A0: continue
        regs.append(dict(plate=src, tile=[tx * T, ty * T], n=len(L), apparent_m=round(apparent, 3), real_m=round(real, 4), ratio=round(real / apparent, 3), pass_=real >= K * apparent))
    bad = [r for r in regs if not r["pass_"]]
    return dict(regions=len(regs), failing=len(bad), worst=sorted(bad, key=lambda r: r["ratio"])[:5],
                medianRatio=round(float(np.median([r["ratio"] for r in regs])), 3) if regs else None, pass_=bool(regs) and not bad,
                note=None if regs else "no front/side relief tile in view")


def texel(samples, cfg):
    near = [s for s in samples if s["dist"] <= cfg["near_m"]]
    bad = [s for s in near if s["texelsPerMetre"] < cfg["min_texels_per_m"]]
    by = {}
    for s in samples: by.setdefault(s["mat"], []).append(s["texelsPerMetre"])
    return dict(nearSamples=len(near), failing=len(bad), texelsPerMetreByMat={k: round(float(np.median(v)), 1) for k, v in by.items()},
                minNear=round(min([s["texelsPerMetre"] for s in near]), 1) if near else None,
                maxMipNear=max([s["mip"] for s in near]) if near else None, pass_=not bad)


def framing(f, cfg):
    errs = []
    if f["capsuleFrac"] > cfg["capsule_max_frac"]: errs.append(f"capsule {f['capsuleFrac']:.1%} of frame > {cfg['capsule_max_frac']:.0%}")
    if f["capsuleCentroidY"] is not None and f["capsuleCentroidY"] < cfg["centroid_min_y"]: errs.append(f"capsule centroid at {f['capsuleCentroidY']:.2f} of height, above the lower third")
    if f["doorOccluded"] is not None and f["doorOccluded"] > cfg["door_occlusion_max"]: errs.append(f"capsule covers {f['doorOccluded']:.0%} of the door ROI")
    return dict(f, errors=errs, pass_=not errs)


def materials(mats, exempt, png):
    errs = sorted({f"material '{m['mat']}' on '{m['node']}' has no map (untextured)" for m in mats if not m["hasMap"] and m["node"] not in exempt})
    errs += sorted({f"material '{m['mat']}' map has {m['magentaFrac']:.1%} magenta texels" for m in mats if (m["magentaFrac"] or 0) > 0.001})
    a = np.asarray(Image.open(png).convert("RGB")).astype(int)
    mag = float(((a[..., 0] > 200) & (a[..., 1] < 60) & (a[..., 2] > 200)).mean())
    if mag > 0.0005: errs.append(f"{mag:.2%} magenta pixels on screen (texture fallback)")
    return dict(errors=errs, screenMagenta=round(mag, 5), pass_=not errs)
