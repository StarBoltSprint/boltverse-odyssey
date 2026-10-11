#!/usr/bin/env python3
"""Zone B staging rebuild. Avenue from the keyed heightfield. Real framebuffer.

Imports placement-from-key and align.search. Does not copy their formulas.
Does not rebake the heightfield. Does not write the live preview.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import sys
import threading
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PLACE = os.path.join(REPO, "tools", "placement-from-key")
TERRAIN = os.path.join(REPO, "tools", "terrain-from-key")
STAGE_PAGE = os.path.join(TERRAIN, "staging")
KC = os.environ.get("PLACEMENT_STAGE", "/workspace/kc-staging/zb")
OUT = os.path.join(REPO, "steps", "scene-strict-1011")
PREV = os.path.join(REPO, "steps", "placement-key2-1011")
HEIGHT = os.path.join(REPO, "steps", "terrain-key2-1011", "data")
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
PORT = int(os.environ.get("SCENE_PORT", "8767"))

sys.path.insert(0, TERRAIN)
import build_field
sample_grid = build_field.sample_grid
sys.path.remove(TERRAIN)
sys.modules.pop("geom", None)
sys.modules.pop("build_field", None)
sys.path.insert(0, PLACE)

from depth_lift import assign_assets, lift_instances
from geom import Cam, av_xz, dir_to_heading, heading_to_dir, xz_av
from score import frame_stats, score_render
import place

# Week-2 solved camera. Pitch is the three.js sign (negative looks down).
FOV = 88.0
PITCH = -7.674
EYE = 1.77
ROLL = 0.17
AV_HEAD = dir_to_heading(np.array([0.97933, 0.0, -0.20233]))[0]


def load_grid():
    meta = json.load(open(os.path.join(HEIGHT, "height.json")))
    grid = np.fromfile(os.path.join(HEIGHT, "height.bin"), dtype=np.float32).reshape(meta["nz"], meta["nx"])
    origin = np.array(meta["origin"], np.float64)
    return grid, origin, float(meta["step"]), meta


def valley(grid, origin, step):
    """Cross-track trough. A heading wins when a narrow lane sits below both shoulders. The look direction is the one that keeps that trough ahead."""
    nz, nx = grid.shape
    s = 4
    zz, xx = np.mgrid[0:nz:s, 0:nx:s]
    H = grid[::s, ::s].astype(np.float64)
    X = origin[0] + xx.astype(np.float64) * step
    Z = origin[1] + zz.astype(np.float64) * step
    cx, cz = float(np.mean(X)), float(np.mean(Z))
    best = None
    for deg in range(0, 180, 3):
        fwd = heading_to_dir(float(deg))
        right = heading_to_dir(float(deg) + 90.0)
        cross = (X - cx) * right[0] + (Z - cz) * right[2]
        along = (X - cx) * fwd[0] + (Z - cz) * fwd[2]
        sel = np.abs(along) < 150.0
        bins = np.round(cross[sel] / 6.0) * 6.0
        acc = {}
        for b, hh in zip(bins.tolist(), H[sel].tolist()):
            acc.setdefault(b, []).append(hh)
        means = {b: float(np.mean(v)) for b, v in acc.items() if len(v) >= 4}
        if len(means) < 5:
            continue
        lane_b = min(means, key=means.get)
        lane = means[lane_b]
        shoulders = [means[b] for b in means if 12.0 <= abs(b - lane_b) <= 40.0]
        if len(shoulders) < 2:
            continue
        contrast = float(np.mean(shoulders) - lane)
        if best is None or contrast > best[0]:
            best = (contrast, float(deg), float(lane_b), lane)
    contrast, axis, lane_b, lane_h = best
    right = heading_to_dir(axis + 90.0)
    origin_pt = np.array([cx + right[0] * lane_b, cz + right[2] * lane_b])

    def score(h):
        fwd = heading_to_dir(h)
        right_h = heading_to_dir(h + 90.0)
        ahead, side = [], []
        for t in np.linspace(16.0, 160.0, 16):
            x = origin_pt[0] + fwd[0] * t
            z = origin_pt[1] + fwd[2] * t
            ahead.append(float(sample_grid(grid, origin, step, x, z)))
            for lat in (-24.0, 24.0):
                side.append(float(sample_grid(grid, origin, step, x + right_h[0] * lat, z + right_h[2] * lat)))
        return float(np.mean(side) - np.mean(ahead))

    s1, s2 = score(axis), score((axis + 180.0) % 360.0)
    heading = axis if s1 >= s2 else (axis + 180.0) % 360.0
    fwd = heading_to_dir(heading)
    best_h, seat = 1e9, (float(origin_pt[0]), float(origin_pt[1]))
    for t in np.linspace(-30.0, 30.0, 13):
        for lat in np.linspace(-8.0, 8.0, 5):
            x = origin_pt[0] + fwd[0] * t + right[0] * lat
            z = origin_pt[1] + fwd[2] * t + right[2] * lat
            hh = float(sample_grid(grid, origin, step, x, z))
            if hh < best_h:
                best_h, seat = hh, (x, z)
    return {
        "heading": float(heading),
        "axisDeg": axis,
        "contrastM": round(float(contrast), 3),
        "laneHeight": round(float(lane_h), 3),
        "storedAvenueDeg": None,
        "scoreAhead": round(s1 if heading == axis else s2, 3),
        "scoreBack": round(s2 if heading == axis else s1, 3),
        "seat": [round(seat[0], 3), round(seat[1], 3)],
        "seatHeight": round(best_h, 3),
        "centroid": [round(cx, 3), round(cz, 3)],
    }


def link_stage():
    """Page-relative fetches need objects, mesas, and the mesa module's runtime."""
    mapping = {
        "objects1": os.path.join(KC, "objects1"),
        "mesas": os.path.join(KC, "mesas"),
        "runtime": os.path.join(KC, "runtime"),
        "air.mjs": os.path.join(KC, "air.mjs"),
    }
    for name, src in mapping.items():
        dst = os.path.join(STAGE_PAGE, name)
        if os.path.lexists(dst):
            continue
        os.symlink(src, dst)


