#!/usr/bin/env python3
# Efros-Freeman image quilting. Patches are copied 1:1 from the native crust
# stills. Seams are a min-error cut plus a short feather. The result tiles.
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


def load_sources():
    out = []
    for path in SOURCES:
        img = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
        if img.shape[0] != 1024 or img.shape[1] != 1024:
            raise SystemExit(f"{path.name} is {img.shape}, expected 1024")
        out.append(img)
    return out


def ssd(a, b):
    # Structure, plus the brightness gap so a dark still does not sit against
    # a bright one as a hard seam. Copied pixels stay native.
    d = (a - a.mean()) - (b - b.mean())
    gap = float(a.mean() - b.mean())
    return float(np.dot(d.ravel(), d.ravel())) + gap * gap * a.size * 4.0


def vertical_cut(cost):
    h, w = cost.shape
    dp = np.empty_like(cost)
    prev = np.zeros((h, w), dtype=np.int8)
    dp[0] = cost[0]
    for y in range(1, h):
        for x in range(w):
            x0 = max(0, x - 1)
            x1 = min(w, x + 2)
            seg = dp[y - 1, x0:x1]
            k = int(np.argmin(seg))
            prev[y, x] = x0 + k
            dp[y, x] = cost[y, x] + seg[k]
    cut = np.empty(h, dtype=np.int32)
    cut[-1] = int(np.argmin(dp[-1]))
    for y in range(h - 2, -1, -1):
        cut[y] = int(prev[y + 1, cut[y + 1]])
    return cut


def horizontal_cut(cost):
    return vertical_cut(cost.T)


def feather_mask(length, cut, feather, overlap):
    mask = np.ones(length, dtype=np.float32)
    mask[:cut] = 0
    lo = max(0, cut - feather)
    hi = min(overlap, cut + feather + 1)
    if hi > lo:
        t = (np.arange(lo, hi) - (cut - feather)) / max(1, 2 * feather)
        mask[lo:hi] = np.clip(t, 0, 1)
    return mask


def paste(canvas, patch, ox, oy, overlap, feather, has_left, has_top, has_right, has_bottom):
    size = canvas.shape[0]
    ph, pw = patch.shape[:2]
    mask = np.ones((ph, pw), dtype=np.float32)
    ys_all = (oy + np.arange(ph)) % size
    xs_all = (ox + np.arange(pw)) % size

    def take(ys, xs):
        return canvas[np.ix_(ys, xs)]

    if has_left:
        dest = take(ys_all, xs_all[:overlap])
        cut = vertical_cut(np.sum((patch[:, :overlap] - dest) ** 2, axis=2))
        for y in range(ph):
            mask[y, :overlap] *= feather_mask(overlap, int(cut[y]), feather, overlap)
    if has_right:
        dest = take(ys_all, xs_all[-overlap:])
        # Outside (right) is the existing tile edge, so flip the strip.
        cost = np.sum((patch[:, -overlap:] - dest) ** 2, axis=2)[:, ::-1]
        cut = vertical_cut(cost)
        for y in range(ph):
            flipped = feather_mask(overlap, int(cut[y]), feather, overlap)[::-1]
            mask[y, -overlap:] *= flipped
    if has_top:
        dest = take(ys_all[:overlap], xs_all)
        cut = horizontal_cut(np.sum((patch[:overlap] - dest) ** 2, axis=2))
        top = np.ones((overlap, pw), dtype=np.float32)
        for x in range(pw):
            top[:, x] = feather_mask(overlap, int(cut[x]), feather, overlap)
        mask[:overlap] *= top
    if has_bottom:
        dest = take(ys_all[-overlap:], xs_all)
        cost = np.sum((patch[-overlap:] - dest) ** 2, axis=2)[::-1]
        cut = horizontal_cut(cost)
        bot = np.ones((overlap, pw), dtype=np.float32)
        for x in range(pw):
            bot[:, x] = feather_mask(overlap, int(cut[x]), feather, overlap)[::-1]
        mask[-overlap:] *= bot
    existing = take(ys_all, xs_all)
    canvas[np.ix_(ys_all, xs_all)] = existing * (1 - mask[..., None]) + patch * mask[..., None]


