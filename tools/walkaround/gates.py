"""Source gates for a walk-around view set.

These checks run before a hull is carved. They do not rewrite stills and they
do not paint pixels. Sizes are read from the decoded file, not from a config
claim.

A cropped silhouette carves the volume down to the frame. An interior hole in
the alpha is a see-through stone on screen, because the projector discards
transparent texels. A camera whose right vector is cross(worldUp, forward)
mirrors every view.
"""

from __future__ import annotations

import math

import numpy as np

# Empty margin on every side of the frame. A mask that touches an edge is 0.
MARGIN_FRAC = 0.03
# Share of interior pixels (opaque plus enclosed holes) that may be transparent.
HOLE_MAX = 0.002
# Imagine stills are at most 2K on a side. Measured from the file.
MAX_EDGE_PX = 2048
# Pitch at or above this is a top or 3/4 still. An opening there is the hollow.
ELEVATED_PITCH = 25.0

HANDEDNESS = {
    "schema": "walkaround-basis-1",
    "worldUp": [0.0, 1.0, 0.0],
    "right": "cross(forward, worldUp)",
    "up": "cross(right, forward)",
    "yawZeroOn": "+Z",
    "positiveYawToward": "+X",
    "screenRightAtYaw0": "+X",
    "chase": "heading 0 looks +Z, heading 90 looks +X, right = cross(forward, worldUp). Negate the turn input if steering feels backwards. Do not negate right.",
}


def r4(value: float) -> float:
    return round(float(value), 4)


def ang_dist(a: float, b: float) -> float:
    d = abs((float(a) - float(b)) % 360.0)
    if d > 180.0:
        d = 360.0 - d
    return d


def view_index(bearing_deg: float, yaws: list[float]) -> int:
    """Index of the camera whose yaw is nearest `bearing_deg`.

    Bearing uses the same sign as yawDeg: 0 is the eye on +Z, positive bearing
    moves the eye toward +X. The mirror index (360 - bearing) is not selected
    unless that yaw really is the nearest.
    """
    if not yaws:
        raise ValueError("no yaws")
    best = 0
    best_d = 1e9
    for i, yaw in enumerate(yaws):
        d = ang_dist(bearing_deg, yaw)
        if d < best_d - 1e-9:
            best_d = d
            best = i
    return best


def right_matches(forward, right, atol: float = 1e-4) -> bool:
    """True when right is cross(forward, worldUp), not the mirrored cross."""
    fwd = np.asarray(forward, dtype=np.float64)
    world_up = np.array([0.0, 1.0, 0.0])
    expect = np.cross(fwd, world_up)
    norm = float(np.linalg.norm(expect))
    if norm < 1e-8:
        return True
    expect = expect / norm
    got = np.asarray(right, dtype=np.float64)
    return bool(np.allclose(got, expect, atol=atol))


def frame_margins(mask: np.ndarray) -> dict | None:
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return None
    h, w = mask.shape
    top = int(rows[0])
    bottom = int(h - 1 - rows[-1])
    left = int(cols[0])
    right = int(w - 1 - cols[-1])
    return {
        "topPx": top,
        "bottomPx": bottom,
        "leftPx": left,
        "rightPx": right,
        "topFrac": top / float(h),
        "bottomFrac": bottom / float(h),
        "leftFrac": left / float(w),
        "rightFrac": right / float(w),
        "minFrac": min(top / float(h), bottom / float(h), left / float(w), right / float(w)),
    }


def interior_hole_fraction(mask: np.ndarray) -> float:
    """Transparent pixels enclosed by the silhouette, over interior pixels.

    Interior = opaque pixels plus those enclosed holes. This is the director
    hole metric: a flood from the frame border, then holes / inside.
    """
    body = np.asarray(mask, dtype=bool)
    h, w = body.shape
    outside = np.zeros((h, w), dtype=bool)
    stack = []

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not body[y, x] and not outside[y, x]:
            outside[y, x] = True
            stack.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)
    while stack:
        y, x = stack.pop()
        push(y + 1, x)
        push(y - 1, x)
        push(y, x + 1)
        push(y, x - 1)
    inside = ~outside
    holes = int((inside & ~body).sum())
    denom = int(inside.sum())
    if denom == 0:
        return 0.0
    return holes / float(denom)