def backup_layout():
    os.makedirs(os.path.join(OUT, "backup"), exist_ok=True)
    for rel in ("objects1/layout.json", "mesas/kc-params.json"):
        src = os.path.join(KC, rel)
        dst = os.path.join(OUT, "backup", rel.replace("/", "-"))
        if os.path.isfile(src) and not os.path.isfile(dst):
            shutil.copy(src, dst)


def write_seats(assign):
    place._refuse_live(KC)
    layout = place.load_json(os.path.join(KC, "objects1", "layout.json"))
    layout["towers"] = assign["towers"]
    layout["spire"] = assign["spire"]
    layout["skyline"] = assign["skyline"]
    layout["sceneStrict"] = {"yaw": assign.get("yaw"), "seat": assign.get("seat")}
    place.dump(layout, os.path.join(KC, "objects1", "layout.json"))
    params = place.load_json(os.path.join(KC, "mesas", "kc-params.json"))
    params["layout"] = assign["mesas"]
    place.dump(params, os.path.join(KC, "mesas", "kc-params.json"))


def spin_layout(assign, cam_xz, delta_deg):
    """Move seats from the avenue frame onto the computed valley heading. s/lat stay the storage basis."""
    if abs(delta_deg) < 0.05:
        return
    th = math.radians(delta_deg)
    co, si = math.cos(th), math.sin(th)
    cx, cz = cam_xz

    def rot(x, z):
        dx, dz = x - cx, z - cz
        return cx + co * dx - si * dz, cz + si * dx + co * dz

    for t in assign["towers"] + assign.get("skyline", []) + [assign["spire"]]:
        x, z = rot(float(t["x"]), float(t["z"]))
        t["x"], t["z"] = x, z
        t["s"], t["lateral"] = xz_av(x, z)
    for m in assign["mesas"]:
        x, z = av_xz(float(m["s"]), float(m.get("lat", 0)))
        x, z = rot(x, z)
        m["s"], m["lat"] = xz_av(x, z)


