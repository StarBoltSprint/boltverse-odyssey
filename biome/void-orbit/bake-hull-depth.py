#!/usr/bin/env python3
"""Bake the Void Orbit hull thickness grid.

Reads a side-view still (black background, ship frozen).
Writes an RGBA PNG, 192x108:

  R = thickness 0..255 (0 outside, 255 = fattest interior)
  G = 255 inside the enclosed silhouette, else 0

The outside is a flood fill from the border. Dark armor stays inside.
Form depth is a chamfer distance to that outside. A small high-pass
of the luminance is added as panel relief.

See biome/docs/57-void-orbit-ship-relief.md
"""
from __future__ import annotations

import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

GW, GH = 192, 108


def dilate(mask: np.ndarray, n: int = 1) -> np.ndarray:
    for _ in range(n):
        p = np.pad(mask, 1)
        mask = (
            p[1:-1, 1:-1]
            | p[:-2, 1:-1]
            | p[2:, 1:-1]
            | p[1:-1, :-2]
            | p[1:-1, 2:]
        )
    return mask


def enclosed(body: np.ndarray) -> np.ndarray:
    h, w = body.shape
    outside = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not body[y, x]:
                outside[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not body[y, x] and not outside[y, x]:
                outside[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not body[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                q.append((ny, nx))
    return ~outside


def chamfer(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    dist = np.where(mask, 1e4, 0).astype(np.float32)
    for j in range(h):
        for i in range(w):
            v = dist[j, i]
            if i:
                v = min(v, dist[j, i - 1] + 1)
            if j:
                v = min(v, dist[j - 1, i] + 1)
            if i and j:
                v = min(v, dist[j - 1, i - 1] + 1.414)
            dist[j, i] = v
    for j in range(h - 1, -1, -1):
        for i in range(w - 1, -1, -1):
            v = dist[j, i]
            if i + 1 < w:
                v = min(v, dist[j, i + 1] + 1)
            if j + 1 < h:
                v = min(v, dist[j + 1, i] + 1)
            if i + 1 < w and j + 1 < h:
                v = min(v, dist[j + 1, i + 1] + 1.414)
            dist[j, i] = v
    return dist


def main() -> None:
    src = sys.argv[1] if len(sys.argv) > 1 else "stills/ship-flank.jpg"
    dst = sys.argv[2] if len(sys.argv) > 2 else "stills/ship-depth.png"
    im = np.asarray(Image.open(src).convert("RGB"))
    h, w = im.shape[:2]
    mx = im.max(2).astype(np.float32)
    xs = np.linspace(0, w, GW + 1).astype(int)
    ys = np.linspace(0, h, GH + 1).astype(int)
    small = np.zeros((GH, GW), dtype=bool)
    lum = np.zeros((GH, GW), dtype=np.float32)
    for j in range(GH):
        for i in range(GW):
            patch = mx[ys[j] : max(ys[j + 1], ys[j] + 1), xs[i] : max(xs[i + 1], xs[i] + 1)]
            small[j, i] = bool(patch.max() > 8)
            lum[j, i] = float(patch.mean())
    mask = enclosed(dilate(small, 1))
    dist = chamfer(mask)
    scale = float(np.percentile(dist[mask], 88))
    thick = np.clip(dist / scale, 0, 1) * mask
    blur = np.asarray(
        Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=2.2)),
        dtype=np.float32,
    )
    detail = np.clip((lum - blur) / 48.0, -0.1, 0.1) * mask
    final = np.clip(thick + detail, 0, 1)
    final = np.asarray(
        Image.fromarray((final * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=0.8)),
        dtype=np.float32,
    )
    final = np.where(mask, final, 0)
    out = np.zeros((GH, GW, 4), dtype=np.uint8)
    out[..., 0] = np.clip(final, 0, 255).astype(np.uint8)
    out[..., 1] = mask.astype(np.uint8) * 255
    out[..., 3] = 255
    Image.fromarray(out, "RGBA").save(dst)
    print(f"wrote {dst} mask={mask.mean():.3f} center={out[GH // 2, GW // 2, :2].tolist()}")


if __name__ == "__main__":
    main()
