#!/usr/bin/env python3
"""Place the key still beside a headless terrain frame. No new pixels are invented."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def side_by_side(key: Path, render: Path, dest: Path) -> None:
    a = Image.open(key).convert("RGB")
    b = Image.open(render).convert("RGB")
    h = min(a.height, b.height, 1008)
    def fit(im: Image.Image) -> Image.Image:
        w = max(1, int(round(im.width * (h / im.height))))
        return im.resize((w, h), Image.Resampling.LANCZOS)
    a, b = fit(a), fit(b)
    sheet = Image.new("RGB", (a.width + b.width, h))
    sheet.paste(a, (0, 0))
    sheet.paste(b, (a.width, 0))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest)
    print(dest)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--key", type=Path, required=True)
    p.add_argument("--render", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    side_by_side(args.key, args.render, args.out)


if __name__ == "__main__":
    main()
