#!/usr/bin/env python3
"""tools/kit appearance judge (CPU, licence-clean). Compares the render from the solved key camera with the
key image inside the target mask and scores 0..100:
  colour      mean CIEDE2000 dE in the mask (scikit-image, BSD)      -> 100 * (1 - dE / 40)
  structure   SSIM on CIELAB L, averaged over the mask (scikit-image) -> 100 * max(SSIM, 0)
  perceptual  DINOv2 ViT-S/14 masked patch-token cosine (Apache-2.0) -> 100 * (cos - 0.3) / 0.7
              fallback without torch: HOG cosine (scikit-image)
  total = 0.35 colour + 0.30 structure + 0.35 perceptual.  Gate: total >= --gate (default 50; calibration: key vs itself 100, key blurred sigma 4 px 57.3, flat grey 17.9).
usage: judge.py RENDER.png KEY.jpg MASK.png [--gate 50] [--out judge.json] [--venv /workspace/.venv-sam2/bin/python]"""
import argparse, json, subprocess, sys
from pathlib import Path
import cv2, numpy as np
from skimage.color import deltaE_ciede2000, rgb2lab
from skimage.metrics import structural_similarity

HERE = Path(__file__).resolve().parent


def load(p, shape=None):
    im = cv2.imread(str(p))[:, :, ::-1]
    if shape is not None and im.shape[:2] != shape:
        im = cv2.resize(im, shape[::-1], interpolation=cv2.INTER_AREA)
    return im


def score(render, key, mask, venv=None):
    M = cv2.imread(str(mask), 0) > 127
    K = load(key, M.shape); R = load(render, M.shape)
    lk, lr = rgb2lab(K / 255.0), rgb2lab(R / 255.0)
    de = float(deltaE_ciede2000(lk, lr)[M].mean())
    _, smap = structural_similarity(lk[..., 0], lr[..., 0], data_range=100, full=True, win_size=7)
    ss = float(smap[M].mean())
    per, how = None, None
    if venv and Path(venv).exists():
        try:
            out = subprocess.run([venv, str(HERE / "judge_dino.py"), str(render), str(key), str(mask)], capture_output=True, text=True, timeout=600)
            d = json.loads(out.stdout.strip().splitlines()[-1])
            per, how = d["patch_cos"], {"model": "dinov2_vits14 (Apache-2.0)", **d}
        except Exception as e:  # fall back below
            how = {"dino_error": str(e)[:200]}
    if per is None:
        from skimage.feature import hog
        ys, xs = np.nonzero(M)
        crop = lambda I: cv2.resize(cv2.cvtColor(I[ys.min():ys.max() + 1, xs.min():xs.max() + 1], cv2.COLOR_RGB2GRAY), (256, 128))
        ha, hb = hog(crop(K), pixels_per_cell=(8, 8)), hog(crop(R), pixels_per_cell=(8, 8))
        per = float(ha @ hb / (np.linalg.norm(ha) * np.linalg.norm(hb) + 1e-9))
        how = {**(how or {}), "model": "HOG cosine fallback (scikit-image)"}
    c = 100 * float(np.clip(1 - de / 40, 0, 1))
    s = 100 * max(ss, 0.0)
    p = 100 * float(np.clip((per - 0.3) / 0.7, 0, 1))
    return {"dE2000_mean": round(de, 2), "ssim_L_mask": round(ss, 4), "perceptual_cos": round(per, 4), "perceptual": how,
            "scores": {"colour": round(c, 1), "structure": round(s, 1), "perceptual": round(p, 1)},
            "total": round(0.35 * c + 0.30 * s + 0.35 * p, 1)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("render"); ap.add_argument("key"); ap.add_argument("mask")
    ap.add_argument("--gate", type=float, default=50.0)
    ap.add_argument("--out"); ap.add_argument("--venv", default="/workspace/.venv-sam2/bin/python")
    a = ap.parse_args()
    r = score(a.render, a.key, a.mask, a.venv)
    r["gate"] = a.gate; r["verdict"] = "PASS" if r["total"] >= a.gate else "FAIL"
    if a.out:
        Path(a.out).write_text(json.dumps(r, indent=1))
    print(json.dumps(r, indent=1))
    sys.exit(0 if r["verdict"] == "PASS" else 1)
