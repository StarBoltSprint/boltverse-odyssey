"""Relief maps (metres-agnostic, -1..1) from the Imagine plates: band-pass luminance, dark = recess."""
import json, sys, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from masks import load
def relief(img):
    lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
    band = ndi.gaussian_filter(lum, 1.5) - ndi.gaussian_filter(lum, 14)
    big = ndi.gaussian_filter(lum, 4) - ndi.gaussian_filter(lum, 40)     # strata bands / undercuts
    r = 0.6 * band / 0.08 + 0.4 * big / 0.12
    return np.clip(r, -1, 1).astype(np.float32)
if __name__ == "__main__":
    plates = json.load(open(sys.argv[1])); out = sys.argv[2]
    for k, p in plates.items():
        np.save(f"{out}-relief-{k}.npy", relief(load(p)))
    print("ok")
