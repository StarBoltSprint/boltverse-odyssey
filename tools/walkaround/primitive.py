"""Invisible box or cylinder fitted to the view silhouettes.

The solid is the fitted primitive. Each face keeps a flat normal so the
existing projector assigns one Imagine view to that face. Code does not
paint the face. Corner seams are reported, not hidden.
"""

from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw

import hull
import surface


def _yaw_matrix(yaw_deg: float) -> np.ndarray:
    a = math.radians(yaw_deg)
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0.0, s], [0.0, 1.0, 0.0], [-s, 0.0, c]], np.float64)


def _convex_hull(points: np.ndarray) -> np.ndarray:
    pts = np.unique(np.round(points.astype(np.float64), 4), axis=0)
    if len(pts) <= 2:
        return pts
    order = np.lexsort((pts[:, 1], pts[:, 0]))
    pts = pts[order]

    def cross(o, a, b) -> float:
        return float((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]))

    lower: list[np.ndarray] = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: list[np.ndarray] = []
    for p in pts[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    ring = lower[:-1] + upper[:-1]
    return np.asarray(ring, np.float64)


def _raster_polygon(poly: np.ndarray, width: int, height: int) -> np.ndarray:
    canvas = Image.new("L", (int(width), int(height)), 0)
    if len(poly) >= 3:
        ImageDraw.Draw(canvas).polygon([tuple(p) for p in poly.tolist()], fill=255)
    return np.array(canvas) > 0


def _iou(pred: np.ndarray, mask: np.ndarray) -> float:
    inter = np.logical_and(pred, mask).sum()
    union = np.logical_or(pred, mask).sum()
    if union <= 0:
        return 0.0
    return float(inter / union)


def _project_points(points: np.ndarray, view: dict) -> tuple[np.ndarray, np.ndarray]:
    u, v, z = hull.project(points, view["cam"], view["width"], view["height"], view["fovY"])
    return np.stack([np.asarray(u), np.asarray(v)], axis=1), np.asarray(z)


def box_corners(center: np.ndarray, half: np.ndarray, yaw_deg: float) -> np.ndarray:
    signs = np.array([[x, y, z] for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)], np.float64)
    local = signs * half.reshape(1, 3)
    return (local @ _yaw_matrix(yaw_deg).T) + center.reshape(1, 3)


def cylinder_rings(center: np.ndarray, radius: float, y0: float, y1: float, segments: int = 28) -> np.ndarray:
    ang = np.linspace(0, 2 * math.pi, segments, endpoint=False)
    ring = np.stack([np.cos(ang) * radius, np.zeros_like(ang), np.sin(ang) * radius], axis=1)
    bottom = ring + np.array([center[0], y0, center[2]])
    top = ring + np.array([center[0], y1, center[2]])
    return np.vstack([bottom, top])


def silhouette_iou(kind: str, params: dict, views: list[dict]) -> tuple[float, list[dict]]:
    per = []
    for view in views:
        if kind == "box":
            pts = box_corners(params["center"], params["half"], params["yawDeg"])
        else:
            pts = cylinder_rings(params["center"], params["radius"], params["y0"], params["y1"])
        uv, z = _project_points(pts, view)
        front = z > 0.05
        if int(front.sum()) < 3:
            per.append({"file": view["file"], "iou": 0.0})
            continue
        poly = _convex_hull(uv[front])
        pred = _raster_polygon(poly, view["width"], view["height"])
        per.append({"file": view.get("stored", view["file"]), "yawDeg": view["yawDeg"], "iou": round(_iou(pred, view["mask"]), 4)})
    mean = float(np.mean([row["iou"] for row in per])) if per else 0.0
    return mean, per


def _score_box(views: list[dict], yaw: float, center: np.ndarray, half: np.ndarray) -> float:
    mean, _ = silhouette_iou("box", {"center": center, "half": half, "yawDeg": yaw}, views)
    return mean


