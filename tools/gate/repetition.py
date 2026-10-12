"""Cornice-underside repetition gate.

High-passed (sigma 4 px) normalised autocorrelation. A tiled texture shows a
secondary peak > 0.5 more than 12 px from the centre. Do not loosen either number.
"""
import json
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SIGMA = 4
MIN_RADIUS_PX = 12
PEAK_MAX = 0.5


def secondary_peak(P, M, sigma=SIGMA, min_r=MIN_RADIUS_PX):
    P = np.asarray(P, np.float32)
    M = np.asarray(M, bool)
    Q = np.where(M, P - ndi.gaussian_filter(P, sigma), 0)
    Fq = np.fft.fft2(Q, s=(2 * Q.shape[0], 2 * Q.shape[1]))
    ac = np.fft.fftshift(np.real(np.fft.ifft2(Fq * np.conj(Fq))))
    cy, cx = np.array(ac.shape) // 2
    ac = ac / ac[cy, cx]
    W = np.fft.fftshift(np.real(np.fft.ifft2(np.abs(np.fft.fft2(M.astype(float), s=ac.shape)) ** 2)))
    W = W / W[cy, cx]
    ac = np.where(W > 0.25, ac / np.maximum(W, 1e-6), 0)
    yy, xx = np.mgrid[:ac.shape[0], :ac.shape[1]]
    return float(ac[np.hypot(yy - cy, xx - cx) > min_r].max())


def judge(peak, threshold=PEAK_MAX):
    return {
        "secondaryPeak": round(float(peak), 3),
        "threshold": threshold,
        "minRadiusPx": MIN_RADIUS_PX,
        "pass": bool(peak <= threshold),
    }


def from_image(path):
    im = np.asarray(Image.open(path).convert("L"), np.float32)
    return judge(secondary_peak(im, np.ones(im.shape, bool)))


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if not a or a[0] in ("-h", "--help"):
        print("usage: repetition <image.png> [--out j]", file=sys.stderr)
        return 2
    r = from_image(a[0])
    if "--out" in a:
        json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
    print(json.dumps(r))
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
