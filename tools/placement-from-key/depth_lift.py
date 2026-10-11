"""Depth Anything V2 relative depth, scaled by one ground-plane anchor, then a ray lift."""

from __future__ import annotations

import numpy as np
from PIL import Image

from geom import Cam, av_xz, xz_av

MODEL = "/workspace/grokcli/models/depth_anything_v2_small.onnx"
MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def relative_depth(path: str) -> np.ndarray:
    """Higher value is nearer. MoGe is not installed in this environment; DA V2 small is the depth."""
    import onnxruntime as ort

    im = Image.open(path).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im.resize((1280, 700), Image.Resampling.LANCZOS)).astype(np.float32) / 255
    ten = np.transpose((rgb - MEAN) / STD, (2, 0, 1))[None].astype(np.float32)
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    pred = sess.run(None, {"pixel_values": ten})[0][0].astype(np.float32)
    up = Image.fromarray(pred).resize((w, h), Image.Resampling.BILINEAR)
    return np.asarray(up).astype(np.float32)


def fit_disparity(cam: Cam, depth: np.ndarray, eye: float) -> dict:
    """Z = A / disparity, A from the avenue pixel at 92% of the frame height on the ground plane."""
    h, w = depth.shape
    u, v = w * 0.50, h * 0.92
    plane_y = cam.p[1] - eye
    rd = cam.ray(u, v)
    if abs(rd[1]) < 1e-4:
        raise RuntimeError("ground ray is parallel to the plane")
    t = (plane_y - cam.p[1]) / rd[1]
    if t <= 1:
        raise RuntimeError(f"ground anchor behind the camera t={t}")
    z_metric = float(np.dot(rd * t, cam.forward))
    d = float(depth[int(v), int(u)])
    # A second pixel checks the fit. It is reported, not used as a second free parameter.
    u2, v2 = w * 0.50, h * 0.72
    rd2 = cam.ray(u2, v2)
    t2 = (plane_y - cam.p[1]) / rd2[1]
    z2 = float(np.dot(rd2 * t2, cam.forward))
    d2 = float(depth[int(v2), int(u2)])
    A = z_metric * max(d, 1e-4)
    z2_pred = A / max(d2, 1e-4)
    return {
        "A": A,
        "anchorZ": z_metric,
        "anchorD": d,
        "checkZ": z2,
        "checkPred": z2_pred,
        "checkRel": abs(z2_pred - z2) / max(z2, 1e-3),
        "planeY": plane_y,
        "model": "depth-anything-v2-small",
        "moge": "not installed",
    }


def _mask_base(mask: np.ndarray) -> tuple[float, float, float, float]:
    ys, xs = np.nonzero(mask)
    yb = int(np.percentile(ys, 98))
    band = ys >= yb - 2
    u = float(np.median(xs[band]))
    top = float(ys.min())
    return u, float(yb), top, float(xs.max() - xs.min() + 1)


def lift_instances(cam: Cam, depth: np.ndarray, labels: np.ndarray, instances: list, fit: dict, layout: dict) -> list:
    A = fit["A"]
    h, w = labels.shape
    out = []
    by_id = {t["id"]: t for t in layout.get("towers", [])}
    by_id["spire"] = layout["spire"]
    for inst in instances:
        if not inst.get("lift", True):
            out.append({**inst, "status": "sky-sample"})
            continue
        label = int(inst["label"])
        mask = labels == label
        if mask.sum() < 20:
            out.append({**inst, "status": "empty-mask"})
            continue
        u, v, top, width_px = _mask_base(mask)
        ui, vi = int(np.clip(u, 0, w - 1)), int(np.clip(v, 0, h - 1))
        d = float(depth[vi, ui])
        Z = A / max(d, 1e-4)
        rd = cam.ray(u, v)
        # Camera depth Z is the forward component. Travel t along the unit ray until that depth.
        fwd = float(np.dot(rd, cam.forward))
        if fwd < 0.05 or not np.isfinite(Z) or Z < 8 or Z > 900:
            out.append({**inst, "status": "depth-reject", "Z": None if not np.isfinite(Z) else Z})
            continue
        t = Z / fwd
        world = cam.p + rd * t
        x, z = float(world[0]), float(world[2])
        s, lat = xz_av(x, z)
        height_m = max(4.0, (v - top) / cam.f * Z)
        from geom import dir_to_heading
        yaw, _elev = dir_to_heading(cam.p - np.array([x, 0.0, z]))
        row = {
            "id": inst["id"],
            "kind": inst["kind"],
            "label": label,
            "status": "lifted",
            "imageBase": [round(u, 1), round(v, 1)],
            "maskBox": inst.get("maskBox"),
            "pixels": inst.get("pixels"),
            "Z": round(Z, 2),
            "position": [round(x, 3), round(float(world[1]), 3), round(z, 3)],
            "s": round(s, 3),
            "lateral": round(lat, 3),
            "yaw": round(yaw % 360, 2),
            "heightM": round(height_m, 2),
            "widthPx": round(width_px, 1),
        }
        out.append(row)
    return out


