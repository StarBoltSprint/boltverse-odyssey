#!/usr/bin/env python3
"""Single-image Manhattan camera.

Line segments (OpenCV LSD, else probabilistic Hough) are clustered into
1–3 orthogonal vanishing points. Focal length, pitch, roll, and yaw come
from those points. Camera height and the ground plane come from a metric
depth map (MoGe-2 when no depth is passed).

camera.json is three.js Y-up: X right, Y up, the camera looks down -Z.
Units are metres.

  python3 tools/common/align/camera.py --image key.jpg --out camera.json
"""
from __future__ import annotations

import argparse
import json
import os

import cv2
import numpy as np


def _R(yaw_deg, pitch_deg, roll_deg):
    """World to camera. yaw 0 looks toward world -Z. Positive pitch looks down."""
    y, p, r = np.deg2rad([yaw_deg, pitch_deg, roll_deg])
    cy, sy = np.cos(y), np.sin(y)
    cp, sp = np.cos(p), np.sin(p)
    cr, sr = np.cos(r), np.sin(r)
    Ry = np.array([[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]], np.float64)
    Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]], np.float64)
    Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]], np.float64)
    return Rz @ Rx @ Ry


def project(points, cam_pos, yaw, pitch, roll, fx, fy, cx, cy):
    R = _R(yaw, pitch, roll)
    q = (R @ (np.asarray(points, np.float64) - np.asarray(cam_pos, np.float64)).T).T
    z = q[:, 2]
    depth = -z
    u = fx * q[:, 0] / np.maximum(depth, 1e-6) + cx
    v = cy - fy * q[:, 1] / np.maximum(depth, 1e-6)
    return np.stack([u, v], 1), depth, q


def render_box(width, height, fov_y_deg, pitch_deg, yaw_deg=0.0, roll_deg=0.0, height_m=1.6, center=(0.0, 2.2, -12.0), size=(3.2, 4.4, 2.4)):
    """Synthetic Manhattan box plus a ground grid. Returns gray, depth, truth."""
    fy = (height * 0.5) / np.tan(np.deg2rad(fov_y_deg) * 0.5)
    fx = fy
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    cam = np.array([0.0, height_m, 0.0], np.float64)
    sx, sy, sz = size
    cxw, cyw, czw = center
    xs = [cxw - sx / 2, cxw + sx / 2]
    ys = [cyw - sy / 2, cyw + sy / 2]
    zs = [czw - sz / 2, czw + sz / 2]
    corners = np.array([[x, y, z] for x in xs for y in ys for z in zs], np.float64)
    edges = []
    for i in range(8):
        for j in range(i + 1, 8):
            d = np.abs(corners[i] - corners[j])
            if np.sum(d > 1e-6) == 1:
                edges.append((i, j))
    img = np.full((height, width), 240, np.uint8)
    # Ground grid in front of the camera, world y = 0.
    for t in np.linspace(-8, 8, 9):
        a = np.array([[t, 0, -4], [t, 0, -28]], np.float64)
        b = np.array([[-8, 0, -6 - t], [8, 0, -6 - t]], np.float64)
        for seg in (a, b):
            uv, depth, _ = project(seg, cam, yaw_deg, pitch_deg, roll_deg, fx, fy, cx, cy)
            if np.all(depth > 0.2):
                p0 = tuple(np.round(uv[0]).astype(int))
                p1 = tuple(np.round(uv[1]).astype(int))
                cv2.line(img, p0, p1, 180, 1, cv2.LINE_8)
    for i, j in edges:
        uv, depth, _ = project(corners[[i, j]], cam, yaw_deg, pitch_deg, roll_deg, fx, fy, cx, cy)
        if np.any(depth <= 0.05):
            continue
        p0 = tuple(np.round(uv[0]).astype(int))
        p1 = tuple(np.round(uv[1]).astype(int))
        cv2.line(img, p0, p1, 0, 2, cv2.LINE_8)
    depth_map = _depth_map(width, height, fx, fy, cx, cy, cam, yaw_deg, pitch_deg, roll_deg, corners, edges)
    truth = {
        "fov_y_deg": float(fov_y_deg),
        "pitch_deg": float(pitch_deg),
        "roll_deg": float(roll_deg),
        "yaw_deg": float(yaw_deg),
        "height_m": float(height_m),
        "fx": float(fx),
        "fy": float(fy),
    }
    return img, depth_map, truth


