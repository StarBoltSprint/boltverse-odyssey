#!/usr/bin/env python3
"""Proof sheet for one object's Imagine views.

Measures whether the stills are the same object before a walk-around hull
is built. Does not call Imagine. Does not rewrite the stills. The sheet PNG
is a labelled proof, not an asset and not a texture.

  python3 tools/objsheet/sheet.py --views views/ --config config.json --out proof/

Exit 0 on PASS. Exit 1 on any FAIL. A hand-written PASS is not a PASS.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WALK = Path(__file__).resolve().parents[1] / "walkaround"
if str(WALK) not in sys.path:
    sys.path.insert(0, str(WALK))

from gates import HOLE_MAX, MARGIN_FRAC, MAX_EDGE_PX, source_view_report  # noqa: E402
from hull import camera_pose, carve, enclosed_2d, foreground_mask, voxel_centers, world_to_ijk, sample_volume  # noqa: E402

YAWS = [0, 45, 90, 135, 180, 225, 270, 315]
ELEVATED_PITCH = 25.0
AREA_TOL = 0.15
HEIGHT_TOL = 0.08
WIDTH_MIRROR_TOL = 0.15
HEIGHT_MIRROR_TOL = 0.08
GUIDE_IOU = 0.97
COLOR_CORR_MIN = 0.20
COLOR_DIST_MAX = 110.0
KEEP_MIN = 0.70
KEEP_MEAN = 0.80
VOTE = 7
GRID = 32

HEURISTICS = [
    "The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.",
    "Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.",
    "Adjacent area ±15% and height ±8% match the walk-around silhouette lock.",
    "Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.",
    "Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.",
    "Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.",
    "Views that disagree shrink that carve toward a blob, and the keep fraction falls.",
    "A silhouette that comes within 3% of any frame edge is cropped. Cropped views carve the hull. The margin is measured on the unfilled mask.",
    "Interior holes are transparent pixels enclosed by the silhouette, as a fraction of interior pixels. Above 0.2% the stone is see-through. The tool does not fill those pixels.",
    "Width and height are read from the file. A still over 2048 px on a side fails.",
    "A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.",
]


def r4(value) -> float:
    return round(float(value), 4)


class SheetFailure(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


def load_rgba(path: Path) -> np.ndarray:
    with Image.open(path) as im:
        return np.array(im.convert("RGBA"))


def object_mask(rgba: np.ndarray, threshold: float, fill: bool) -> np.ndarray:
    alpha = rgba[:, :, 3]
    if int(alpha.min()) < 250:
        fg = alpha > 16
    else:
        fg = foreground_mask(rgba, threshold)
    if fill and fg.any():
        return enclosed_2d(fg)
    return fg


def span_of(mask: np.ndarray) -> dict:
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    area = int(mask.sum())
    if len(rows) == 0:
        return {"area": 0, "height": 0, "width": 0, "rows": None, "cols": None}
    return {
        "area": area,
        "height": int(rows[-1] - rows[0] + 1),
        "width": int(cols[-1] - cols[0] + 1),
        "rows": [int(rows[0]), int(rows[-1])],
        "cols": [int(cols[0]), int(cols[-1])],
    }


def iou(a: np.ndarray, b: np.ndarray) -> float:
    if a.shape != b.shape:
        return 0.0
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    if union == 0:
        return 1.0
    return float(inter) / float(union)


def nearest_resize_mask(mask: np.ndarray, shape: tuple[int, int]) -> np.ndarray:
    im = Image.fromarray(mask.astype(np.uint8) * 255, "L")
    im = im.resize((shape[1], shape[0]), Image.Resampling.NEAREST)
    return np.array(im) > 127


def hist_corr(rgba_a: np.ndarray, mask_a: np.ndarray, rgba_b: np.ndarray, mask_b: np.ndarray) -> tuple[float, float]:
    def pack(rgba, mask):
        pix = rgba[mask][:, :3].astype(np.float32)
        if len(pix) == 0:
            return np.zeros(8 * 8 * 8, np.float64), np.zeros(3, np.float32)
        hist, _ = np.histogramdd(pix / 255.0, bins=8, range=[(0, 1)] * 3)
        hist = hist.reshape(-1).astype(np.float64)
        total = hist.sum()
        if total:
            hist /= total
        return hist, pix.mean(axis=0)

    ha, ma = pack(rgba_a, mask_a)
    hb, mb = pack(rgba_b, mask_b)
    if float(ha.sum()) == 0 or float(hb.sum()) == 0:
        return 0.0, 999.0
    corr = float(np.corrcoef(ha, hb)[0, 1])
    if math.isnan(corr):
        corr = 0.0
    dist = float(np.linalg.norm(ma - mb))
    return corr, dist


def rel_delta(a: float, b: float) -> float:
    base = max((a + b) * 0.5, 1e-6)
    return abs(a - b) / base


def yaw_norm(yaw: float) -> float:
    value = float(yaw) % 360.0
    if value < 0:
        value += 360.0
    return value


def is_horizontal(view: dict) -> bool:
    elev = view.get("elevationDeg")
    if elev is None:
        return True
    return abs(float(elev)) < ELEVATED_PITCH


def read_entries(config: dict, views_dir: Path) -> list[dict]:
    entries = list(config.get("views") or [])
    if entries:
        return entries
    found = []
    for path in sorted(views_dir.glob("*.png")):
        stem = path.stem.lower()
        yaw = None
        if stem.startswith("yaw-"):
            try:
                yaw = float(stem.split("-")[1])
            except ValueError:
                yaw = None
        found.append({"file": path.name, "yawDeg": yaw if yaw is not None else 0.0})
    return found


def extract_guide_frame(video: Path, time_sec: float, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-ss",
        f"{time_sec:.4f}",
        "-i",
        str(video),
        "-frames:v",
        "1",
        str(dest),
    ]
    proc = subprocess.run(cmd, check=False, capture_output=True)
    if proc.returncode != 0 or not dest.is_file():
        raise SheetFailure(f"could not read guide frame from {video}")


def prepare_views(views_dir: Path, config: dict, work: Path | None) -> list[dict]:
    camera = config.get("camera") or {}
    distance = float(camera.get("distance", 3.0))
    eye_y = float(camera.get("eyeY", 0.0))
    fov = float(camera.get("fovYDeg", 40.0))
    threshold = float(config.get("bgThreshold", 0.04))
    guide_video = config.get("guideVideo")
    deg_per_sec = float(config.get("guideDegPerSec") or 0.0)
    yaw0 = float(config.get("guideYaw0Deg") or 0.0)
    views = []
    for entry in read_entries(config, views_dir):
        path = views_dir / entry["file"]
        if not path.is_file():
            raise SheetFailure(f"missing view {path}")
        rgba = load_rgba(path)
        elev = entry.get("elevationDeg", entry.get("elevDeg"))
        horizontal = elev is None or abs(float(elev)) < ELEVATED_PITCH
        raw_mask = object_mask(rgba, threshold, fill=False)
        mask = object_mask(rgba, threshold, fill=horizontal)
        view_distance = float(entry.get("distance", distance))
        view_fov = float(entry.get("fovYDeg", fov))
        view_eye = float(entry.get("eyeY", eye_y))
        cam = camera_pose(float(entry.get("yawDeg", 0.0)), view_distance, view_eye, None if elev is None else float(elev))
        guide_mask = None
        guide_note = None
        guide_file = entry.get("guide")
        if guide_file:
            gpath = Path(guide_file)
            if not gpath.is_absolute():
                gpath = views_dir / gpath if (views_dir / gpath).is_file() else (views_dir.parent / gpath)
            guide_rgba = load_rgba(gpath)
            guide_mask = object_mask(guide_rgba, threshold, fill=horizontal)
            if guide_mask.shape != mask.shape:
                guide_mask = nearest_resize_mask(guide_mask, mask.shape)
                guide_note = "guide resized with nearest neighbor for the IoU measurement only"
        elif guide_video and deg_per_sec and work is not None and horizontal:
            delta = (yaw_norm(entry.get("yawDeg", 0.0)) - yaw_norm(yaw0)) % 360.0
            dest = work / f"guide-{int(entry.get('yawDeg', 0)):03d}.png"
            extract_guide_frame(Path(guide_video), delta / deg_per_sec, dest)
            guide_rgba = load_rgba(dest)
            guide_mask = object_mask(guide_rgba, threshold, fill=horizontal)
            if guide_mask.shape != mask.shape:
                guide_mask = nearest_resize_mask(guide_mask, mask.shape)
                guide_note = "guide frame resized with nearest neighbor for the IoU measurement only"
            guide_file = str(dest)
        views.append(
            {
                "file": entry["file"],
                "path": path,
                "rgba": rgba,
                "mask": mask,
                "rawMask": raw_mask,
                "span": span_of(mask),
                "yawDeg": float(entry.get("yawDeg", 0.0)),
                "elevationDeg": None if elev is None else float(elev),
                "cam": cam,
                "width": rgba.shape[1],
                "height": rgba.shape[0],
                "fovY": view_fov,
                "guideFile": guide_file,
                "guideMask": guide_mask,
                "guideNote": guide_note,
            }
        )
    return views


def silhouette_check(views: list[dict]) -> dict:
    """A walk-around still needs a keyed subject, not a full-frame photograph."""
    failures = []
    rows = []
    for view in views:
        frame = max(1, view["width"] * view["height"])
        fill = view["span"]["area"] / float(frame)
        rows.append({"file": view["file"], "fillArea": r4(fill), "height": view["span"]["height"]})
        if view["span"]["area"] < 16:
            failures.append(f"FAIL silhouette {view['file']} empty")
        elif fill > 0.92:
            failures.append(
                f"FAIL silhouette {view['file']} fillArea={fill:.3f} (no keyed background, mask is the frame)"
            )
    return {"status": "PASS" if not failures else "FAIL", "views": rows, "failures": failures}


def ring_check(views: list[dict]) -> dict:
    horizontal = [v for v in views if is_horizontal(v)]
    got = sorted(int(round(yaw_norm(v["yawDeg"]))) % 360 for v in horizontal)
    missing = [y for y in YAWS if y not in got]
    extra = [y for y in got if y not in YAWS]
    failures = []
    if len(horizontal) != 8 or missing or extra:
        failures.append(
            f"FAIL ring expected 8 yaws every 45°, got {got}, missing {missing}, extra {extra}"
        )
    return {"status": "PASS" if not failures else "FAIL", "yaws": got, "missing": missing, "failures": failures}


def pair_checks(views: list[dict]) -> dict:
    horizontal = sorted((v for v in views if is_horizontal(v)), key=lambda v: yaw_norm(v["yawDeg"]))
    adjacent = []
    failures = []
    for i, view in enumerate(horizontal):
        other = horizontal[(i + 1) % len(horizontal)]
        area = rel_delta(view["span"]["area"], other["span"]["area"])
        height = rel_delta(view["span"]["height"], other["span"]["height"])
        corr, dist = hist_corr(view["rgba"], view["mask"], other["rgba"], other["mask"])
        row = {
            "a": view["file"],
            "b": other["file"],
            "yawA": r4(view["yawDeg"]),
            "yawB": r4(other["yawDeg"]),
            "areaDelta": r4(area),
            "heightDelta": r4(height),
            "colorCorr": r4(corr),
            "colorDist": r4(dist),
        }
        adjacent.append(row)
        if area > AREA_TOL:
            failures.append(
                f"FAIL adjacent {view['file']}→{other['file']} area delta={area:.3f} limit={AREA_TOL}"
            )
        if height > HEIGHT_TOL:
            failures.append(
                f"FAIL adjacent {view['file']}→{other['file']} height delta={height:.3f} limit={HEIGHT_TOL}"
            )
        if corr < COLOR_CORR_MIN and dist > COLOR_DIST_MAX:
            failures.append(
                f"FAIL colour {view['file']}→{other['file']} corr={corr:.3f} dist={dist:.1f}"
            )
    opposite = []
    by_yaw = {int(round(yaw_norm(v["yawDeg"]))) % 360: v for v in horizontal}
    for yaw in YAWS:
        if yaw >= 180 or yaw not in by_yaw or (yaw + 180) % 360 not in by_yaw:
            continue
        a = by_yaw[yaw]
        b = by_yaw[(yaw + 180) % 360]
        width = rel_delta(a["span"]["width"], b["span"]["width"])
        height = rel_delta(a["span"]["height"], b["span"]["height"])
        opposite.append(
            {
                "a": a["file"],
                "b": b["file"],
                "widthDelta": r4(width),
                "heightDelta": r4(height),
            }
        )
        if width > WIDTH_MIRROR_TOL:
            failures.append(
                f"FAIL opposite {a['file']}|{b['file']} width delta={width:.3f} limit={WIDTH_MIRROR_TOL}"
            )
        if height > HEIGHT_MIRROR_TOL:
            failures.append(
                f"FAIL opposite {a['file']}|{b['file']} height delta={height:.3f} limit={HEIGHT_MIRROR_TOL}"
            )
    return {
        "status": "PASS" if not failures else "FAIL",
        "adjacent": adjacent,
        "opposite": opposite,
        "limits": {
            "area": AREA_TOL,
            "height": HEIGHT_TOL,
            "oppositeWidth": WIDTH_MIRROR_TOL,
            "oppositeHeight": HEIGHT_MIRROR_TOL,
            "colorCorr": COLOR_CORR_MIN,
            "colorDist": COLOR_DIST_MAX,
        },
        "failures": failures,
    }


def guide_check(views: list[dict]) -> dict:
    rows = []
    failures = []
    any_guide = False
    for view in views:
        if view["guideMask"] is None:
            continue
        any_guide = True
        score = iou(view["mask"], view["guideMask"])
        rows.append({"file": view["file"], "yawDeg": r4(view["yawDeg"]), "iou": r4(score), "note": view["guideNote"]})
        if score < GUIDE_IOU:
            failures.append(f"FAIL guide {view['file']} IoU={score:.4f} limit={GUIDE_IOU}")
    if not any_guide:
        return {"status": "SKIP", "reason": "no guide frames", "views": [], "limit": GUIDE_IOU, "failures": []}
    return {"status": "PASS" if not failures else "FAIL", "views": rows, "limit": GUIDE_IOU, "failures": failures}


def keep_fraction(solid: np.ndarray, view: dict, half: np.ndarray, vsize: np.ndarray, steps: int = 40) -> float:
    mask = view["mask"]
    h, w = mask.shape
    step = max(1, int(math.ceil(max(h, w) / 96)))
    small = mask[::step, ::step]
    sh, sw = small.shape
    cam = view["cam"]
    fy = (h * 0.5) / math.tan(math.radians(view["fovY"]) * 0.5)
    ys = (np.arange(sh) + 0.5) * step - 0.5
    xs = (np.arange(sw) + 0.5) * step - 0.5
    xx, yy = np.meshgrid(xs, ys)
    cx = (w - 1) * 0.5
    cy = (h - 1) * 0.5
    x_cam = (xx - cx) / fy
    y_cam = -(yy - cy) / fy
    dirs = (
        x_cam[..., None] * cam["right"]
        + y_cam[..., None] * cam["up"]
        + np.ones((sh, sw, 1), np.float64) * cam["forward"]
    )
    dirs = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-8)
    dist = float(cam["distance"])
    ts = np.linspace(dist * 0.2, dist * 1.9, steps)
    pts = cam["position"] + dirs[..., None, :] * ts[None, None, :, None]
    ijk = world_to_ijk(pts.reshape(-1, 3), half, vsize)
    hit = sample_volume(solid, ijk).reshape(sh, sw, steps).any(axis=-1)
    denom = int(small.sum())
    if denom == 0:
        return 0.0
    return float(np.logical_and(hit, small).sum()) / float(denom)


def hull_check(views: list[dict], config: dict) -> dict:
    horizontal = [v for v in views if is_horizontal(v)]
    size = np.array(config.get("objectSize") or [1.0, 1.0, 1.0], dtype=np.float64)
    n = int(config.get("grid") or GRID)
    n = max(16, min(n, 40))
    vote = int(config.get("vote") or VOTE)
    if len(horizontal) < 8:
        vote = max(1, len(horizontal) - 1)
    half = size / 2.0
    vsize = size / float(n)
    pts = voxel_centers(n, half, vsize)
    solid, _votes = carve(pts, horizontal, vote, n)
    rows = []
    kept = []
    for view in views:
        fraction = keep_fraction(solid, view, half, vsize)
        rows.append(
            {
                "file": view["file"],
                "yawDeg": r4(view["yawDeg"]),
                "elevationDeg": None if view["elevationDeg"] is None else r4(view["elevationDeg"]),
                "keepFraction": r4(fraction),
                "horizontal": is_horizontal(view),
            }
        )
        if is_horizontal(view):
            kept.append(fraction)
    volume = float(solid.mean())
    mean = float(np.mean(kept)) if kept else 0.0
    minimum = float(np.min(kept)) if kept else 0.0
    failures = []
    if minimum < KEEP_MIN:
        failures.append(f"FAIL hull min keep={minimum:.3f} limit={KEEP_MIN} (views disagree, hull shrinks)")
    if mean < KEEP_MEAN:
        failures.append(f"FAIL hull mean keep={mean:.3f} limit={KEEP_MEAN}")
    if volume < 0.01:
        failures.append(f"FAIL hull volume fraction={volume:.4f} (carve collapsed)")
    return {
        "status": "PASS" if not failures else "FAIL",
        "vote": vote,
        "grid": n,
        "volumeFraction": r4(volume),
        "meanKeep": r4(mean),
        "minKeep": r4(minimum),
        "views": rows,
        "limits": {"minKeep": KEEP_MIN, "meanKeep": KEEP_MEAN},
        "failures": failures,
    }


def outline(mask: np.ndarray) -> np.ndarray:
    er = erode_bool(mask)
    return mask & ~er


def erode_bool(mask: np.ndarray) -> np.ndarray:
    out = mask.copy()
    out[1:] &= mask[:-1]
    out[:-1] &= mask[1:]
    out[:, 1:] &= mask[:, :-1]
    out[:, :-1] &= mask[:, 1:]
    return out


def fit_cell(rgba: np.ndarray, mask: np.ndarray, cell: int) -> tuple[Image.Image, np.ndarray]:
    h, w = mask.shape
    scale = 1.0 if max(h, w) <= cell else cell / float(max(h, w))
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    rgb = Image.fromarray(rgba[..., :3], "RGB").resize((nw, nh), Image.Resampling.NEAREST)
    small_mask = np.array(Image.fromarray(mask.astype(np.uint8) * 255, "L").resize((nw, nh), Image.Resampling.NEAREST)) > 127
    return rgb, small_mask


def draw_sheet(groups: list[tuple[str, list[dict], dict]], path: Path) -> None:
    """groups: (title, views, per-view fail files). Proof only."""
    cell = 180
    pad = 8
    label_h = 36
    head = 28
    font = ImageFont.load_default()
    blocks = []
    width = 0
    for title, views, _fails in groups:
        row_w = pad + min(4, max(1, len(views))) * (cell + pad)
        width = max(width, row_w, 640)
        blocks.append(len(views))
    height = pad
    for title, views, _fails in groups:
        cols = max(1, len(views))
        rows = 1
        per_row = min(4, cols)
        rows = int(math.ceil(cols / per_row))
        height += head + rows * (cell + label_h + pad) + pad
    canvas = Image.new("RGB", (max(width, 4 * (cell + pad) + pad), height), (18, 18, 18))
    draw = ImageDraw.Draw(canvas)
    y = pad
    per_row = 4
    for title, views, failed in groups:
        draw.text((pad, y), title, fill=(230, 230, 230), font=font)
        y += head
        for i, view in enumerate(views):
            col = i % per_row
            row = i // per_row
            if col == 0 and row > 0:
                y += cell + label_h + pad
            x = pad + col * (cell + pad)
            rgb, small = fit_cell(view["rgba"], view["mask"], cell)
            plate = Image.new("RGB", (cell, cell), (0, 0, 0))
            ox = (cell - rgb.size[0]) // 2
            oy = (cell - rgb.size[1]) // 2
            plate.paste(rgb, (ox, oy))
            arr = np.array(plate)
            edge = outline(small)
            full = np.zeros((cell, cell), dtype=bool)
            full[oy : oy + small.shape[0], ox : ox + small.shape[1]] = edge
            arr[full] = (0, 220, 220)
            plate = Image.fromarray(arr, "RGB")
            canvas.paste(plate, (x, y))
            bad = view["file"] in failed
            elev = view["elevationDeg"]
            elev_txt = "elev —" if elev is None else f"elev {elev:.0f}°"
            label = f"yaw {view['yawDeg']:.0f}°  {elev_txt}"
            draw.text((x, y + cell + 2), label, fill=(255, 80, 80) if bad else (220, 220, 220), font=font)
            if bad:
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], outline=(220, 60, 60))
        y += cell + label_h + pad
    path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(path, "PNG")


def strip_pixels(view: dict) -> dict:
    return {
        "file": view["file"],
        "width": view["width"],
        "height": view["height"],
        "yawDeg": r4(view["yawDeg"]),
        "elevationDeg": None if view["elevationDeg"] is None else r4(view["elevationDeg"]),
        "span": view["span"],
    }


def measure_object(name: str, views_dir: Path, config: dict, work: Path) -> dict:
    views = prepare_views(views_dir, config, work)
    ring = ring_check(views)
    sil = silhouette_check(views)
    pairs = pair_checks(views)
    guides = guide_check(views)
    hull = hull_check(views, config)
    sourced = source_view_report(views)
    margin = {
        "status": "PASS" if not any(line.startswith("FAIL margin") or line.startswith("FAIL size") for line in sourced["failures"]) else "FAIL",
        "limits": {"marginFrac": MARGIN_FRAC, "maxEdgePx": MAX_EDGE_PX},
        "minMarginFrac": sourced["minMarginFrac"],
        "maxEdgePx": sourced["maxEdgePx"],
        "views": sourced["views"],
        "failures": [line for line in sourced["failures"] if line.startswith("FAIL margin") or line.startswith("FAIL size")],
    }
    holes = {
        "status": "PASS" if not any(line.startswith("FAIL holes") for line in sourced["failures"]) else "FAIL",
        "limits": {"holeFraction": HOLE_MAX},
        "maxHoleFraction": sourced["maxHoleFraction"],
        "views": [{"file": row["file"], "holeFraction": row["holeFraction"]} for row in sourced["views"]],
        "failures": [line for line in sourced["failures"] if line.startswith("FAIL holes")],
    }
    failures = []
    failures.extend(sil["failures"])
    failures.extend(ring["failures"])
    failures.extend(pairs["failures"])
    failures.extend(guides["failures"])
    failures.extend(hull["failures"])
    failures.extend(margin["failures"])
    failures.extend(holes["failures"])
    failed_files = set()
    for line in failures:
        for view in views:
            if view["file"] in line:
                failed_files.add(view["file"])
    return {
        "name": name,
        "ok": not failures,
        "views": [strip_pixels(v) for v in views],
        "silhouette": sil,
        "ring": ring,
        "consistency": pairs,
        "guide": guides,
        "hull": hull,
        "margin": margin,
        "holes": holes,
        "failures": failures,
        "_draw": views,
        "_failed": failed_files,
    }


def to_markdown(report: dict) -> str:
    lines = [
        "# objsheet",
        "",
        f"Result: **{'PASS' if report['ok'] else 'FAIL'}**",
        "",
        "A hand-written PASS is not a PASS. Paste this file with the sheet PNG.",
        "",
    ]
    for obj in report["objects"]:
        lines.append(f"## {obj['name']}")
        lines.append("")
        lines.append(f"Object **{'PASS' if obj['ok'] else 'FAIL'}**.")
        lines.append("")
        lines.append(f"- silhouette: `{obj['silhouette']['status']}`")
        lines.append(f"- ring: `{obj['ring']['status']}` yaws `{obj['ring']['yaws']}`")
        lines.append(f"- guide: `{obj['guide']['status']}` limit {obj['guide'].get('limit')}")
        for row in obj["guide"].get("views") or []:
            lines.append(f"  - {row['file']} IoU `{row['iou']}`")
        hull = obj["hull"]
        lines.append(
            f"- hull: `{hull['status']}` mean keep `{hull['meanKeep']}` min `{hull['minKeep']}` volume `{hull['volumeFraction']}`"
        )
        lines.append(
            f"- margin: `{obj['margin']['status']}` minFrac `{obj['margin']['minMarginFrac']}` maxEdge `{obj['margin']['maxEdgePx']}`"
        )
        lines.append(
            f"- holes: `{obj['holes']['status']}` max interior `{obj['holes']['maxHoleFraction']}`"
        )
        for row in hull["views"]:
            lines.append(f"  - {row['file']} keep `{row['keepFraction']}`")
        lines.append("- adjacent:")
        for row in obj["consistency"]["adjacent"]:
            lines.append(
                f"  - {row['a']} → {row['b']} area `{row['areaDelta']}` height `{row['heightDelta']}` colour `{row['colorCorr']}`"
            )
        lines.append("- opposite:")
        for row in obj["consistency"]["opposite"]:
            lines.append(f"  - {row['a']} | {row['b']} width `{row['widthDelta']}` height `{row['heightDelta']}`")
        for line in obj["failures"]:
            lines.append(f"- {line}")
        lines.append("")
    lines.append("## Heuristics")
    lines.append("")
    for note in report["heuristics"]:
        lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)


def load_config(path: Path) -> dict:
    return json.loads(path.read_text())


def run(views: Path, config_path: Path, out: Path) -> dict:
    config = load_config(config_path)
    if config.get("guideVideo"):
        guide_path = Path(config["guideVideo"])
        if not guide_path.is_absolute():
            config["guideVideo"] = str((config_path.parent / guide_path).resolve())
    work = out / ".measure"
    work.mkdir(parents=True, exist_ok=True)
    parent = measure_object(str(config.get("name") or views.name), views, config, work)
    objects = [parent]
    draw_groups = [(parent["name"], parent["_draw"], parent["_failed"])]
    base = config_path.parent
    for sub in config.get("subObjects") or []:
        sub_views = base / sub["viewsDir"]
        sub_cfg_path = base / sub["config"] if sub.get("config") else None
        sub_cfg = load_config(sub_cfg_path) if sub_cfg_path else {"views": read_entries({}, sub_views), "camera": config.get("camera"), "objectSize": [0.4, 0.4, 0.4]}
        measured = measure_object(str(sub.get("name") or "sub"), sub_views, sub_cfg, work / measured_name(sub))
        objects.append(measured)
        draw_groups.append((measured["name"], measured["_draw"], measured["_failed"]))
    sheet = out / "sheet.png"
    draw_sheet(draw_groups, sheet)
    public_objects = []
    failures = []
    for obj in objects:
        obj.pop("_draw", None)
        obj.pop("_failed", None)
        public_objects.append(obj)
        for line in obj["failures"]:
            failures.append(f"{obj['name']}: {line}")
    report = {
        "tool": "objsheet",
        "ok": not failures,
        "sheet": sheet.name,
        "objects": public_objects,
        "failures": failures,
        "heuristics": HEURISTICS,
        "thresholds": {
            "guideIoU": GUIDE_IOU,
            "adjacentArea": AREA_TOL,
            "adjacentHeight": HEIGHT_TOL,
            "oppositeWidth": WIDTH_MIRROR_TOL,
            "oppositeHeight": HEIGHT_MIRROR_TOL,
            "colorCorr": COLOR_CORR_MIN,
            "colorDist": COLOR_DIST_MAX,
            "keepMin": KEEP_MIN,
            "keepMean": KEEP_MEAN,
            "marginFrac": MARGIN_FRAC,
            "holeFraction": HOLE_MAX,
            "maxEdgePx": MAX_EDGE_PX,
        },
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    (out / "report.md").write_text(to_markdown(report))
    return report


def measured_name(sub: dict) -> str:
    return str(sub.get("name") or "sub")


def main() -> int:
    parser = argparse.ArgumentParser(description="Object consistency sheet for one walk-around view set")
    parser.add_argument("--views", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    try:
        report = run(args.views, args.config, args.out)
    except SheetFailure as exc:
        print(f"FAIL objsheet {exc.message}", file=sys.stderr)
        return 2
    for obj in report["objects"]:
        print(
            f"{'PASS' if obj['ok'] else 'FAIL'} object {obj['name']} "
            f"keepMean={obj['hull']['meanKeep']} keepMin={obj['hull']['minKeep']}"
        )
        for line in obj["failures"]:
            print(line)
    if report["ok"]:
        print(f"PASS objsheet out={args.out} sheet={args.out / 'sheet.png'}")
        return 0
    print(f"FAIL objsheet out={args.out} failures={len(report['failures'])}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
