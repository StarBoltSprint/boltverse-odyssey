"""Invisible mesh. TripoSR (one image) or a 4-view visual hull.

No colour is stored on the mesh. A network that paints its own
vertex colours is not used. Hidden sides stay untextured until an
Imagine view covers them.
"""

from __future__ import annotations

import importlib.util
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image

from cameras import camera_pose, fov_y_deg, project_points, wrap_deg

ROOT = Path(__file__).resolve().parents[2]
TRIPOSR_REPO = Path(os.environ.get("TRIPOSR_REPO", "/tmp/cursor/triposr/repo"))
TRIPOSR_CKPT = Path(os.environ.get("TRIPOSR_CKPT", "/tmp/cursor/triposr/model.ckpt"))
TRIPOSR_CFG = Path(os.environ.get("TRIPOSR_CFG", "/tmp/cursor/triposr/config.yaml"))

HULL_YAWS = (0, 90, 180, 270)
# Front, 3/4, side, back, and the mirrors of 45 and 90.
PROJECT_YAWS = (0, 45, 90, 180, 270, 315)


def _surface():
    path = ROOT / "tools" / "walkaround" / "surface.py"
    name = "walkaround_surface_for_mesh3d"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """Pixel tolerance so one drifted silhouette does not shave the hull."""
    out = np.asarray(mask, dtype=bool)
    for _ in range(max(0, int(radius))):
        padded = np.pad(out, 1, constant_values=False)
        out = (
            padded[1:-1, 1:-1]
            | padded[:-2, 1:-1]
            | padded[2:, 1:-1]
            | padded[1:-1, :-2]
            | padded[1:-1, 2:]
        )
    return out


def fill_enclosed(mask: np.ndarray) -> np.ndarray:
    """Holes that do not touch the frame fill in. Open fin gaps stay open."""
    body = np.asarray(mask, dtype=bool)
    h, w = body.shape
    outside = np.zeros((h, w), dtype=bool)
    stack = [(0, x) for x in range(w)]
    stack += [(h - 1, x) for x in range(w)]
    stack += [(y, 0) for y in range(h)]
    stack += [(y, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if y < 0 or x < 0 or y >= h or x >= w or body[y, x] or outside[y, x]:
            continue
        outside[y, x] = True
        stack.append((y + 1, x))
        stack.append((y - 1, x))
        stack.append((y, x + 1))
        stack.append((y, x - 1))
    return ~outside


def mask_from_rgba(rgba: np.ndarray) -> np.ndarray:
    return fill_enclosed(rgba[:, :, 3] > 16)


def load_view_pngs(folder: Path) -> list[dict]:
    views = []
    for path in sorted(folder.glob("yaw-*.png")):
        yaw = float(path.stem.split("-", 1)[1])
        rgba = np.asarray(Image.open(path).convert("RGBA"))
        views.append(
            {
                "file": path.name,
                "path": str(path),
                "yawDeg": yaw,
                "rgba": rgba,
                "mask": mask_from_rgba(rgba),
                "width": int(rgba.shape[1]),
                "height": int(rgba.shape[0]),
            }
        )
    if not views:
        raise FileNotFoundError(f"no yaw-*.png in {folder}")
    return views


def _pick(views: list[dict], yaw: float) -> dict:
    best = None
    best_d = 1e9
    for view in views:
        d = abs(wrap_deg(view["yawDeg"] - yaw))
        if d < best_d:
            best = view
            best_d = d
    if best is None or best_d > 0.5:
        raise FileNotFoundError(f"missing yaw {yaw}")
    return best


def carve_visual_hull(
    views: list[dict],
    yaws: tuple[int, ...] | list[int],
    distance: float,
    elevation_deg: float,
    hfov_deg: float,
    grid: int = 40,
    min_votes: int = 3,
    dilate_px: int = 8,
    extent: float | None = None,
) -> dict:
    """A voxel stays when `min_votes` dilated silhouettes contain it.

    Vote below the view count is the tolerance. One drifted plate does
    not delete the solid. The mesh has no colour.
    """
    chosen = [_pick(views, yaw) for yaw in yaws]
    width = chosen[0]["width"]
    height = chosen[0]["height"]
    fov_y = fov_y_deg(hfov_deg, width, height)
    if extent is None:
        extent = float(distance) * math.tan(math.radians(hfov_deg) * 0.5) * 1.35
    y_extent = extent * (float(height) / float(width))
    xs = np.linspace(-extent, extent, int(grid))
    ys = np.linspace(-y_extent, y_extent, int(grid))
    zs = np.linspace(-extent, extent, int(grid))
    step = np.array([xs[1] - xs[0], ys[1] - ys[0], zs[1] - zs[0]], np.float64)
    origin = np.array([xs[0], ys[0], zs[0]], np.float64)
    xx, yy, zz = np.meshgrid(xs, ys, zs, indexing="ij")
    pts = np.stack([xx, yy, zz], axis=-1).reshape(-1, 3)
    votes = np.zeros(len(pts), np.uint8)
    for view in chosen:
        cam = camera_pose(view["yawDeg"], distance, elevation_deg)
        mask = dilate(view["mask"], dilate_px)
        u, v, z = project_points(pts, cam, view["width"], view["height"], fov_y)
        ui = np.rint(u).astype(np.int32)
        vi = np.rint(v).astype(np.int32)
        inside = (z > 1e-4) & (ui >= 0) & (vi >= 0) & (ui < view["width"]) & (vi < view["height"])
        hit = np.zeros(len(pts), dtype=bool)
        sel = np.flatnonzero(inside)
        hit[sel] = mask[vi[sel], ui[sel]]
        votes += hit.astype(np.uint8)
    solid = (votes >= int(min_votes)).reshape(xx.shape)
    touched = bool(
        solid[0].any()
        or solid[-1].any()
        or solid[:, 0].any()
        or solid[:, -1].any()
        or solid[:, :, 0].any()
        or solid[:, :, -1].any()
    )
    surf = _surface()
    verts, faces = surf.surface_nets(solid.astype(np.float32), 0.5, origin, step)
    faces = surf.orient_outward(verts, faces)
    normals = surf.vertex_normals(verts, faces) if len(faces) else np.zeros((0, 3), np.float32)
    return {
        "vertices": np.asarray(verts, np.float32),
        "faces": np.asarray(faces, np.int32),
        "normals": np.asarray(normals, np.float32),
        "solidCount": int(solid.sum()),
        "grid": int(grid),
        "extent": float(extent),
        "boundaryTouch": touched,
        "minVotes": int(min_votes),
        "dilatePx": int(dilate_px),
        "hullYaws": [float(y) for y in yaws],
        "fovYDeg": float(fov_y),
        "engine": "visual-hull",
    }


def triposr_status() -> tuple[bool, str]:
    missing = []
    for name in ("torch", "einops", "omegaconf", "transformers"):
        if importlib.util.find_spec(name) is None:
            missing.append(name)
    if missing:
        return False, "import missing: " + ", ".join(missing)
    if not TRIPOSR_CKPT.is_file():
        return False, (
            f"weights missing: {TRIPOSR_CKPT} "
            "(stabilityai/TripoSR model.ckpt is about 1.6 GB; not stored in the repo)"
        )
    if not TRIPOSR_CFG.is_file():
        return False, f"config missing: {TRIPOSR_CFG}"
    if not (TRIPOSR_REPO / "tsr" / "system.py").is_file():
        return False, f"TripoSR repo missing: {TRIPOSR_REPO}"
    return True, "ok"


def rot_y(yaw_deg: float) -> np.ndarray:
    a = math.radians(float(yaw_deg))
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]], np.float64)


