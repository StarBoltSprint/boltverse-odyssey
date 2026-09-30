#!/usr/bin/env python3
"""Bake relief depth for law 60. Near = white.

Numbers are the ones in biome/docs/60-imagine-relief-panorama-method.md.
A full-width ONNX pass of the 3916 panorama OOMs, so the color is cut into
1280-wide tiles with a 320 px overlap and a cosine blend.

The plate window is then replaced by the already-QC'd plate depth. Only the
sides are softened (gaussian σ=6, ×0.42), with a 96 px feather outside the plate.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
TILE_W = 1280
OVERLAP = 320
INFER_H = 700
PLATE_X = 1355
PLATE_W = 1280
FEATHER = 96


def gaussian(img: np.ndarray, sigma: float) -> np.ndarray:
    sigma = float(sigma)
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-0.5 * (x / np.float32(sigma)) ** 2)
    k /= k.sum()

    def conv_h(a: np.ndarray) -> np.ndarray:
        pad = np.pad(a, ((0, 0), (r, r)), mode="reflect")
        n = pad.shape[1] + k.shape[0] - 1
        fa = np.fft.rfft(pad, n=n, axis=1)
        fk = np.fft.rfft(k, n=n)
        out = np.fft.irfft(fa * fk, n=n, axis=1)
        return out[:, r : r + a.shape[1]].astype(np.float32)

    return conv_h(conv_h(img).T).T


def smoothstep(e0: float, e1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def tile_starts(width: int) -> list[int]:
    if width <= TILE_W:
        return [0]
    starts = list(range(0, width - TILE_W + 1, TILE_W - OVERLAP))
    last = width - TILE_W
    if starts[-1] != last:
        starts.append(last)
    return starts


def infer_tile(sess, rgb: np.ndarray) -> np.ndarray:
    im = Image.fromarray(rgb).resize((TILE_W, INFER_H), Image.Resampling.LANCZOS)
    arr = np.asarray(im).astype(np.float32) / 255
    arr = (arr - MEAN) / STD
    ten = np.transpose(arr, (2, 0, 1))[None].astype(np.float32)
    pred = sess.run(None, {"pixel_values": ten})[0][0].astype(np.float32)
    d = pred - pred.min()
    d = d / (d.max() + 1e-8)
    u8 = Image.fromarray((d * 255).astype(np.uint8), "L").resize(
        (rgb.shape[1], rgb.shape[0]), Image.Resampling.BILINEAR
    )
    return np.asarray(u8).astype(np.float32) / 255


def blend_tiles(sess, rgb: np.ndarray) -> np.ndarray:
    h, w = rgb.shape[:2]
    acc = np.zeros((h, w), np.float32)
    wt = np.zeros((h, w), np.float32)
    starts = tile_starts(w)
    n = len(starts)
    for i, x0 in enumerate(starts):
        x1 = min(w, x0 + TILE_W)
        tile = infer_tile(sess, rgb[:, x0:x1])
        tw = x1 - x0
        weight = np.ones(tw, np.float32)
        if i > 0:
            f = min(OVERLAP, tw)
            t = np.linspace(0, 1, f, dtype=np.float32)
            weight[:f] = 0.5 * (1 - np.cos(np.pi * t))
        if i < n - 1:
            f = min(OVERLAP, tw)
            t = np.linspace(0, 1, f, dtype=np.float32)
            weight[-f:] *= 0.5 * (1 + np.cos(np.pi * t))
        acc[:, x0:x1] += tile * weight
        wt[:, x0:x1] += weight
    return acc / np.maximum(wt, 1e-6)


def highpass(raw: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    coarse = gaussian(raw, 1.1)
    lo, hi = np.percentile(coarse, [2, 99])
    coarse = np.clip((coarse - lo) / max(1e-6, hi - lo), 0, 1)
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    detail = lum - gaussian(lum, 2.0)
    mask = smoothstep(0.15, 0.18, coarse)
    masked = detail * mask
    sel = mask > 0.5
    p90 = float(np.percentile(np.abs(masked[sel]), 90)) if sel.any() else 1.0
    scale = 0.035 / max(p90, 1e-8)
    out = gaussian(coarse + np.clip(masked * scale, -0.2, 0.2), 0.9)
    out = np.clip(out, 0, 1)
    gate = smoothstep(0.012, 0.045, gaussian(lum, 1.2))
    return np.clip(out * gate, 0, 1), scale


def lock_plate(depth: np.ndarray, plate: np.ndarray, x: int) -> np.ndarray:
    out = depth
    h, w = out.shape
    pw = min(plate.shape[1], w - x)
    ph = min(plate.shape[0], h)
    soft = np.clip(gaussian(out, 6.0) * 0.42, 0, 1)
    ext = soft.copy()
    ext[:, x : x + pw] = plate[:ph, :pw]
    # 96 px outside the plate only: ramp from the locked edge into the soft side.
    for i in range(FEATHER):
        t = (i + 0.5) / FEATHER
        k = t * t * (3 - 2 * t)
        xl = x - 1 - i
        if xl >= 0:
            ext[:, xl] = plate[:ph, 0] * (1 - k) + soft[:, xl] * k
        xr = x + pw + i
        if xr < w:
            ext[:, xr] = plate[:ph, pw - 1] * (1 - k) + soft[:, xr] * k
    return np.clip(ext, 0, 1)


def save_gray(path: Path, depth: np.ndarray) -> None:
    u8 = (np.clip(depth, 0, 1) * 255).round().astype(np.uint8)
    Image.fromarray(u8, "L").save(path)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--color", type=Path, required=True)
    p.add_argument("--model", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--lock", type=Path, default=None, help="QC plate depth, 1280 wide")
    p.add_argument("--lock-x", type=int, default=PLATE_X)
    args = p.parse_args()

    import onnxruntime as ort

    rgb = np.asarray(Image.open(args.color).convert("RGB"))
    sess = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    raw = blend_tiles(sess, rgb)
    depth, scale = highpass(raw, rgb.astype(np.float32) / 255)
    print("high-pass scale", round(scale, 6), "starts", tile_starts(rgb.shape[1]))
    if args.lock is not None:
        plate = np.asarray(Image.open(args.lock).convert("L")).astype(np.float32) / 255
        before = depth[:, args.lock_x : args.lock_x + plate.shape[1]].copy()
        depth = lock_plate(depth, plate, args.lock_x)
        interior = depth[:, args.lock_x : args.lock_x + plate.shape[1]]
        print("plate lock mae", float(np.abs(interior - plate[: interior.shape[0]]).mean()))
        del before
    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_gray(args.out, depth)
    print("wrote", args.out, depth.shape)


if __name__ == "__main__":
    main()
