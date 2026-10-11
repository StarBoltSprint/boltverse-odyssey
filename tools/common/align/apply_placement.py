#!/usr/bin/env python3
"""Placement lever: one solved camera, then CMA-ES per tower / spire / mesa.

Masks and MoGe depth are the placement-key2 files. No new SAM or MoGe call.
The cheap trial is a projected box silhouette. One staging shot is attempted
after the search. Live preview files are not written.
"""
from __future__ import annotations

import json
import os
import sys
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
COMMON = os.path.abspath(os.path.join(HERE, ".."))
REPO = os.path.abspath(os.path.join(COMMON, "..", ".."))
PLACE = os.path.join(REPO, "tools", "placement-from-key")
for p in (COMMON, PLACE):
    if p not in sys.path:
        sys.path.insert(0, p)

from align.camera import overlay, solve
from align.metrics import score as metric_score
from align.search import search
from depth_lift import AHEAD, LAT_FLOOR, LAT_PUSH, SCALE_SPAN, YAW_SPAN, guard_seat
from geom import Cam, av_xz, iou, xz_av
from score import placed_iou_from_rows

PREV = os.path.join(REPO, "steps", "placement-key2-1011")
STEP = os.path.join(REPO, "steps", "align-solve-1011", "placement")
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
KINDS = ("tower", "spire", "mesa")
BEFORE_IOU = 0.3763


def _cam_from_solve(cam_json, fallback):
    intr = cam_json["intrinsics"]
    ext = cam_json["extrinsics"]
    h = ext.get("height_m")
    eye = float(fallback["eye"])
    if h is not None and 0.5 <= float(h) <= 40:
        eye = float(h)
    return Cam(
        fallback["x"], eye, fallback["z"],
        fallback["yaw"], float(ext["pitch_deg"]),
        float(intr["fov_y_deg"]), 1280, 720,
    )


def _box_mask(cam, s, lat, yaw, scale, height, shape, kind):
    """Eight corners of a vertical box, filled in the key frame."""
    x, z = av_xz(s, lat)
    width = {"tower": 18.0, "spire": 8.0, "mesa": 40.0}.get(kind, 16.0) * float(scale)
    depth = width * 0.55
    hy = float(height)
    yr = np.deg2rad(yaw)
    c, sn = np.cos(yr), np.sin(yr)
    corners = []
    for dx in (-width / 2, width / 2):
        for dz in (-depth / 2, depth / 2):
            wx = x + c * dx + sn * dz
            wz = z - sn * dx + c * dz
            corners.append([wx, 0.0, wz])
            corners.append([wx, hy, wz])
    uv, dep = cam.project(corners)
    h, w = shape
    img = np.zeros((h, w), np.uint8)
    ok = dep > 1.0
    if ok.sum() < 3:
        return img.astype(bool)
    pts = uv[ok].astype(np.int32)
    hull = cv2.convexHull(pts)
    cv2.fillConvexPoly(img, hull, 1)
    return img.astype(bool)


def _score_objects(cam, rows, labels):
    per = []
    order_bad = 0
    painted = np.zeros(labels.shape, np.uint8)
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a["imageV"] > b["imageV"] + 12 and a["s"] > b["s"] + 8:
                order_bad += 1
            elif b["imageV"] > a["imageV"] + 12 and b["s"] > a["s"] + 8:
                order_bad += 1
    for row in rows:
        if row.get("kind") not in KINDS:
            continue
        key = labels == int(row["label"])
        if key.sum() < 20:
            continue
        got = _box_mask(cam, row["s"], row["lateral"], row["yaw"], row["scale"], row["height"], labels.shape, row["kind"])
        painted[got] = 255
        val = iou(key, got)
        # Edge agreement of the box outline against the mask outline.
        edge_r = cv2.Canny(got.astype(np.uint8) * 255, 40, 120)
        edge_k = cv2.Canny(key.astype(np.uint8) * 255, 40, 120)
        sc = metric_score(
            np.stack([edge_r, edge_r, edge_r], -1),
            np.stack([edge_k, edge_k, edge_k], -1),
        )
        per.append({
            "id": row["id"], "kind": row["kind"], "iou": val, "pixels": int(key.sum()),
            "alignment": sc["alignment"], "chamfer_px": sc["chamfer_px"],
        })
    weighted = placed_iou_from_rows([{"kind": r["kind"], "iou": r["iou"], "pixels": r["pixels"]} for r in per])
    return {"perObject": per, "placedWeighted": weighted, "inversions": order_bad, "paint": painted}