def _score_cylinder(views: list[dict], center_xz: np.ndarray, radius: float, y0: float, y1: float) -> float:
    center = np.array([center_xz[0], 0.0, center_xz[1]])
    mean, _ = silhouette_iou(
        "cylinder",
        {"center": center, "radius": radius, "y0": y0, "y1": y1},
        views,
    )
    return mean


def fit_box(views: list[dict], object_size: np.ndarray) -> dict:
    center = np.zeros(3, np.float64)
    half = np.array(object_size, np.float64) * 0.5
    yaw = 0.0
    best = _score_box(views, yaw, center, half)
    for trial in (0.0, 15.0, 30.0, 45.0):
        score = _score_box(views, trial, center, half)
        if score > best:
            best = score
            yaw = trial
    steps = {
        "yaw": 5.0,
        "c": 0.03,
        "h": 0.03,
    }
    for _round in range(5):
        improved = True
        while improved:
            improved = False
            candidates = [("yaw", yaw + steps["yaw"]), ("yaw", yaw - steps["yaw"])]
            for axis in range(3):
                for sign in (1.0, -1.0):
                    moved = center.copy()
                    moved[axis] += sign * steps["c"]
                    candidates.append((f"c{axis}", moved))
                for sign in (1.0, -1.0):
                    grown = half.copy()
                    grown[axis] = max(0.05, grown[axis] + sign * steps["h"])
                    candidates.append((f"h{axis}", grown))
            for kind, value in candidates:
                if kind == "yaw":
                    score = _score_box(views, float(value), center, half)
                    if score > best + 1e-4:
                        best = score
                        yaw = float(value) % 180.0
                        improved = True
                elif kind.startswith("c"):
                    score = _score_box(views, yaw, value, half)
                    if score > best + 1e-4:
                        best = score
                        center = np.array(value, np.float64)
                        improved = True
                else:
                    score = _score_box(views, yaw, center, value)
                    if score > best + 1e-4:
                        best = score
                        half = np.array(value, np.float64)
                        improved = True
        steps = {k: v * 0.5 for k, v in steps.items()}
    return {"center": center, "half": half, "yawDeg": yaw, "meanIoU": best}


def fit_cylinder(views: list[dict], object_size: np.ndarray) -> dict:
    radius = float(max(object_size[0], object_size[2]) * 0.5)
    y0 = float(-object_size[1] * 0.5)
    y1 = float(object_size[1] * 0.5)
    center_xz = np.zeros(2, np.float64)
    best = _score_cylinder(views, center_xz, radius, y0, y1)
    step_r, step_y, step_c = 0.03, 0.03, 0.03
    for _round in range(5):
        improved = True
        while improved:
            improved = False
            trials = []
            for sign in (1.0, -1.0):
                trials.append(("r", max(0.05, radius + sign * step_r), y0, y1, center_xz))
                trials.append(("y0", radius, y0 + sign * step_y, y1, center_xz))
                trials.append(("y1", radius, y0, y1 + sign * step_y, center_xz))
                for axis in range(2):
                    moved = center_xz.copy()
                    moved[axis] += sign * step_c
                    trials.append(("c", radius, y0, y1, moved))
            for _name, r, a, b, c in trials:
                if b - a < 0.08:
                    continue
                score = _score_cylinder(views, c, r, a, b)
                if score > best + 1e-4:
                    best = score
                    radius, y0, y1, center_xz = r, a, b, np.array(c, np.float64)
                    improved = True
        step_r *= 0.5
        step_y *= 0.5
        step_c *= 0.5
    return {
        "center": np.array([center_xz[0], 0.0, center_xz[1]]),
        "radius": radius,
        "y0": y0,
        "y1": y1,
        "meanIoU": best,
    }


