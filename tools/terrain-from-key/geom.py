"""Key-camera rays in the Zone B convention (Three.js YXZ, yaw about Y, pitch about X)."""

from __future__ import annotations

import math

import numpy as np


def pitch_for_horizon(fov_deg: float, horizon_row: float, aspect: float) -> float:
    """Pitch (degrees) that puts a flat-ground horizon on `horizon_row` (0 top, 1 bottom)."""
    ndc_y = 1.0 - 2.0 * horizon_row
    ly = ndc_y * math.tan(math.radians(fov_deg) * 0.5)
    return math.degrees(math.atan(-ly))


def camera_axes(yaw_deg: float, pitch_deg: float):
    """Right, up, forward. Matches three.module.js makeRotationFromEuler order YXZ, roll 0.

    rotation.y = -yaw, rotation.x = pitch. Forward matches getWorldDirection.
    """
    yaw = math.radians(yaw_deg)
    pitch = math.radians(pitch_deg)
    cy, sy = math.cos(yaw), math.sin(yaw)
    cp, sp = math.cos(pitch), math.sin(pitch)
    # local +X
    right = np.array([cy, 0.0, sy], np.float64)
    # local +Y
    up = np.array([-sy * sp, cp, cy * sp], np.float64)
    # -local Z
    forward = np.array([cp * sy, sp, -cp * cy], np.float64)
    return right, up, forward


def ray_directions(yaw_deg, pitch_deg, fov_deg, width, height):
    """Unit rays for pixel centres. Shape (height, width, 3)."""
    aspect = width / height
    t = math.tan(math.radians(fov_deg) * 0.5)
    p00 = 1.0 / (aspect * t)
    p11 = 1.0 / t
    xs = (np.arange(width, dtype=np.float64) + 0.5) / width * 2.0 - 1.0
    ys = 1.0 - (np.arange(height, dtype=np.float64) + 0.5) / height * 2.0
    ndc_x, ndc_y = np.meshgrid(xs, ys)
    lx = ndc_x / p00
    ly = ndc_y / p11
    lz = -np.ones_like(lx)
    right, up, forward = camera_axes(yaw_deg, pitch_deg)
    # L = (lx, ly, -1); world = lx*right + ly*up + (-1)*(-forward wait)
    # local Z is -forward, so z_cam=-1 contributes +forward.
    world = (
        lx[..., None] * right
        + ly[..., None] * up
        + (-lz)[..., None] * forward
    )
    # lz is -1, -lz is +1, times forward. Yes.
    n = np.linalg.norm(world, axis=-1, keepdims=True)
    return world / np.maximum(n, 1e-8)


def plane_t(origin_y: float, dirs, y_plane: float = 0.0):
    """Distance along the ray to the plane y = y_plane. NaN if the ray misses."""
    dy = dirs[..., 1]
    t = np.full(dy.shape, np.nan, np.float64)
    hit = dy < -1e-4
    t[hit] = (y_plane - origin_y) / dy[hit]
    return t