def _elevated(view: dict) -> bool:
    """True for a top or 3/4 still. Its enclosed opening is the hollow, not a hole to reject."""
    if view.get("elevated"):
        return True
    elev = view.get("elevationDeg")
    if elev is None:
        cam = view.get("cam") or {}
        elev = cam.get("pitchDeg", cam.get("elevationDeg"))
    if elev is None:
        return False
    return abs(float(elev)) >= ELEVATED_PITCH


def _raw_mask(view: dict) -> np.ndarray:
    raw = view.get("rawMask")
    if raw is not None:
        return raw
    return view["mask"]


def source_view_report(views: list[dict]) -> dict:
    """FAIL cropped frames, interior holes, or a still larger than 2K."""
    failures: list[str] = []
    rows = []
    min_margin = 1.0
    max_hole = 0.0
    max_edge = 0
    for view in views:
        width = int(view["width"])
        height = int(view["height"])
        max_edge = max(max_edge, width, height)
        mask = _raw_mask(view)
        margins = frame_margins(mask)
        hole = interior_hole_fraction(mask) if margins is not None else 0.0
        max_hole = max(max_hole, hole)
        if margins is not None:
            min_margin = min(min_margin, margins["minFrac"])
        row = {
            "file": view["file"],
            "width": width,
            "height": height,
            "measuredFrom": "file",
            "margin": None
            if margins is None
            else {k: (int(v) if k.endswith("Px") else r4(v)) for k, v in margins.items()},
            "holeFraction": r4(hole),
        }
        rows.append(row)
        if width > MAX_EDGE_PX or height > MAX_EDGE_PX:
            failures.append(
                f"FAIL size {view['file']} {width}x{height} measured from file, limit {MAX_EDGE_PX}"
            )
        if margins is None:
            failures.append(f"FAIL margin {view['file']} empty silhouette")
            continue
        if margins["minFrac"] + 1e-9 < MARGIN_FRAC:
            touched = []
            for side in ("top", "bottom", "left", "right"):
                if margins[f"{side}Frac"] + 1e-9 < MARGIN_FRAC:
                    touched.append(f"{side}={margins[f'{side}Px']}px")
            failures.append(
                f"FAIL margin {view['file']} {', '.join(touched)} minFrac={margins['minFrac']:.4f} limit={MARGIN_FRAC} (cropped views carve the hull)"
            )
        if not _elevated(view) and hole > HOLE_MAX + 1e-12:
            failures.append(
                f"FAIL holes {view['file']} interior={hole:.4f} limit={HOLE_MAX} (transparent interior is see-through on screen)"
            )
    if not views:
        min_margin = 0.0
    return {
        "status": "PASS" if not failures else "FAIL",
        "limits": {"marginFrac": MARGIN_FRAC, "holeFraction": HOLE_MAX, "maxEdgePx": MAX_EDGE_PX},
        "minMarginFrac": r4(min_margin),
        "maxHoleFraction": r4(max_hole),
        "maxEdgePx": int(max_edge),
        "views": rows,
        "failures": failures,
    }


def xz_radius(solid: np.ndarray, origin: np.ndarray, voxel_size: np.ndarray) -> float:
    """Ground radius of the occupied columns. This is the collider footprint."""
    idx = np.argwhere(np.asarray(solid))
    if len(idx) == 0:
        return 0.0
    origin = np.asarray(origin, dtype=np.float64)
    voxel_size = np.asarray(voxel_size, dtype=np.float64)
    xs = origin[0] + (idx[:, 0] + 0.5) * voxel_size[0]
    zs = origin[2] + (idx[:, 2] + 0.5) * voxel_size[2]
    return float(np.max(np.hypot(xs, zs)))


def _foreground(rgba: np.ndarray) -> np.ndarray:
    alpha = rgba[:, :, 3]
    if int(alpha.min()) < 250:
        return alpha > 16
    return rgba[:, :, :3].max(axis=2) > 10