def _box_mesh(center: np.ndarray, half: np.ndarray, yaw_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """24 vertices, flat normals, 12 triangles. `face_id` per vertex."""
    rot = _yaw_matrix(yaw_deg)
    # Face order: +X -X +Y -Y +Z -Z. Each face is two triangles, unique verts.
    axes = [
        (np.array([1.0, 0, 0]), np.array([0.0, 1, 0]), np.array([0.0, 0, 1])),
        (np.array([-1.0, 0, 0]), np.array([0.0, 1, 0]), np.array([0.0, 0, -1])),
        (np.array([0.0, 1, 0]), np.array([1.0, 0, 0]), np.array([0.0, 0, 1])),
        (np.array([0.0, -1, 0]), np.array([1.0, 0, 0]), np.array([0.0, 0, -1])),
        (np.array([0.0, 0, 1]), np.array([1.0, 0, 0]), np.array([0.0, 1, 0])),
        (np.array([0.0, 0, -1]), np.array([1.0, 0, 0]), np.array([0.0, -1, 0])),
    ]
    verts = []
    normals = []
    faces = []
    face_of_vert = []
    for fi, (normal, u_axis, v_axis) in enumerate(axes):
        n = rot @ normal
        uu = rot @ u_axis
        vv = rot @ v_axis
        center_f = rot @ (normal * half) + center
        corners = [
            center_f + uu * half[int(np.argmax(np.abs(u_axis)))] * np.sign(u_axis[np.argmax(np.abs(u_axis))] or 1) * 0
            + uu * np.dot(half, np.abs(u_axis)) * -1
            + vv * np.dot(half, np.abs(v_axis)) * -1,
            center_f + uu * np.dot(half, np.abs(u_axis)) + vv * np.dot(half, np.abs(v_axis)) * -1,
            center_f + uu * np.dot(half, np.abs(u_axis)) + vv * np.dot(half, np.abs(v_axis)),
            center_f + uu * np.dot(half, np.abs(u_axis)) * -1 + vv * np.dot(half, np.abs(v_axis)),
        ]
        # The expression above is messy. Rebuild corners cleanly.
        hu = float(np.dot(half, np.abs(u_axis)))
        hv = float(np.dot(half, np.abs(v_axis)))
        corners = [
            center_f - uu * hu - vv * hv,
            center_f + uu * hu - vv * hv,
            center_f + uu * hu + vv * hv,
            center_f - uu * hu + vv * hv,
        ]
        base = len(verts)
        for corner in corners:
            verts.append(corner)
            normals.append(n)
            face_of_vert.append(fi)
        faces.append((base, base + 1, base + 2))
        faces.append((base, base + 2, base + 3))
    vertices = np.asarray(verts, np.float32)
    tris = np.asarray(faces, np.int32)
    normals_a = np.asarray(normals, np.float32)
    tris = surface.orient_outward(vertices, tris)
    # orient_outward may flip a triangle but vertex normals stay with the face
    # because each face's verts are unique and the normal was set outward.
    # Re-derive after orient to be safe.
    normals_a = surface.vertex_normals(vertices, tris)
    return vertices, tris, normals_a.astype(np.float32), np.asarray(face_of_vert, np.int32)


def _cylinder_mesh(center: np.ndarray, radius: float, y0: float, y1: float, segments: int = 28):
    verts = []
    faces = []
    ang = np.linspace(0, 2 * math.pi, segments, endpoint=False)
    bottom_center = len(verts)
    verts.append([center[0], y0, center[2]])
    top_center = 1
    verts.append([center[0], y1, center[2]])
    bottom_ring = []
    top_ring = []
    for a in ang:
        bottom_ring.append(len(verts))
        verts.append([center[0] + math.cos(a) * radius, y0, center[2] + math.sin(a) * radius])
    for a in ang:
        top_ring.append(len(verts))
        verts.append([center[0] + math.cos(a) * radius, y1, center[2] + math.sin(a) * radius])
    for i in range(segments):
        j = (i + 1) % segments
        faces.append((bottom_center, bottom_ring[j], bottom_ring[i]))
        faces.append((top_center, top_ring[i], top_ring[j]))
        faces.append((bottom_ring[i], bottom_ring[j], top_ring[j]))
        faces.append((bottom_ring[i], top_ring[j], top_ring[i]))
    vertices = np.asarray(verts, np.float32)
    tris = np.asarray(faces, np.int32)
    tris = surface.orient_outward(vertices, tris)
    normals = surface.vertex_normals(vertices, tris)
    return vertices, tris, normals.astype(np.float32)


def _face_records(vertices: np.ndarray, faces: np.ndarray, views: list[dict], kind: str) -> list[dict]:
    """One record per mesh face: assigned view, stretch, normal."""
    records = []
    fy_of = []
    for view in views:
        fy_of.append((view["height"] * 0.5) / math.tan(math.radians(view["fovY"]) * 0.5))
    for fi, tri in enumerate(faces):
        p = vertices[tri].astype(np.float64)
        normal = np.cross(p[1] - p[0], p[2] - p[0])
        area = float(np.linalg.norm(normal)) * 0.5
        if area < 1e-10:
            continue
        normal = normal / np.linalg.norm(normal)
        center = p.mean(axis=0)
        best_i = 0
        best_s = -1e9
        for vi, view in enumerate(views):
            score = float(np.dot(normal, view["cam"]["position"]))
            if score > best_s:
                best_s = score
                best_i = vi
        view = views[best_i]
        uv, z = _project_points(p, view)
        if np.any(z <= 0.05):
            stretch = 99.0
            pixel_area = 0.0
        else:
            pixel_area = abs(
                (uv[1, 0] - uv[0, 0]) * (uv[2, 1] - uv[0, 1]) - (uv[2, 0] - uv[0, 0]) * (uv[1, 1] - uv[0, 1])
            ) * 0.5
            depth = float(np.mean(z))
            ppu = fy_of[best_i] / max(depth, 1e-3)
            stretch = float((area * ppu * ppu) / max(pixel_area, 1e-6))
        records.append(
            {
                "face": int(fi),
                "normal": normal,
                "center": center,
                "area": area,
                "view": best_i,
                "viewFile": view.get("stored", view["file"]),
                "stretch": stretch,
                "kind": kind,
            }
        )
    return records


def _corner_seams(records: list[dict], faces: np.ndarray, vertices: np.ndarray) -> list[dict]:
    edge_faces: dict[tuple[int, int], list[int]] = {}
    for rec in records:
        tri = faces[rec["face"]]
        for a, b in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])):
            edge_faces.setdefault(tuple(sorted((int(a), int(b)))), []).append(rec["face"])
    by_face = {rec["face"]: rec for rec in records}
    warnings = []
    seen = set()
    for edge, owners in edge_faces.items():
        if len(owners) != 2:
            continue
        a, b = owners
        key = tuple(sorted((a, b)))
        if key in seen:
            continue
        seen.add(key)
        ra, rb = by_face[a], by_face[b]
        dihedral = math.degrees(math.acos(float(np.clip(np.dot(ra["normal"], rb["normal"]), -1, 1))))
        # 180° is a flat join. A corner is well below that.
        corner = dihedral < 150.0
        different = ra["view"] != rb["view"]
        stretch_hi = ra["stretch"] > 2.5 or rb["stretch"] > 2.5
        warn = bool(corner and different)
        if not warn and not stretch_hi:
            continue
        warnings.append(
            {
                "edge": [int(edge[0]), int(edge[1])],
                "faces": [int(a), int(b)],
                "dihedralDeg": round(dihedral, 2),
                "viewA": ra["viewFile"],
                "viewB": rb["viewFile"],
                "stretchA": round(float(ra["stretch"]), 3),
                "stretchB": round(float(rb["stretch"]), 3),
                "corner": corner,
                "warning": warn or stretch_hi,
                "reason": "views differ across a corner" if warn else "stretch above 2.5",
            }
        )
    return warnings