def apply_params(assign, base, x):
    """x = along, cross, yaw delta, lateral gain. Along/cross are metres in the valley frame."""
    along, cross, yaw_d, gain = [float(v) for v in x]
    fwd = heading_to_dir(base["heading"])
    right = heading_to_dir(base["heading"] + 90.0)
    look = heading_to_dir(base["heading"] + yaw_d)
    look_r = heading_to_dir(base["heading"] + yaw_d + 90.0)
    sx = base["seat"][0] + look[0] * along + look_r[0] * cross
    sz = base["seat"][1] + look[2] * along + look_r[2] * cross
    cam = {
        "x": sx, "z": sz, "yaw": (base["heading"] + yaw_d) % 360.0,
        "pitch": PITCH, "eye": EYE, "fov": FOV, "roll": ROLL,
    }
    y = float(sample_grid(base["grid"], base["origin"], base["step"], sx, sz)) + EYE
    world = Cam(sx, y, sz, cam["yaw"], PITCH, FOV, 1280, 720)
    # lateral gain about the camera, stored back through the avenue basis
    for group, lat_key in (
        (assign["towers"], "lateral"),
        ([assign["spire"]], "lateral"),
    ):
        for t in group:
            s0, lat0 = xz_av(float(t["x"]), float(t["z"]))
            # gain is applied in the valley frame, then written as x/z
            dx = float(t["x"]) - base["seat"][0]
            dz = float(t["z"]) - base["seat"][1]
            lat = dx * right[0] + dz * right[2]
            along_m = dx * fwd[0] + dz * fwd[2]
            lat *= gain
            t["x"] = base["seat"][0] + fwd[0] * along_m + right[0] * lat
            t["z"] = base["seat"][1] + fwd[2] * along_m + right[2] * lat
            t["s"], t["lateral"] = xz_av(t["x"], t["z"])
            t["_s0"] = s0
            t["_lat0"] = lat0
    for m in assign["mesas"]:
        x0, z0 = av_xz(float(m["s"]), float(m.get("lat", 0)))
        dx, dz = x0 - base["seat"][0], z0 - base["seat"][1]
        lat = (dx * right[0] + dz * right[2]) * gain
        along_m = dx * fwd[0] + dz * fwd[2]
        wx = base["seat"][0] + fwd[0] * along_m + right[0] * lat
        wz = base["seat"][1] + fwd[2] * along_m + right[2] * lat
        m["s"], m["lat"] = xz_av(wx, wz)
    cam["y"] = y
    return cam, world


def depth_pairs(labels, depth, instances, cam: Cam, assign):
    by = {p["from"]: p for p in assign["placed"]}
    rows = []
    for inst in instances:
        if inst.get("kind") not in ("tower", "spire", "mesa") or inst.get("label") is None:
            continue
        mask = labels == int(inst["label"])
        if int(mask.sum()) < 20:
            continue
        seat = by.get(inst["id"])
        if not seat:
            continue
        x, z = av_xz(float(seat["s"]), float(seat["lateral"]))
        dist = float(np.hypot(x - cam.p[0], z - cam.p[2]))
        rows.append({"id": inst["id"], "moge": float(np.median(depth[mask])), "dist": dist})
    inv = []
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            dz = a["moge"] - b["moge"]
            dd = a["dist"] - b["dist"]
            if abs(dz) < 1.5 or abs(dd) < 3.0:
                continue
            if dz * dd < 0:
                inv.append({"a": a["id"], "b": b["id"], "mogeA": round(a["moge"], 2), "mogeB": round(b["moge"], 2),
                            "distA": round(a["dist"], 2), "distB": round(b["dist"], 2)})
    return rows, inv


def page_url(cam, w, h):
    q = (
        f"hud=0&lockq=1&dyn=0&x={cam['x']:.3f}&z={cam['z']:.3f}&yaw={cam['yaw']:.3f}"
        f"&pitch={cam['pitch']:.3f}&eye={cam['eye']:.3f}&fov={cam['fov']:.3f}&roll={cam['roll']:.3f}"
        f"&w={w}&h={h}&t={int(time.time()*1000)}"
    )
    return f"http://127.0.0.1:{PORT}/index.html?{q}"