def _nearest_resize(rgba: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    from PIL import Image

    h, w = shape
    im = Image.fromarray(rgba, "RGBA").resize((w, h), Image.Resampling.NEAREST)
    return np.array(im)


def color_mae(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float | None:
    if int(mask.sum()) < 16:
        return None
    diff = np.abs(a[mask].astype(np.float32) - b[mask].astype(np.float32))
    return float(diff.mean()) / 255.0


def mirror_against_sources(views: list[dict], qc_dir) -> dict:
    """QC render must agree with the source still better than with its mirror.

    A symmetric silhouette can tie. A tie is not a fail. A flipped camera,
    which matches the horizontal mirror better, is a fail.
    """
    from pathlib import Path
    from PIL import Image

    qc_dir = Path(qc_dir)
    rows = []
    failures = []
    conclusive = 0
    for view in views:
        if view.get("elevated"):
            continue
        stem = Path(view.get("stored", view["file"])).stem
        path = qc_dir / f"{stem}.png"
        if not path.is_file():
            continue
        src = view["rgba"]
        with Image.open(path) as im:
            qc = np.array(im.convert("RGBA"))
        if qc.shape[:2] != src.shape[:2]:
            qc = _nearest_resize(qc, src.shape[:2])
        fg = _foreground(src)
        same = color_mae(qc[:, :, :3], src[:, :, :3], fg)
        flip = src[:, ::-1]
        flipped = color_mae(qc[:, :, :3], flip[:, :, :3], fg)
        if same is None or flipped is None:
            continue
        winner = "same"
        if flipped + 0.02 < same:
            winner = "mirror"
        elif abs(same - flipped) <= 0.02:
            winner = "tie"
        else:
            conclusive += 1
        if winner == "same":
            conclusive += 1
        row = {
            "file": view["file"],
            "yawDeg": r4(view["yawDeg"]),
            "maeSame": r4(same),
            "maeMirror": r4(flipped),
            "winner": winner,
        }
        rows.append(row)
        if winner == "mirror":
            failures.append(
                f"FAIL handedness {view['file']} yaw={view['yawDeg']} maeMirror={flipped:.4f} maeSame={same:.4f} (render matches the horizontal mirror)"
            )
    return {
        "status": "PASS" if not failures else "FAIL",
        "conclusiveViews": conclusive,
        "views": rows,
        "failures": failures,
    }


def basis_report(views: list[dict]) -> dict:
    """Lock view index and the right-handed camera. No pixels are drawn."""
    from hull import camera_pose, project

    failures = []
    yaws = []
    for view in views:
        if view.get("elevated"):
            continue
        yaws.append(float(view["yawDeg"]))
        cam = view["cam"]
        if not right_matches(cam["forward"], cam["right"]):
            failures.append(
                f"FAIL handedness {view['file']} right is not cross(forward, worldUp)"
            )
    index_probe = None
    if yaws:
        got = view_index(90.0, yaws)
        mirror = view_index(270.0, yaws)
        index_probe = {
            "bearingDeg": 90.0,
            "yawDeg": r4(yaws[got]),
            "mirrorYawDeg": r4(yaws[mirror]),
        }
        if ang_dist(yaws[got], 90.0) > ang_dist(yaws[got], 270.0):
            failures.append(
                f"FAIL handedness view index at bearing 90 selected yaw {yaws[got]} (mirror of the ring)"
            )
    width, height, fov, distance = 160, 200, 40.0, 3.0
    if views:
        width = int(views[0]["width"])
        height = int(views[0]["height"])
        fov = float(views[0].get("fovY") or 40.0)
        distance = float(views[0]["cam"]["distance"])
    cam0 = camera_pose(0.0, distance, 0.0, None)
    u, _v, _z = project(np.array([[0.25, 0.0, 0.0]]), cam0, width, height, fov)
    center = (width - 1) * 0.5
    plus_x_right = float(u[0]) > center
    if not plus_x_right:
        failures.append(
            "FAIL handedness +X at yaw 0 is not screen-right. right must be cross(forward, worldUp)"
        )
    if not right_matches(cam0["forward"], cam0["right"]):
        failures.append("FAIL handedness yaw-0 probe right is mirrored")
    return {
        "status": "PASS" if not failures else "FAIL",
        "schema": HANDEDNESS["schema"],
        "contract": HANDEDNESS,
        "viewIndex": index_probe,
        "plusXAtYaw0IsScreenRight": plus_x_right,
        "screenU": r4(float(u[0])),
        "screenCenter": r4(center),
        "failures": failures,
    }


def chase_right_matches_hull(heading_deg: float = 180.0) -> dict:
    """Chase camera looking at the origin from +Z must share the hull's right.

    Heading 0 looks along +Z. Heading 180 looks along -Z, which is the
    walk-around yaw-0 camera (eye on +Z). Both rights are +X.
    """
    yaw = math.radians(heading_deg)
    forward = np.array([math.sin(yaw), 0.0, math.cos(yaw)], dtype=np.float64)
    world_up = np.array([0.0, 1.0, 0.0])
    right = np.cross(forward, world_up)
    right = right / np.linalg.norm(right)
    return {
        "headingDeg": heading_deg,
        "forward": [r4(v) for v in forward],
        "right": [r4(v) for v in right],
    }