def _voxelize_mesh(vertices: np.ndarray, faces: np.ndarray, n: int = 36):
    """Occupancy of a closed mesh by ray parity along +X. The collider, not the picture."""
    extent = np.max(np.abs(vertices.astype(np.float64)), axis=0)
    half = np.maximum(extent * 1.25, 0.15)
    vsize = (2.0 * half) / n
    solid = np.zeros((n, n, n), np.uint8)
    tris = vertices[faces].astype(np.float64)
    # For each YZ column, intersect triangles with the ray x varying.
    ys = -half[1] + (np.arange(n) + 0.5) * vsize[1]
    zs = -half[2] + (np.arange(n) + 0.5) * vsize[2]
    xs = -half[0] + (np.arange(n) + 0.5) * vsize[0]
    for iy, y in enumerate(ys):
        for iz, z in enumerate(zs):
            hits = []
            for tri in tris:
                # Möller–Trumbore in 2D: barycentric in yz, solve x.
                x0, y0, z0 = tri[0]
                x1, y1, z1 = tri[1]
                x2, y2, z2 = tri[2]
                denom = (y1 - y0) * (z2 - z0) - (z1 - z0) * (y2 - y0)
                if abs(denom) < 1e-12:
                    continue
                by = ((y - y0) * (z2 - z0) - (z - z0) * (y2 - y0)) / denom
                bz = ((y1 - y0) * (z - z0) - (z1 - z0) * (y - y0)) / denom
                b0 = 1.0 - by - bz
                if b0 < -1e-5 or by < -1e-5 or bz < -1e-5:
                    continue
                hits.append(b0 * x0 + by * x1 + bz * x2)
            if len(hits) < 2:
                continue
            hits = sorted(hits)
            # Pair enter/exit.
            for a, b in zip(hits[0::2], hits[1::2]):
                inside = (xs >= min(a, b)) & (xs <= max(a, b))
                solid[inside, iy, iz] = 1
    return solid, half, vsize


