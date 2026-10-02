#!/usr/bin/env python3
"""Green-screen despill for a keyed cutout.

Clamps G to max(R, B) and erodes alpha by 1 px. That is the take 10d manual
step, now automatic. It rewrites only --out. The source file stays put.
Pixels that were not in the Imagine plate are not invented: G is lowered to a
channel already in the pixel, and the eroded fringe becomes transparent.

  python3 tools/assetcheck/despill.py --in fringe.png --out clean.png
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from measures import erode


def despill_rgba(rgba: np.ndarray) -> np.ndarray:
    if rgba.ndim != 3 or rgba.shape[2] < 4:
        raise ValueError("despill expects an RGBA image")
    out = np.array(rgba, copy=True)
    red = out[..., 0].astype(np.int16)
    blue = out[..., 2].astype(np.int16)
    green = out[..., 1].astype(np.int16)
    out[..., 1] = np.minimum(green, np.maximum(red, blue)).astype(np.uint8)
    kept = erode(out[..., 3] > 16, 1)
    out[..., 3] = np.where(kept, out[..., 3], np.uint8(0))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Despill a green-keyed cutout")
    parser.add_argument("--in", dest="src", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.out.resolve() == args.src.resolve():
        print("FAIL despill: --out must be a different file than --in", file=sys.stderr)
        return 2
    with Image.open(args.src) as im:
        rgba = np.array(im.convert("RGBA"))
    cleaned = despill_rgba(rgba)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cleaned, "RGBA").save(args.out)
    print(f"PASS despill out={args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
