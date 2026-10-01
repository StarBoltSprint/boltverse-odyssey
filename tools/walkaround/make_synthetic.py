#!/usr/bin/env python3
"""Synthetic walk-around stills for the hull tool.

These are not Imagine pixels. They exist so the command can be run when the
repo has no 2026-09-30 rock views. Black void, one bumpy ellipsoid, 8 yaws.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
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


def tube_inside(p: np.ndarray) -> np.ndarray:
    """Open vertical tube. Side views see a wall; a top view sees the hole."""
    radius = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2)
    return (np.abs(p[..., 1]) < 0.55) & (radius < 0.46) & (radius > 0.20)


def spur_inside(p: np.ndarray) -> np.ndarray:
    """Knob centered on its own origin. Radii stay close so the 8-view area lock holds."""
    return (p[..., 0] / 0.18) ** 2 + (p[..., 1] / 0.16) ** 2 + (p[..., 2] / 0.16) ** 2 < 1.0


def color_of(pos: np.ndarray) -> np.ndarray:
    yaw = np.arctan2(pos[..., 0], pos[..., 2])
    band = np.floor((yaw + math.pi) / (2 * math.pi) * 8.0).astype(np.int32) % 8
    base = BANDS[band]
    speck = 0.82 + 0.18 * np.sin(pos[..., 0] * 28.0 + pos[..., 2] * 21.0)
    return np.clip(base * speck[..., None], 0, 255)


def render_mask(yaw_deg: float, inside_fn, elevation_deg: float = 0.0) -> np.ndarray:
    """Raymarch a synthetic solid. Pixels are this generator's pattern, not a hull texture."""
    from hull import camera_pose

    elev = None if abs(elevation_deg) < 1e-6 else float(elevation_deg)
    cam = camera_pose(yaw_deg, DISTANCE, EYE_Y, elev)
    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH]
    fy = (HEIGHT * 0.5) / math.tan(math.radians(FOV_Y) * 0.5)
    cx = (WIDTH - 1) * 0.5
    cy = (HEIGHT - 1) * 0.5
    x_cam = (xs - cx) / fy
    y_cam = -(ys - cy) / fy
    dirs = (
        x_cam[..., None] * cam["right"]
        + y_cam[..., None] * cam["up"]
        + np.ones_like(x_cam)[..., None] * cam["forward"]
    )
    dirs = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-8)
    eye = cam["position"]
    flat = dirs.reshape(-1, 3)
    t = np.full(flat.shape[0], 0.35, np.float64)
    hit_t = np.full(flat.shape[0], np.nan)
    step = 0.012
    for _ in range(420):
        pos = eye + flat * t[:, None]
        inside = inside_fn(pos)
        new = inside & np.isnan(hit_t)
        hit_t[new] = t[new]
        t += step
        if np.all(~np.isnan(hit_t) | (t > 8.5)):
            break
    rgb = np.zeros((flat.shape[0], 3), np.uint8)
    ok = ~np.isnan(hit_t)
    if np.any(ok):
        pos = eye + flat[ok] * hit_t[ok, None]
        rgb[ok] = color_of(pos).astype(np.uint8)
    return rgb.reshape(HEIGHT, WIDTH, 3)


