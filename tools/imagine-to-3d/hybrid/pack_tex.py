#!/usr/bin/env python3
"""Delight the accepted flank plates and pack linear luma + half-res chroma.

RGBA of the three native plates plus mips would pass 16 MiB. Chroma-subsample
keeps every native luma pixel (no resample of the subject).
"""
import os, shutil
import numpy as np
from PIL import Image, ImageFilter

SRC = "/workspace/zb-tower-hybrid-1010/imagine/out"
OUT = "/workspace/zb-tower-hybrid-1010/tex"
MESH = "/workspace/zb-tower-hybrid-1010/mesh"
os.makedirs(OUT, exist_ok=True)

# named copies
for a, b in (("view-4.jpg", "left.jpg"), ("view-6.jpg", "right.jpg"), ("view-5.jpg", "back.jpg"), ("view-3.jpg", "top.jpg")):
    shutil.copy(os.path.join(SRC, a), os.path.join(SRC, b))


def delight_u8(rgb):
    r = rgb.astype(np.float32) / 255.0
    luma = 0.2126 * r[..., 0] + 0.7152 * r[..., 1] + 0.0722 * r[..., 2]
    im = Image.fromarray(np.clip(luma * 255, 0, 255).astype(np.uint8))
    sigma = max(im.size) / 7.0
    Ls = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma)), np.float32) / 255.0
    Ls = np.clip(Ls, 0.08, 0.85)
    out = np.clip(r * ((0.40 / Ls) ** 0.55)[..., None], 0, 1)
    return out


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


def pack(name, path):
    rgb = np.asarray(Image.open(path).convert("RGB"))
    lin = srgb_to_lin(delight_u8(rgb))
    Y = 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2]
    Cb = np.clip((lin[..., 2] - Y) / 1.8556 + 0.5, 0, 1)
    Cr = np.clip((lin[..., 0] - Y) / 1.5748 + 0.5, 0, 1)
    h, w = Y.shape
    ch = np.stack([Cb, Cr], -1)
    # box downsample chroma, native luma
    ch_s = ch.reshape(h // 2, 2, w // 2, 2, 2).mean(axis=(1, 3))
    Y.astype(np.float32).tofile(os.path.join(OUT, f"{name}-y.f32"))  # not used
    np.clip(Y * 255, 0, 255).astype(np.uint8).tofile(os.path.join(OUT, f"{name}-y.bin"))
    np.clip(ch_s * 255, 0, 255).astype(np.uint8).tofile(os.path.join(OUT, f"{name}-c.bin"))
    # GPU: R8 full + RG8 half, plus mip chain ~1.33
    gpu = (w * h + (w // 2) * (h // 2) * 2) * 1.333
    print(name, w, h, "gpu MiB", round(gpu / 1048576, 2))
    return dict(w=w, h=h, gpu=gpu)


meta = {}
for name in ("left", "right", "back"):
    meta[name] = pack(name, os.path.join(SRC, f"{name}.jpg"))
# sand from the delighted key, lowest masked rows
alb = np.asarray(Image.open(os.path.join(MESH, "albedo-key.png")).convert("RGBA"))
m = alb[..., 3] > 128
ys = np.nonzero(m.any(1))[0]
band = alb[ys[-12]:, :, :3][m[ys[-12]:]]
sand = (band.astype(np.float32) / 255.0).mean(0)
meta["sand"] = [round(float(x), 4) for x in sand]
# key atlas RGBA is small
ka = Image.open(os.path.join(MESH, "albedo-key.png"))
meta["key"] = dict(w=ka.size[0], h=ka.size[1], gpu=ka.size[0] * ka.size[1] * 4 * 1.333)
meta["detail"] = dict(w=1024, h=1024, gpu=1024 * 1024 * 1.333, note="R8 if uploaded once")
total = sum(v["gpu"] for v in meta.values() if isinstance(v, dict) and "gpu" in v)
print("sum bytes", round(total / 1048576, 2), "MiB (detail counted)")
import json
json.dump(meta, open(os.path.join(OUT, "pack.json"), "w"), indent=1)
