"""FLAT-REGION gate (tools/13). Any connected screen region >= REGION_MIN of the frame whose local texture is ~0 fails,
WHATEVER its colour or luma (nogrey only sees low-saturation pixels with luma > 20, so light/bluish snow, flat sky fills
and dark fills slip through it).
Local texture = per-channel std over a WIN x WIN window of the image pre-blurred 3x3 (the pre-blur removes the page's
+-0.5 LSB blue-noise dither, so a dithered flat fill still reads flat), max over RGB. Flat = std <= STD_MAX.
Regions: connected components of flat pixels (8-connected after a 1 px close) + a GRID x GRID cell check.
python3 -m tools.gate.flatregion img.png [mask.jpg]"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

STD_MAX = 0.4
WIN = 9
REGION_MIN = 0.01
GRID = 12
CELL_FLAT = 0.85


def flat_mask(rgb):
    a = ndi.uniform_filter(rgb.astype(np.float32), (3, 3, 1))
    sd = np.zeros(a.shape[:2], np.float32)
    for c in range(3):
        m = ndi.uniform_filter(a[..., c], WIN)
        sd = np.maximum(sd, np.sqrt(np.maximum(ndi.uniform_filter(a[..., c] ** 2, WIN) - m * m, 0)))
    return sd <= STD_MAX, sd


def check(img_path, mask_out=None):
    rgb = np.asarray(Image.open(img_path).convert("RGB"))
    flat, sd = flat_mask(rgb)
    flat = ndi.binary_closing(flat, iterations=1)
    H, W = flat.shape; N = H * W
    bad = []
    lab, n = ndi.label(flat, structure=np.ones((3, 3)))
    if n:
        sizes = ndi.sum(flat, lab, range(1, n + 1))
        for i, s in enumerate(sizes, 1):
            if s / N >= REGION_MIN:
                ys, xs = np.nonzero(lab == i)
                bad.append(dict(kind="component", frac=round(float(s / N), 4), bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
                                meanRgb=rgb[ys, xs].mean(0).round(1).tolist(), yBand=[round(ys.min() / H, 2), round(ys.max() / H, 2)]))
    cells = []
    for gy in range(GRID):
        for gx in range(GRID):
            c = flat[gy * H // GRID:(gy + 1) * H // GRID, gx * W // GRID:(gx + 1) * W // GRID]
            if c.mean() >= CELL_FLAT: cells.append([gx, gy])
    if mask_out:
        o = rgb.copy(); o[flat] = (0.45 * o[flat] + [140, 0, 140]).clip(0, 255).astype(np.uint8)
        Image.fromarray(o).save(mask_out, quality=88)
    bad.sort(key=lambda b: -b["frac"])
    return dict(pass_=not bad, flatFrac=round(float(flat.mean()), 4), worst=bad[0]["frac"] if bad else 0.0, regions=bad[:8], flatCells=len(cells),
                params=dict(STD_MAX=STD_MAX, WIN=WIN, REGION_MIN=REGION_MIN))


if __name__ == "__main__":
    r = check(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(json.dumps(r).replace('"pass_"', '"pass"')); sys.exit(0 if r["pass_"] else 1)