def _depth_map(width, height, fx, fy, cx, cy, cam, yaw, pitch, roll, corners, edges):
    """Z-forward metres for ground pixels. The box occludes the ground."""
    R = _R(yaw, pitch, roll)
    # Ray in camera: ((u-cx)/fx, -(v-cy)/fy, -1), then world = R.T @ dir
    ys, xs = np.mgrid[0:height, 0:width]
    x = (xs - cx) / fx
    y = -(ys - cy) / fy
    d_c = np.stack([x, y, -np.ones_like(x)], -1)
    d_c = d_c / np.linalg.norm(d_c, axis=2, keepdims=True)
    d_w = d_c @ R  # row vectors times R.T is d_c @ R
    # Intersect y = 0: cam_y + t * d_w_y = 0
    t = np.full(xs.shape, np.nan, np.float64)
    hit = np.abs(d_w[..., 1]) > 1e-6
    t[hit] = -cam[1] / d_w[..., 1][hit]
    t[t < 0.05] = np.nan
    # Depth along the camera forward axis (-Z camera) equals t * forward component.
    forward = -d_c[..., 2]
    depth = t * forward
    return depth.astype(np.float32)


def detect_lines(gray):
    """Return segments Nx4 float. LSD when OpenCV has it, else Hough."""
    g = gray if gray.ndim == 2 else cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
    if g.dtype != np.uint8:
        g = np.clip(g, 0, 255).astype(np.uint8)
    if hasattr(cv2, "createLineSegmentDetector"):
        lsd = cv2.createLineSegmentDetector(cv2.LSD_REFINE_STD)
        lines = lsd.detect(g)[0]
        if lines is not None and len(lines):
            return lines.reshape(-1, 4).astype(np.float64)
    edges = cv2.Canny(g, 50, 150)
    segs = cv2.HoughLinesP(edges, 1, np.pi / 180, 30, minLineLength=18, maxLineGap=4)
    if segs is None:
        return np.zeros((0, 4), np.float64)
    return segs.reshape(-1, 4).astype(np.float64)


def _intersect(l1, l2):
    x1, y1, x2, y2 = l1
    x3, y3, x4, y4 = l2
    den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(den) < 1e-8:
        return None
    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / den
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / den
    return float(px), float(py)


def _fit_vp(segs, vp0):
    """Length-weighted line intersection. (vp - mid) is parallel to the segment."""
    A = []
    b = []
    w = []
    for s in segs:
        dx = float(s[2] - s[0])
        dy = float(s[3] - s[1])
        length = float(np.hypot(dx, dy))
        if length < 8:
            continue
        mx = (float(s[0]) + float(s[2])) * 0.5
        my = (float(s[1]) + float(s[3])) * 0.5
        A.append([dy, -dx])
        b.append(dy * mx - dx * my)
        w.append(length)
    if len(A) < 2:
        return vp0
    A = np.asarray(A, np.float64)
    b = np.asarray(b, np.float64)
    ww = np.asarray(w, np.float64)
    scale = ww / (ww.mean() + 1e-9)
    sol, _, _, _ = np.linalg.lstsq(A * scale[:, None], b * scale, rcond=None)
    if not np.isfinite(sol).all():
        return vp0
    return (float(sol[0]), float(sol[1]))


def _angle_err(seg, vp):
    mid = np.array([(seg[0] + seg[2]) * 0.5, (seg[1] + seg[3]) * 0.5])
    to = np.array(vp) - mid
    dr = np.array([seg[2] - seg[0], seg[3] - seg[1]])
    nt = np.linalg.norm(to) + 1e-9
    nd = np.linalg.norm(dr) + 1e-9
    c = abs(float(np.dot(to, dr) / (nt * nd)))
    c = min(1.0, c)
    return float(np.rad2deg(np.arccos(c)))


def _seg_angle(seg):
    return float(np.rad2deg(np.arctan2(seg[3] - seg[1], seg[2] - seg[0])))


