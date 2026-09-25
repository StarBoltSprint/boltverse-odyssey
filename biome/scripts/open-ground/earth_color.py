#!/usr/bin/env python3
"""Earth color for an open-ground horizon (law 43).

The raw mean is darker than the lit pebbles, so a flat band painted with the
mean looks like a shelf. The shader uses the mean of the bright grains
(luminance between the 70th and 85th percentile).

Usage:
  python3 biome/scripts/open-ground/earth_color.py ground.mp4
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: earth_color.py <ground.mp4>", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    if not src.is_file():
        print(f"missing {src}", file=sys.stderr)
        return 2
    try:
        from PIL import Image
    except ImportError:
        print("pillow is required", file=sys.stderr)
        return 2
    with tempfile.TemporaryDirectory() as tmp:
        frame = Path(tmp) / "frame.png"
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(src), "-frames:v", "1", str(frame)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        im = Image.open(frame).convert("RGB")
        px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    n = len(px)
    mean = [sum(c[i] for c in px) / n / 255 for i in range(3)]
    lum = sorted((c[0] + c[1] + c[2]) / (3 * 255) for c in px)
    lo = lum[int(n * 0.70)]
    hi = lum[min(n - 1, int(n * 0.85))]
    lit_px = [c for c in px if lo <= (c[0] + c[1] + c[2]) / (3 * 255) <= hi]
    lit = [sum(c[i] for c in lit_px) / len(lit_px) / 255 for i in range(3)]
    print(f"mean  vec3({mean[0]:.3f}, {mean[1]:.3f}, {mean[2]:.3f})")
    print(f"lit   vec3({lit[0]:.3f}, {lit[1]:.3f}, {lit[2]:.3f})")
    print("use lit in PLATE_FS when uFlat > 0.5")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