def transform_vertices(vertices: np.ndarray, yaw_deg: float, scale: float, center: np.ndarray) -> np.ndarray:
    v = (np.asarray(vertices, np.float64) - np.asarray(center, np.float64)) * float(scale)
    return (v @ rot_y(yaw_deg).T).astype(np.float32)


def align_yaw_scale(
    vertices: np.ndarray,
    faces: np.ndarray,
    views: list[dict],
    yaws: tuple[int, ...] | list[int],
    distance: float,
    elevation_deg: float,
    hfov_deg: float,
    iou_fn,
) -> dict:
    """Search a level yaw and one scale so the mesh matches the silhouettes.

    The search is the alignment. It does not paint.
    `iou_fn(vertices, faces, view, cam, fov_y) -> float`.
    """
    center = np.asarray(vertices, np.float64).mean(axis=0)
    chosen = [_pick(views, yaw) for yaw in yaws]
    fov_y = fov_y_deg(hfov_deg, chosen[0]["width"], chosen[0]["height"])
    cams = [camera_pose(v["yawDeg"], distance, elevation_deg) for v in chosen]
    best = {"iou": -1.0, "yawDeg": 0.0, "scale": 1.0}
    for yaw in range(0, 360, 15):
        for scale in (0.5, 0.75, 1.0, 1.35, 1.8):
            vv = transform_vertices(vertices, yaw, scale, center)
            score = 0.0
            for view, cam in zip(chosen, cams):
                score += float(iou_fn(vv, faces, view, cam, fov_y))
            score /= len(chosen)
            if score > best["iou"]:
                best = {"iou": score, "yawDeg": float(yaw), "scale": float(scale)}
    yaw0 = best["yawDeg"]
    scale0 = best["scale"]
    for yaw in (yaw0 - 10.0, yaw0, yaw0 + 10.0):
        for scale in (scale0 * 0.9, scale0, scale0 * 1.1):
            vv = transform_vertices(vertices, yaw, scale, center)
            score = 0.0
            for view, cam in zip(chosen, cams):
                score += float(iou_fn(vv, faces, view, cam, fov_y))
            score /= len(chosen)
            if score > best["iou"]:
                best = {"iou": score, "yawDeg": float(yaw), "scale": float(scale)}
    out = transform_vertices(vertices, best["yawDeg"], best["scale"], center)
    best["center"] = [float(x) for x in center]
    best["vertices"] = out
    return best
