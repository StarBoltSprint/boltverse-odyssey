#!/usr/bin/env python3
"""Place Zone B from the key image. Staging only. No Imagine generation.

  python3 tools/placement-from-key/place.py all --out steps/placement-key2-1011
  python3 tools/placement-from-key/selftest.py

Two render rounds, then stop. The blocking number is the weighted silhouette IoU.
MoGe-2 metric depth, SAM2 small masks, wreck and arch stay TODO and do not block.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from copy import deepcopy

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

from depth_lift import assign_assets, enforce_order, guard_seat, lift_instances
from geom import AVENUE_HALF, Cam, av_xz, dir_to_heading, xz_av
from score import frame_rejected, score_render

LIVE = os.environ.get("I23D_LIVE_ROOT", "/workspace/zb-preview-1008")
STAGE = os.environ.get("PLACEMENT_STAGE", "/workspace/kc-staging/zb")
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
ZONE_SRC = "/workspace/grokcli/wt/world-graph-1011/zone-b.zone.json"
SAM = "/workspace/.venv-sam2/bin/python"
KEY_CAM = dict(x=-51.115, z=9.63, yaw=78, pitch=4.84, eye=4.0, fov=90)
RUNNERS = [
    {"name": "street", "x": -7.45, "z": 3.44, "yaw": 81, "pitch": -15, "eye": 1.6, "fov": 58},
    {"name": "chase", "x": None, "z": None, "s": -44, "lat": 36, "yaw": 30, "pitch": -2.4, "eye": 3.05, "fov": 58},
    {"name": "runner", "s": -20, "lat": 0, "yaw": 78, "pitch": 0, "eye": 1.7, "fov": 58},
]


def _refuse_live(path):
    o, live = os.path.realpath(path), os.path.realpath(LIVE)
    if o == live or o.startswith(live + os.sep):
        raise SystemExit(f"refusing to write the live preview: {path}")


def load_json(path):
    with open(path) as f:
        return json.load(f)


def dump(obj, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=1)
        f.write("\n")


def shot(url, png, w, h):
    cmd = ["node", os.path.join(HERE, "shot.mjs"), url, png, str(w), str(h)]
    r = subprocess.run(cmd, text=True, capture_output=True, timeout=240)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + "\n" + r.stderr)
    return json.loads(r.stdout.strip().splitlines()[-1])


def page_url(cam, w, h):
    q = (
        f"hud=0&lockq=1&dyn=0&x={cam['x']}&z={cam['z']}&yaw={cam['yaw']}"
        f"&pitch={cam['pitch']}&eye={cam['eye']}&fov={cam['fov']}&w={w}&h={h}&t={int(time.time())}"
    )
    return f"http://127.0.0.1:8997/index-placement.html?{q}"


def ensure_page():
    """Staging copy of main.mjs that reads ?fov=. The live file is not edited."""
    _refuse_live(STAGE)
    src = os.path.join(LIVE, "main.mjs")
    dst = os.path.join(STAGE, "main-placement.mjs")
    text = open(src).read()
    old = "camera.fov = cam.fovDeg; camera.updateProjectionMatrix();"
    new = 'camera.fov = (QD.get("fov") && isFinite(+QD.get("fov"))) ? +QD.get("fov") : cam.fovDeg; camera.updateProjectionMatrix();'
    if old not in text and "QD.get(\"fov\")" not in text:
        raise SystemExit("main.mjs fov line not found")
    if old in text:
        text = text.replace(old, new, 1)
    open(dst, "w").write("// staging copy for placement-from-key. Live main.mjs is untouched.\n" + text)
    html = open(os.path.join(STAGE, "index.html")).read()
    html = html.replace('src="./main.mjs?v=62"', 'src="./main-placement.mjs?v=placement1"')
    html = html.replace('src="./main.mjs"', 'src="./main-placement.mjs?v=placement1"')
    open(os.path.join(STAGE, "index-placement.html"), "w").write(html)


def run_depth(out, fov_x):
    npy = os.path.join(out, "depth-moge.npy")
    js = os.path.join(out, "depth-moge.json")
    cmd = [SAM, os.path.join(HERE, "moge_depth.py"), KEY, npy, js, str(fov_x)]
    r = subprocess.run(cmd, text=True, capture_output=True, timeout=1800)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + "\n" + r.stderr)
    return load_json(js)


def run_masks(out):
    boxes = os.path.join(HERE, "vision_boxes.json")
    npy = os.path.join(out, "masks.npy")
    js = os.path.join(out, "masks.json")
    cmd = [SAM, os.path.join(HERE, "sam2_boxes.py"), KEY, boxes, npy, js]
    r = subprocess.run(cmd, text=True, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + "\n" + r.stderr)
    return load_json(js)


PRIOR_OUT = os.path.join(ROOT, "steps", "placement-key-1011")
COMMON = os.path.join(ROOT, "tools")


def seed_backups(out):
    """Copy the pre-nudge snapshots so a new out dir does not freeze the failed layout."""
    os.makedirs(out, exist_ok=True)
    for name, _rel in STAGE_FILES:
        dst = os.path.join(out, name)
        src = os.path.join(PRIOR_OUT, name)
        if not os.path.isfile(dst) and os.path.isfile(src):
            shutil.copy(src, dst)


def _calls(side):
    passes = side.get("passes") or {}
    main = passes.get("main") if isinstance(passes, dict) else None
    main_calls = main.get("calls") if isinstance(main, dict) else None
    info = side.get("drawCalls")
    used = main_calls if main_calls is not None else info
    return used, {"info": info, "main": main_calls, "source": "passes.main" if main_calls is not None else "info.calls", "visible": side.get("visible")}


def _unexpected_missing(todos):
    out = []
    for td in todos:
        if td.get("status") != "TODO":
            continue
        ident = f"{td.get('id') or ''} {td.get('kind') or ''}".lower()
        if "wreck" in ident or "arch" in ident:
            continue
        out.append(td.get("id"))
    return out


def _sam_structure(labels, instances):
    m = np.zeros(labels.shape, np.uint8)
    for inst in instances:
        if inst.get("kind") not in ("tower", "spire", "mesa"):
            continue
        if inst.get("label") is None:
            continue
        m[labels == int(inst["label"])] = 1
    return m


def _seat_mask(assign, cam: Cam, shape, lifts):
    h, w = shape
    got = np.zeros((h, w), np.uint8)
    by = {p["from"]: p for p in assign["placed"]}
    for lift in lifts:
        if lift.get("status") != "lifted" or lift.get("kind") not in ("tower", "spire", "mesa"):
            continue
        p = by.get(lift["id"])
        if not p:
            continue
        x, z = av_xz(p["s"], p["lateral"])
        height = float(p.get("height") or lift.get("heightM") or 40.0)
        base = cam.project([[x, float(cam.p[1]), z]])[0][0]
        top = cam.project([[x, float(cam.p[1]) + height, z]])[0][0]
        u0, v0 = float(base[0]), float(base[1])
        u1, v1 = float(top[0]), float(top[1])
        half = max(4.0, abs(v0 - v1) * 0.18)
        x0 = int(np.clip(min(u0, u1) - half, 0, w - 1))
        x1 = int(np.clip(max(u0, u1) + half, 0, w - 1))
        y0 = int(np.clip(min(v0, v1), 0, h - 1))
        y1 = int(np.clip(max(v0, v1), 0, h - 1))
        if x1 > x0 and y1 > y0:
            got[y0:y1 + 1, x0:x1 + 1] = 1
    return got


def camera_from_shot(meta, fov, w, h):
    cam = meta["cam"]
    return Cam(cam["x"], cam["y"], cam["z"], cam["yaw"], cam["pitch"], fov, w, h)


def sun_from_key(cam: Cam, instances) -> dict:
    sun = next(i for i in instances if i["id"] == "sun")
    box = sun["maskBox"]
    u = (box[0] + box[2]) / 2
    v = (box[1] + box[3]) / 2
    rd = cam.ray(u, v)
    heading, elev = dir_to_heading(rd)
    # The giant is opposite the sun, outside this 90-degree vertical / wide horizontal frame.
    planet_h = (heading + 180.0) % 360.0
    return {
        "sun": {"azimuthDeg": round(heading, 2), "elevationDeg": round(elev, 2), "pixel": [round(u, 1), round(v, 1)]},
        "planet": {"azimuthDeg": round(planet_h, 2), "elevationDeg": 22.0, "radiusDeg": 13, "inKeyFrame": False},
        "note": "Sun direction is the ray through the key sun. Planet heading is opposite that ray so the gas giant leaves the key frame. Existing atlas and planet still only.",
    }


def apply_sky(sky):
    _refuse_live(STAGE)
    biome_path = os.path.join(STAGE, "biome.json")
    biome = load_json(biome_path)
    biome["sun"]["azimuthDeg"] = sky["sun"]["azimuthDeg"]
    biome["sun"]["elevationDeg"] = sky["sun"]["elevationDeg"]
    biome["planet"]["azimuthDeg"] = sky["planet"]["azimuthDeg"]
    biome["planet"]["elevationDeg"] = sky["planet"]["elevationDeg"]
    dump(biome, biome_path)
    sky_path = os.path.join(STAGE, "sky1", "sky-t7.mjs")
    text = open(sky_path).read()
    import re
    repl = "PLANET = { heading: %.2f, elev: %.2f, radiusDeg: 13 }" % (sky["planet"]["azimuthDeg"], sky["planet"]["elevationDeg"])
    text2, n = re.subn(r"PLANET = \{ heading: [^,]+, elev: [^,]+, radiusDeg: 13 \}", repl, text, count=1)
    if n != 1:
        raise SystemExit("PLANET literal not found in staging sky-t7.mjs")
    open(sky_path, "w").write(text2)


def write_layout(layout, assign):
    _refuse_live(STAGE)
    layout = deepcopy(layout)
    layout["towers"] = assign["towers"]
    layout["spire"] = assign["spire"]
    layout["skyline"] = assign["skyline"]
    layout["placementFromKey"] = {"placed": assign["placed"], "notes": assign["notes"]}
    dump(layout, os.path.join(STAGE, "objects1", "layout.json"))
    params_path = os.path.join(STAGE, "mesas", "kc-params.json")
    params = load_json(params_path)
    params["layout"] = assign["mesas"]
    dump(params, params_path)
    return layout


def write_zone(assign, sky, lifts, path, apply_moves=True):
    zone = load_json(ZONE_SRC)
    by = {o["id"]: o for o in zone["objects"]}
    if apply_moves:
        moved = {p["id"]: p for p in assign["placed"]}
        for oid, p in moved.items():
            if oid not in by:
                continue
            o = by[oid]
            if p.get("kind") == "mesa":
                continue
            x, z = av_xz(p["s"], p["lateral"])
            o["transform"]["position"][0] = x
            o["transform"]["position"][2] = z
            o["transform"]["rotationDeg"]["yaw"] = p["yaw"]
            sc = p["scale"]
            o["transform"]["scale"] = [sc, sc, sc]
            o.setdefault("layout", {})
            o["layout"]["s"] = p["s"]
            o["layout"]["lateral"] = p["lateral"]
            o["layout"]["height"] = p.get("height")
            o["placementFromKey"] = {"from": p["from"], "raw": p.get("raw")}
        # Mesa rows in the zone use ids like mesa-L-mid. kc-params ids are L-mid.
        for p in assign["placed"]:
            if p.get("kind") != "mesa":
                continue
            zid = "mesa-" + p["id"]
            if zid not in by:
                continue
            o = by[zid]
            x, z = av_xz(p["s"], p["lateral"])
            o["transform"]["position"][0] = x
            o["transform"]["position"][2] = z
            o["transform"]["rotationDeg"]["yaw"] = p["yaw"]
            sc = p["scale"]
            o["transform"]["scale"] = [sc, sc, sc]
            o.setdefault("layout", {})
            o["layout"]["s"] = p["s"]
            o["layout"]["lateral"] = p["lateral"]
            o["placementFromKey"] = {"from": p["from"], "raw": p.get("raw")}
    zone["objects"] = [o for o in zone["objects"] if not str(o.get("id", "")).startswith("todo-")]
    zone["objects"].extend(assign["todos"])
    zone["placementFromKey"] = {
        "applied": bool(apply_moves),
        "sky": sky,
        "lifts": lifts,
        "placed": assign["placed"],
        "notes": assign["notes"],
        "clamp": "MoGe metres are applied. Mesas that would enter the lens are pushed out. Extra towers park behind the camera.",
    }
    zone["keyCamera"]["previewPose"] = {
        "x": KEY_CAM["x"], "z": KEY_CAM["z"], "yaw": KEY_CAM["yaw"], "pitch": KEY_CAM["pitch"],
        "eye": KEY_CAM["eye"], "fov": KEY_CAM["fov"], "source": "unreal-look-fix2 matched camera",
    }
    dump(zone, path)


def runner_xz(cam):
    if cam.get("x") is not None:
        return cam["x"], cam["z"]
    return av_xz(cam["s"], cam["lat"])


def layout_checks(assign):
    items = []
    for t in assign["towers"] + [assign["spire"]]:
        w = (12.0 if t["id"] == "spire" else {"m2": 23.75, "m3": 27.5, "m4": 21.25, "m6": 17.65}.get(t.get("module"), 20)) * float(t.get("scale") or 1)
        items.append({"id": t["id"], "s": t["s"], "lateral": t["lateral"], "r": w * 0.5, "kind": "spire" if t["id"] == "spire" else "tower"})
    blocked = [it for it in items if abs(it["lateral"]) < AVENUE_HALF]
    overlaps = []
    for i, a in enumerate(items):
        ax, az = av_xz(a["s"], a["lateral"])
        for b in items[i + 1:]:
            bx, bz = av_xz(b["s"], b["lateral"])
            dist = ((ax - bx) ** 2 + (az - bz) ** 2) ** 0.5
            need = a["r"] + b["r"] + 1.5
            if dist < need:
                overlaps.append({"a": a["id"], "b": b["id"], "dist": round(dist, 2), "need": round(need, 2)})
    return {"corridorBlocked": [it["id"] for it in blocked], "overlaps": overlaps, "n": len(items)}


def nudge(assign, cam: Cam, lifts):
    """Round 2: depth order, then slide each seat sideways onto its key column."""
    enforce_order(assign)
    by_from = {p["from"]: p for p in assign["placed"]}
    cam_s = assign.get("camS")
    if cam_s is None:
        cam_s, _ = xz_av(float(cam.p[0]), float(cam.p[2]))
    for row in lifts:
        if row.get("status") != "lifted":
            continue
        p = by_from.get(row["id"])
        if not p:
            continue
        kind = p.get("kind") or row["kind"]
        if kind not in ("tower", "spire", "mesa"):
            continue
        s = p["s"]
        lat = p["lateral"]
        x, z = av_xz(s, lat)
        uv, depth = cam.project([[x, float(cam.p[1]), z]])
        if float(depth[0]) < 8:
            continue
        du = row["imageBase"][0] - float(uv[0, 0])
        shift = float(np.clip(du / cam.f * float(depth[0]), -40.0, 40.0))
        right = cam.right
        x2 = x + float(right[0]) * shift
        z2 = z + float(right[2]) * shift
        want_s, want_lat = xz_av(x2, z2)
        side = 1 if row["imageBase"][0] >= cam.w * 0.5 else -1
        if kind == "spire":
            side = 1
        ns, nlat = guard_seat(want_s, want_lat, cam_s, kind, side)
        p["s"] = round(ns, 3)
        p["lateral"] = round(nlat, 3)
        if kind == "mesa":
            for m in assign["mesas"]:
                if m["id"] == p["id"]:
                    m["s"] = round(ns, 2)
                    m["lat"] = round(nlat, 2)
        elif kind == "spire":
            assign["spire"]["s"] = p["s"]
            assign["spire"]["lateral"] = p["lateral"]
            assign["spire"]["x"], assign["spire"]["z"] = av_xz(p["s"], p["lateral"])
        else:
            for t in assign["towers"]:
                if t["id"] == p["id"]:
                    t["s"] = p["s"]
                    t["lateral"] = p["lateral"]
                    t["x"], t["z"] = av_xz(p["s"], p["lateral"])


def depth_inversions(assign, cam: Cam, lifts) -> list:
    """A nearer mask (larger image v) must not sit farther from the camera than a farther mask."""
    by_from = {p["from"]: p for p in assign["placed"]}
    rows = []
    for lift in lifts:
        if lift.get("status") != "lifted":
            continue
        p = by_from.get(lift["id"])
        if not p:
            continue
        x, z = av_xz(p["s"], p["lateral"])
        _uv, depth = cam.project([[x, float(cam.p[1]), z]])
        rows.append((lift["id"], float(lift["imageBase"][1]), float(depth[0])))
    inv = []
    for i, a in enumerate(rows):
        for b in rows[i + 1:]:
            if a[1] > b[1] + 20 and a[2] > b[2] + 12:
                inv.append({"nearerInKey": a[0], "butFartherThan": b[0], "depth": [round(a[2], 1), round(b[2], 1)]})
            elif b[1] > a[1] + 20 and b[2] > a[2] + 12:
                inv.append({"nearerInKey": b[0], "butFartherThan": a[0], "depth": [round(b[2], 1), round(a[2], 1)]})
    return inv


STAGE_FILES = (
    ("stage-before-objects1-layout.json", "objects1/layout.json"),
    ("stage-before-biome.json", "biome.json"),
    ("stage-before-sky1-sky-t7.mjs", "sky1/sky-t7.mjs"),
    ("stage-before-mesas-kc-params.json", "mesas/kc-params.json"),
)


def restore_stage(out):
    """Put the pre-cook staging files back. A re-run must not backup the bad layout over them."""
    _refuse_live(STAGE)
    paths = [(os.path.join(out, src), os.path.join(STAGE, rel)) for src, rel in STAGE_FILES]
    if not all(os.path.isfile(src) for src, _dst in paths):
        for src_name, rel in STAGE_FILES:
            shutil.copy(os.path.join(STAGE, rel), os.path.join(out, src_name))
        return False
    for src, dst in paths:
        shutil.copy(src, dst)
    return True


def restore_layout_only(out):
    """Drop a rejected placement. Sky files stay as last applied."""
    _refuse_live(STAGE)
    for src, rel in STAGE_FILES:
        if rel in ("biome.json", "sky1/sky-t7.mjs"):
            continue
        shutil.copy(os.path.join(out, src), os.path.join(STAGE, rel))


def sheet(paths, labels, dest, cell):
    cw, ch = cell
    canvas = Image.new("RGB", (cw * len(paths), ch + 36), (16, 16, 18))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    for i, (path, label) in enumerate(zip(paths, labels)):
        im = Image.open(path).convert("RGB")
        im.thumbnail((cw, ch))
        x = i * cw + (cw - im.width) // 2
        y = 36 + (ch - im.height) // 2
        canvas.paste(im, (x, y))
        draw.text((i * cw + 12, 8), label, fill=(240, 236, 228), font=font)
    canvas.save(dest, quality=90)


def write_report(path, times, scores, sky, checks, budget, phone_url, verdict, rounds, gates=None, clock=None):
    lines = [
        "# Placement from the key — 11 Oct",
        "",
        f"Verdict: {verdict}",
        "",
        "Blocking target: weighted silhouette IoU ≥ 0.75, every lifted object at the right depth order. Two rounds, then stop.",
        "",
        "## Times (seconds)",
        "",
        "| Stage | Seconds |",
        "| --- | --- |",
    ]
    for k, v in times.items():
        lines.append(f"| {k} | {v:.1f} |")
    lines += ["", "## Sky", "", "```", json.dumps(sky, indent=1), "```", "", "## Silhouette IoU", ""]
    for name, sc in scores.items():
        lines.append(f"### {name}")
        lines.append("")
        placed = sc.get("placedWeighted", sc["overallWeighted"])
        lines.append(f"Weighted {sc['overallWeighted']} · placed kinds {placed} · union {sc['union']}")
        if sc.get("reject"):
            lines.append(f"Rejected: {sc['reject']}")
        if sc.get("frame"):
            lines.append(f"Frame luma {sc['frame']['luma']} · sky in the top 45% {sc['frame']['skyTop']}")
        lines.append("")
        lines.append("| Object | Kind | IoU |")
        lines.append("| --- | --- | --- |")
        for row in sc["perObject"]:
            lines.append(f"| {row['id']} | {row['kind']} | {row['iou']} |")
        lines.append("")
    lines += ["## Layout checks (runner geometry)", "", "```", json.dumps(checks, indent=1), "```", ""]
    lines += ["## Phone budget", "", "```", json.dumps(budget, indent=1), "```", ""]
    if clock:
        lines += [
            "## Stage clock",
            "",
            "The 0.87 silhouette number is the object-cook gate. This step records a projected-seat proxy before the browser shots. The blocking number stays the framebuffer placed IoU ≥ 0.75.",
            "",
            "```",
            json.dumps(clock, indent=1),
            "```",
            "",
        ]
    if gates:
        lines += ["## Capture gate", "", "```", json.dumps(gates, indent=1), "```", ""]
    lines += [
        "## Rounds",
        "",
        rounds,
        "",
        "## Staging",
        "",
        phone_url,
        "",
        "Live preview files were not edited. No Imagine image was generated.",
        "",
    ]
    open(path, "w").write("\n".join(lines))


def _archive_bad_round(out):
    """Keep the rock-wall frames. They are not a placement result."""
    summary = os.path.join(out, "summary.json")
    disc = os.path.join(out, "summary-discarded.json")
    if os.path.isfile(summary) and not os.path.isfile(disc):
        shutil.copy(summary, disc)
    for name in ("round1-16x9.png", "round2-16x9.png", "after-16x9.png", "sheet-16x9.jpg", "sheet-phone.jpg"):
        src = os.path.join(out, name)
        dst = os.path.join(out, "discarded-rockwall-" + name)
        if os.path.isfile(src) and not os.path.isfile(dst):
            shutil.copy(src, dst)


def _decision(scores, name):
    why = frame_rejected(scores[name], scores["before"])
    scores[name]["reject"] = why
    if why:
        return None
    return scores[name]["placedWeighted"]


def all_cmd(a):
    sys.path.insert(0, COMMON)
    from common.capture_gate import check_capture
    from common.stage_clock import StageClock

    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    seed_backups(out)
    _archive_bad_round(out)
    restored = restore_stage(out)
    times = {}
    t = time.time()
    ensure_page()
    times["staging page"] = time.time() - t

    cam = Cam(KEY_CAM["x"], KEY_CAM["eye"], KEY_CAM["z"], KEY_CAM["yaw"], KEY_CAM["pitch"], KEY_CAM["fov"], 1280, 720)

    t = time.time()
    masks_json = os.path.join(out, "masks.json")
    masks_npy = os.path.join(out, "masks.npy")
    if os.path.isfile(masks_json) and os.path.isfile(masks_npy):
        masks = load_json(masks_json)
        times["sam2 masks"] = 0.0
    else:
        masks = run_masks(out)
        times["sam2 masks"] = time.time() - t

    t = time.time()
    depth_path = os.path.join(out, "depth-moge.npy")
    meta_path = os.path.join(out, "depth-moge.json")
    fov_x = math.degrees(2 * math.atan(math.tan(math.radians(float(KEY_CAM["fov"])) / 2.0) * (1280 / 720)))
    if os.path.isfile(depth_path) and os.path.isfile(meta_path):
        depth = np.load(depth_path)
        meta = load_json(meta_path)
        times["moge depth"] = 0.0
    else:
        meta = run_depth(out, fov_x)
        depth = np.load(depth_path)
        times["moge depth"] = time.time() - t
    labels = np.load(masks_npy)
    if depth.shape[:2] != labels.shape[:2]:
        ys = np.linspace(0, depth.shape[0] - 1, labels.shape[0]).astype(int)
        xs = np.linspace(0, depth.shape[1] - 1, labels.shape[1]).astype(int)
        depth = np.asarray(depth, np.float32)[ys][:, xs]
    fit = {"metric": True, "model": meta.get("model", "moge-2"), "A": None, "fovX": round(fov_x, 3), "p50": meta.get("p50")}
    dump(fit, os.path.join(out, "depth-fit.json"))
    t = time.time()
    base_layout = load_json(os.path.join(STAGE, "objects1", "layout.json"))
    lifts = lift_instances(cam, depth, labels, masks["instances"], fit, base_layout)
    dump(lifts, os.path.join(out, "lifts.json"))
    times["depth lift"] = time.time() - t

    sky = sun_from_key(cam, masks["instances"])
    dump(sky, os.path.join(out, "sky-align.json"))
    t = time.time()
    apply_sky(sky)
    times["sky apply"] = time.time() - t

    mesa = load_json(os.path.join(STAGE, "mesas", "kc-params.json"))["layout"]
    assign = assign_assets(lifts, base_layout, mesa, cam)
    dump(assign["placed"], os.path.join(out, "placed-r1.json"))

    ref = _sam_structure(labels, masks["instances"])
    got = _seat_mask(assign, cam, labels.shape, lifts)
    key_im = np.asarray(Image.open(KEY).convert("RGB"))
    ys = np.linspace(0, key_im.shape[0] - 1, 90).astype(int)
    xs = np.linspace(0, key_im.shape[1] - 1, 160).astype(int)
    colour_ref = key_im[ys][:, xs]
    colour_got = np.broadcast_to(colour_ref.reshape(-1, 3).mean(axis=0).reshape(1, 1, 3), colour_ref.shape).astype(np.uint8)
    clock = StageClock(0.0, 1.0)
    cheap_ok = clock.cheap(ref, got, colour_ref, colour_got)
    times["cheap proxy"] = sum(row["seconds"] for row in clock.report()["stages"])
    if not cheap_ok:
        raise SystemExit("cheap gate failed; no Zone B render")

    before_png = os.path.join(out, "before-16x9.png")
    before_phone = os.path.join(out, "before-phone.png")

    def _before():
        t0 = time.time()
        shot(page_url(KEY_CAM, 1280, 720), before_png, 1280, 720)
        times["before render"] = time.time() - t0
        t0 = time.time()
        shot(page_url(KEY_CAM, 540, 1200), before_phone, 540, 1200)
        times["before phone"] = time.time() - t0

    clock.heavy("before renders", _before)
    side = load_json(before_png.replace(".png", ".json"))
    gates = {"ready": check_capture(before_png, "frame")}
    if side.get("loadingShot") and os.path.isfile(side["loadingShot"]):
        gates["loading"] = check_capture(side["loadingShot"], "frame", dom_text=side.get("loadingText") or "Chargement")
    else:
        gates["loading"] = {"ok": None, "why": "no loading frame: the Chargement overlay was already gone 350 ms after DOMContentLoaded"}
    gates["loadingText"] = side.get("loadingText") or ""

    scores = {}
    scores["before"] = score_render(before_png, labels, masks["instances"])

    r1 = os.path.join(out, "round1-16x9.png")

    def _round1():
        t0 = time.time()
        write_layout(base_layout, assign)
        shot(page_url(KEY_CAM, 1280, 720), r1, 1280, 720)
        times["round 1 render"] = time.time() - t0

    clock.heavy("round 1", _round1)
    scores["round1"] = score_render(r1, labels, masks["instances"])

    saved = deepcopy(assign)
    r2 = os.path.join(out, "round2-16x9.png")

    def _round2():
        t0 = time.time()
        nudge(assign, cam, lifts)
        write_layout(base_layout, assign)
        shot(page_url(KEY_CAM, 1280, 720), r2, 1280, 720)
        times["round 2 render"] = time.time() - t0

    clock.heavy("round 2", _round2)
    scores["round2"] = score_render(r2, labels, masks["instances"])

    d1 = _decision(scores, "round1")
    d2 = _decision(scores, "round2")
    if d1 is None and d2 is None:
        keep = "reverted"
        restore_layout_only(out)
        apply_sky(sky)
        disk = load_json(os.path.join(STAGE, "objects1", "layout.json"))
        held = {"towers": disk["towers"], "spire": disk["spire"]}
        after = os.path.join(out, "after-16x9.png")
        shot(page_url(KEY_CAM, 1280, 720), after, 1280, 720)
        zone_assign = saved
        zone_assign["applied"] = False
    elif d2 is None or (d1 is not None and d1 > d2):
        keep = "round1"
        assign = saved
        write_layout(base_layout, assign)
        after = r1
        shutil.copy(after, os.path.join(out, "after-16x9.png"))
        held = assign
        zone_assign = assign
        zone_assign["applied"] = True
    else:
        keep = "round2"
        after = r2
        shutil.copy(after, os.path.join(out, "after-16x9.png"))
        held = assign
        zone_assign = assign
        zone_assign["applied"] = True

    zone_path = os.path.join(out, "placement-zone-b.zone.json")
    write_zone(zone_assign, sky, lifts, zone_path, apply_moves=zone_assign.get("applied", False))
    write_zone(zone_assign, sky, lifts, os.path.join(ROOT, "placement-zone-b.zone.json"), apply_moves=zone_assign.get("applied", False))

    check_assign = held if keep != "reverted" else held
    checks = {
        "key": layout_checks(check_assign),
        "depthInversions": depth_inversions(zone_assign, cam, lifts),
        "missing": [td["id"] for td in zone_assign["todos"] if td["status"] == "TODO"],
        "unexpectedMissing": _unexpected_missing(zone_assign["todos"]),
        "runners": {},
    }
    phone = os.path.join(out, "after-phone.png")

    def _phone():
        t0 = time.time()
        shot(page_url(KEY_CAM, 540, 1200), phone, 540, 1200)
        for rc in RUNNERS:
            x, z = runner_xz(rc)
            pose = dict(rc, x=x, z=z)
            png = os.path.join(out, f"runner-{rc['name']}.png")
            shot(page_url(pose, 640, 360), png, 640, 360)
            checks["runners"][rc["name"]] = {"pose": {"x": round(x, 2), "z": round(z, 2), "yaw": rc["yaw"]}, "shot": png}
        times["phone and runners"] = time.time() - t0

    clock.heavy("phone and runners", _phone)
    before_side = side
    before_phone_side = load_json(before_phone.replace(".png", ".json"))
    after_side = load_json(phone.replace(".png", ".json"))
    checks["runners"]["geometry"] = layout_checks(check_assign)
    gates["readyPhone"] = check_capture(phone, "frame")

    b16, b16d = _calls(before_side)
    bp, bpd = _calls(before_phone_side)
    ap, apd = _calls(after_side)
    budget = {
        "before16x9": {"drawCalls": b16, "triangles": before_side.get("triangles"), "detail": b16d},
        "beforePhone": {"drawCalls": bp, "triangles": before_phone_side.get("triangles"), "size": before_phone_side.get("size"), "detail": bpd},
        "afterPhone": {"drawCalls": ap, "triangles": after_side.get("triangles"), "size": after_side.get("size"), "detail": apd},
        "cap": {"drawCalls": 12, "note": "Phone cap uses passes.main.calls when the page exposes it. The info.calls field is recorded beside it. Toward 12 is the goal; overCap is a flag, not the IoU verdict."},
    }
    calls = ap
    before_calls = bp
    budget["overCap"] = calls is not None and calls > 12
    budget["overBefore"] = calls is not None and before_calls is not None and calls > before_calls

    if keep == "reverted":
        best = scores["before"]["placedWeighted"]
    else:
        best = scores[keep]["placedWeighted"]
    order_ok = not checks["depthInversions"] and not checks["unexpectedMissing"]
    corridor_free = not checks["key"]["corridorBlocked"] and not checks["key"]["overlaps"]
    verdict = "PASS" if best >= 0.75 and order_ok and corridor_free else "FAIL"
    sheet(
        [before_png, os.path.join(out, "after-16x9.png"), KEY],
        ["before", "after", "key"],
        os.path.join(out, "sheet-16x9.jpg"),
        (640, 360),
    )
    sheet(
        [before_phone, phone, KEY],
        ["before phone", "after phone", "key"],
        os.path.join(out, "sheet-phone.jpg"),
        (540, 1200),
    )
    url = page_url(KEY_CAM, 540, 1200)
    disc_line = ""
    disc_path = os.path.join(out, "summary-discarded.json")
    if os.path.isfile(disc_path):
        disc = load_json(disc_path)
        disc_line = (
            " Discarded rock-wall measurement (camera inside a mesa; the IoU proxy counted rock as structure): "
            f"before {disc['scores']['before']['overallWeighted']}, "
            f"round 1 {disc['scores']['round1']['overallWeighted']}, "
            f"round 2 {disc['scores']['round2']['overallWeighted']}. Those two renders are not the keep."
        )
    rounds = (
        f"Decision score is the weighted IoU of tower, spire, and mesa only. "
        f"Before placed {scores['before']['placedWeighted']} (all objects {scores['before']['overallWeighted']}). "
        f"Round 1 placed {scores['round1']['placedWeighted']} reject={scores['round1'].get('reject')}. "
        f"Round 2 placed {scores['round2']['placedWeighted']} reject={scores['round2'].get('reject')}. "
        f"Kept {keep}. Depth inversions {len(checks['depthInversions'])}. "
        f"TODO (wreck/arch do not block) {checks['missing']}. Unexpected {checks['unexpectedMissing']}."
        + disc_line
    )
    clock_report = clock.report()
    dump({
        "times": times,
        "scores": scores,
        "keep": keep,
        "verdict": verdict,
        "budget": budget,
        "checks": checks,
        "fit": fit,
        "gates": gates,
        "clock": clock_report,
        "restoredFromBackup": restored,
    }, os.path.join(out, "summary.json"))
    write_report(os.path.join(out, "REPORT.md"), times, scores, sky, checks, budget, url, verdict, rounds, gates, clock_report)
    print(json.dumps({"verdict": verdict, "keep": keep, "iou": best, "before": scores["before"]["placedWeighted"]}, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["all"])
    ap.add_argument("--out", default=os.path.join(ROOT, "steps", "placement-key2-1011"))
    a = ap.parse_args()
    if a.cmd == "all":
        all_cmd(a)


if __name__ == "__main__":
    main()
