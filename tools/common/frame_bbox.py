#!/usr/bin/env python3
"""Frame a checklist camera on one target AABB.

Views: close (8 m off the front face), low-portrait (eye 1.6 m, 8 m off the face),
far (pulled back, field narrowed so the box still fills the frame), ortho-front,
ortho-side. Ortho frames use the face aspect so the box covers at least 60 %.
Prints one JSON object. Does not draw.
"""
import json
import math
import sys

CLOSE_M = 8.0
LOW_EYE_M = 1.6
FAR_HEIGHT_MUL = 2.2
FAR_MIN_M = 120.0
MARGIN = 0.08
ORTHO_MARGIN = 0.02
MIN_COVER = 0.25
ORTHO_MIN_COVER = 0.60
ORTHO_LONG = 1024


def _sub(a, b):
    return [a[i] - b[i] for i in range(3)]


def _add(a, b):
    return [a[i] + b[i] for i in range(3)]


def _mul(a, s):
    return [a[i] * s for i in range(3)]


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def _norm(a):
    n = math.sqrt(_dot(a, a)) or 1.0
    return [a[0] / n, a[1] / n, a[2] / n]


def _center(mn, mx):
    return [(mn[i] + mx[i]) * 0.5 for i in range(3)]


def _corners(mn, mx):
    out = []
    for x in (mn[0], mx[0]):
        for y in (mn[1], mx[1]):
            for z in (mn[2], mx[2]):
                out.append([x, y, z])
    return out


def _horizontal(front):
    fx, fz = float(front[0]), float(front[1] if len(front) == 2 else front[2])
    n = math.hypot(fx, fz) or 1.0
    return [fx / n, 0.0, fz / n]


def _extent_along(mn, mx, axis):
    c = _center(mn, mx)
    return max(_dot(_sub(p, c), axis) for p in _corners(mn, mx))


def _fit_fov(eye, target, up, corners, aspect, margin=MARGIN):
    forward = _norm(_sub(target, eye))
    right = _norm(_cross(forward, up))
    upv = _cross(right, forward)
    max_ax = 1e-6
    max_ay = 1e-6
    for p in corners:
        v = _sub(p, eye)
        z = _dot(v, forward)
        if z < 0.05:
            continue
        max_ax = max(max_ax, abs(_dot(v, right) / z))
        max_ay = max(max_ay, abs(_dot(v, upv) / z))
    span = 1.0 - 2.0 * margin
    tan_v = max(max_ay / span, (max_ax / span) / aspect)
    tan_v = min(tan_v, math.tan(math.radians(85)))
    tan_h = aspect * tan_v
    wfrac = min(1.0, max_ax / tan_h)
    hfrac = min(1.0, max_ay / tan_v)
    fov_y = math.degrees(2.0 * math.atan(tan_v))
    return fov_y, wfrac * hfrac, forward, right, upv


def frame_view(mn, mx, view, width, height, front=(0.0, 0.0, 1.0)):
    mn = [float(v) for v in mn]
    mx = [float(v) for v in mx]
    width = int(width)
    height = int(height)
    if width < 8 or height < 8:
        raise ValueError("frame is too small")
    aspect = width / height
    c = _center(mn, mx)
    fwd = _horizontal(front)
    # Camera sits on the front side and looks toward the center (view direction = -fwd).
    view_dir = _mul(fwd, -1.0)
    side = _norm(_cross([0.0, 1.0, 0.0], view_dir))
    depth = _extent_along(mn, mx, fwd)
    height_m = mx[1] - mn[1]
    up = [0.0, 1.0, 0.0]
    corners = _corners(mn, mx)

    if view in ("ortho-front", "ortho-side", "ortho-top"):
        if view == "ortho-front":
            face_w = _extent_along(mn, mx, side) * 2.0
            face_h = height_m
            eye = _add(c, _mul(fwd, depth + max(height_m, 1.0)))
            up = [0.0, 1.0, 0.0]
        elif view == "ortho-side":
            face_w = depth * 2.0
            face_h = height_m
            eye = _add(c, _mul(side, _extent_along(mn, mx, side) + max(height_m, 1.0)))
            up = [0.0, 1.0, 0.0]
        else:
            face_w = _extent_along(mn, mx, side) * 2.0
            face_h = depth * 2.0
            eye = _add(c, [0.0, height_m + max(face_w, 1.0), 0.0])
            up = [0.0, 0.0, -1.0]
        face_w = max(face_w, 1e-3)
        face_h = max(face_h, 1e-3)
        span = 1.0 - 2.0 * ORTHO_MARGIN
        ortho_w = face_w / span
        ortho_h = face_h / span
        # Match the pixel aspect to the face so both axes fill `span` (cover >= 60 %).
        aspect_face = ortho_w / ortho_h
        if aspect_face >= 1.0:
            pw, ph = ORTHO_LONG, max(8, int(round(ORTHO_LONG / aspect_face)))
        else:
            ph, pw = ORTHO_LONG, max(8, int(round(ORTHO_LONG * aspect_face)))
        cover = span * span
        return {
            "view": view,
            "kind": "ortho",
            "eye": eye,
            "target": c,
            "up": up,
            "orthoW": ortho_w,
            "orthoH": ortho_h,
            "near": 0.05,
            "far": max(height_m * 8.0, 500.0),
            "width": pw,
            "height": ph,
            "fovY": None,
            "coverEst": round(cover, 4),
            "minCover": ORTHO_MIN_COVER,
            "distanceM": None,
        }

    if view == "close":
        dist = CLOSE_M
        eye_y = c[1]
    elif view == "low-portrait":
        dist = CLOSE_M
        eye_y = mn[1] + LOW_EYE_M
    elif view == "far":
        dist = max(FAR_HEIGHT_MUL * height_m, FAR_MIN_M)
        eye_y = c[1]
    else:
        raise ValueError(f"unknown checklist view {view}")
    eye = _add(c, _mul(fwd, depth + dist))
    eye[1] = eye_y
    fov_y, cover, *_ = _fit_fov(eye, c, up, corners, aspect)
    return {
        "view": view,
        "kind": "persp",
        "eye": eye,
        "target": c,
        "up": up,
        "orthoW": None,
        "orthoH": None,
        "near": 0.05,
        "far": max(8000.0, dist + height_m * 4.0),
        "width": width,
        "height": height,
        "fovY": round(fov_y, 4),
        "coverEst": round(cover, 4),
        "minCover": MIN_COVER,
        "distanceM": dist,
    }


def main():
    raw = sys.argv[1] if len(sys.argv) > 1 else sys.stdin.read()
    spec = json.loads(raw)
    pose = frame_view(
        spec["min"], spec["max"], spec["view"], spec.get("width", 412), spec.get("height", 915),
        spec.get("front") or (0.0, 0.0, 1.0),
    )
    print(json.dumps(pose))


if __name__ == "__main__":
    main()
