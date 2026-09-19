#!/usr/bin/env python3
"""Lock a planet disc to constant radius + center (Law 0: no size change)."""
import argparse
import os

import cv2
import numpy as np


def largest_disc(bgr, luma_th=8, star=False):
    luma = bgr.max(axis=2)
    h, w = bgr.shape[:2]
    if star:
        core = luma > 140
        if core.any():
            ys, xs = np.where(core)
            cx, cy = float(xs.mean()), float(ys.mean())
        else:
            cx, cy = w * 0.5, h * 0.5
        body = luma > 90
        ys, xs = np.where(body)
        if len(xs) < 20:
            return cx, cy, min(w, h) * 0.22
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        d = d[d < min(w, h) * 0.42]
        if d.size == 0:
            return cx, cy, min(w, h) * 0.22
        # 70th sits on the photosphere, not the filament tips
        r = float(np.percentile(d, 70))
        return cx, cy, max(r, 8.0)
    lit = luma > 22
    if lit.any():
        ys, xs = np.where(lit)
        cx, cy = float(xs.mean()), float(ys.mean())
    else:
        cx, cy = w * 0.5, h * 0.5
    body = luma > luma_th
    ys, xs = np.where(body)
    if len(xs) < 20:
        return cx, cy, min(w, h) * 0.36
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    d = d[d < min(w, h) * 0.48]
    if d.size == 0:
        return cx, cy, min(w, h) * 0.36
    r = float(np.percentile(d, 96))
    return cx, cy, max(r, 8.0)


def lock_frame(bgr, target_r, target_cx, target_cy, star=False):
    h, w = bgr.shape[:2]
    cx, cy, r = largest_disc(bgr, star=star)
    scale = target_r / r
    M = np.array(
        [
            [scale, 0.0, target_cx - scale * cx],
            [0.0, scale, target_cy - scale * cy],
        ],
        dtype=np.float32,
    )
    out = cv2.warpAffine(
        bgr,
        M,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0),
    )
    yy, xx = np.mgrid[0:h, 0:w]
    pr = np.sqrt((xx - target_cx) ** 2 + (yy - target_cy) ** 2)
    if star:
        # Keep the corona. Fade only deep void.
        inner, outer = target_r * 2.4, target_r * 2.85
    else:
        inner, outer = target_r * 1.26, target_r * 1.48
    win = np.clip((outer - pr) / max(outer - inner, 1e-6), 0, 1).astype(np.float32)
    return np.clip(out.astype(np.float32) * win[..., None], 0, 255).astype(np.uint8)


def measure_clip(path, samples=9):
    cap = cv2.VideoCapture(path)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    rows = []
    for i in range(samples):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i * (n - 1) / max(samples - 1, 1)))
        ok, fr = cap.read()
        if not ok:
            continue
        cx, cy, r = largest_disc(fr)
        h, w = fr.shape[:2]
        rows.append((r / w, cx / w, cy / h))
    cap.release()
    return rows


def lock_video(src, dest, target_uv=None, star=False):
    cap = cv2.VideoCapture(src)
    if not cap.isOpened():
        raise SystemExit("cannot open " + src)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0

    radii = []
    frames = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        cx, cy, r = largest_disc(fr, star=star)
        radii.append(r)
        frames.append(fr)
    cap.release()
    if not frames:
        raise SystemExit("empty " + src)

    lo, hi = int(len(radii) * 0.15), int(len(radii) * 0.85)
    mid = radii[lo:hi] or radii
    target_r = (target_uv * w) if target_uv else float(np.median(mid))
    tcx, tcy = w * 0.5, h * 0.5

    if star:
        keep = list(range(len(frames)))
    else:
        keep = [i for i, r in enumerate(radii) if abs(r - target_r) / target_r < 0.08]
        if len(keep) < 24:
            keep = list(range(len(frames)))
    print(f"keep {len(keep)}/{len(frames)} frames  target_r={target_r/w:.3f} star={star}", flush=True)
    frames = [frames[i] for i in keep]

    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    tmp = dest + ".raw.mp4"
    wr = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i, fr in enumerate(frames):
        wr.write(lock_frame(fr, target_r, tcx, tcy, star=star))
        if i % 30 == 0:
            print(f"lock {i}/{len(frames)}  target_r={target_r/w:.3f}", flush=True)
    wr.release()

    # h264
    import subprocess

    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            tmp,
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            dest,
        ]
    )
    os.remove(tmp)
    print(f"locked {len(frames)} frames  r={target_r/w:.3f} → {dest}", flush=True)
    return target_r / w


def match_to_ref(src, ref, dest):
    """Scale src's disc to ref's disc radius, centered. For last_frame vs first."""
    ref_im = cv2.imread(ref)
    src_im = cv2.imread(src)
    if ref_im is None or src_im is None:
        raise SystemExit("match missing " + src + " or " + ref)
    _, _, r_ref = largest_disc(ref_im)
    h, w = src_im.shape[:2]
    out = lock_frame(src_im, r_ref, w * 0.5, h * 0.5)
    os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
    cv2.imwrite(dest, out)
    print(f"match disc {src} → r={r_ref/w:.3f}  {dest}", flush=True)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--video", default=None)
    p.add_argument("--output", required=False, default="-")
    p.add_argument("--radius", type=float, default=None, help="target UV radius")
    p.add_argument("--measure", action="store_true")
    p.add_argument("--disc", default=None, help="print UV radius of a still")
    p.add_argument("--match-to", default=None, help="still whose disc size we copy")
    p.add_argument("--still", default=None, help="source still to resize")
    p.add_argument("--star", action="store_true", help="lock photosphere, keep corona")
    args = p.parse_args()
    if args.disc:
        im = cv2.imread(args.disc)
        if im is None:
            raise SystemExit("cannot read " + args.disc)
        cx, cy, r = largest_disc(im, star=args.star)
        h, w = im.shape[:2]
        print(f"{r/w:.4f} {cx/w:.4f} {cy/h:.4f}")
    elif args.match_to and args.still:
        match_to_ref(args.still, args.match_to, args.output)
    elif args.measure:
        rows = measure_clip(args.video)
        print(f"{'r':>6} {'cx':>6} {'cy':>6}")
        for r, cx, cy in rows:
            print(f"{r:6.3f} {cx:6.3f} {cy:6.3f}")
        rs = [r for r, _, _ in rows]
        print(f"min {min(rs):.3f}  max {max(rs):.3f}  median {float(np.median(rs)):.3f}")
    else:
        lock_video(args.video, args.output, args.radius, star=args.star)