def overlap_error(canvas, patch, ox, oy, overlap, has_left, has_top, has_right, has_bottom):
    size = canvas.shape[0]
    err = 0.0
    ph, pw = patch.shape[:2]
    if has_left:
        dest = np.empty((ph, overlap, 3), dtype=np.float32)
        for x in range(overlap):
            dest[:, x] = canvas[(oy + np.arange(ph)) % size, (ox + x) % size]
        err += ssd(patch[:, :overlap], dest)
    if has_top:
        dest = np.empty((overlap, pw, 3), dtype=np.float32)
        for y in range(overlap):
            dest[y] = canvas[(oy + y) % size, (ox + np.arange(pw)) % size]
        err += ssd(patch[:overlap], dest)
    if has_right:
        dest = np.empty((ph, overlap, 3), dtype=np.float32)
        for x in range(overlap):
            dest[:, x] = canvas[(oy + np.arange(ph)) % size, (ox + pw - overlap + x) % size]
        err += ssd(patch[:, -overlap:], dest)
    if has_bottom:
        dest = np.empty((overlap, pw, 3), dtype=np.float32)
        for y in range(overlap):
            dest[y] = canvas[(oy + ph - overlap + y) % size, (ox + np.arange(pw)) % size]
        err += ssd(patch[-overlap:], dest)
    return err


def quilt(sources, out, patch, overlap, seed, candidates):
    step = patch - overlap
    if out % step != 0:
        raise SystemExit(f"{out} is not a multiple of step {step}")
    n = out // step
    rng = np.random.default_rng(seed)
    canvas = np.zeros((out, out, 3), dtype=np.float32)
    used = [0, 0, 0, 0]
    for gy in range(n):
        for gx in range(n):
            ox, oy = gx * step, gy * step
            has_left = gx > 0
            has_top = gy > 0
            has_right = gx == n - 1
            has_bottom = gy == n - 1
            # Each still is searched. A running quota keeps all four in the atlas
            # without a checker of the dark still against the bright ones.
            best_err = 1e30
            best = None
            best_src = 0
            placed = gy * n + gx
            if placed == 0:
                best_src = int(rng.integers(0, 3))
                src = sources[best_src]
                x = int(rng.integers(0, src.shape[1] - patch))
                y = int(rng.integers(0, src.shape[0] - patch))
                best = src[y:y + patch, x:x + patch].copy()
            else:
                for si, src in enumerate(sources):
                    quota = max(0, used[si] - placed / len(sources))
                    for _ in range(max(1, candidates // len(sources))):
                        x = int(rng.integers(0, src.shape[1] - patch))
                        y = int(rng.integers(0, src.shape[0] - patch))
                        block = src[y:y + patch, x:x + patch]
                        err = overlap_error(canvas, block, ox, oy, overlap, has_left, has_top, has_right, has_bottom)
                        err += quota * quota * 5e7
                        if err < best_err:
                            best_err = err
                            best = block.copy()
                            best_src = si
            paste(canvas, best, ox, oy, overlap, 4, has_left, has_top, has_right, has_bottom)
            used[best_src] += 1
        print(f"seed {seed} row {gy + 1}/{n}", flush=True)
    return np.clip(np.rint(canvas), 0, 255).astype(np.uint8), used


def period_ratio(img, lag):
    # Column-mean autocorrelation. A repeat of the 1024 source would peak at that lag.
    gray = img.astype(np.float64)
    sig = gray.mean(axis=(0, 2)) if False else gray.mean(axis=0).mean(axis=1)
    sig = sig - sig.mean()
    var = np.dot(sig, sig) / len(sig)
    if var < 1e-8:
        return 0.0

    def ac(k):
        return float(np.dot(sig[: len(sig) - k], sig[k:]) / ((len(sig) - k) * var))

    if lag + 256 >= len(sig):
        return 0.0, 0.0, 0.0
    peak = ac(lag)
    beside = (ac(lag - 128) + ac(lag + 128) + ac(lag - 256) + ac(lag + 256)) / 4
    return peak / (abs(beside) + 0.08), peak, beside


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=int, default=4096)
    parser.add_argument("--patch", type=int, default=576)
    parser.add_argument("--overlap", type=int, default=64)
    parser.add_argument("--candidates", type=int, default=24)
    parser.add_argument("--seeds", default="7,19")
    parser.add_argument("--dest", default="tex/crust-atlas")
    args = parser.parse_args()
    sources = load_sources()
    dest = HERE / args.dest
    dest.mkdir(parents=True, exist_ok=True)
    report = []
    for seed in [int(s) for s in args.seeds.split(",")]:
        img, used = quilt(sources, args.out, args.patch, args.overlap, seed, args.candidates)
        path = dest / f"atlas-{seed}.png"
        Image.fromarray(img, "RGB").save(path, optimize=True)
        ratio, peak, beside = period_ratio(img, 1024)
        preview = dest / f"atlas-{seed}-preview.png"
        Image.fromarray(img[:1024, :1024], "RGB").save(preview)
        row = {
            "seed": seed,
            "file": str(path.relative_to(HERE)),
            "bytes": path.stat().st_size,
            "sources": used,
            "ac1024": {"ratio": round(ratio, 3), "peak": round(peak, 3), "beside": round(beside, 3)},
        }
        report.append(row)
        print(json.dumps(row), flush=True)
    (dest / "quilt.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
