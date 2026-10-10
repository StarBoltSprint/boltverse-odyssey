"""Rock masks + top profiles from Imagine view plates (flat sky + flat ground background)."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(np.float32) / 255.0

def rock_mask(img, sky_rows=40, ground_rows=40):
    """rock = textured or not-sky/not-flat-sand. Returns bool mask."""
    lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
    mu = ndi.uniform_filter(lum, 7); var = ndi.uniform_filter(lum * lum, 7) - mu * mu
    sd = np.sqrt(np.maximum(var, 0))
    sky = np.median(img[:sky_rows].reshape(-1, 3), 0)
    dsky = np.linalg.norm(img - sky, axis=2)
    # sand: hue orange, smooth. rock: textured (sd high) or dark crevices
    textured = ndi.uniform_filter((sd > 0.035).astype(np.float32), 9) > 0.35
    dark = lum < 0.33
    m = (textured | dark) & (dsky > 0.06)
    m = ndi.binary_closing(m, iterations=4)
    m = ndi.binary_opening(m, iterations=2)
    m = ndi.binary_fill_holes(m)
    lab, n = ndi.label(m)
    if n:
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = np.argsort(sizes)[::-1][:1] + 1
        m = np.isin(lab, keep)
    return m

def object_mask(img, sky_rows=40):
    """everything that is not sky (rock + sand mound), above the flat ground band."""
    sky = np.median(img[:sky_rows].reshape(-1, 3), 0)
    dsky = np.linalg.norm(img - sky, axis=2)
    return ndi.binary_opening(dsky > 0.07, iterations=2)

def top_profile(mask):
    """per column: row of the topmost mask pixel (or -1)."""
    H, W = mask.shape
    any_ = mask.any(0)
    top = np.where(any_, mask.argmax(0), -1)
    return top

if __name__ == "__main__":
    import sys, json
    out = {}
    for p in sys.argv[1:]:
        img = load(p); r = rock_mask(img); o = object_mask(img)
        ys, xs = np.nonzero(r)
        out[p] = dict(size=img.shape[:2], rock_bbox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], rock_px=int(r.sum()))
        vis = (img * 255).astype(np.uint8).copy(); vis[r] = (vis[r] * 0.4 + np.array([0, 255, 0]) * 0.6).astype(np.uint8)
        vis[o & ~r] = (vis[o & ~r] * 0.6 + np.array([0, 0, 255]) * 0.4).astype(np.uint8)
        Image.fromarray(vis).save(p.rsplit('/', 1)[-1].replace('.jpg', '-mask.jpg'))
    print(json.dumps(out, indent=1))