def ensure_server():
    import socket
    s = socket.socket()
    try:
        s.connect(("127.0.0.1", PORT))
        s.close()
        return
    except OSError:
        pass
    import subprocess
    subprocess.Popen(
        [sys.executable, os.path.join(TERRAIN, "serve.py"), "--port", str(PORT)],
        stdout=open(os.path.join(OUT, "serve.log"), "w"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    for _ in range(40):
        time.sleep(0.25)
        try:
            s = socket.socket()
            s.connect(("127.0.0.1", PORT))
            s.close()
            return
        except OSError:
            continue
    raise RuntimeError(f"staging server did not bind {PORT}")


def shoot(cam, tag, phone=False):
    wide = os.path.join(OUT, f"{tag}-wide.png")
    place.shot(page_url(cam, 1280, 720), wide, 1280, 720)
    meta = json.load(open(wide.replace(".png", ".json")))
    phone_meta = None
    if phone:
        phone_png = os.path.join(OUT, f"{tag}-phone.png")
        place.shot(page_url(cam, 720, 1600), phone_png, 720, 1600)
        phone_meta = json.load(open(phone_png.replace(".png", ".json")))
    return wide, meta, phone_meta


def main():
    os.makedirs(OUT, exist_ok=True)
    t0 = time.perf_counter()
    link_stage()
    backup_layout()
    grid, origin, step, meta = load_grid()
    info = valley(grid, origin, step)
    info["storedAvenueDeg"] = meta.get("avenue", {}).get("headingDeg")
    info["copiedStoredYaw"] = False
    json.dump(info, open(os.path.join(OUT, "avenue.json"), "w"), indent=1)
    print("AVENUE", json.dumps(info), flush=True)

    labels = np.load(os.path.join(PREV, "masks.npy"))
    depth = np.load(os.path.join(PREV, "depth-moge.npy"))
    masks = json.load(open(os.path.join(PREV, "masks.json")))
    key = np.asarray(Image.open(KEY).convert("RGB"))
    key_sky = frame_stats(key)["skyTop"]
    y = info["seatHeight"] + EYE
    cam0 = Cam(info["seat"][0], y, info["seat"][1], info["heading"], PITCH, FOV, 1280, 720)
    fit = {"metric": True, "model": "moge-2"}
    layout = place.load_json(os.path.join(KC, "objects1", "layout.json"))
    mesas = place.load_json(os.path.join(KC, "mesas", "kc-params.json"))["layout"]
    lifts = lift_instances(cam0, depth, labels, masks["instances"], fit, layout)
    assign = assign_assets(lifts, layout, mesas, cam0)
    spin_layout(assign, info["seat"], info["heading"] - AV_HEAD)
    json.dump(lifts, open(os.path.join(OUT, "lifts.json"), "w"), indent=1)
    base = {
        "heading": info["heading"], "seat": info["seat"], "grid": grid, "origin": origin, "step": step,
        "assign": assign,
    }
    # Freeze the spun seats as the mean. apply_params reads x/z each call, so copy once.
    frozen = json.loads(json.dumps({k: assign[k] for k in ("towers", "spire", "skyline", "mesas", "placed", "todos", "notes")}))

    def clone():
        return json.loads(json.dumps(frozen))

    ensure_server()
    lock = threading.Lock()
    shots = {"n": 0}

    def objective(x, tag_prefix="trial"):
        with lock:
            a = clone()
            cam, world = apply_params(a, {**base, "assign": a}, x)
            write_seats(a)
            tag = f"{tag_prefix}-{shots['n']}"
            shots["n"] += 1
            try:
                wide, meta, _phone = shoot(cam, tag, phone=False)
            except Exception as exc:
                print("SHOT FAIL", exc, flush=True)
                return 5.0
            sc = score_render(wide, labels, masks["instances"])
            _, inv = depth_pairs(labels, depth, masks["instances"], world, a)
            sky = (sc.get("frame") or {}).get("skyTop") or 0.0
            passes = meta.get("passes") or {}
            calls = (passes.get("scene") or {}).get("calls")
            if calls is None:
                calls = meta.get("drawCalls")
            if calls is None:
                calls = 99
            if meta.get("objError") or meta.get("mesaError"):
                print("MOUNT", meta.get("objError"), meta.get("mesaError"), flush=True)
            seat = (meta.get("seat") or {})
            gap = seat.get("maxAbs")
            gap = 9.0 if gap is None else float(gap)
            iou = float(sc.get("placedWeighted") or 0.0)
            loss = (1.0 - iou) + 2.0 * max(0.0, abs(sky - key_sky) - 0.1) + 0.12 * len(inv) + 0.02 * max(0, calls - 12) + 0.15 * max(0.0, gap - 0.5)
            row = {
                "tag": tag, "loss": round(loss, 4), "iou": round(iou, 4), "sky": sky, "keySky": key_sky,
                "inversions": len(inv), "drawCalls": calls, "float": gap, "cam": {k: cam[k] for k in ("x", "z", "yaw", "y")},
            }
            print("FRAME", json.dumps(row), flush=True)
            with open(os.path.join(OUT, "frame-log.jsonl"), "a") as f:
                f.write(json.dumps(row) + "\n")
            objective.best = row if objective.best is None or loss < objective.best["loss"] else objective.best
            if objective.best["tag"] == tag:
                objective.best_assign = a
                objective.best_cam = cam
                objective.best_score = sc
                objective.best_inv = inv
            return loss

    objective.best = None
    sys.path.insert(0, os.path.join(REPO, "tools", "common"))
    from align.search import search
    bounds = np.array([[-20, 20], [-8, 8], [-6, 6], [0.85, 1.25]], np.float64)
    mean = np.array([0.0, 0.0, 0.0, 1.0])
    # One real frame before the search, then at most 3 rounds.
    objective(mean, "seed")
    total_evals = 1
    rounds = int(os.environ.get("SCENE_ROUNDS", "3"))
    for rnd in range(rounds):
        if objective.best and objective.best["iou"] >= 0.75 and objective.best["inversions"] == 0 and abs(objective.best["sky"] - key_sky) <= 0.1 and (objective.best["drawCalls"] or 99) <= 12 and (objective.best["float"] or 9) <= 0.5:
            break
        result = search(
            lambda x, rnd=rnd: objective(x, f"r{rnd}"),
            bounds, mean=mean, sigma=0.22, seed=rnd + 3, popsize=4, max_evals=4, patience=2, target=0.05,
            log_path=os.path.join(OUT, f"trials-r{rnd}.jsonl"), solver="cmaes",
        )
        total_evals += int(result["evals"])
        mean = np.array(result["x"], np.float64)
        print("ROUND", rnd, result["loss"], result["solver"], result["evals"], flush=True)

    phone_meta = None
    if getattr(objective, "best_cam", None):
        try:
            _w, _m, phone_meta = shoot(objective.best_cam, "best", phone=True)
        except Exception as exc:
            print("PHONE FAIL", exc, flush=True)
    best = objective.best or {}
    if phone_meta:
        best["phoneDrawCalls"] = ((phone_meta.get("passes") or {}).get("scene") or {}).get("calls", phone_meta.get("drawCalls"))
        best["phoneSeat"] = phone_meta.get("seat")
        if best.get("phoneDrawCalls") is not None:
            best["drawCalls"] = best["phoneDrawCalls"]
    verdict = "PASS" if (
        best.get("iou", 0) >= 0.75 and best.get("inversions") == 0
        and abs(best.get("sky", 0) - key_sky) <= 0.1
        and (best.get("drawCalls") or 99) <= 12 and (best.get("float") or 9) <= 0.5
    ) else "FAIL"
    # Leave the best layout on the staging tree.
    if getattr(objective, "best_assign", None):
        write_seats(objective.best_assign)
    numbers = {
        "job": "placement",
        "verdict": verdict,
        "avenue": {k: info[k] for k in info if k != "grid"},
        "keySkyTop": key_sky,
        "best": best,
        "depthPairs": getattr(objective, "best_inv", []),
        "trials": total_evals,
        "seconds": round(time.perf_counter() - t0, 3),
        "port": PORT,
        "note": "Framebuffer on the terrain-key2 page. Layout left on kc-staging. Live main.mjs untouched.",
    }
    json.dump(numbers, open(os.path.join(OUT, "placement-numbers.json"), "w"), indent=1)
    print("PLACEMENT", verdict, json.dumps(best), flush=True)
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