def vanishing_points(lines, width, height, seed=0, iters=400):
    """RANSAC up to 3 VPs. Near-vertical segments are fitted first."""
    rng = np.random.default_rng(seed)
    segs = [s for s in lines if np.hypot(s[2] - s[0], s[3] - s[1]) >= 12]
    left = list(range(len(segs)))
    found = []
    vertical = [k for k in left if abs(abs(_seg_angle(segs[k])) - 90) < 18]
    if len(vertical) >= 4:
        vp = _fit_vp([segs[k] for k in vertical], (width * 0.5, height * 4.0))
        inl = [k for k in vertical if _angle_err(segs[k], vp) < 3.0]
        if len(inl) >= 4:
            vp = _fit_vp([segs[k] for k in inl], vp)
            found.append({"xy": [vp[0], vp[1]], "inliers": len(inl)})
            drop = set(inl)
            left = [k for k in left if k not in drop]
    for _vp in range(3 - len(found)):
        if len(left) < 6:
            break
        best = None
        idx = np.array(left)
        for _ in range(iters):
            i, j = rng.choice(idx, 2, replace=False)
            vp = _intersect(segs[i], segs[j])
            if vp is None:
                continue
            if not np.isfinite(vp[0]) or abs(vp[0]) > width * 30 or abs(vp[1]) > height * 30:
                continue
            inl = []
            for k in left:
                if _angle_err(segs[k], vp) < 2.5:
                    inl.append(k)
            if best is None or len(inl) > len(best[1]):
                best = (vp, inl)
        if best is None or len(best[1]) < 4:
            break
        vp = _fit_vp([segs[k] for k in best[1]], best[0])
        inl = [k for k in left if _angle_err(segs[k], vp) < 2.2]
        if len(inl) >= 4:
            vp = _fit_vp([segs[k] for k in inl], vp)
            inl = [k for k in left if _angle_err(segs[k], vp) < 2.2]
        if len(inl) < 4:
            break
        found.append({"xy": [vp[0], vp[1]], "inliers": len(inl)})
        drop = set(inl)
        left = [k for k in left if k not in drop]
    return found


def _f_from_pair(v1, v2, cx, cy):
    d = (v1[0] - cx) * (v2[0] - cx) + (v1[1] - cy) * (v2[1] - cy)
    if d >= -1.0:
        return None
    return float(np.sqrt(-d))


def _dir_from_vp(vp, f, cx, cy):
    d = np.array([(vp[0] - cx) / f, -(vp[1] - cy) / f, -1.0], np.float64)
    n = np.linalg.norm(d)
    return d / n


def solve_from_vps(vps, width, height):
    cx, cy = (width - 1) / 2.0, (height - 1) / 2.0
    if len(vps) < 2:
        return None
    pts = [v["xy"] for v in vps]
    # The vertical point is the one furthest from the principal point in y.
    vert_i = max(range(len(pts)), key=lambda i: abs(pts[i][1] - cy))
    vert = pts[vert_i]
    horiz = [pts[i] for i in range(len(pts)) if i != vert_i]
    # Focal length from each horizontal point paired with the vertical.
    scored = []
    for hp in horiz:
        f = _f_from_pair(hp, vert, cx, cy)
        if f is None or f < 0.3 * height or f > 8 * width:
            continue
        scored.append((f, hp))
    if not scored:
        return None
    # Two horizontal points should share a horizon. If their v's disagree,
    # keep the point nearer the principal x (the forward axis) and its f.
    if len(scored) >= 2 and abs(scored[0][1][1] - scored[1][1][1]) > 0.08 * height:
        scored.sort(key=lambda item: abs(item[1][0] - cx))
        scored = scored[:1]
    f = float(np.median([item[0] for item in scored]))
    horiz = [item[1] for item in scored]
    if len(horiz) == 1:
        # One finite horizontal point. Roll stays 0. Horizon is its v,
        # which is exact when that point is the forward axis.
        roll = 0.0
        v_h = float(horiz[0][1])
    else:
        h1 = np.array(horiz[0], np.float64)
        h2 = np.array(horiz[1], np.float64)
        direction = h2 - h1
        roll = float(np.rad2deg(np.arctan2(direction[1], direction[0])))
        if roll > 90:
            roll -= 180
        if roll < -90:
            roll += 180
        if abs(direction[0]) < 1e-6:
            v_h = float(h1[1])
        else:
            v_h = float(h1[1] + direction[1] * (cx - h1[0]) / direction[0])
    pitch = float(np.rad2deg(np.arctan2(cy - v_h, f)))
    dirs = []
    for hp in horiz:
        d = _dir_from_vp(hp, f, cx, cy)
        cp, sp = np.cos(np.deg2rad(-pitch)), np.sin(np.deg2rad(-pitch))
        Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]])
        dirs.append(Rx @ d)
    forward = min(dirs, key=lambda d: abs(d[0]))
    if forward[2] > 0:
        forward = -forward
    yaw = float(np.rad2deg(np.arctan2(forward[0], -forward[2])))
    fov_y = float(np.rad2deg(2 * np.arctan((height * 0.5) / f)))
    fov_x = float(np.rad2deg(2 * np.arctan((width * 0.5) / f)))
    return {
        "fx": f,
        "fy": f,
        "cx": cx,
        "cy": cy,
        "fov_y_deg": fov_y,
        "fov_x_deg": fov_x,
        "pitch_deg": pitch,
        "roll_deg": roll,
        "yaw_deg": yaw,
        "horizon_v": v_h,
        "vertical_vp": vert,
        "horizontal_vps": horiz,
    }


