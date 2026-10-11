#!/usr/bin/env python3
"""Place Zone B from the key image. Staging only. No Imagine generation.

  python3 tools/placement-from-key/place.py all --out steps/placement-key-1011
  python3 tools/placement-from-key/selftest.py

Two render rounds, then stop. The blocking number is the weighted silhouette IoU.
"""

from __future__ import annotations

import argparse
import json
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

from depth_lift import AHEAD, assign_assets, clamp_sl, fit_disparity, lift_instances, relative_depth
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


def run_masks(out):
    boxes = os.path.join(HERE, "vision_boxes.json")
    npy = os.path.join(out, "masks.npy")
    js = os.path.join(out, "masks.json")
    cmd = [SAM, os.path.join(HERE, "sam2_boxes.py"), KEY, boxes, npy, js]
    r = subprocess.run(cmd, text=True, capture_output=True, timeout=600)
    if r.returncode != 0:
        raise RuntimeError(r.stdout + "\n" + r.stderr)
    return load_json(js)


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
        "clamp": "Moves are nudges. A raw disparity lift is stored and is not applied when it would put a mesh inside the lens.",
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
    """One image-space correction, still inside clamp_sl against the original seat."""
    by_from = {p["from"]: p for p in assign["placed"]}
    by_id = {t["id"]: t for t in assign["towers"]}
    by_id["spire"] = assign["spire"]
    mesa = {m["id"]: m for m in assign["mesas"]}
    cam_s = assign.get("camS")
    if cam_s is None:
        cam_s, _ = xz_av(float(cam.p[0]), float(cam.p[2]))
    for row in lifts:
        if row.get("status") != "lifted":
            continue
        p = by_from.get(row["id"])
        if not p or "originS" not in p:
            continue
        kind = p.get("kind") or row["kind"]
        if kind == "mesa":
            target = mesa.get(p["id"])
        else:
            target = by_id.get(p["id"])
        if not target:
            continue
        s = target.get("s")
        lat = target.get("lat", target.get("lateral"))
        x, z = av_xz(s, lat)
        uv, depth = cam.project([[x, float(cam.p[1]), z]])
        if float(depth[0]) < AHEAD.get(kind, 40):
            continue
        du = row["imageBase"][0] - float(uv[0, 0])
        # At most 8 m of lateral correction. A full pixel shift would walk into the lens.
        shift = float(np.clip(du / cam.f * float(depth[0]), -8.0, 8.0))
        right = cam.right
        x2 = x + float(right[0]) * shift
        z2 = z + float(right[2]) * shift
        want_s, want_lat = xz_av(x2, z2)
        ns, nlat = clamp_sl(p["originS"], p["originLat"], want_s, want_lat, kind, cam_s)
        if kind == "mesa":
            target["s"] = round(ns, 2)
            target["lat"] = round(nlat, 2)
        else:
            target["s"] = round(ns, 3)
            target["lateral"] = round(nlat, 3)
            target["x"], target["z"] = av_xz(target["s"], target["lateral"])
        p["s"] = target["s"]
        p["lateral"] = target.get("lat", target.get("lateral"))


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


