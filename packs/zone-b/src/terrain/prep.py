#!/usr/bin/env python3
"""Turn Imagine stills into tile PNGs, depth maps, and keyed detail cuts.

Pixel ops only: edge join, crop, black key, monocular depth, a light high-pass.
No new colour is invented. Style words stay out of this file.
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)
MODEL = Path(os.environ.get("DEPTH_MODEL", "/workspace/grokcli/models/depth_anything_v2_small.onnx"))
# Repo root of the checkout this file lives in (packs/<zone>/src/terrain/prep.py).
ROOT = Path(__file__).resolve().parents[4]
SRC = Path(os.environ.get(
    "GROUND_SRC",
    "/workspace/grokcli/out/zoneB/step1/run/inbox",
))
GROUND = Path(os.environ.get("GROUND_OUT", str(ROOT / "packs/zone-b/src/ground")))

# Three stills, eight slots. Shared sources share one depth pass.
TILES = [
    ("n02-ground-ridges.jpg", "m0.png"),
    ("n03-ground-flats.jpg", "m1.png"),
    ("n01-ground-hollows.jpg", "m2.png"),
    ("n02-ground-ridges.jpg", "m3.png"),
    ("n03-ground-flats.jpg", "m4.png"),
    ("n01-ground-hollows.jpg", "m5.png"),
    ("n01-ground-hollows.jpg", "m6.png"),
    ("n03-ground-flats.jpg", "m7.png"),
]


def gaussian(img: np.ndarray, sigma: float) -> np.ndarray:
    sigma = float(sigma)
    r = max(1, int(math.ceil(sigma * 3)))
    x = np.arange(-r, r + 1, dtype=np.float32)
    k = np.exp(-0.5 * (x / np.float32(sigma)) ** 2)
    k /= k.sum()

    def conv_h(a: np.ndarray) -> np.ndarray:
        pad = np.pad(a, ((0, 0), (r, r)), mode="wrap")
        n = pad.shape[1] + k.shape[0] - 1
        fa = np.fft.rfft(pad, n=n, axis=1)
        fk = np.fft.rfft(k, n=n)
        out = np.fft.irfft(fa * fk, n=n, axis=1)
        return out[:, r : r + a.shape[1]].astype(np.float32)

    return conv_h(conv_h(img).T).T


def join_edges(a: np.ndarray, band: float = 0.1) -> np.ndarray:
    """Average opposite edges so the still wraps. Pixels stay from the still."""
    out = a.astype(np.float32).copy()
    h, w = out.shape[:2]
    bw = max(2, int(w * band))
    bh = max(2, int(h * band))
    s = np.linspace(1.0, 0.0, bw, dtype=np.float32).reshape(1, bw, 1)
    left = out[:, :bw]
    right = out[:, -bw:][:, ::-1]
    mix = 0.5 * (left + right)
    out[:, :bw] = left * (1 - s) + mix * s
    out[:, -bw:] = out[:, -bw:] * (1 - s[:, ::-1]) + mix[:, ::-1] * s[:, ::-1]
    s = np.linspace(1.0, 0.0, bh, dtype=np.float32).reshape(bh, 1, 1)
    top = out[:bh]
    bot = out[-bh:][::-1]
    mix = 0.5 * (top + bot)
    out[:bh] = top * (1 - s) + mix * s
    out[-bh:] = out[-bh:] * (1 - s[::-1]) + mix[::-1] * s[::-1]
    return np.clip(out, 0, 255)


def seam_score(a: np.ndarray) -> tuple[float, float]:
    g = a.mean(axis=2) if a.ndim == 3 else a
    h, w = g.shape
    dh = np.abs(np.diff(g, axis=1)).mean()
    dv = np.abs(np.diff(g, axis=0)).mean()
    interior = 0.5 * (dh + dv) + 1e-6
    edge = 0.5 * (np.abs(g[:, 0] - g[:, -1]).mean() + np.abs(g[0, :] - g[-1, :]).mean())
    return float(edge / interior), float(edge)


def infer_depth(sess, rgb: np.ndarray) -> np.ndarray:
    side = 518
    im = Image.fromarray(rgb.astype(np.uint8)).resize((side, side), Image.Resampling.BILINEAR)
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr = (arr - MEAN) / STD
    ten = np.transpose(arr, (2, 0, 1))[None].astype(np.float32)
    pred = sess.run(None, {"pixel_values": ten})[0][0].astype(np.float32)
    d = pred - pred.min()
    d = d / (d.max() + 1e-6)
    u8 = Image.fromarray((d * 255).astype(np.uint8), "L").resize(
        (rgb.shape[1], rgb.shape[0]), Image.Resampling.BILINEAR
    )
    return np.asarray(u8).astype(np.float32) / 255.0


def highpass(depth: np.ndarray) -> np.ndarray:
    coarse = gaussian(depth, 14.0)
    detail = depth - coarse
    p = float(np.percentile(np.abs(detail), 95))
    detail = np.clip(detail / max(p, 1e-6), -1.2, 1.2)
    detail = gaussian(detail, 1.2)
    return np.clip(detail, -1, 1)


def save_depth(detail: np.ndarray, path: Path) -> None:
    byte = np.clip(128 + detail * 100.0, 0, 255).astype(np.uint8)
    Image.fromarray(byte, "L").save(path, optimize=True)


def key_cut(path: Path, dest: Path, lo: float, hi: float) -> None:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
    t = np.clip((lum - lo) / max(1.0, hi - lo), 0, 1)
    t = t * t * (3 - 2 * t)
    alpha = (t * 255).astype(np.uint8)
    ys, xs = np.where(alpha > 24)
    if len(xs) < 10:
        raise SystemExit(f"empty cut {path.name}")
    pad = 8
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(a.shape[1], int(xs.max()) + pad + 1)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(a.shape[0], int(ys.max()) + pad + 1)
    rgb = a[y0:y1, x0:x1].astype(np.uint8)
    al = alpha[y0:y1, x0:x1]
    rgba = np.dstack([rgb, al])
    Image.fromarray(rgba, "RGBA").save(dest, optimize=True)
    print(f"cut {dest.name} {rgba.shape[1]}x{rgba.shape[0]}")


def main() -> None:
    GROUND.mkdir(parents=True, exist_ok=True)
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    seen: dict[str, np.ndarray] = {}
    depth_cache: dict[str, np.ndarray] = {}
    for src_name, dest_name in TILES:
        if src_name not in seen:
            im = np.asarray(Image.open(SRC / src_name).convert("RGB"))
            joined = join_edges(im, 0.09)
            ratio, edge = seam_score(joined)
            print(f"seam {src_name} ratio {ratio:.3f} abs {edge:.2f}", flush=True)
            seen[src_name] = joined
        rgb = seen[src_name]
        Image.fromarray(rgb.astype(np.uint8), "RGB").save(GROUND / dest_name, optimize=True)
        if src_name not in depth_cache:
            depth = infer_depth(sess, rgb.astype(np.uint8))
            depth_cache[src_name] = highpass(depth)
        detail = depth_cache[src_name]
        hname = "h" + dest_name[1:]
        save_depth(detail, GROUND / hname)
        print(f"depth {hname} p95 {np.percentile(np.abs(detail), 95):.3f}", flush=True)
    print("prep done", flush=True)


if __name__ == "__main__":
    main()
