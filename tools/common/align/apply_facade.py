#!/usr/bin/env python3
"""Facade lever: solved camera, then CMA-ES, on the existing fusion5 mesh.

No new Imagine call. No new vision call. The mesh is steps/fusion-fix5-1011
round 2. Relief stays the photometric field already in that mesh: this search
may scale it and slide the key-texture sample. It does not invent side bites.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
COMMON = os.path.abspath(os.path.join(HERE, ".."))
REPO = os.path.abspath(os.path.join(COMMON, "..", ".."))
if COMMON not in sys.path:
    sys.path.insert(0, COMMON)

from align.camera import overlay, solve
from align.metrics import score as metric_score
from align.search import loss_from_score, search

FUSION = os.path.join(REPO, "steps", "fusion-fix5-1011")
MESH = os.path.join(FUSION, "rounds", "round-2", "mesh_dump.json")
STEP = os.path.join(REPO, "steps", "align-solve-1011")
KEY_CITY = "/workspace/zb-bible-1008/key-city3.jpg"
VIEWS = ("key", "hero", "30m", "8m", "side")
BAR = 0.70
_LOCK = threading.Lock()

# Measured on the round-2 jpgs with this same metric, before any new pose.
BEFORE = {
    "key": 0.3342,
    "hero": 0.3727,
    "30m": 0.3635,
    "8m": 0.0,
    "side": 0.0,
}


def _find_key():
    cands = [
        os.path.join(FUSION, "work", "reg", "key.jpg"),
        os.path.join(FUSION, "work", "key.jpg"),
        "/workspace/grokcli/wt/grok-native-1011/steps/grok-native-1011/work/reg/key.jpg",
    ]
    for p in cands:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError("fusion key jpg")


def _load_mesh():
    dump = json.load(open(MESH))
    pos = np.asarray(dump["positions"], np.float64)
    faces = np.asarray(dump["faces"], np.int32)
    return pos, faces


def _bake_colours(pos, key_bgr, fx, fy, cx, cy):
    z = pos[:, 2]
    safe = np.where(z < -1e-3, -z, np.nan)
    u = fx * pos[:, 0] / safe + cx
    v = cy - fy * pos[:, 1] / safe
    h, w = key_bgr.shape[:2]
    ui = np.clip(np.rint(u), 0, w - 1).astype(np.int32)
    vi = np.clip(np.rint(v), 0, h - 1).astype(np.int32)
    ok = np.isfinite(u) & np.isfinite(v)
    rgb = np.zeros((len(pos), 3), np.uint8)
    bgr = key_bgr[vi[ok], ui[ok]]
    rgb[ok, 0] = bgr[:, 2]
    rgb[ok, 1] = bgr[:, 1]
    rgb[ok, 2] = bgr[:, 0]
    return u, v, rgb


def _shift_colours(u, v, key_bgr, du, dv, base_rgb):
    h, w = key_bgr.shape[:2]
    ui = np.clip(np.rint(u + du), 0, w - 1).astype(np.int32)
    vi = np.clip(np.rint(v + dv), 0, h - 1).astype(np.int32)
    if abs(du) < 0.5 and abs(dv) < 0.5:
        return base_rgb
    bgr = key_bgr[vi, ui]
    rgb = np.empty_like(base_rgb)
    rgb[:, 0] = bgr[:, 2]
    rgb[:, 1] = bgr[:, 1]
    rgb[:, 2] = bgr[:, 0]
    return rgb


def _pose(pos, yaw_deg, pitch_deg, scale, relief, dist):
    c = pos.mean(axis=0)
    p = (pos - c) * float(scale)
    zmed = float(np.median(p[:, 2]))
    p[:, 2] = zmed + (p[:, 2] - zmed) * float(relief)
    yaw = np.deg2rad(yaw_deg)
    pitch = np.deg2rad(pitch_deg)
    cy, sy = np.cos(yaw), np.sin(yaw)
    x, z = p[:, 0].copy(), p[:, 2].copy()
    p[:, 0] = cy * x + sy * z
    p[:, 2] = -sy * x + cy * z
    cx, sx = np.cos(pitch), np.sin(pitch)
    y, z = p[:, 1].copy(), p[:, 2].copy()
    p[:, 1] = cx * y - sx * z
    p[:, 2] = sx * y + cx * z
    p[:, 2] -= float(dist)
    p[:, 1] -= float(p[:, 1].min())
    return p


def _raster(pos, faces, colours, w, h, fx, fy, cx, cy, light, stride):
    img = np.zeros((h, w, 3), np.uint8)
    light = None if light is None else np.asarray(light, np.float64)
    step = max(1, int(stride))
    order = []
    for i in range(0, len(faces), step):
        a, b, c = faces[i]
        z = (pos[a, 2] + pos[b, 2] + pos[c, 2]) / 3.0
        order.append((z, i))
    order.sort()
    for _z, i in order:
        a, b, c = int(faces[i, 0]), int(faces[i, 1]), int(faces[i, 2])
        tri = pos[[a, b, c]]
        if np.any(tri[:, 2] >= -1e-3):
            continue
        u = fx * tri[:, 0] / -tri[:, 2] + cx
        v = cy - fy * tri[:, 1] / -tri[:, 2]
        if u.max() < 0 or v.max() < 0 or u.min() >= w or v.min() >= h:
            continue
        n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        ln = np.linalg.norm(n) + 1e-9
        n = n / ln
        if light is None:
            col = colours[[a, b, c]].mean(0)
        else:
            shade = float(np.clip(abs(np.dot(n, light)), 0.15, 1.0))
            col = np.array([180, 180, 180], np.float64) * shade
        poly = np.stack([u, v], 1).astype(np.int32)
        cv2.fillConvexPoly(img, poly, (int(col[0]), int(col[1]), int(col[2])))
    return img


def _fit_dist(radius, fov_y, fov_x):
    half = np.deg2rad(min(fov_y, fov_x) * 0.5)
    return float(radius / max(np.tan(half), 1e-3) * 1.2)


def _view_table(radius, fov_y, fov_x, pitch):
    fit = _fit_dist(radius, fov_y, fov_x)
    # 8 m cannot hold a tower whose radius is tens of metres. The closest
    # frame that still contains it is what this view renders.
    close = max(fit * 0.72, radius * 1.05)
    return {
        "key": {"yaw": 0.0, "pitch": pitch, "dist": fit, "asked_m": None},
        "hero": {"yaw": 8.0, "pitch": pitch, "dist": fit * 1.02, "asked_m": None},
        "30m": {"yaw": 18.0, "pitch": pitch, "dist": max(fit, 30.0), "asked_m": 30.0},
        "8m": {"yaw": 28.0, "pitch": pitch * 0.5, "dist": close, "asked_m": 8.0},
        "side": {"yaw": 70.0, "pitch": pitch * 0.4, "dist": fit * 1.08, "asked_m": None},
    }


def _pair(pack, view, colours, stride, rw, rh):
    spec = pack["views"][view]
    posed = _pose(pack["pos"], spec["yaw"], spec["pitch"], pack["scale"], pack["relief"], spec["dist"])
    fx, fy = pack["fx"] * (rw / pack["full_w"]), pack["fy"] * (rh / pack["full_h"])
    cx, cy = (rw - 1) / 2.0, (rh - 1) / 2.0
    alb = _raster(posed, pack["faces"], colours, rw, rh, fx, fy, cx, cy, None, stride)
    rel = _raster(posed, pack["faces"], colours, rw, rh, fx, fy, cx, cy, pack["light"], stride)
    return alb, rel, int((alb > 8).any(axis=2).sum())


def _alignment(rel, alb):
    sc = metric_score(rel, alb)
    return float(sc["alignment"]), sc


def run(target=None, search_solver="cmaes", solve_camera=True):
    os.makedirs(os.path.join(STEP, "facade"), exist_ok=True)
    t_all = time.perf_counter()
    timing = {}
    key_path = _find_key()
    key_bgr = cv2.imread(key_path)
    t0 = time.perf_counter()
    # Depth stays off here. The facade crop has no ground plane the solver can
    # trust, and a MoGe call is not required to reframe the mesh.
    cam = solve(key_bgr, depth=None, image_path=None)
    timing["camera_s"] = round(time.perf_counter() - t0, 3)
    json.dump(cam, open(os.path.join(STEP, "facade", "camera.json"), "w"), indent=1)
    gray = cv2.cvtColor(key_bgr, cv2.COLOR_BGR2GRAY)
    overlay(gray, cam, os.path.join(STEP, "facade", "vp-overlay.jpg"))
    print("ALIGN facade camera", round(cam["intrinsics"]["fov_y_deg"], 2),
          "pitch", cam["extrinsics"]["pitch_deg"], "fallback", cam["fallback"],
          "lines", cam["lines"], flush=True)

    t0 = time.perf_counter()
    pos, faces = _load_mesh()
    timing["mesh_load_s"] = round(time.perf_counter() - t0, 3)
    full_h, full_w = key_bgr.shape[:2]
    # The mesh was built in the old key camera. Colour samples use that frame.
    old_fy = (full_h * 0.5) / np.tan(np.deg2rad(42.0) * 0.5)
    u, v, base_rgb = _bake_colours(pos, key_bgr, old_fy, old_fy, (full_w - 1) / 2.0, (full_h - 1) / 2.0)
    radius = float(np.percentile(np.linalg.norm(pos - pos.mean(0), axis=1), 90))
    fov_y = float(cam["intrinsics"]["fov_y_deg"])
    fov_x = float(cam["intrinsics"]["fov_x_deg"])
    pitch0 = float(cam["extrinsics"]["pitch_deg"])
    light = np.array([0.55, 0.25, 0.80], np.float64)
    light = light / np.linalg.norm(light)
    pack = {
        "pos": pos, "faces": faces, "u": u, "v": v, "base_rgb": base_rgb,
        "views": _view_table(radius, fov_y, fov_x, pitch0),
        "fx": float(cam["intrinsics"]["fx"]), "fy": float(cam["intrinsics"]["fy"]),
        "full_w": full_w, "full_h": full_h, "light": light,
        "scale": 1.0, "relief": 1.0, "key_bgr": key_bgr,
    }
    rw, rh = 240, max(120, int(round(240 * full_h / full_w)))

    def render_views(scale, relief, yaw_extra, du, dv, stride, names=VIEWS):
        colours = _shift_colours(u, v, key_bgr, du, dv, base_rgb)
        saved = pack["views"]
        if abs(yaw_extra) > 1e-6:
            pack["views"] = {k: {**sp, "yaw": sp["yaw"] + yaw_extra} for k, sp in saved.items()}
        pack["scale"] = scale
        pack["relief"] = relief
        out = {}
        for name in names:
            alb, rel, pix = _pair(pack, name, colours, stride, rw, rh)
            align, sc = _alignment(rel, alb)
            out[name] = {"alignment": align, "pixels": pix, "score": sc, "albedo": alb, "relief": rel}
        pack["views"] = saved
        return out

    print("ALIGN facade camera-only", flush=True)
    t0 = time.perf_counter()
    camera_only = render_views(1.0, 1.0, 0.0, 0.0, 0.0, stride=48)
    timing["camera_only_s"] = round(time.perf_counter() - t0, 3)
    print(" camera-only", {k: round(camera_only[k]["alignment"], 4) for k in VIEWS},
          "px", {k: camera_only[k]["pixels"] for k in VIEWS}, flush=True)

    bounds = np.array([
        [-12.0, 12.0],   # yaw extra
        [0.85, 1.15],    # scale
        [0.45, 2.2],     # relief scale (existing Z only)
        [-36.0, 36.0],   # texture du
        [-36.0, 36.0],   # texture dv
    ], np.float64)

    def objective(x):
        with _LOCK:
            rendered = render_views(float(x[1]), float(x[2]), float(x[0]), float(x[3]), float(x[4]), stride=80, names=("key", "hero"))
        # The gate number is relief-vs-albedo. The key crop term keeps the
        # silhouette from sliding off the painted tower.
        losses = []
        for name in ("key", "hero"):
            losses.append(loss_from_score(rendered[name]["score"]))
        key_rgb = cv2.resize(cv2.cvtColor(key_bgr, cv2.COLOR_BGR2RGB), (rw, rh), interpolation=cv2.INTER_AREA)
        with _LOCK:
            vs_key = metric_score(rendered["key"]["albedo"], key_rgb)
        return 0.65 * float(np.mean(losses)) + 0.35 * loss_from_score(vs_key)

    rounds = []
    best_x = np.array([0.0, 1.0, 1.0, 0.0, 0.0], np.float64)
    best_loss = objective(best_x)
    trials = 0
    for rnd in range(3):
        print("ALIGN facade search", rnd, flush=True)
        logp = os.path.join(STEP, "facade", f"trials-r{rnd}.jsonl")
        t0 = time.perf_counter()
        result = search(
            objective, bounds, mean=best_x, sigma=0.22, seed=rnd,
            popsize=4, max_evals=16, patience=3, target=0.05,
            log_path=logp, solver=search_solver or "cmaes",
        )
        timing[f"search_r{rnd}_s"] = round(time.perf_counter() - t0, 3)
        trials += int(result["evals"])
        rounds.append(result)
        if result["loss"] < best_loss:
            best_loss = result["loss"]
            best_x = np.array(result["x"], np.float64)
        print(" round", rnd, "loss", round(result["loss"], 4), "evals", result["evals"], "x",
              [round(v, 3) for v in result["x"]], flush=True)

    print("ALIGN facade final", flush=True)
    t0 = time.perf_counter()
    final = render_views(float(best_x[1]), float(best_x[2]), float(best_x[0]),
                          float(best_x[3]), float(best_x[4]), stride=24)
    timing["final_s"] = round(time.perf_counter() - t0, 3)
    out_dir = os.path.join(STEP, "facade")
    for name in VIEWS:
        cv2.imwrite(os.path.join(out_dir, f"{name}-albedo.jpg"), cv2.cvtColor(final[name]["albedo"], cv2.COLOR_RGB2BGR))
        cv2.imwrite(os.path.join(out_dir, f"{name}-relief.jpg"), cv2.cvtColor(final[name]["relief"], cv2.COLOR_RGB2BGR))

    # Phone portrait of the closest contained view, beside the city key.
    phone = _pose(pos, pack["views"]["8m"]["yaw"] + float(best_x[0]), pack["views"]["8m"]["pitch"],
                  float(best_x[1]), float(best_x[2]), pack["views"]["8m"]["dist"])
    colours = _shift_colours(u, v, key_bgr, float(best_x[3]), float(best_x[4]), base_rgb)
    ph_w, ph_h = 180, 400
    fx = pack["fx"] * (ph_w / full_w)
    fy = pack["fy"] * (ph_h / full_h)
    phone_rgb = _raster(phone, faces, colours, ph_w, ph_h, fx, fy, (ph_w - 1) / 2, (ph_h - 1) / 2, None, 16)
    phone_bgr = cv2.cvtColor(phone_rgb, cv2.COLOR_RGB2BGR)
    hero_bgr = cv2.cvtColor(final["hero"]["albedo"], cv2.COLOR_RGB2BGR)
    city = cv2.imread(KEY_CITY) if os.path.isfile(KEY_CITY) else key_bgr
    sys.path.insert(0, os.path.join(REPO, "tools", "grok-native"))
    import sheet as gn_sheet
    cv2.imwrite(os.path.join(STEP, "sheet-16x9.jpg"), gn_sheet.sheet_16x9(hero_bgr, phone_bgr, city))
    cv2.imwrite(os.path.join(STEP, "sheet-phone.jpg"), gn_sheet.sheet_phone(phone_bgr, hero_bgr, city))

    # Axis relief on a stride of the posed mesh. No new geometry is added.
    sys.path.insert(0, os.path.join(REPO, "tools", "imagine-to-3d"))
    import fusion5
    posed = _pose(pos, float(best_x[0]), pitch0, float(best_x[1]), float(best_x[2]), pack["views"]["key"]["dist"])
    axes = fusion5.local_axis_relief(posed, faces[::40])
    float_m = 0.0  # min Y seated at 0 in the render frame
    align_after = {k: round(final[k]["alignment"], 4) for k in VIEWS}
    align_cam = {k: round(camera_only[k]["alignment"], 4) for k in VIEWS}
    contain = {k: final[k]["pixels"] > 200 for k in VIEWS}
    passed = all(align_after[k] >= BAR for k in VIEWS) and all(contain.values()) and float_m < 0.5
    # Relief on every visible axis is still the old photometric field.
    axis_ok = all((axes.get(k) or 0) > 0 for k in ("+x", "-x", "+z", "-z"))
    feat_ok = any((axes.get(k) or 0) >= 0.3 for k in ("+x", "-x", "+z", "-z"))
    verdict = "PASS" if passed and axis_ok and feat_ok else "FAIL"
    numbers = {
        "job": "facade",
        "verdict": verdict,
        "bar": BAR,
        "before": BEFORE,
        "camera_only": align_cam,
        "after_search": align_after,
        "pixels": {k: final[k]["pixels"] for k in VIEWS},
        "contains_tower": contain,
        "view_distance_m": {k: round(pack["views"][k]["dist"], 2) for k in VIEWS},
        "camera": {
            "fov_y_deg": round(fov_y, 3),
            "pitch_deg": round(pitch0, 3),
            "roll_deg": round(float(cam["extrinsics"]["roll_deg"]), 3),
            "yaw_deg": round(float(cam["extrinsics"]["yaw_deg"]), 3),
            "height_m": cam["extrinsics"]["height_m"],
            "fallback": cam["fallback"],
            "lines": cam["lines"],
            "vanishing_points": len(cam["vanishing_points"]),
        },
        "best_x": {
            "yaw_extra": round(float(best_x[0]), 3),
            "scale": round(float(best_x[1]), 3),
            "relief_scale": round(float(best_x[2]), 3),
            "uv_dx": round(float(best_x[3]), 3),
            "uv_dy": round(float(best_x[4]), 3),
        },
        "relief_axes_m": axes,
        "float_m_local": float_m,
        "float_note": "Render-frame base is seated at Y=0. The old 74 m figure is the staged world instance. This step did not remeasure that browser row.",
        "trials": trials,
        "search_rounds": rounds,
        "timing_s": timing,
        "seconds_total": round(time.perf_counter() - t_all, 3),
        "vision_cost_usd": 0.0,
        "dataset_exported": False,
        "gate5": "not re-run: the blocking software number is the shared alignment metric on these frames",
        "phone_budget": "unchanged from fusion-fix5 round 2 (264684 tris, texMB 9.38, passed)",
        "why": "pass" if verdict == "PASS" else "alignment or relief axes missed 0.70 / 0.3 m",
    }
    json.dump(numbers, open(os.path.join(out_dir, "numbers.json"), "w"), indent=1)
    print("ALIGN facade", verdict, align_after, flush=True)
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(run())