# A disparity lift of a far silhouette lands at 10–40 m. Mesa meshes are city strata.
# Applying that lift raw puts the camera inside the rock. These caps keep the move a nudge.
AHEAD = {"tower": 55.0, "spire": 70.0, "mesa": 90.0}
MAX_DS = {"tower": 24.0, "spire": 24.0, "mesa": 30.0}
MAX_DLAT = {"tower": 12.0, "spire": 12.0, "mesa": 24.0}
LAT_FLOOR = {"tower": 22.0, "spire": 36.0, "mesa": 110.0}
SCALE_SPAN = {"tower": (0.80, 1.20), "spire": (0.80, 1.20), "mesa": (0.90, 1.10)}
YAW_SPAN = 30.0


def _wrap(deg: float) -> float:
    return (deg + 180.0) % 360.0 - 180.0


def clamp_sl(old_s: float, old_lat: float, want_s: float, want_lat: float, kind: str, cam_s: float) -> tuple[float, float]:
    """Nudge toward the lift. Never inside the avenue floor, never nearer than AHEAD."""
    ds = float(np.clip(want_s - old_s, -MAX_DS[kind], MAX_DS[kind]))
    dlat = float(np.clip(want_lat - old_lat, -MAX_DLAT[kind], MAX_DLAT[kind]))
    s = old_s + ds
    lat = old_lat + dlat
    floor_s = cam_s + AHEAD[kind]
    if s < floor_s:
        s = min(max(floor_s, old_s), old_s + MAX_DS[kind])
        if s < floor_s:
            s = old_s
    sign = 1.0 if old_lat >= 0 else -1.0
    if abs(lat) < LAT_FLOOR[kind]:
        lat = sign * LAT_FLOOR[kind]
    if abs(lat - old_lat) > MAX_DLAT[kind]:
        lat = old_lat + float(np.clip(lat - old_lat, -MAX_DLAT[kind], MAX_DLAT[kind]))
    if abs(lat) < LAT_FLOOR[kind]:
        lat = old_lat
    return float(s), float(lat)


def _yaw_near(old: float, want: float) -> float:
    dy = float(np.clip(_wrap(want - old), -YAW_SPAN, YAW_SPAN))
    return (old + dy) % 360.0


def _project(cam: Cam, s: float, lat: float) -> tuple[float, float]:
    x, z = av_xz(s, lat)
    uv, depth = cam.project([[x, float(cam.p[1]), z]])
    return float(uv[0, 0]), float(depth[0])