def write_report(path, times, scores, sky, checks, budget, phone_url, verdict, rounds):
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
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    _archive_bad_round(out)
    restored = restore_stage(out)
    times = {}
    t = time.time()
    ensure_page()
    times["staging page"] = time.time() - t

    before_png = os.path.join(out, "before-16x9.png")
    side_path = before_png.replace(".png", ".json")
    t = time.time()
    if restored and os.path.isfile(before_png) and os.path.isfile(side_path):
        times["before render"] = 0.0
    else:
        shot(page_url(KEY_CAM, 1280, 720), before_png, 1280, 720)
        times["before render"] = time.time() - t
    side = load_json(side_path)
    cam = camera_from_shot(side, KEY_CAM["fov"], 1280, 720)

    before_phone = os.path.join(out, "before-phone.png")
    t = time.time()
    if not (os.path.isfile(before_phone) and os.path.isfile(before_phone.replace(".png", ".json"))):
        shot(page_url(KEY_CAM, 540, 1200), before_phone, 540, 1200)
    times["before phone"] = time.time() - t

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
    depth_path = os.path.join(out, "depth.npy")
    if os.path.isfile(depth_path):
        depth = np.load(depth_path)
    else:
        depth = relative_depth(KEY)
        np.save(depth_path, depth)
    fit = fit_disparity(cam, depth, KEY_CAM["eye"])
    dump(fit, os.path.join(out, "depth-fit.json"))
    labels = np.load(masks_npy)
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

    scores = {}
    scores["before"] = score_render(before_png, labels, masks["instances"])

    t = time.time()
    write_layout(base_layout, assign)
    r1 = os.path.join(out, "round1-16x9.png")
    shot(page_url(KEY_CAM, 1280, 720), r1, 1280, 720)
    scores["round1"] = score_render(r1, labels, masks["instances"])
    times["round 1 render"] = time.time() - t

    saved = deepcopy(assign)
    t = time.time()
    nudge(assign, cam, lifts)
    write_layout(base_layout, assign)
    r2 = os.path.join(out, "round2-16x9.png")
    shot(page_url(KEY_CAM, 1280, 720), r2, 1280, 720)
    scores["round2"] = score_render(r2, labels, masks["instances"])
    times["round 2 render"] = time.time() - t

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
        "runners": {},
    }
    t = time.time()
    phone = os.path.join(out, "after-phone.png")
    shot(page_url(KEY_CAM, 540, 1200), phone, 540, 1200)
    before_side = side
    before_phone_side = load_json(before_phone.replace(".png", ".json"))
    after_side = load_json(phone.replace(".png", ".json"))
    for rc in RUNNERS:
        x, z = runner_xz(rc)
        pose = dict(rc, x=x, z=z)
        png = os.path.join(out, f"runner-{rc['name']}.png")
        shot(page_url(pose, 640, 360), png, 640, 360)
        checks["runners"][rc["name"]] = {"pose": {"x": round(x, 2), "z": round(z, 2), "yaw": rc["yaw"]}, "shot": png}
    checks["runners"]["geometry"] = layout_checks(check_assign)
    times["phone and runners"] = time.time() - t

    budget = {
        "before16x9": {"drawCalls": before_side.get("drawCalls"), "triangles": before_side.get("triangles")},
        "beforePhone": {"drawCalls": before_phone_side.get("drawCalls"), "triangles": before_phone_side.get("triangles"), "size": before_phone_side.get("size")},
        "afterPhone": {"drawCalls": after_side.get("drawCalls"), "triangles": after_side.get("triangles"), "size": after_side.get("size")},
        "cap": {"drawCalls": 12, "note": "standing phone cap. Flag when the kept phone frame is over the cap or over the before phone frame."},
    }
    calls = after_side.get("drawCalls")
    before_calls = before_phone_side.get("drawCalls")
    budget["overCap"] = calls is not None and calls > 12
    budget["overBefore"] = calls is not None and before_calls is not None and calls > before_calls

    if keep == "reverted":
        best = scores["before"]["placedWeighted"]
    else:
        best = scores[keep]["placedWeighted"]
    order_ok = not checks["depthInversions"] and not checks["missing"]
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
        f"Kept {keep}. Depth inversions {len(checks['depthInversions'])}. Missing {checks['missing']}."
        + disc_line
    )
    dump({
        "times": times,
        "scores": scores,
        "keep": keep,
        "verdict": verdict,
        "budget": budget,
        "checks": checks,
        "fit": fit,
        "restoredFromBackup": restored,
    }, os.path.join(out, "summary.json"))
    write_report(os.path.join(out, "REPORT.md"), times, scores, sky, checks, budget, url, verdict, rounds)
    print(json.dumps({"verdict": verdict, "keep": keep, "iou": best, "before": scores["before"]["placedWeighted"]}, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["all"])
    ap.add_argument("--out", default=os.path.join(ROOT, "steps", "placement-key-1011"))
    a = ap.parse_args()
    if a.cmd == "all":
        all_cmd(a)


if __name__ == "__main__":
    main()