def write_views(out: Path, shots: list[tuple[str, float, float]], inside_fn, size, name: str) -> None:
    view_dir = out / "views"
    view_dir.mkdir(parents=True, exist_ok=True)
    views = []
    for file_name, yaw, elev in shots:
        rgb = render_mask(yaw, inside_fn, elev)
        Image.fromarray(rgb, "RGB").save(view_dir / file_name)
        item = {"file": file_name, "yawDeg": yaw}
        if abs(elev) > 1e-6:
            item["elevationDeg"] = elev
        views.append(item)
        print(f"wrote {file_name}")
    cfg = {
        "name": name,
        "synthetic": True,
        "objectSize": size,
        "vote": 7,
        "grid": 36,
        "bgThreshold": 0.04,
        "camera": {"distance": DISTANCE, "eyeY": EYE_Y, "fovYDeg": FOV_Y},
        "views": views,
        "placement": {"position": [0, 0, 0]},
    }
    (out / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")


def box_inside(p: np.ndarray) -> np.ndarray:
    return (np.abs(p[..., 0]) <= 0.46) & (np.abs(p[..., 1]) <= 0.60) & (np.abs(p[..., 2]) <= 0.42)


def cylinder_inside(p: np.ndarray) -> np.ndarray:
    radius = np.sqrt(p[..., 0] ** 2 + p[..., 2] ** 2)
    return (radius <= 0.40) & (np.abs(p[..., 1]) <= 0.55)


def hash_rgb(pos: np.ndarray) -> np.ndarray:
    """High-contrast cells so a CPU feature matcher has something to track."""
    q = np.floor(pos * 8.5).astype(np.int64)
    h = (q[..., 0] * 73856093) ^ (q[..., 1] * 19349663) ^ (q[..., 2] * 83492791)
    h = h.astype(np.uint64)
    rgb = np.stack([(h & 255), ((h >> 8) & 255), ((h >> 16) & 255)], axis=-1)
    return np.where(rgb >= 128, 235, 20).astype(np.uint8)


def ellipsoid_inside(p: np.ndarray, scale_x: float) -> np.ndarray:
    return (p[..., 0] / (0.52 * scale_x)) ** 2 + (p[..., 1] / 0.70) ** 2 + (p[..., 2] / 0.48) ** 2 < 1.0


def render_scaled(yaw_deg: float, elevation_deg: float, scale_x: float) -> np.ndarray:
    """Raymarch the turntable ellipsoid. scale_x != 1 is a morph, not a texture."""
    from hull import camera_pose

    elev = None if abs(elevation_deg) < 1e-6 else float(elevation_deg)
    cam = camera_pose(yaw_deg, DISTANCE, EYE_Y, elev)
    ys, xs = np.mgrid[0:HEIGHT, 0:WIDTH]
    fy = (HEIGHT * 0.5) / math.tan(math.radians(FOV_Y) * 0.5)
    cx = (WIDTH - 1) * 0.5
    cy = (HEIGHT - 1) * 0.5
    x_cam = (xs - cx) / fy
    y_cam = -(ys - cy) / fy
    dirs = (
        x_cam[..., None] * cam["right"]
        + y_cam[..., None] * cam["up"]
        + np.ones_like(x_cam)[..., None] * cam["forward"]
    )
    dirs = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-8)
    eye = cam["position"]
    flat = dirs.reshape(-1, 3)
    t = np.full(flat.shape[0], 0.35, np.float64)
    hit_t = np.full(flat.shape[0], np.nan)
    step = 0.012
    for _ in range(420):
        pos = eye + flat * t[:, None]
        inside = ellipsoid_inside(pos, scale_x)
        new = inside & np.isnan(hit_t)
        hit_t[new] = t[new]
        t += step
        if np.all(~np.isnan(hit_t) | (t > 8.5)):
            break
    rgb = np.zeros((flat.shape[0], 3), np.uint8)
    ok = ~np.isnan(hit_t)
    if np.any(ok):
        pos = eye + flat[ok] * hit_t[ok, None]
        rgb[ok] = hash_rgb(pos)
    return rgb.reshape(HEIGHT, WIDTH, 3)


def write_clip(frames: list[np.ndarray], dest: Path) -> None:
    tmp = dest.parent / f".{dest.stem}-frames"
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    for i, rgb in enumerate(frames, start=1):
        Image.fromarray(rgb, "RGB").save(tmp / f"f{i:04d}.png")
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            "8",
            "-i",
            str(tmp / "f%04d.png"),
            "-c:v",
            "png",
            "-pix_fmt",
            "rgb24",
            str(dest),
        ]
    )
    shutil.rmtree(tmp)