def _clamp_row(row, s, lat, yaw, scale, height, cam_s):
    side = 1.0 if lat >= 0 else -1.0
    s2, lat2 = guard_seat(s, lat, cam_s, row["kind"], side)
    span = SCALE_SPAN.get(row["kind"], (0.4, 2.4))
    lo = min(span[0], row.get("scale0", span[0]) * 0.75)
    hi = max(span[1], row.get("scale0", span[1]) * 1.25)
    scale = float(np.clip(scale, lo, hi))
    dy = (yaw - row["yaw0"]) 
    dy = (dy + 180) % 360 - 180
    yaw = row["yaw0"] + float(np.clip(dy, -YAW_SPAN, YAW_SPAN))
    height = float(np.clip(height, 4.0, max(8.0, row["height0"] * 1.8)))
    return s2, lat2, yaw % 360.0, scale, height


def run():
    os.makedirs(STEP, exist_ok=True)
    t_all = time.perf_counter()
    timing = {}
    labels = np.load(os.path.join(PREV, "masks.npy"))
    depth = np.load(os.path.join(PREV, "depth-moge.npy"))
    if depth.shape[:2] != labels.shape[:2]:
        depth = cv2.resize(depth.astype(np.float32), (labels.shape[1], labels.shape[0]), interpolation=cv2.INTER_LINEAR)
    placed = json.load(open(os.path.join(PREV, "placed-r1.json")))
    masks = json.load(open(os.path.join(PREV, "masks.json")))
    by_mask = {i["id"]: i for i in masks["instances"]}
    bgr = cv2.imread(KEY)
    t0 = time.perf_counter()
    cam_json = solve(bgr, depth=depth, image_path=None)
    timing["camera_s"] = round(time.perf_counter() - t0, 3)
    json.dump(cam_json, open(os.path.join(STEP, "camera.json"), "w"), indent=1)
    overlay(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), cam_json, os.path.join(STEP, "vp-overlay.jpg"))
    from place import KEY_CAM
    cam = _cam_from_solve(cam_json, KEY_CAM)
    cam_s, _cam_lat = xz_av(KEY_CAM["x"], KEY_CAM["z"])
    print("ALIGN placement camera fov", round(cam.fov, 2), "pitch", round(cam.pitch, 2),
          "eye", round(float(cam.p[1]), 2), "fallback", cam_json["fallback"], flush=True)

    rows = []
    for p in placed:
        if p.get("kind") not in KINDS or "s" not in p:
            continue
        src = by_mask.get(p["id"]) or by_mask.get(p.get("from"))
        if not src or src.get("label") is None:
            continue
        raw = p.get("raw") or {}
        row = {
            "id": p["id"], "kind": p["kind"], "label": int(src["label"]),
            "s": float(p["s"]), "lateral": float(p.get("lateral", p.get("lat", 0))),
            "yaw": float(p.get("yaw", 0)), "scale": float(p.get("scale", 1)),
            "height": float(raw.get("heightM") or p.get("height") or 40),
            "imageV": float(p.get("imageV") or 0),
        }
        row["yaw0"] = row["yaw"]
        row["height0"] = row["height"]
        row["scale0"] = row["scale"]
        row["s0"] = row["s"]
        row["lat0"] = row["lateral"]
        rows.append(row)
    if not rows:
        raise SystemExit("no tower/spire/mesa rows in placed-r1.json")

    base = _score_objects(cam, rows, labels)
    camera_iou = base["placedWeighted"]
    print("ALIGN placement camera-only software IoU", round(camera_iou, 4),
          "inversions", base["inversions"], flush=True)

    trials = 0
    search_rows = []
    for rnd in range(3):
        print("ALIGN placement search", rnd, flush=True)
        t0 = time.perf_counter()
        for row in rows:
            bounds = np.array([
                [row["s0"] - 30, row["s0"] + 80],
                [row["lat0"] - 40, row["lat0"] + 40],
                [row["yaw0"] - YAW_SPAN, row["yaw0"] + YAW_SPAN],
                [row["scale0"] * 0.75, row["scale0"] * 1.25],
                [max(4.0, row["height0"] * 0.6), row["height0"] * 1.6],
            ], np.float64)

            def objective(x, row=row):
                s, lat, yaw, scale, height = _clamp_row(row, x[0], x[1], x[2], x[3], x[4], cam_s)
                key = labels == int(row["label"])
                got = _box_mask(cam, s, lat, yaw, scale, height, labels.shape, row["kind"])
                val = iou(key, got)
                bad = 0
                for other in rows:
                    if other["id"] == row["id"]:
                        continue
                    if row["imageV"] > other["imageV"] + 12 and s > other["s"] + 8:
                        bad += 1
                    elif other["imageV"] > row["imageV"] + 12 and other["s"] > s + 8:
                        bad += 1
                return (1.0 - val) + 0.05 * bad

            result = search(
                objective, bounds, mean=np.array([row["s"], row["lateral"], row["yaw"], row["scale"], row["height"]]),
                sigma=0.2, seed=rnd, popsize=4, max_evals=12, patience=2, target=0.08,
                log_path=os.path.join(STEP, f"trials-r{rnd}-{row['id']}.jsonl"), solver="cmaes",
            )
            trials += int(result["evals"])
            s, lat, yaw, scale, height = _clamp_row(row, *result["x"], cam_s)
            row.update({"s": s, "lateral": lat, "yaw": yaw, "scale": scale, "height": height})
            search_rows.append({"round": rnd, "id": row["id"], "loss": result["loss"], "evals": result["evals"]})
        timing[f"search_r{rnd}_s"] = round(time.perf_counter() - t0, 3)
        snap = _score_objects(cam, rows, labels)
        print(" round", rnd, "iou", round(snap["placedWeighted"], 4), "inv", snap["inversions"], flush=True)

    final = _score_objects(cam, rows, labels)
    cv2.imwrite(os.path.join(STEP, "software-silhouette.png"), final["paint"])
    json.dump([{k: r[k] for k in ("id", "kind", "s", "lateral", "yaw", "scale", "height", "label")} for r in rows],
              open(os.path.join(STEP, "placed.json"), "w"), indent=1)

    shot_note = "not taken"
    phone_path = os.path.join(REPO, "steps", "align-solve-1011", "placement-sheet-phone.jpg")
    try:
        import place
        place._refuse_live(place.STAGE)
        layout = place.load_json(os.path.join(place.STAGE, "objects1", "layout.json"))
        # Patch seats that exist on the staged layout. Unknown ids stay.
        by_id = {r["id"]: r for r in rows}
        for t in layout.get("towers", []):
            if t["id"] in by_id:
                r = by_id[t["id"]]
                t["s"], t["lateral"] = r["s"], r["lateral"]
                t["x"], t["z"] = av_xz(r["s"], r["lateral"])
                t["yaw"], t["scale"] = r["yaw"], r["scale"]
                t["height"] = r["height"]
        if layout.get("spire") and layout["spire"].get("id") in by_id:
            r = by_id[layout["spire"]["id"]]
            layout["spire"]["s"] = r["s"]
            layout["spire"]["lateral"] = r["lateral"]
            layout["spire"]["yaw"] = r["yaw"]
            layout["spire"]["scale"] = r["scale"]
        params_path = os.path.join(place.STAGE, "mesas", "kc-params.json")
        if os.path.isfile(params_path):
            params = place.load_json(params_path)
            for m in params.get("layout", []):
                if m.get("id") in by_id:
                    r = by_id[m["id"]]
                    m["s"], m["lat"] = r["s"], r["lateral"]
                    m["yaw"], m["scale"] = r["yaw"], r["scale"]
            place.dump(params, params_path)
        place.dump(layout, os.path.join(place.STAGE, "objects1", "layout.json"))
        place.ensure_page()
        shot_cam = dict(place.KEY_CAM)
        shot_cam["fov"] = cam.fov
        shot_cam["pitch"] = cam.pitch
        shot_cam["eye"] = float(cam.p[1])
        png = os.path.join(STEP, "phone.png")
        place.shot(place.page_url(shot_cam, 540, 1200), png, 540, 1200)
        wide = os.path.join(STEP, "wide.png")
        place.shot(place.page_url(shot_cam, 1280, 720), wide, 1280, 720)
        sys.path.insert(0, os.path.join(REPO, "tools", "grok-native"))
        import sheet as gn_sheet
        phone = cv2.imread(png)
        wide_bgr = cv2.imread(wide)
        cv2.imwrite(phone_path, gn_sheet.sheet_phone(phone, wide_bgr, bgr))
        shot_note = "staging shot on 127.0.0.1:8997"
    except Exception as exc:
        shot_note = "shot failed: " + str(exc)[:400]
        sys.path.insert(0, os.path.join(REPO, "tools", "grok-native"))
        import sheet as gn_sheet
        paint = cv2.cvtColor(final["paint"], cv2.COLOR_GRAY2BGR)
        cv2.imwrite(phone_path, gn_sheet.sheet_phone(paint, paint, bgr))
        print("ALIGN placement shot", shot_note, flush=True)

    verdict = "PASS" if final["placedWeighted"] >= 0.75 and final["inversions"] == 0 else "FAIL"
    numbers = {
        "job": "placement",
        "verdict": verdict,
        "before_placedWeighted": BEFORE_IOU,
        "camera_only_software": round(camera_iou, 4),
        "after_search_software": round(final["placedWeighted"], 4),
        "perObject": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items()} for r in final["perObject"]],
        "inversions": final["inversions"],
        "floors": {"ahead": AHEAD, "lat_floor": LAT_FLOOR, "lat_push": LAT_PUSH},
        "camera": {
            "fov_y_deg": round(cam.fov, 3),
            "pitch_deg": round(cam.pitch, 3),
            "roll_deg": round(float(cam_json["extrinsics"]["roll_deg"]), 3),
            "yaw_deg_image": round(float(cam_json["extrinsics"]["yaw_deg"]), 3),
            "yaw_deg_world": place_yaw if False else KEY_CAM["yaw"],
            "height_m": cam_json["extrinsics"]["height_m"],
            "eye_m": round(float(cam.p[1]), 3),
            "fallback": cam_json["fallback"],
            "lines": cam_json["lines"],
        },
        "trials": trials,
        "timing_s": timing,
        "seconds_total": round(time.perf_counter() - t_all, 3),
        "vision_cost_usd": 0.0,
        "shot": shot_note,
        "why": "pass" if verdict == "PASS" else "software placed IoU under 0.75 or depth order inverted",
        "note": "Decision IoU is tower, spire, and mesa. Wreck and arch stay TODO. The number is the cheap box raster, then a staging shot when the server answers.",
    }
    # fix the silly yaw line
    numbers["camera"]["yaw_deg_world"] = KEY_CAM["yaw"]
    json.dump(numbers, open(os.path.join(STEP, "numbers.json"), "w"), indent=1)
    print("ALIGN placement", verdict, round(final["placedWeighted"], 4), shot_note, flush=True)
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    # imported KEY_CAM above inside run; this reference is for the camera dict
    from place import KEY_CAM  # noqa: E402
    sys.exit(run())
