"""Known turnaround cameras. Invisible rig only. No pixels.

Yaw 0 sits on +Z and looks at the origin. +X is screen-right at yaw 0
(same basis as tools/walkaround). Elevation is degrees above the horizon.
"""

from __future__ import annotations

import math

import numpy as np

# Rail 12 turnaround class. The ship KEEP text says eighteen degrees;
# that elevation is passed in by the caller. It is not hardcoded here
# as a replacement for +15 on a new turnaround.
HFOV_DEG = 24.0
BLEND_LIMIT_DEG = 45.0


def wrap_deg(delta: float) -> float:
    return (float(delta) + 180.0) % 360.0 - 180.0


def yaw_weight(delta_deg: float, limit_deg: float = BLEND_LIMIT_DEG) -> float:
    """cos(yaw delta), and 0 past the limit. The limit itself still blends."""
    d = abs(wrap_deg(delta_deg))
    if d > float(limit_deg):
        return 0.0
    return float(math.cos(math.radians(d)))


def fov_y_deg(hfov_deg: float, width: int, height: int) -> float:
    hfov = math.radians(float(hfov_deg))
    return math.degrees(2.0 * math.atan(math.tan(hfov * 0.5) * (float(height) / float(width))))


def focal_px(width: int, hfov_deg: float) -> float:
    """f_px = (W / 2) / tan(HFOV / 2). Rail 12."""
    return (float(width) * 0.5) / math.tan(math.radians(float(hfov_deg)) * 0.5)


def camera_pose(yaw_deg: float, distance: float, elevation_deg: float) -> dict:
    yaw = math.radians(float(yaw_deg))
    elev = math.radians(float(elevation_deg))
    horiz = math.cos(elev) * float(distance)
    pos = np.array(
        [math.sin(yaw) * horiz, math.sin(elev) * float(distance), math.cos(yaw) * horiz],
        dtype=np.float64,
    )
    forward = -pos
    norm = float(np.linalg.norm(forward))
    if norm < 1e-8:
        raise ValueError("camera distance is zero")
    forward = forward / norm
    world_up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, world_up)
    rn = float(np.linalg.norm(right))
    if rn < 1e-8:
        raise ValueError("camera is on the world up axis")
    right = right / rn
    up = np.cross(right, forward)
    up = up / float(np.linalg.norm(up))
    return {
        "yawDeg": float(yaw_deg) % 360.0,
        "elevationDeg": float(elevation_deg),
        "position": pos,
        "right": right,
        "up": up,
        "forward": forward,
        "distance": float(distance),
    }


def project_points(points: np.ndarray, cam: dict, width: int, height: int, fov_y: float):
    """Image v grows downward. Square pixels. Principal point at the centre."""
    rel = np.asarray(points, np.float64) - cam["position"]
    x = rel @ cam["right"]
    y = rel @ cam["up"]
    z = rel @ cam["forward"]
    fy = (float(height) * 0.5) / math.tan(math.radians(float(fov_y)) * 0.5)
    z_safe = np.maximum(z, 1e-8)
    cx = (float(width) - 1.0) * 0.5
    cy = (float(height) - 1.0) * 0.5
    u = cx + fy * (x / z_safe)
    v = cy - fy * (y / z_safe)
    return u, v, z
