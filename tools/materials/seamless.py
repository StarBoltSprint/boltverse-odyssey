#!/usr/bin/env python3
"""Make an Imagine swatch tileable and gate it. usage: seamless.py IN.jpg OUT.jpg [--axis xy|x] [--key-crop KEY.jpg] [--tile-m M]
Seamless: half-offset copy cross-faded ONLY in a narrow border band (weight 0 at the original's own edges), so the
wrap seam lands inside the copy's interior and the interior keeps the original (no ghosting, no mirror).
Gates printed as JSON: seam (mean |edge diff| of the wrap vs interior neighbour diff), repeat (max off-origin
autocorrelation of a 2x2 tiling within the tile, lower = less visible repetition), px_per_m (tile px / tile m),
dE76 of the mean Lab vs the key crop (colour gate)."""
import argparse, json
import cv2, numpy as np


def seamless(im, axis="xy"):
    h, w = im.shape[:2]
    sh = np.roll(im, (h // 2 if "y" in axis else 0, w // 2), (0, 1)).astype(np.float32)
    y = np.linspace(-1, 1, h)[:, None]; x = np.linspace(-1, 1, w)[None, :]
    band = 0.18   # cross-fade only in the outer 11 % on each side: the shifted copy never ghosts over the interior
    wx = np.clip((1 - np.abs(x)) / band, 0, 1); wy = np.clip((1 - np.abs(y)) / band, 0, 1) if "y" in axis else np.ones_like(y)
    wgt = (wx * wy)[..., None]; wgt = wgt * wgt * (3 - 2 * wgt)
    return (im.astype(np.float32) * wgt + sh * (1 - wgt)).clip(0, 255).astype(np.uint8)


def gates(im, tile_m, key=None, axis="xy"):
    g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
    inner = np.abs(np.diff(g, axis=1)).mean()
    seam_x = np.abs(g[:, 0] - g[:, -1]).mean() / inner
    seam_y = np.abs(g[0] - g[-1]).mean() / np.abs(np.diff(g, axis=0)).mean() if "y" in axis else 1.0
    s = cv2.resize(g, (256, 256)); s = s - cv2.GaussianBlur(s, (0, 0), 6)          # high-pass: repeated MOTIFS, not low-freq shading
    F = np.fft.fft2(s); ac = np.real(np.fft.ifft2(F * np.conj(F))); ac /= ac[0, 0]
    r = 12; ac[:r, :r] = ac[-r:, -r:] = ac[:r, -r:] = ac[-r:, :r] = 0
    out = {"seam_x": round(float(seam_x), 2), "seam_y": round(float(seam_y), 2), "self_similarity": round(float(ac.max()), 3),
           "px_per_m": round(im.shape[1] / tile_m, 1)}
    if key is not None:
        from skimage.color import rgb2lab
        a = rgb2lab(im[:, :, ::-1] / 255.0).reshape(-1, 3).mean(0); b = rgb2lab(key[:, :, ::-1] / 255.0).reshape(-1, 3).mean(0)
        out["dE76_vs_key"] = round(float(np.linalg.norm(a - b)), 1)
        out["dEab_chroma_vs_key"] = round(float(np.linalg.norm(a[1:] - b[1:])), 1)        # hue/chroma gate; L is matched by the shader gain
        out["L_gain_to_key"] = round(float(((b[0] + 16) / 116) ** 3 / ((a[0] + 16) / 116) ** 3), 3)
        out["lab"] = [round(float(v), 1) for v in a]; out["key_lab"] = [round(float(v), 1) for v in b]
    out["pass"] = bool(out["seam_x"] <= 1.5 and out["seam_y"] <= 1.5 and out["self_similarity"] < 0.5 and out["px_per_m"] >= 500
                       and out.get("dEab_chroma_vs_key", 0) <= 15)
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("inp"); ap.add_argument("out"); ap.add_argument("--axis", default="xy")
    ap.add_argument("--key-crop"); ap.add_argument("--tile-m", type=float, default=1.9); ap.add_argument("--crop", nargs=4, type=int)
    a = ap.parse_args()
    im = cv2.imread(a.inp)
    if a.crop:
        x0, y0, x1, y1 = a.crop; im = im[y0:y1, x0:x1]
    before = gates(im, a.tile_m, axis=a.axis)
    o = seamless(im, a.axis); cv2.imwrite(a.out, o, [cv2.IMWRITE_JPEG_QUALITY, 90])
    k = cv2.imread(a.key_crop) if a.key_crop else None
    print(json.dumps({"in": a.inp, "out": a.out, "before": before, "after": gates(o, a.tile_m, k, a.axis)}))
