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
    metric = bool(fit.get("metric"))
    A = fit.get("A") or 1.0
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
        Z = d if metric else A / max(d, 1e-4)
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


# MoGe metres are applied. A mesa that the net puts inside the lens is pushed out:
# that is the rock-wall failure. Towers keep the metric seat and only leave the avenue.
AHEAD = {"tower": 18.0, "spire": 55.0, "mesa": 90.0}
LAT_FLOOR = {"tower": 18.0, "spire": 12.0, "mesa": 80.0}
LAT_PUSH = {"tower": 22.0, "spire": 16.0, "mesa": 110.0}
SCALE_SPAN = {"tower": (0.40, 2.40), "spire": (0.45, 2.20), "mesa": (0.90, 1.10)}
YAW_SPAN = 40.0


def _wrap(deg: float) -> float:
    return (deg + 180.0) % 360.0 - 180.0


def guard_seat(s: float, lat: float, cam_s: float, kind: str, side: float) -> tuple[float, float]:
    """Keep a metric seat. Mesas and the spire cannot enter the lens. Towers flank the avenue."""
    s = float(s)
    lat = float(lat)
    floor_s = cam_s + AHEAD[kind]
    if s < floor_s:
        s = floor_s
    sign = 1.0 if side >= 0 else -1.0
    if kind == "mesa":
        if abs(lat) < LAT_FLOOR[kind]:
            lat = sign * LAT_PUSH[kind]
        elif lat * sign < 0:
            lat = sign * abs(lat)
    elif kind == "spire":
        if lat < LAT_FLOOR[kind]:
            lat = LAT_PUSH[kind]
    else:
        if abs(lat) < LAT_FLOOR[kind] or lat * sign < 0:
            lat = sign * LAT_PUSH[kind]
    return float(s), float(lat)


def clamp_sl(old_s: float, old_lat: float, want_s: float, want_lat: float, kind: str, cam_s: float) -> tuple[float, float]:
    """Compatibility name. The seat is the metric target, guarded, not a nudge from old_s."""
    side = 1.0 if want_lat >= 0 else -1.0
    if kind == "tower" and abs(want_lat) < 1:
        side = 1.0 if old_lat >= 0 else -1.0
    return guard_seat(want_s, want_lat, cam_s, kind, side)


def _yaw_near(old: float, want: float) -> float:
    dy = float(np.clip(_wrap(want - old), -YAW_SPAN, YAW_SPAN))
    return (old + dy) % 360.0


def _project(cam: Cam, s: float, lat: float) -> tuple[float, float]:
    x, z = av_xz(s, lat)
    uv, depth = cam.project([[x, float(cam.p[1]), z]])
    return float(uv[0, 0]), float(depth[0])


def _sync(assign_towers, spire, mesas, row):
    kind = row["kind"]
    if kind == "mesa":
        for m in mesas:
            if m["id"] == row["id"]:
                m["s"] = row["s"]
                m["lat"] = row["lateral"]
                m["scale"] = row["scale"]
                m["yaw"] = row["yaw"]
                return
    target = spire if kind == "spire" else next(t for t in assign_towers if t["id"] == row["id"])
    target["s"] = row["s"]
    target["lateral"] = row["lateral"]
    target["x"], target["z"] = av_xz(row["s"], row["lateral"])
    target["yaw"] = row["yaw"]
    target["scale"] = row["scale"]
    if row.get("height") is not None:
        target["height"] = row["height"]


def enforce_order(assign: dict) -> int:
    """Nearer in the key (larger image v) gets the nearer avenue s. Laterals stay."""
    rows = [p for p in assign["placed"] if p.get("kind") in ("tower", "spire", "mesa")]
    if len(rows) < 2:
        return 0
    before = 0
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a["imageV"] > b["imageV"] + 12 and a["s"] > b["s"] + 8:
                before += 1
            elif b["imageV"] > a["imageV"] + 12 and b["s"] > a["s"] + 8:
                before += 1
    seats = sorted(float(p["s"]) for p in rows)
    for p, s in zip(sorted(rows, key=lambda r: -float(r["imageV"])), seats):
        p["s"] = round(s, 3)
        _sync(assign["towers"], assign["spire"], assign["mesas"], p)
    return before