def ransac_plane(points, iters=80, thresh=0.08, seed=1):
    pts = np.asarray(points, np.float64)
    if len(pts) < 30:
        return None
    rng = np.random.default_rng(seed)
    best = None
    n = len(pts)
    for _ in range(iters):
        sel = pts[rng.choice(n, 3, replace=False)]
        nrm = np.cross(sel[1] - sel[0], sel[2] - sel[0])
        ln = np.linalg.norm(nrm)
        if ln < 1e-8:
            continue
        nrm = nrm / ln
        d = -float(np.dot(nrm, sel[0]))
        dist = np.abs(pts @ nrm + d)
        inl = dist < thresh
        count = int(inl.sum())
        if best is None or count > best[0]:
            best = (count, nrm, d, inl)
    if best is None or best[0] < 30:
        return None
    nrm, inl = best[1], best[3]
    A = np.c_[pts[inl], np.ones(int(inl.sum()))]
    # Fit n·x + d = 0 by SVD on centered points.
    c = pts[inl].mean(0)
    _, _, vt = np.linalg.svd(pts[inl] - c, full_matrices=False)
    nrm = vt[-1]
    nrm = nrm / np.linalg.norm(nrm)
    d = -float(np.dot(nrm, c))
    return {"normal": nrm.tolist(), "d": d, "inliers": int(inl.sum()), "rms": float(np.std(pts[inl] @ nrm + d))}


