"""Per-region no-grey gate (tools/13).

The old row only counted pixels equal to flat 128 over the whole subject, so a
plinth rendered as flat (72,75,80) passed at 0.006. This gate looks per region:

1. Flat-grey pixels: low saturation (max-min <= SAT_MAX), local texture std over a
   5x5 window <= STD_MAX, on the subject (luma > BG_LUMA).
2. Regions:
   - material / UV-island ids, when an id buffer (.npy, int, same HxW) is given;
   - connected components of flat-grey pixels;
   - a GRID x GRID screen-space grid.
   A region FAILS if its flat-grey area >= REGION_MIN of the subject's on-screen area
   (and, for ids/grid, it is at least FLAT_FRAC flat-grey).
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SAT_MAX = 12
STD_MAX = 2.5
BG_LUMA = 6
REGION_MIN = 0.01
FLAT_FRAC = 0.6
GRID = 16


def flat_grey_mask(rgb):
    a = rgb.astype(np.float32)
    luma = a.mean(2)
    subj = ndi.binary_erosion(luma > BG_LUMA, iterations=1) | (luma > BG_LUMA)
    sat = a.max(2) - a.min(2)
    m = ndi.uniform_filter(luma, 5)
    sd = np.sqrt(np.maximum(ndi.uniform_filter(luma * luma, 5) - m * m, 0))
    flat = subj & (sat <= SAT_MAX) & (sd <= STD_MAX) & (luma > 20)
    return subj, flat


def check(img_path, ids_path=None):
    rgb = np.asarray(Image.open(img_path).convert("RGB"))
    subj, flat = flat_grey_mask(rgb)
    S = int(subj.sum()) or 1
    bad = []
    lab, n = ndi.label(flat)
    if n:
        sizes = ndi.sum(flat, lab, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s / S >= REGION_MIN:
                ys, xs = np.nonzero(lab == i)
                c = rgb[ys, xs].mean(0).round(1).tolist()
                bad.append(dict(kind="component", frac=round(s / S, 4), bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], meanRgb=c))
    H, W = flat.shape
    for gy in range(GRID):
        for gx in range(GRID):
            sl = (slice(gy * H // GRID, (gy + 1) * H // GRID), slice(gx * W // GRID, (gx + 1) * W // GRID))
            cs, cf = subj[sl].sum(), flat[sl].sum()
            if cs and cf / S >= REGION_MIN and cf / cs >= FLAT_FRAC:
                bad.append(dict(kind="grid", cell=[gx, gy], frac=round(cf / S, 4), flatInCell=round(cf / cs, 3)))
    if ids_path:
        ids = np.load(ids_path)
        for v in np.unique(ids[subj]):
            r = subj & (ids == v)
            rs, rf = r.sum(), (flat & r).sum()
            if rs / S >= REGION_MIN and rf / rs >= FLAT_FRAC:
                bad.append(dict(kind="id", id=int(v), frac=round(rs / S, 4), flatInRegion=round(rf / rs, 3)))
    worst = max([b["frac"] for b in bad], default=0.0)
    return dict(image=img_path, subjectPx=S, flatGreyFrac=round(float(flat.sum()) / S, 4),
                worstRegionFrac=worst, regionMin=REGION_MIN, failingRegions=bad[:40],
                nFailing=len(bad), pass_=not bad)


def main(argv):
    res = [check(p) for p in argv]
    out = dict(tool="no-grey-regions", views=res, pass_=all(r["pass_"] for r in res))
    s = json.dumps(out, indent=1).replace('"pass_"', '"pass"')
    print(s)
    return 0 if out["pass_"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