def build_primitive(kind: str, views: list[dict], object_size: np.ndarray) -> dict:
    body = [v for v in views if v.get("group", "body") == "body"]
    if kind not in ("box", "cylinder"):
        return {
            "vertices": np.zeros((0, 3), np.float32),
            "normals": np.zeros((0, 3), np.float32),
            "faces": np.zeros((0, 3), np.int32),
            "solid": np.zeros((8, 8, 8), np.uint8),
            "half": np.array(object_size) * 0.5,
            "vsize": np.array(object_size) / 8.0,
            "stats": {"method": "primitive", "primitive": kind, "surface": f"primitive-{kind}", "ok": False},
            "failures": [
                f"FAIL primitive: --primitive must be box or cylinder, got {kind}. "
                "This run did not fall back to the silhouette method."
            ],
            "waive_silhouette_lock": False,
        }
    if kind == "box":
        fit = fit_box(body, object_size)
        vertices, faces, normals, _face_ids = _box_mesh(fit["center"], fit["half"], fit["yawDeg"])
        params = {
            "center": [round(float(v), 4) for v in fit["center"]],
            "half": [round(float(v), 4) for v in fit["half"]],
            "yawDeg": round(float(fit["yawDeg"]), 3),
        }
    else:
        fit = fit_cylinder(body, object_size)
        vertices, faces, normals = _cylinder_mesh(fit["center"], fit["radius"], fit["y0"], fit["y1"])
        params = {
            "center": [round(float(v), 4) for v in fit["center"]],
            "radius": round(float(fit["radius"]), 4),
            "y0": round(float(fit["y0"]), 4),
            "y1": round(float(fit["y1"]), 4),
            "axis": "Y",
        }
    mean, per = silhouette_iou(kind, {
        "center": np.array(params["center"], np.float64) if kind == "cylinder" else fit["center"],
        "half": fit["half"] if kind == "box" else None,
        "yawDeg": fit.get("yawDeg", 0.0),
        "radius": fit.get("radius", 0.0),
        "y0": fit.get("y0", 0.0),
        "y1": fit.get("y1", 0.0),
    }, body)
    # silhouette_iou for cylinder ignores the center y. Pass the fit dict directly.
    if kind == "box":
        mean, per = silhouette_iou("box", {"center": fit["center"], "half": fit["half"], "yawDeg": fit["yawDeg"]}, body)
    else:
        mean, per = silhouette_iou(
            "cylinder",
            {"center": fit["center"], "radius": fit["radius"], "y0": fit["y0"], "y1": fit["y1"]},
            body,
        )
    records = _face_records(vertices, faces, body, kind)
    seams = _corner_seams(records, faces, vertices)
    stretches = [r["stretch"] for r in records if r["stretch"] < 50]
    hist = surface.geometric_edge_histogram(vertices, faces)
    stats = {
        "method": "primitive",
        "primitive": kind,
        "surface": f"primitive-{kind}",
        "ok": True,
        "fit": params,
        "silhouetteIoU": {"mean": round(mean, 4), "perView": per},
        "cornerSeams": seams,
        "cornerSeamWarnings": sum(1 for row in seams if row.get("warning")),
        "stretch": {
            "mean": round(float(np.mean(stretches)), 4) if stretches else None,
            "max": round(float(np.max(stretches)), 4) if stretches else None,
        },
        "holes": {
            "boundaryEdges": int(hist["boundary"]),
            "nonManifoldEdges": int(hist["nonManifold"]),
        },
        "meshFaces": int(len(faces)),
        "meshVertices": int(len(vertices)),
        "note": (
            "A box or a vertical cylinder. The diagonal silhouette of a box is wider than the face-on one, "
            "so the round-object ±15% area lock is waived for this method. IoU is the fit measure. "
            "The cylinder axis is world Y. A horizontal tube will not fit."
        ),
    }
    failures = []
    if mean < 0.50:
        stats["ok"] = False
        failures.append(
            f"FAIL primitive: silhouette IoU {mean:.3f} is below 0.50. The {kind} does not match the views. "
            "Re-run without --shape primitive to use the default silhouette volume. "
            "This run did not switch methods."
        )
    if int(hist["boundary"]) > 0:
        stats["ok"] = False
        failures.append(
            f"FAIL primitive: mesh has {int(hist['boundary'])} boundary edges. "
            "This run did not fall back to the silhouette method."
        )
    solid, half, vsize = _voxelize_mesh(vertices, faces, n=36)
    if int(solid.sum()) < 8:
        # Parity voxelization can miss a thin fit. Fall back to the analytic solid,
        # which is still the invisible primitive, not a picture.
        solid, half, vsize = _analytic_solid(kind, fit, n=36)
    return {
        "vertices": vertices.astype(np.float32),
        "normals": normals.astype(np.float32),
        "faces": faces.astype(np.int32),
        "solid": solid,
        "half": half.astype(np.float64),
        "vsize": vsize.astype(np.float64),
        "stats": stats,
        "failures": failures,
        "waive_silhouette_lock": True,
    }


