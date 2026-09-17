#!/usr/bin/env python3
"""Measure lock-off plate travel (road rush), not FPS.

  python3 scripts/plate-speed.py biome/master/road.mp4
  python3 scripts/plate-speed.py --ref biome/master/road.mp4 biome/master/road-bar.mp4
  python3 scripts/plate-speed.py --match --ref biome/master/road.mp4 biome/master/road-bar.mp4 -o biome/master/road-bar.mp4

How: dump gray frames, then how far asphalt patches slide DOWN over a
fixed 0.20s. That number is px/s at 720p. --match time-warps so it matches --ref
(duration shrinks if the plate was slower).
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

FF = os.environ.get("FFMPEG", "/usr/local/bin/ffmpeg")
DUMP_FPS = 24
DT = 0.20
SCALE_W = 360
BANDS = (0.58, 0.66, 0.74)
SEARCH = 80
PW, PH = 20, 16


def run_ff(args: list[str]) -> None:
    subprocess.check_call(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def dump_gray(src: str, dest: str) -> None:
    os.makedirs(dest, exist_ok=True)
    run_ff(
        [
            FF, "-y", "-i", src,
            "-vf", f"fps={DUMP_FPS},scale={SCALE_W}:-1,format=gray",
            os.path.join(dest, "%04d.png"),
        ]
    )


def load_frames(dest: str) -> list[np.ndarray]:
    files = sorted(glob.glob(os.path.join(dest, "*.png")))
    if len(files) < 8:
        raise SystemExit(f"not enough frames in {dest} ({len(files)})")
    return [np.asarray(Image.open(f), dtype=np.float32) for f in files]


def patch_dy(a: np.ndarray, b: np.ndarray, band: float) -> list[float]:
    h, w = a.shape
    y = int(h * band)
    out: list[float] = []
    for x in range(int(w * 0.26), int(w * 0.74) - PW, 18):
        pa = a[y : y + PH, x : x + PW]
        if pa.shape != (PH, PW):
            continue
        pa = pa - pa.mean()
        errs: list[float] = []
        for dy in range(0, SEARCH + 1):
            yy = y + dy
            if yy + PH > h:
                break
            pb = b[yy : yy + PH, x : x + PW]
            if pb.shape != pa.shape:
                errs.append(1e9)
                continue
            pb = pb - pb.mean()
            errs.append(float(np.mean((pa - pb) ** 2)))
        i = int(np.argmin(errs))
        if 0 < i < len(errs) - 1:
            e0, e1, e2 = errs[i - 1], errs[i], errs[i + 1]
            den = e0 - 2 * e1 + e2
            if abs(den) > 1e-9:
                i = i + 0.5 * (e0 - e2) / den
        out.append(float(i))
    return out


def probe(src: str) -> tuple[float | None, float | None]:
    meta = subprocess.run(
        [FF, "-hide_banner", "-i", src],
        check=False, capture_output=True, text=True,
    ).stderr
    dur = None
    fps = None
    for line in meta.splitlines():
        if "Duration:" in line:
            t = line.split("Duration:")[1].split(",")[0].strip()
            hh, mm, ss = t.split(":")
            dur = int(hh) * 3600 + int(mm) * 60 + float(ss)
        if " fps," in line and fps is None:
            try:
                fps = float(line.split(" fps,")[0].split()[-1])
            except ValueError:
                pass
    return dur, fps


def measure(src: str) -> dict:
    with tempfile.TemporaryDirectory(prefix="plate-speed-") as tmp:
        dump_gray(src, tmp)
        frames = load_frames(tmp)
    step = max(1, round(DT * DUMP_FPS))
    dt = step / DUMP_FPS
    dys: list[float] = []
    for i in range(0, len(frames) - step, 2):
        for band in BANDS:
            dys.extend(patch_dy(frames[i], frames[i + step], band))
    med = float(np.median(np.array(dys, dtype=np.float64)))
    px_s = med / dt * (720 / SCALE_W)
    dur, fps = probe(src)
    return {
        "file": src,
        "px_s": round(px_s, 2),
        "med_dy": round(med, 3),
        "dt": round(dt, 3),
        "samples": len(dys),
        "duration": dur,
        "fps": fps,
    }


def match_file(src: str, factor: float, dest: str) -> None:
    vf = (
        f"setpts=PTS/{factor:.5f},fps=48,"
        "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"
    )
    tmp = dest + ".tmp.mp4"
    run_ff(
        [
            FF, "-y", "-i", src, "-vf", vf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-g", "15", "-keyint_min", "15", "-sc_threshold", "0",
            "-crf", "23", "-maxrate", "3500k", "-bufsize", "7000k",
            "-an", "-movflags", "+faststart", tmp,
        ]
    )
    os.replace(tmp, dest)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("plate")
    ap.add_argument("--ref", help="reference plate (first empty road)")
    ap.add_argument("--match", action="store_true", help="time-warp plate to --ref speed")
    ap.add_argument("-o", "--out", help="output path for --match")
    args = ap.parse_args()
    plate = measure(args.plate)
    out: dict = {"plate": plate}
    if args.ref:
        ref = measure(args.ref)
        out["ref"] = ref
        factor = (ref["px_s"] / plate["px_s"]) if plate["px_s"] > 1 else 1.0
        factor = max(0.45, min(2.4, factor))
        out["factor"] = round(factor, 4)
        out["note"] = "factor>1 speeds the plate up (shorter). This is travel, not FPS."
        if args.match:
            dest = args.out or args.plate
            match_file(args.plate, factor, dest)
            out["written"] = dest
            out["after"] = measure(dest)
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    sys.exit(main())