def write_turntable(out: Path, morph: bool) -> None:
    """Eight rigid HD stills, plus four 90° clips. Morph stretches only the clips."""
    view_dir = out / "views"
    view_dir.mkdir(parents=True, exist_ok=True)
    views = []
    for i in range(8):
        yaw = i * 45.0
        name = f"yaw-{int(yaw):03d}.png"
        Image.fromarray(render_scaled(yaw, 0.0, 1.0), "RGB").save(view_dir / name)
        views.append({"file": name, "yawDeg": yaw})
        print(f"wrote {name}")
    video_dir = out / "videos"
    video_dir.mkdir(parents=True, exist_ok=True)
    frames_per = 8
    for clip in range(4):
        yaw0 = clip * 90.0
        yaw1 = yaw0 + 90.0
        frames = []
        for k in range(frames_per):
            t = k / (frames_per - 1)
            yaw = yaw0 + (yaw1 - yaw0) * t
            if morph:
                global_t = (clip * (frames_per - 1) + k) / (4 * (frames_per - 1))
                scale = 1.0 + 0.65 * global_t
            else:
                scale = 1.0
            frames.append(render_scaled(yaw, 0.0, scale))
        write_clip(frames, video_dir / f"q{clip}.mp4")
        print(f"wrote q{clip}.mp4")
    turntables = [
        {"file": "videos/q0.mp4", "yawStartDeg": 0, "yawEndDeg": 90},
        {"file": "videos/q1.mp4", "yawStartDeg": 90, "yawEndDeg": 180},
        {"file": "videos/q2.mp4", "yawStartDeg": 180, "yawEndDeg": 270},
        {"file": "videos/q3.mp4", "yawStartDeg": 270, "yawEndDeg": 360},
    ]
    cfg = {
        "name": "synthetic-morph" if morph else "synthetic-turntable",
        "synthetic": True,
        "objectSize": [1.16, 1.52, 1.08],
        "vote": 7,
        "grid": 36,
        "bgThreshold": 0.04,
        "camera": {"distance": DISTANCE, "eyeY": EYE_Y, "fovYDeg": FOV_Y},
        "views": views,
        "turntables": turntables,
        "placement": {"position": [0, 0, 0]},
    }
    if not morph:
        top = []
        for k in range(4):
            t = k / 3.0
            top.append(render_scaled(0.0, 20.0 + (70.0 - 20.0) * t, 1.0))
        write_clip(top, video_dir / "top.mp4")
        cfg["topRise"] = {"file": "videos/top.mp4", "yawDeg": 0, "elevStartDeg": 20, "elevEndDeg": 70}
        print("wrote top.mp4")
    (out / "config.json").write_text(json.dumps(cfg, indent=2) + "\n")
    print(f"config {out / 'config.json'}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument(
        "--kind",
        choices=("rock", "bowl", "assembly", "box", "cylinder", "turntable", "morph"),
        default="rock",
    )
    args = parser.parse_args()
    if args.kind == "box":
        shots = [(f"yaw-{int(i*45):03d}.png", i * 45.0, 0.0) for i in range(8)]
        write_views(args.out, shots, box_inside, [0.92, 1.20, 0.84], "synthetic-box")
        return
    if args.kind == "cylinder":
        shots = [(f"yaw-{int(i*45):03d}.png", i * 45.0, 0.0) for i in range(8)]
        write_views(args.out, shots, cylinder_inside, [0.80, 1.10, 0.80], "synthetic-cylinder")
        return
    if args.kind in ("turntable", "morph"):
        write_turntable(args.out, morph=args.kind == "morph")
        return
    if args.kind == "bowl":
        shots = [(f"yaw-{int(i*45):03d}.png", i * 45.0, 0.0) for i in range(8)]
        shots.append(("top.png", 0.0, 90.0))
        shots.append(("three-quarter.png", 20.0, 42.0))
        write_views(args.out, shots, tube_inside, [1.05, 1.25, 1.05], "synthetic-bowl")
        return
    if args.kind == "assembly":
        # Parent stills are the body alone. The protruding part has its own view set.
        shots = [(f"yaw-{int(i*45):03d}.png", i * 45.0, 0.0) for i in range(8)]
        write_views(args.out, shots, lambda p: field(p) < 0, [1.28, 1.62, 1.16], "synthetic-assembly")
        spur_shots = [(f"yaw-{int(i*45):03d}.png", i * 45.0, 0.0) for i in range(8)]
        write_views(args.out / "spur", spur_shots, spur_inside, [0.48, 0.42, 0.42], "spur")
        parent = json.loads((args.out / "config.json").read_text())
        parent["subObjects"] = [
            {
                "name": "spur",
                "config": "spur/config.json",
                "viewsDir": "spur/views",
                "joint": [0.48, 0.08, 0.0],
                "localAttach": [-0.08, 0.0, 0.0],
                "axis": [0.0, 1.0, 0.0],
            }
        ]
        (args.out / "config.json").write_text(json.dumps(parent, indent=2) + "\n")
        print(f"config {args.out / 'config.json'}")
        return
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