def _analytic_solid(kind: str, fit: dict, n: int = 36):
    if kind == "box":
        center = fit["center"]
        half_b = fit["half"]
        yaw = fit["yawDeg"]
        extent = half_b + np.abs(center) + 0.05
        half = np.maximum(extent, 0.15)
    else:
        r = fit["radius"]
        half = np.array(
            [abs(fit["center"][0]) + r + 0.05, max(abs(fit["y0"]), abs(fit["y1"])) + 0.05, abs(fit["center"][2]) + r + 0.05]
        )
        half = np.maximum(half, 0.15)
    vsize = (2.0 * half) / n
    solid = np.zeros((n, n, n), np.uint8)
    xs = -half[0] + (np.arange(n) + 0.5) * vsize[0]
    ys = -half[1] + (np.arange(n) + 0.5) * vsize[1]
    zs = -half[2] + (np.arange(n) + 0.5) * vsize[2]
    grid = np.stack(np.meshgrid(xs, ys, zs, indexing="ij"), axis=-1)
    if kind == "box":
        local = (grid - fit["center"]) @ _yaw_matrix(fit["yawDeg"])
        inside = np.all(np.abs(local) <= fit["half"].reshape(1, 1, 1, 3), axis=-1)
    else:
        dx = grid[..., 0] - fit["center"][0]
        dz = grid[..., 2] - fit["center"][2]
        inside = (dx * dx + dz * dz) <= fit["radius"] ** 2
        inside &= (grid[..., 1] >= fit["y0"]) & (grid[..., 1] <= fit["y1"])
    solid[inside] = 1
    return solid, half, vsize
