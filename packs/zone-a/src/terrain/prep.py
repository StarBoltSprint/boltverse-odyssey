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
# Repo root of the checkout this file lives in (packs/zone-a/src/terrain/prep.py).
ROOT = Path(__file__).resolve().parents[4]
# Imagine session stills. A copy of the zone A set is in /workspace/grokcli/out/zoneA-step1/stills/.
SRC = Path(os.environ.get(
    "GROUND_SRC",
    "/workspace/x-live/chrome-game-home/.grok/sessions/"
    "%2Fworkspace%2Fgrokcli%2FzoneA/01a100b7-a59d-7b11-b4e7-6871c562bf09/images",
))
GROUND = ROOT / "packs/zone-a/src/ground"
DETAIL = ROOT / "packs/zone-a/src/detail"

# Imagine file -> repo name. m7 repeats m6 (one plate, two slots).
TILES = [
    ("8.jpg", "m0.png"),
    ("4.jpg", "m1.png"),
    ("3.jpg", "m2.png"),
    ("11.jpg", "m3.png"),
    ("1.jpg", "m4.png"),
    ("9.jpg", "m5.png"),
    ("2.jpg", "m6.png"),
    ("2.jpg", "m7.png"),
]
MASK = ("5.jpg", "mask.png")
CUTS = [("10.jpg", "c0.png"), ("6.jpg", "c1.png"), ("7.jpg", "c2.png")]


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
    DETAIL.mkdir(parents=True, exist_ok=True)
    sess = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    seen: dict[str, np.ndarray] = {}
    for src_name, dest_name in TILES + [MASK]:
        if src_name not in seen:
            im = np.asarray(Image.open(SRC / src_name).convert("RGB"))
            joined = join_edges(im, 0.09)
            ratio, edge = seam_score(joined)
            print(f"seam {src_name} ratio {ratio:.3f} abs {edge:.2f}")
            seen[src_name] = joined
        rgb = seen[src_name]
        Image.fromarray(rgb.astype(np.uint8), "RGB").save(GROUND / dest_name, optimize=True)
        # Only m0.png … m9.png. mask.png also starts with "m" and must not become hask.png.
        if len(dest_name) > 1 and dest_name[0] == "m" and dest_name[1].isdigit():
            depth = infer_depth(sess, rgb.astype(np.uint8))
            detail = highpass(depth)
            hname = "h" + dest_name[1:]
            save_depth(detail, GROUND / hname)
            print(f"depth {hname} p95 {np.percentile(np.abs(detail), 95):.3f}")
    # key limits differ: cluster, low ridge, upright lip
    key_cut(SRC / "10.jpg", DETAIL / "c0.png", 14, 40)
    key_cut(SRC / "6.jpg", DETAIL / "c1.png", 16, 42)
    key_cut(SRC / "7.jpg", DETAIL / "c2.png", 18, 48)
    print("prep done")


if __name__ == "__main__":
    main()
