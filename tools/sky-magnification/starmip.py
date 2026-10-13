#!/usr/bin/env python3
"""Star-preserving mip 1 + on-screen star check under trilinear sampling."""
import argparse, json, math, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

def lum(a): return a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722

def star_mask(a, k=2.5):
    L = lum(a); th = L - nd.grey_opening(L, size=5)          # top-hat
    t = max(0.03, float(np.median(th) + k * 1.4826 * np.median(np.abs(th - np.median(th)))))
    return th > t, th

def mip1_box(a):
    h, w = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
    return a[:h, :w].reshape(h // 2, 2, w // 2, 2, -1).mean((1, 3))

def mip1_star(a):
    h, w = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
    b = a[:h, :w].reshape(h // 2, 2, w // 2, 2, -1)
    m = star_mask(a)[0][:h, :w].reshape(h // 2, 2, w // 2, 2).any((1, 3))
    return np.where(m[..., None], b.max((1, 3)), b.mean((1, 3)))

def bilinear(img, u, v):  # u,v in texel coords of img (texel centres at i+0.5)
    x = np.clip(u - 0.5, 0, img.shape[1] - 1.001); y = np.clip(v - 0.5, 0, img.shape[0] - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int); fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    g = lambda yy, xx: img[yy, xx]
    return (g(y0, x0) * (1 - fx) * (1 - fy) + g(y0, x0 + 1) * fx * (1 - fy)
            + g(y0 + 1, x0) * (1 - fx) * fy + g(y0 + 1, x0 + 1) * fx * fy)

def render(base, mip1, mag, region, phase=0.25):
    """Screen pixels over base-texel region (x0,y0,x1,y1) at magnification mag; trilinear base<->mip1."""
    x0, y0, x1, y1 = region; step = 1.0 / mag
    lod = max(0.0, math.log2(step)); fr = min(1.0, lod)
    us = np.arange(x0 + phase, x1, step); vs = np.arange(y0 + phase, y1, step)
    U, V = np.meshgrid(us, vs)
    s0 = bilinear(base, U, V)
    if mip1 is None or fr == 0: return s0, lod, U, V
    return s0 * (1 - fr) + bilinear(mip1, U / 2, V / 2) * fr, lod, U, V

def star_check(base, mip1, mag, region, max_px=2.0, min_ratio=0.85, phase=0.25):
    m, th = star_mask(base); L = lum(base)
    x0, y0, x1, y1 = region
    lab, n = nd.label(m[y0:y1, x0:x1])
    peaks = nd.maximum_position(L[y0:y1, x0:x1], lab, range(1, n + 1))
    bg = float(np.median(L[y0:y1, x0:x1][~nd.binary_dilation(m[y0:y1, x0:x1], iterations=2)]))
    scr, lod, U, V = render(base, mip1, mag, region, phase); S = lum(scr)
    sbg = float(np.median(S)); ratios, sizes = [], []
    for (py, px) in peaks:
        bp = L[y0 + py, x0 + px] - bg
        if bp < 0.08: continue
        sx = (x0 + px + 0.5 - U[0, 0]) * mag; sy = (y0 + py + 0.5 - V[0, 0]) * mag
        ix, iy = int(round(sx)), int(round(sy))
        if not (3 <= ix < S.shape[1] - 3 and 3 <= iy < S.shape[0] - 3): continue
        win = S[iy - 3:iy + 4, ix - 3:ix + 4] - sbg; pk = float(win.max())
        ratios.append(pk / bp)
        # FWHM-equivalent diameter of the connected blob above half peak
        bl, _ = nd.label(win > pk / 2); c = np.unravel_index(win.argmax(), win.shape)
        sizes.append(2 * math.sqrt((bl == bl[c]).sum() / math.pi))
    mr, ms = float(np.median(ratios)), float(np.median(sizes))
    ok = mr >= min_ratio and ms <= max_px
    return dict(verdict="PASS" if ok else "FAIL", mag=mag, lod=round(lod, 4), lod_frac=round(min(1, lod), 4),
                n_stars=len(ratios), median_peak_ratio=round(mr, 4), p10_peak_ratio=round(float(np.percentile(ratios, 10)), 4),
                median_size_px=round(ms, 3), p90_size_px=round(float(np.percentile(sizes, 90)), 3),
                bg_mean_base=round(float(L[y0:y1, x0:x1].mean()), 4), bg_mean_screen=round(float(S.mean()), 4),
                bg_median_base=round(bg, 4), bg_median_screen=round(sbg, 4),
                limits=dict(median_peak_ratio_min=min_ratio, median_size_px_max=max_px)), scr

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--plate', default='/workspace/zd-bible-1012/zd-plates/sky12/zd-sky12-S00-final5.jpg')
    ap.add_argument('--mag', type=float, default=0.7359)
    ap.add_argument('--region', default='0,420,1280,715', help='base texels x0,y0,x1,y1 (above the horizon)')
    ap.add_argument('--out', default='out')
    a = ap.parse_args(argv)
    base = np.asarray(Image.open(a.plate).convert('RGB'), np.float32) / 255
    reg = tuple(int(v) for v in a.region.split(','))
    rep = dict(gate="sky-star-mip1", plate=a.plate, region_texels=reg, methods={})
    for name, mip in (("base-only", None), ("box", mip1_box(base)), ("star-preserving", mip1_star(base))):
        r, scr = star_check(base, mip, a.mag, reg); rep['methods'][name] = r
        if mip is not None:
            p = f"{a.out}/S00-0736x-{name}.jpg"
            Image.fromarray((np.clip(scr, 0, 1) * 255).astype(np.uint8)).save(p, quality=88); r['crop'] = p
    json.dump(rep, open(f"{a.out}/zd-sky-star-mip1.json", 'w'), indent=1)
    for k, v in rep['methods'].items():
        print(k, v['verdict'], 'peak', v['median_peak_ratio'], 'size', v['median_size_px'], 'bg', v['bg_mean_screen'], 'n', v['n_stars'])
    return 0 if rep['methods']['star-preserving']['verdict'] == 'PASS' else 1

if __name__ == '__main__': sys.exit(main())
