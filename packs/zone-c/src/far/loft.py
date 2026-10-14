#!/usr/bin/env python3
"""Loft a far solid from one Imagine elevation. Shape only. No new colour."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
# Front is -Z. Y is up. The ring is a cliff wedge, not a circle.
PROFILE = (
    (0.00, 0.02),
    (0.18, 0.00),
    (0.70, -0.04),
    (0.94, -0.10),
    (1.00, -0.16),
    (0.66, -0.62),
    (0.22, -0.96),
    (0.00, -1.00),
)


def mask_of(rgb: np.ndarray) -> np.ndarray:
    top = rgb[:12].reshape(-1, 3)
    sky = np.median(top, axis=0)
    d = np.linalg.norm(rgb - sky, axis=2)
    return d > 28.0


def loft(path: Path, stations: int = 28) -> dict:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    m = mask_of(rgb)
    # Keep the mass that connects to the lower frame, so a pale sky stays out.
    cols = np.where(m.any(axis=0))[0]
    if len(cols) < 8:
        raise SystemExit(f"no mass in {path.name}")
    x0, x1 = int(cols[0]), int(cols[-1])
    xs = np.linspace(x0, x1, stations)
    crests = []
    for x in xs:
        col = m[:, int(x)]
        ys = np.where(col)[0]
        crests.append(int(ys.min()) if len(ys) else h // 2)
    # Image y grows downward. Crest height in pixels from the bottom.
    pix_h = [max(8, h - c) for c in crests]
    max_h = float(max(pix_h))
    length = (x1 - x0) / max_h  # metres at world height 1
    depth = 0.46
    pos = []
    uv = []
    rings = len(PROFILE)
    for i, x in enumerate(xs):
        u = (float(x) - x0) / max(1.0, float(x1 - x0))
        hh = pix_h[i] / max_h
        lx = (u - 0.5) * length
        for py, pz in PROFILE:
            pos.extend((lx, py * hh, pz * depth))
            uv.extend((u, 1.0 - py * hh))
    idx = []
    for i in range(stations - 1):
        for k in range(rings):
            a = i * rings + k
            b = i * rings + (k + 1) % rings
            c = (i + 1) * rings + k
            d = (i + 1) * rings + (k + 1) % rings
            idx.extend((a, c, b, b, c, d))
    return {
        "length": length,
        "depth": depth,
        "positions": [round(v, 5) for v in pos],
        "uvs": [round(v, 5) for v in uv],
        "idx": idx,
    }


def main() -> None:
    out = {
        "cliff": loft(ROOT / "cliff.jpg"),
        "ridge": loft(ROOT / "ridge.jpg"),
    }
    (ROOT / "mesh.json").write_text(json.dumps(out))
    for name, part in out.items():
        print(name, "len", round(part["length"], 3), "tris", len(part["idx"]) // 3)


if __name__ == "__main__":
    main()