def assign_assets(lifts: list, layout: dict, mesa_layout: list, cam: Cam) -> dict:
    """Place existing assets on the MoGe seats, as two rows flanking the avenue.

    Wreck and arch have no mesh: TODO markers. A mesa lift inside the lens is
    pushed out. Extra towers and the skyline park behind the camera so the key
    frame shows the two rows, the spire, and the left and right mesas.
    """
    towers = [dict(t) for t in layout["towers"]]
    spire = dict(layout["spire"])
    skyline = [dict(t) for t in layout.get("skyline", [])]
    cam_s, _cam_lat = xz_av(float(cam.p[0]), float(cam.p[2]))

    used = set()
    placed = []
    todos = []
    notes = [f"camera avenue s={cam_s:.2f}. Seats are MoGe metres, guarded. Repeated towers stay instanced per module."]

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

    def take_tower(row, side):
        pool = [t for t in towers if t["id"] not in used and ((1 if t["lateral"] >= 0 else -1) == side)]
        if not pool:
            pool = [t for t in towers if t["id"] not in used]
        if not pool:
            return None
        pool.sort(key=lambda t: abs(t["lateral"]))
        return pool[0]

    def take_mesa(row, side):
        pool = []
        for m in mesa_layout:
            if m.get("_used"):
                continue
            mside = 1 if m.get("lat", 0) >= 0 else -1
            if mside == side:
                pool.append(m)
        if not pool:
            return None
        pool.sort(key=lambda m: abs(m.get("lat", 0)))
        return pool[0]

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
        side = 1 if row["imageBase"][0] >= cam.w * 0.5 else -1
        if kind == "spire":
            old_s = float(spire["s"])
            old_lat = float(spire["lateral"])
            old_yaw = float(spire.get("yaw") or 0)
            old_h = float(spire.get("height") or 150)
            old_sc = float(spire.get("scale") or 1)
            ns, nlat = guard_seat(row["s"], row["lateral"], cam_s, "spire", 1)
            lo, hi = SCALE_SPAN["spire"]
            factor = float(np.clip(float(row["heightM"]) / max(old_h, 1.0), lo, hi))
            rec = {
                "id": "spire", "from": row["id"], "kind": "spire",
                "s": round(ns, 3), "lateral": round(nlat, 3), "scale": round(old_sc * factor, 3),
                "yaw": round(_yaw_near(old_yaw, row["yaw"]), 2), "height": round(old_h * factor, 2),
                "imageU": row["imageBase"][0], "imageV": row["imageBase"][1],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            }
            _sync(towers, spire, mesa_layout, rec)
            placed.append(rec)
            continue
        if kind == "tower":
            t = take_tower(row, side)
            if t is None:
                notes.append(f"{row['id']}: no tower asset")
                continue
            used.add(t["id"])
            old_s = float(t["s"])
            old_lat = float(t["lateral"])
            old_yaw = float(t.get("yaw") or 0)
            old_h = float(t.get("height") or 90)
            old_sc = float(t.get("scale") or 1)
            ns, nlat = guard_seat(row["s"], row["lateral"], cam_s, "tower", side)
            lo, hi = SCALE_SPAN["tower"]
            factor = float(np.clip(float(row["heightM"]) / max(old_h, 1.0), lo, hi))
            rec = {
                "id": t["id"], "from": row["id"], "kind": "tower",
                "s": round(ns, 3), "lateral": round(nlat, 3), "scale": round(old_sc * factor, 3),
                "yaw": round(_yaw_near(old_yaw, row["yaw"]), 2), "height": round(old_h * factor, 2),
                "imageU": row["imageBase"][0], "imageV": row["imageBase"][1],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            }
            _sync(towers, spire, mesa_layout, rec)
            placed.append(rec)
            continue
        if kind == "mesa":
            m = take_mesa(row, side)
            if m is None:
                notes.append(f"{row['id']}: no mesa on that side")
                continue
            m["_used"] = True
            old_s = float(m["s"])
            old_lat = float(m.get("lat") or 0)
            old_sc = float(m.get("scale") or 1)
            old_yaw = float(m.get("yaw") or 0)
            ns, nlat = guard_seat(row["s"], row["lateral"], cam_s, "mesa", side)
            lo, hi = SCALE_SPAN["mesa"]
            rec = {
                "id": m["id"], "from": row["id"], "kind": "mesa",
                "s": round(ns, 2), "lateral": round(nlat, 2),
                "scale": round(float(np.clip(old_sc, old_sc * lo, old_sc * hi)), 3),
                "yaw": round(_yaw_near(old_yaw, row["yaw"]), 1),
                "imageU": row["imageBase"][0], "imageV": row["imageBase"][1],
                "originS": old_s, "originLat": old_lat, "originScale": old_sc, "originYaw": old_yaw,
                "raw": {"s": row["s"], "lateral": row["lateral"], "Z": row["Z"], "heightM": row["heightM"], "yaw": row["yaw"]},
            }
            _sync(towers, spire, mesa_layout, rec)
            placed.append(rec)

    for i, t in enumerate(towers):
        if t["id"] not in used:
            t["s"] = round(cam_s - 220 - i * 30, 3)
            t["lateral"] = round(40.0 if i % 2 == 0 else -40.0, 3)
            t["x"], t["z"] = av_xz(t["s"], t["lateral"])
            notes.append(f"{t['id']}: parked behind the camera")
    for i, srow in enumerate(skyline):
        srow["s"] = round(cam_s - 400 - i * 20, 3)
        srow["lateral"] = 60.0 if i % 2 == 0 else -60.0
        srow["x"], srow["z"] = av_xz(srow["s"], srow["lateral"])
    for i, m in enumerate(mesa_layout):
        m.pop("_used", None)
        if any(p["id"] == m["id"] for p in placed):
            continue
        m["s"] = round(cam_s - 260 - i * 25, 2)
        m["lat"] = 30.0 if i % 2 == 0 else -30.0
        notes.append(f"{m['id']}: parked behind the camera")
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