def ground_from_depth(depth, fx, fy, cx, cy, pitch_deg, horizon_v=None):
    """Back-project metric camera-forward depth. Height is the distance to the plane."""
    h, w = depth.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    z = np.asarray(depth, np.float64)
    ok = np.isfinite(z) & (z > 0.3) & (z < 80)
    if horizon_v is not None:
        ok &= ys > horizon_v + 4
    else:
        ok &= ys > h * 0.55
    if int(ok.sum()) < 50:
        ok = np.isfinite(z) & (z > 0.3) & (ys > h * 0.6)
    if int(ok.sum()) < 40:
        return None
    # Subsample.
    idx = np.flatnonzero(ok.ravel())
    if len(idx) > 4000:
        idx = idx[:: len(idx) // 4000]
    yy, xx = np.unravel_index(idx, ok.shape)
    zz = z[yy, xx]
    X = (xx - cx) / fx * zz
    Y = -(yy - cy) / fy * zz
    Z = -zz  # camera frame, in front is -Z
    pts = np.stack([X, Y, Z], 1)
    plane = ransac_plane(pts)
    if plane is None:
        return None
    # Distance from the camera origin to the plane.
    n = np.array(plane["normal"], np.float64)
    dist = abs(plane["d"]) / (np.linalg.norm(n) + 1e-9)
    # Sign: the ground is below the camera when the plane's Y in a level frame is negative.
    cp, sp = np.cos(np.deg2rad(-pitch_deg)), np.sin(np.deg2rad(-pitch_deg))
    # A point on the plane along the normal from the origin.
    if abs(plane["d"]) < 1e-8:
        height = 0.0
    else:
        point = -n * plane["d"] / (np.dot(n, n) + 1e-12)
        # Undo pitch so world-up is camera-up.
        y_level = cp * point[1] - sp * point[2]
        height = abs(float(y_level)) if abs(y_level) > 0.05 else float(dist)
    plane["height_m"] = float(height)
    plane["distance_m"] = float(dist)
    return plane


def solve(image, depth=None, image_path=None):
    """image is gray/RGB array or a path. depth is metric camera-forward metres or None (MoGe-2)."""
    if isinstance(image, str):
        image_path = image
        bgr = cv2.imread(image, cv2.IMREAD_COLOR)
        if bgr is None:
            raise FileNotFoundError(image)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    else:
        arr = np.asarray(image)
        gray = arr if arr.ndim == 2 else cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape[:2]
    lines = detect_lines(gray)
    vps = vanishing_points(lines, w, h)
    intr = solve_from_vps(vps, w, h)
    if intr is None:
        # Level fallback so callers still get a file. The selftest treats this as a miss.
        fy = (h * 0.5) / np.tan(np.deg2rad(40) * 0.5)
        intr = {
            "fx": fy, "fy": fy, "cx": (w - 1) / 2, "cy": (h - 1) / 2,
            "fov_y_deg": 40.0, "fov_x_deg": float(np.rad2deg(2 * np.arctan((w * 0.5) / fy))),
            "pitch_deg": 0.0, "roll_deg": 0.0, "yaw_deg": 0.0,
            "horizon_v": (h - 1) / 2, "vertical_vp": None, "horizontal_vps": [],
            "fallback": True,
        }
    depth_src = "given"
    if depth is None and image_path:
        depth_src = "moge-2"
        try:
            import sys
            tools = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            if tools not in sys.path:
                sys.path.insert(0, tools)
            from common.vision_models import depth_moge
            fov_x = intr["fov_x_deg"]
            depth = depth_moge(image_path, side=384, fov_x=float(fov_x), full=True)
        except Exception as exc:
            depth = None
            depth_src = f"unavailable: {exc}"
    plane = None
    if depth is not None:
        dh, dw = depth.shape[:2]
        if (dh, dw) != (h, w):
            depth = cv2.resize(np.asarray(depth, np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
        plane = ground_from_depth(depth, intr["fx"], intr["fy"], intr["cx"], intr["cy"], intr["pitch_deg"], intr.get("horizon_v"))
    height = None if plane is None else plane["height_m"]
    R = _R(intr["yaw_deg"], intr["pitch_deg"], intr["roll_deg"])
    # Camera position: above the origin by height, looking from (0, height, 0).
    hyp = 0.0 if height is None else float(height)
    position = [0.0, hyp, 0.0]
    t = (-R @ np.array(position)).tolist()
    cam = {
        "units": "m",
        "convention": "three.js Y-up, camera looks down -Z, image y down",
        "width": w,
        "height": h,
        "intrinsics": {
            "fx": intr["fx"], "fy": intr["fy"], "cx": intr["cx"], "cy": intr["cy"],
            "fov_y_deg": intr["fov_y_deg"], "fov_x_deg": intr["fov_x_deg"],
            "width": w, "height": h,
        },
        "extrinsics": {
            "yaw_deg": intr["yaw_deg"],
            "pitch_deg": intr["pitch_deg"],
            "roll_deg": intr["roll_deg"],
            "height_m": height,
            "position_m": position,
            "R_world_to_camera": R.tolist(),
            "t_world_to_camera": t,
        },
        "horizon": {"v": intr.get("horizon_v"), "roll_deg": intr["roll_deg"]},
        "vanishing_points": vps,
        "ground": plane,
        "depth_source": depth_src,
        "lines": int(len(lines)),
        "fallback": bool(intr.get("fallback")),
        "licences": {
            "opencv": "Apache-2.0",
            "numpy": "BSD-3-Clause",
            "moge-2": "MIT",
        },
    }
    return cam


def overlay(gray, cam, path):
    img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR) if gray.ndim == 2 else gray.copy()
    h, w = img.shape[:2]
    for vp in cam.get("vanishing_points") or []:
        x, y = vp["xy"]
        if -w < x < 2 * w and -h < y < 2 * h:
            cv2.circle(img, (int(x), int(y)), 8, (0, 0, 255), 2)
    hv = (cam.get("horizon") or {}).get("v")
    if hv is not None and np.isfinite(hv):
        roll = np.deg2rad((cam.get("horizon") or {}).get("roll_deg") or 0)
        x0, x1 = 0, w - 1
        y0 = int(hv + (0 - (w / 2)) * np.tan(roll))
        y1 = int(hv + ((w - 1) - (w / 2)) * np.tan(roll))
        cv2.line(img, (x0, y0), (x1, y1), (0, 180, 0), 2)
    cv2.imwrite(path, img)
    return path


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", required=True)
    ap.add_argument("--depth")
    ap.add_argument("--out", required=True)
    ap.add_argument("--overlay")
    a = ap.parse_args(argv)
    depth = np.load(a.depth) if a.depth else None
    cam = solve(a.image, depth=depth, image_path=a.image)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    json.dump(cam, open(a.out, "w"), indent=1)
    if a.overlay:
        gray = cv2.imread(a.image, cv2.IMREAD_GRAYSCALE)
        overlay(gray, cam, a.overlay)
    print(json.dumps({k: cam["extrinsics"][k] for k in ("yaw_deg", "pitch_deg", "roll_deg", "height_m")}, indent=1))
    print("fov_y", round(cam["intrinsics"]["fov_y_deg"], 3), "lines", cam["lines"], "vps", len(cam["vanishing_points"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
