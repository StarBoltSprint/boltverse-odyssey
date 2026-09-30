#!/usr/bin/env python3
"""Synthetic walk-around stills for the hull tool.

These are not Imagine pixels. They exist so the command can be run when the
repo has no 2026-09-30 rock views. Black void, one bumpy ellipsoid, 8 yaws.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

RX, RY, RZ = 0.56, 0.74, 0.50
WIDTH, HEIGHT = 160, 200
FOV_Y = 40.0
DISTANCE = 3.05
EYE_Y = 0.0

# Eight facing colors. The center of each still should stay this color.
BANDS = np.array(
    [
        [214, 92, 58],
        [206, 150, 52],
        [168, 176, 64],
        [64, 158, 104],
        [48, 132, 186],
        [72, 86, 196],
        [148, 72, 186],
        [196, 74, 122],
    ],
    dtype=np.float32,
)


def camera_pose(yaw_deg: float, distance: float, eye_y: float) -> dict:
    yaw = math.radians(yaw_deg)
    pos = np.array([math.sin(yaw) * distance, eye_y, math.cos(yaw) * distance], dtype=np.float64)
    forward = -pos / np.linalg.norm(pos)
    world_up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, world_up)
    right = right / np.linalg.norm(right)
    up = np.cross(right, forward)
    up = up / np.linalg.norm(up)
    return {"position": pos, "right": right, "up": up, "forward": forward}


def field(p: np.ndarray) -> np.ndarray:
    yaw = np.arctan2(p[..., 0], p[..., 2])
    bump = 1.0 + 0.04 * np.sin(3.0 * yaw) * np.cos(2.0 * p[..., 1] / RY)
    e = (p[..., 0] / RX) ** 2 + (p[..., 1] / RY) ** 2 + (p[..., 2] / RZ) ** 2
    return e - bump


def shade(pos: np.ndarray) -> np.ndarray:
    eps = 0.02
    gx = field(pos + np.array([eps, 0, 0])) - field(pos - np.array([eps, 0, 0]))
    gy = field(pos + np.array([0, eps, 0])) - field(pos - np.array([0, eps, 0]))
    gz = field(pos + np.array([0, 0, eps])) - field(pos - np.array([0, 0, eps]))
    n = np.stack([gx, gy, gz], axis=-1)
    n = n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-8)
    yaw = np.arctan2(n[..., 0], n[..., 2])
    band = np.floor((yaw + math.pi) / (2 * math.pi) * 8.0).astype(np.int32) % 8
    base = BANDS[band]
    speck = 0.82 + 0.18 * np.sin(pos[..., 0] * 28.0 + pos[..., 2] * 21.0)
    crack = np.abs(np.sin(pos[..., 0] * 10.0 + pos[..., 1] * 6.0))
    crack = np.where(crack < 0.08, 0.55, 1.0)
    rgb = base * speck[..., None] * crack[..., None]
    return np.clip(rgb, 0, 255)


def render(yaw_deg: float) -> tuple[np.ndarray, np.ndarray]:
    cam = camera_pose(yaw_deg, DISTANCE, EYE_Y)
    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH]
    fy = (HEIGHT * 0.5) / math.tan(math.radians(FOV_Y) * 0.5)
    fx = fy
    cx = (WIDTH - 1) * 0.5
    cy = (HEIGHT - 1) * 0.5
    x_cam = (xs - cx) / fx
    y_cam = -(ys - cy) / fy
    dirs = (
        x_cam[..., None] * cam["right"]
        + y_cam[..., None] * cam["up"]
        + np.ones_like(x_cam)[..., None] * cam["forward"]
    )
    dirs = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-8)
    eye = cam["position"]
    flat = dirs.reshape(-1, 3)
    t = np.full(flat.shape[0], 0.4, np.float64)
    hit_t = np.full(flat.shape[0], np.nan)
    step = 0.02
    for _ in range(220):
        pos = eye + flat * t[:, None]
        inside = field(pos) < 0
        new = inside & np.isnan(hit_t)
        hit_t[new] = t[new]
        t += step
        if np.all(~np.isnan(hit_t) | (t > 8)):
            break
    rgb = np.zeros((flat.shape[0], 3), np.uint8)
    depth = np.zeros(flat.shape[0], np.float32)
    ok = ~np.isnan(hit_t)
    if np.any(ok):
        pos = eye + flat[ok] * hit_t[ok, None]
        rgb[ok] = shade(pos).astype(np.uint8)
        ts = hit_t[ok]
        near = float(ts.min())
        far = float(ts.max())
        # Near = white, matching Depth Anything V2's contract in doc 60.
        depth[ok] = 1.0 - (ts - near) / max(1e-6, far - near)
    return rgb.reshape(HEIGHT, WIDTH, 3), depth.reshape(HEIGHT, WIDTH)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    view_dir = args.out / "views"
    depth_dir = args.out / "depth"
    view_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)
    views = []
    for i in range(8):
        yaw = i * 45.0
        name = f"yaw-{int(yaw):03d}.png"
        rgb, depth = render(yaw)
        Image.fromarray(rgb, "RGB").save(view_dir / name)
        Image.fromarray((np.clip(depth, 0, 1) * 255).astype(np.uint8), "L").save(depth_dir / name)
        views.append({"file": name, "yawDeg": yaw})
        print(f"wrote {name}")
    cfg = {
        "name": "synthetic-rock",
        "synthetic": True,
        "objectSize": [1.28, 1.62, 1.16],
        "vote": 7,
        "grid": 36,
        "bgThreshold": 0.04,
        "camera": {"distance": DISTANCE, "eyeY": EYE_Y, "fovYDeg": FOV_Y},
        "views": views,
        "placement": {"position": [0, 0, 0]},
    }
    (args.out / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    print(f"config {args.out / 'config.json'}")


if __name__ == "__main__":
    main()