def assign_assets(lifts: list, layout: dict, mesa_layout: list, cam: Cam) -> dict:
    """Match lifted instances to existing rows, then nudge. Wreck and arch have no mesh.

    The raw lift is stored on each placed row. The applied s/lateral/scale stay inside
    clamp_sl so a bad disparity cannot drop a mesa into the lens.
    """
    towers = [dict(t) for t in layout["towers"]]
    spire = dict(layout["spire"])
    skyline = [dict(t) for t in layout.get("skyline", [])]
    cam_s, _cam_lat = xz_av(float(cam.p[0]), float(cam.p[2]))

    used = set()
    placed = []
    todos = []
    notes = [f"camera avenue s={cam_s:.2f}. Applied moves are clamped nudges. Raw lifts stay on each row."]

    def todo(row, status, reason):
        todos.append({
            "id": f"todo-{row['id']}",
            "kind": row["kind"],
            "status": status,
            "reason": reason,
            "transform": {
                "position": row["position"],
                "rotationDeg": {"yaw": row["yaw"], "leanDeg": 0, "leanAxisDeg": 90},
                "scale": [1, 1, 1],
            },
            "layout": {"s": row["s"], "lateral": row["lateral"], "height": row["heightM"]},
            "imageBase": row["imageBase"],
            "rawLift": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"]},
        })

    def nearest(cands, u_target):
        """cands: (obj, u, depth) with depth already > 40."""
        if not cands:
            return None
        cands.sort(key=lambda c: abs(c[1] - u_target))
        return cands[0]

    def take_tower(row):
        want = 1 if row["imageBase"][0] >= cam.w * 0.5 else -1
        # Prefer the side the mask sits on. Fall back to any visible tower.
        pool = []
        any_vis = []
        for t in towers:
            if t["id"] in used:
                continue
            u, depth = _project(cam, t["s"], t["lateral"])
            if depth < 40:
                continue
            any_vis.append((t, u, depth))
            side = 1 if t["lateral"] >= 0 else -1
            if side == want:
                pool.append((t, u, depth))
        return nearest(pool or any_vis, row["imageBase"][0])

    def take_mesa(row):
        want = 1 if row["imageBase"][0] >= cam.w * 0.5 else -1
        pool = []
        for m in mesa_layout:
            if m.get("_used"):
                continue
            u, depth = _project(cam, m["s"], m.get("lat", 0))
            if depth < 40:
                continue
            side = 1 if m.get("lat", 0) >= 0 else -1
            if side == want:
                pool.append((m, u, depth))
        return nearest(pool, row["imageBase"][0])

    for row in lifts:
        kind = row.get("kind")
        if row.get("status") != "lifted":
            continue
        if kind in ("wreck", "arch"):
            todo(row, "TODO", f"no {kind} mesh in objects1 or the live layout")
            notes.append(f"{row['id']}: TODO, no asset")
            continue
        if kind in ("rail", "slab"):
            todo(row, "procedural-not-an-asset", "objects-t7 draws these as code boxes on the avenue. No Imagine mesh to move. Target is recorded.")
            notes.append(f"{row['id']}: procedural, not retargeted")
            continue
        if kind == "spire":
            old_s = float(spire["s"])
            old_lat = float(spire["lateral"])
            old_yaw = float(spire.get("yaw") or 0)
            ns, nlat = clamp_sl(old_s, old_lat, row["s"], row["lateral"], "spire", cam_s)
            _u, depth = _project(cam, ns, nlat)
            old_h = float(spire.get("height") or 150)
            old_sc = float(spire.get("scale") or 1)
            px_h = float(row["heightM"]) / max(float(row["Z"]), 1e-3) * cam.f
            want_h = px_h / cam.f * max(depth, 1.0)
            lo, hi = SCALE_SPAN["spire"]
            factor = float(np.clip(want_h / old_h, lo, hi))
            spire["s"] = round(ns, 3)
            spire["lateral"] = round(nlat, 3)
            spire["x"], spire["z"] = av_xz(spire["s"], spire["lateral"])
            spire["yaw"] = round(_yaw_near(old_yaw, row["yaw"]), 2)
            spire["scale"] = round(old_sc * factor, 3)
            spire["height"] = round(old_h * factor, 2)
            placed.append({
                "id": "spire", "from": row["id"], "kind": "spire",
                "s": spire["s"], "lateral": spire["lateral"], "scale": spire["scale"],
                "yaw": spire["yaw"], "height": spire["height"],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            })
            continue
        if kind == "tower":
            hit = take_tower(row)
            if hit is None:
                notes.append(f"{row['id']}: no tower in front of the camera")
                continue
            t, _u0, _d0 = hit
            used.add(t["id"])
            old_s = float(t["s"])
            old_lat = float(t["lateral"])
            old_yaw = float(t.get("yaw") or 0)
            ns, nlat = clamp_sl(old_s, old_lat, row["s"], row["lateral"], "tower", cam_s)
            _u, depth = _project(cam, ns, nlat)
            old_h = float(t.get("height") or 90)
            old_sc = float(t.get("scale") or 1)
            px_h = float(row["heightM"]) / max(float(row["Z"]), 1e-3) * cam.f
            want_h = px_h / cam.f * max(depth, 1.0)
            lo, hi = SCALE_SPAN["tower"]
            factor = float(np.clip(want_h / max(old_h, 1.0), lo, hi))
            t["s"] = round(ns, 3)
            t["lateral"] = round(nlat, 3)
            t["x"], t["z"] = av_xz(t["s"], t["lateral"])
            t["yaw"] = round(_yaw_near(old_yaw, row["yaw"]), 2)
            t["scale"] = round(old_sc * factor, 3)
            t["height"] = round(old_h * factor, 2)
            placed.append({
                "id": t["id"], "from": row["id"], "kind": "tower",
                "s": t["s"], "lateral": t["lateral"], "scale": t["scale"],
                "yaw": t["yaw"], "height": t["height"],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            })
            continue
        if kind == "mesa":
            hit = take_mesa(row)
            if hit is None:
                notes.append(f"{row['id']}: no mesa in front of the camera on that side")
                continue
            m, _u0, _d0 = hit
            m["_used"] = True
            old_s = float(m["s"])
            old_lat = float(m.get("lat") or 0)
            old_sc = float(m.get("scale") or 1)
            old_yaw = float(m.get("yaw") or 0)
            ns, nlat = clamp_sl(old_s, old_lat, row["s"], row["lateral"], "mesa", cam_s)
            lo, hi = SCALE_SPAN["mesa"]
            m["s"] = round(ns, 2)
            m["lat"] = round(nlat, 2)
            m["scale"] = round(float(np.clip(old_sc, old_sc * lo, old_sc * hi)), 3)
            m["yaw"] = round(_yaw_near(old_yaw, row["yaw"]), 1)
            placed.append({
                "id": m["id"], "from": row["id"], "kind": "mesa",
                "s": m["s"], "lateral": m["lat"], "scale": m["scale"], "yaw": m["yaw"],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            })

    for t in towers:
        if t["id"] not in used:
            notes.append(f"{t['id']}: unmatched, left in place")
    for m in mesa_layout:
        m.pop("_used", None)
    return {
        "towers": towers,
        "spire": spire,
        "skyline": skyline,
        "mesas": mesa_layout,
        "placed": placed,
        "todos": todos,
        "notes": notes,
        "camS": round(cam_s, 3),
    }
