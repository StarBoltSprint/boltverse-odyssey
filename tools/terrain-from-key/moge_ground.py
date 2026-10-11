#!/usr/bin/env python3
"""Metric ground from MoGe-2 (MIT), the repo default depth.

Fits a plane to the causeway pixels and reports eye height, pitch and the
vertical field of view implied by the recovered intrinsics. Depth Anything
is not called. The map is written next to the step, not into a shipped atlas.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

# Repo layout: tools/terrain-from-key/ -> tools/common, and the MoGe source
# lives beside the weights (vision_models.SRC).
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
import vision_models  # noqa: E402

sys.path.insert(0, vision_models.SRC)


def load_image(path: Path, max_side: int):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    scale = min(1.0, max_side / max(w, h))
    if scale < 1:
        im = im.resize((int(round(w * scale)), int(round(h * scale))), Image.Resampling.LANCZOS)
    arr = np.asarray(im, np.float32) / 255.0
    tensor = torch.from_numpy(arr.transpose(2, 0, 1).copy())
    return im, tensor


def fit_plane(pts: np.ndarray):
    """pts (N,3) camera space. Returns normal (up-ish), point, rms."""
    c = pts.mean(axis=0)
    _, _, vh = np.linalg.svd(pts - c, full_matrices=False)
    n = vh[-1]
    if n[1] > 0:
        # MoGe camera is OpenCV: y points down. An upward normal has negative y.
        n = -n
    n = n / np.linalg.norm(n)
    resid = (pts - c) @ n
    return n, c, float(np.sqrt(np.mean(resid ** 2)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--max-side", type=int, default=960)
    ap.add_argument("--level", type=int, default=5)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    im, tensor = load_image(args.image, args.max_side)
    w, h = im.size
    print(f"infer {w}x{h} level {args.level}", flush=True)
    model = vision_models.load_moge2()
    with torch.inference_mode():
        out = model.infer(tensor, resolution_level=args.level, use_fp16=False, force_projection=True, apply_mask=False)
    points = out["points"].detach().cpu().numpy().astype(np.float32)
    depth = out["depth"].detach().cpu().numpy().astype(np.float32)
    K = out["intrinsics"].detach().cpu().numpy().astype(np.float64)
    # intrinsics are normalised (principal point at 0.5). fx is in units of width.
    fx, fy = float(K[0, 0]), float(K[1, 1])
    vfov = float(np.degrees(2 * np.arctan(0.5 / fy)))
    hfov = float(np.degrees(2 * np.arctan(0.5 / fx)))
    # Causeway, hand-checked on key-zc1: the near slabs, inside the lips, above the foreground leaves.
    x0, x1 = int(w * 0.46), int(w * 0.58)
    y0, y1 = int(h * 0.80), int(h * 0.92)
    deck = points[y0:y1, x0:x1].reshape(-1, 3)
    finite = np.isfinite(deck).all(axis=1) & (deck[:, 2] > 0.2) & (deck[:, 2] < 80)
    deck = deck[finite]
    n, c, rms = fit_plane(deck)
    # Camera origin to the plane. Plane through c with normal n: height = -c·n if n points up
    # (origin is above the plane, n points toward the sky, so origin·n relative to plane is positive height).
    height = float(-(c @ n))  # wait, plane is (p-c)·n = 0, origin distance with sign
    # signed distance of the origin from the plane, along n. n points up (negative camera y),
    # origin is above the deck, so distance should be positive.
    signed = float(-(c @ n))
    if signed < 0:
        n = -n
        signed = -signed
    # Pitch: angle between the camera forward (+z) and the plane.
    # The ground's vanishing direction in the camera is the component of +z orthogonal to n.
    forward = np.array([0.0, 0.0, 1.0])
    # camera y is down. World up in camera frame is n.
    # Pitch above the horizon is positive when we look up: the angle from the horizontal
    # forward to +z. Horizontal forward is +z with the up-component removed.
    pitch = float(np.degrees(np.arctan2(float(np.dot(forward, n)), float(np.linalg.norm(np.cross(forward, n))))))
    # When looking along a horizontal, forward · up = 0, pitch 0.
    # When looking up, forward · up > 0 if n is up. Our n has negative camera-y if it points up,
    # and looking up means +z has a negative camera-y component, so forward·n > 0. Yes.
    depth_u8 = depth.copy()
    finite_d = np.isfinite(depth_u8)
    lo, hi = np.percentile(depth_u8[finite_d], [2, 98])
    vis = np.clip((depth_u8 - lo) / (hi - lo + 1e-6), 0, 1)
    vis[~finite_d] = 0
    Image.fromarray((vis * 255).astype(np.uint8)).save(args.out / "moge-depth.png")
    overlay = im.copy()
    dr = ImageDraw.Draw(overlay)
    dr.rectangle((x0, y0, x1, y1), outline=(255, 210, 40), width=3)
    overlay.save(args.out / "moge-deck-box.jpg", quality=90)
    np.save(args.out / "moge-depth.npy", depth)
    report = {
        "model": "moge-2",
        "licence": "MIT",
        "image": str(args.image),
        "inferSize": [w, h],
        "resolutionLevel": args.level,
        "intrinsicsNorm": K.tolist(),
        "hfovDeg": hfov,
        "vfovDeg": vfov,
        "deckBox": [x0, y0, x1, y1],
        "deckPoints": int(len(deck)),
        "planeNormalCamera": n.tolist(),
        "planePoint": c.tolist(),
        "planeRmsM": rms,
        "eyeHeightM": signed,
        "pitchDeg": pitch,
        "depthP50DeckM": float(np.median(deck[:, 2])),
        "note": "OpenCV camera: x right, y down, z forward. Pitch positive looks up.",
    }
    (args.out / "moge-ground.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({
        "vfov": round(vfov, 2),
        "hfov": round(hfov, 2),
        "eyeM": round(signed, 3),
        "pitch": round(pitch, 3),
        "rms": round(rms, 3),
        "deckZ": round(float(np.median(deck[:, 2])), 2),
        "points": int(len(deck)),
    }))


if __name__ == "__main__":
    main()
