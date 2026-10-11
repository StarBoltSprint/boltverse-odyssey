"""Key-camera geometry for Zone B. Three.js Euler XYZ, the same order as main.mjs."""

from __future__ import annotations

import math

import numpy as np

AV_O = np.array([0.287, 1.349], np.float64)
AV_F = np.array([0.97933, -0.20233], np.float64)
AV_R = np.array([0.20817, 0.97938], np.float64)
AVENUE_HALF = 14.0
BASE_W = {"m2": 95 / 4.0, "m3": 110 / 4.0, "m4": 85 / 4.0, "m6": 60 / 3.4, "spire": 12.0}


def heading_to_dir(heading_deg: float, elevation_deg: float = 0.0) -> np.ndarray:
    h = math.radians(heading_deg)
    e = math.radians(elevation_deg)
    return np.array([math.sin(h) * math.cos(e), math.sin(e), -math.cos(h) * math.cos(e)], np.float64)


def dir_to_heading(d: np.ndarray) -> tuple[float, float]:
    x, y, z = (float(v) for v in d)
    heading = math.degrees(math.atan2(x, -z)) % 360.0
    elev = math.degrees(math.atan2(y, math.hypot(x, z)))
    return heading, elev


def av_xz(s: float, lat: float) -> tuple[float, float]:
    p = AV_O + AV_F * s + AV_R * lat
    return float(p[0]), float(p[1])


def xz_av(x: float, z: float) -> tuple[float, float]:
    """Inverse of av_xz. The avenue axes are not a perfect orthonormal pair."""
    d = np.array([x, z], np.float64) - AV_O
    m = np.stack([AV_F, AV_R], 1)
    s, lat = np.linalg.solve(m, d)
    return float(s), float(lat)


class Cam:
    """World camera. fov_deg is the vertical field, as in THREE.PerspectiveCamera."""

    def __init__(self, x, y, z, yaw, pitch, fov_deg, width, height):
        self.p = np.array([x, y, z], np.float64)
        self.yaw = float(yaw)
        self.pitch = float(pitch)
        self.fov = float(fov_deg)
        self.w = int(width)
        self.h = int(height)
        pr = math.radians(pitch)
        yr = math.radians(-yaw)
        cx, sx = math.cos(pr), math.sin(pr)
        cy, sy = math.cos(yr), math.sin(yr)
        self.right = np.array([cy, sx * sy, -cx * sy], np.float64)
        self.up = np.array([0.0, cx, sx], np.float64)
        self.forward = np.array([-sy, sx * cy, -cx * cy], np.float64)
        self.f = (self.h / 2.0) / math.tan(math.radians(self.fov) / 2.0)

    def project(self, points) -> tuple[np.ndarray, np.ndarray]:
        q = np.asarray(points, np.float64) - self.p
        cx = q @ self.right
        cy = q @ self.up
        depth = q @ self.forward
        safe = np.maximum(depth, 1e-4)
        uv = np.stack([self.w / 2 + self.f * cx / safe, self.h / 2 - self.f * cy / safe], 1)
        return uv, depth

    def ray(self, u: float, v: float) -> np.ndarray:
        x = (u - self.w / 2) / self.f
        y = (self.h / 2 - v) / self.f
        d = self.right * x + self.up * y + self.forward
        return d / np.linalg.norm(d)


def iou(a, b) -> float:
    a = np.asarray(a, bool)
    b = np.asarray(b, bool)
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 0.0
    return float(inter) / float(union)
