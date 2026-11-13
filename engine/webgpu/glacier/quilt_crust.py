#!/usr/bin/env python3
# Off-lattice crust quilting. Patches are copied 1:1 from the four native
# stills, at random sizes and random dihedral copies (mirror / quarter-turn).
# Placement is jittered rows with a short overlap, not a fixed 512 px lattice.
# A wide feather was measured and it pushed the perspective grid back over 1.8,
# so the seam is the hard cut where the next patch starts. Interiors are exact.
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCES = [
    HERE / "artifacts/run13/materials/crust-v1.jpg",
    HERE / "artifacts/run13/materials/crust-v2.jpg",
    HERE / "artifacts/run13/materials/crust-v3.jpg",
    HERE / "artifacts/run13/materials/crust-v4.jpg",
]
SIZE = 4096


def load_sources():
    out = []
    for path in SOURCES:
        img = np.asarray(Image.open(path).convert("RGB"))
        if img.shape[0] != 1024 or img.shape[1] != 1024:
            raise SystemExit(f"{path.name} is {img.shape}, expected 1024")
        out.append(img)
    return out


def orient(block, k):
    # Every output pixel is one source pixel. No resample, no scale change.
    if k & 1:
        block = block[:, ::-1]
    if k & 2:
        block = block[::-1]
    if k & 4:
        block = np.ascontiguousarray(block.transpose(1, 0, 2))
    return np.ascontiguousarray(block)


def quilt(sources, seed):
    rng = np.random.default_rng(seed)
    tile = 24
    canvas = np.zeros((SIZE, SIZE, 3), np.uint8)
    counts = [0, 0, 0, 0]
    native_ok = 0
    native_n = 0
    y = 0
    while y < SIZE:
        ph = int(rng.integers(tile, int(tile * 1.6)))
        x = 0
        while x < SIZE:
            pw = int(rng.integers(tile, int(tile * 1.6)))
            si = int(rng.integers(0, 4))
            counts[si] += 1
            src = sources[si]
            span = max(ph, pw)
            sy = int(rng.integers(0, 1024 - span))
            sx = int(rng.integers(0, 1024 - span))
            block = src[sy : sy + span, sx : sx + span].copy()
            block = orient(block, int(rng.integers(0, 8)))
            block = block[:ph, :pw]
            h, w = block.shape[:2]
            y1, x1 = min(SIZE, y + h), min(SIZE, x + w)
            canvas[y:y1, x:x1] = block[: y1 - y, : x1 - x]
            if h > 8 and w > 8 and native_n < 8:
                cy, cx = h // 2, w // 2
                got = canvas[y + cy - 2 : y + cy + 2, x + cx - 2 : x + cx + 2]
                exp = block[cy - 2 : cy + 2, cx - 2 : cx + 2]
                native_n += 1
                native_ok += bool(np.array_equal(got, exp))
            x += max(8, int(w * 0.75))
        y += max(8, int(ph * 0.75))
    return canvas, counts, {"checked": native_n, "verbatim": native_ok}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", default="13,17")
    parser.add_argument("--names", default="7,19", help="output atlas ids, shader order")
    parser.add_argument("--dest", default="tex/crust-atlas")
    args = parser.parse_args()
    sources = load_sources()
    dest = HERE / args.dest
    dest.mkdir(parents=True, exist_ok=True)
    seeds = [int(s) for s in args.seeds.split(",")]
    names = args.names.split(",")
    if len(names) != len(seeds):
        raise SystemExit("seeds and names must match")
    report = []
    for seed, name in zip(seeds, names):
        img, counts, native = quilt(sources, seed)
        path = dest / f"atlas-{name}.png"
        Image.fromarray(img, "RGB").save(path)
        Image.fromarray(img[:1024, :1024], "RGB").save(dest / f"atlas-{name}-preview.png")
        row = {
            "seed": seed,
            "name": name,
            "file": str(path.relative_to(HERE)),
            "bytes": path.stat().st_size,
            "patchPx": [24, 38],
            "sources": counts,
            "native": native,
            "dark": int((img.sum(axis=2) < 80).sum()),
        }
        report.append(row)
        print(json.dumps(row), flush=True)
    (dest / "quilt.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
