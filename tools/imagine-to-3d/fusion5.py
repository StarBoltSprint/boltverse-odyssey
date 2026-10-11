"""Fusion 5 — grok-native solid, SAM2 mask cut against neighbours, photometric relief.

  python3 tools/imagine-to-3d/fusion5.py --spec tools/imagine-to-3d/specs/zoneb-tower-vision.yaml
  python3 tools/imagine-to-3d/auto.py run <spec> --method fusion5

No new Imagine images. Imports tools/grok-native. Does not copy that package.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time

import cv2
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
GN = os.path.join(REPO, "tools", "grok-native")
sys.path.insert(0, HERE)
sys.path.insert(0, GN)

import masks as gn_masks  # noqa: E402
import normals as gn_normals  # noqa: E402
import parametric as gn_parametric  # noqa: E402
import register as gn_register  # noqa: E402
import slab_mesh  # noqa: E402
import vision_api  # noqa: E402
from checks.relief_align import overlap, save_overlay  # noqa: E402

VENV = os.environ.get("GROK_NATIVE_PY", "/workspace/.venv-sam2/bin/python")
SRC = os.environ.get("GROK_NATIVE_SRC", "/workspace/grok-native-1011/imagine")
CACHE = os.environ.get(
    "FUSION5_CACHE",
    "/workspace/grokcli/wt/grok-native-1011/steps/grok-native-1011/work",
)
FUSION_MASK = os.environ.get("GROK_NATIVE_FUSION_MASK", "/workspace/proj-1010/out/mask.png")
PLATES = {
    "left": "/workspace/zb-tower-hybrid-1010/imagine/out/view-4.jpg",
    "right": "/workspace/zb-tower-hybrid-1010/imagine/out/view-6.jpg",
    "back": "/workspace/zb-tower-hybrid-1010/imagine/out/view-5.jpg",
    "top": "/workspace/zb-tower-hybrid-1010/imagine/out/view-3.jpg",
}
FEATURE_IDS = ("glass", "chrome", "ladder", "damage", "cables", "ledge")
BAR = 0.70


def clock(bucket, key, fn):
    t0 = time.perf_counter()
    out = fn()
    bucket[key] = round(time.perf_counter() - t0, 3)
    return out


def iou(a, b):
    aa = a.astype(bool)
    bb = b.astype(bool)
    inter = np.logical_and(aa, bb).sum()
    union = np.logical_or(aa, bb).sum()
    return float(inter) / float(union) if union else 0.0


def box_iou(a, b):
    x0 = max(a[0], b[0])
    y0 = max(a[1], b[1])
    x1 = min(a[2], b[2])
    y1 = min(a[3], b[3])
    inter = max(0, x1 - x0) * max(0, y1 - y0)
    area = max(0, a[2] - a[0]) * max(0, a[3] - a[1]) + max(0, b[2] - b[0]) * max(0, b[3] - b[1]) - inter
    return float(inter) / float(area) if area else 0.0


def keep_component(mask, seed_xy):
    n, labels = cv2.connectedComponents(mask.astype(np.uint8))
    if n <= 1:
        return mask.astype(bool)
    x, y = int(seed_xy[0]), int(seed_xy[1])
    h, w = mask.shape
    x = int(np.clip(x, 0, w - 1))
    y = int(np.clip(y, 0, h - 1))
    lab = int(labels[y, x])
    if lab == 0:
        counts = [(int((labels == i).sum()), i) for i in range(1, n)]
        lab = max(counts)[1] if counts else 0
    return labels == lab


def cut_neighbours(hero, neighbour_masks, neighbour_boxes, seed_xy):
    """Subtract neighbour SAM2 masks, drop pixels inside neighbour boxes, keep one component."""
    m = hero.astype(np.uint8).copy()
    for nm in neighbour_masks:
        m[nm.astype(bool)] = 0
    h, w = m.shape
    for box in neighbour_boxes:
        x0, y0, x1, y1 = [int(v) for v in box]
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(w, x1), min(h, y1)
        if x1 > x0 and y1 > y0:
            m[y0:y1, x0:x1] = 0
    kept = keep_component(m, seed_xy)
    leak = {}
    for i, box in enumerate(neighbour_boxes):
        x0, y0, x1, y1 = [int(v) for v in box]
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(w, x1), min(h, y1)
        leak[i] = int(kept[y0:y1, x0:x1].sum()) if x1 > x0 and y1 > y0 else 0
    return kept, leak


def feature_mask(shape, features, hero):
    h, w = shape
    m = np.zeros((h, w), np.uint8)
    used = []
    for feat in features:
        box = feat.get("box")
        if not box or len(box) != 4:
            continue
        x0, y0, x1, y1 = gn_masks.box_px(box, w, h, pad=0)
        if x1 <= x0 or y1 <= y0:
            continue
        region = np.zeros((h, w), np.uint8)
        region[y0:y1, x0:x1] = 1
        sel = (region > 0) & hero.astype(bool)
        m[sel] = 1
        used.append({"id": str(feat.get("id")), "px": int(sel.sum()), "box": list(box)})
    return m.astype(bool), used


def clamp_feature_depth(field, feat, lo=0.30, hi=2.0):
    """Keep the measured sign. Scale so the feature p90 is inside lo..hi. Outside feat stays 0."""
    out = np.zeros(field.shape, np.float64)
    if int(feat.sum()) < 30:
        return out, {"px": int(feat.sum()), "scale": 0.0}
    vals = field[feat]
    sign = np.sign(vals)
    sign[sign == 0] = -1.0
    mag = np.abs(vals)
    p90 = float(np.percentile(mag, 90))
    scale = 1.0
    if p90 < lo:
        scale = lo / max(p90, 1e-6)
    elif p90 > hi:
        scale = hi / p90
    scaled = np.clip(mag * scale, 0.0, hi)
    # Flat half of a loose box stays the base wall. The strong half is the feature.
    med = float(np.median(scaled))
    strong = scaled >= max(med, lo * 0.5)
    depth = np.zeros_like(scaled)
    depth[strong] = np.clip(np.maximum(scaled[strong], lo), lo, hi)
    out[feat] = sign * depth
    per = {}
    return out, {
        "px": int(feat.sum()),
        "p90_before": p90,
        "scale": scale,
        "strong_px": int(strong.sum()),
        "depth_p50": float(np.median(np.abs(out[feat]))) if feat.any() else 0.0,
        "depth_p90": float(np.percentile(np.abs(out[feat]), 90)) if feat.any() else 0.0,
    }


def quantize_planes(field, feat, levels=4):
    """Snap feature depths to a few measured levels. Not a height schedule."""
    out = field.copy()
    vals = out[feat]
    nz = np.abs(vals) > 1e-6
    if int(nz.sum()) < 20:
        return out, []
    src = vals[nz]
    qs = np.unique(np.round(np.quantile(src, np.linspace(0.15, 0.85, levels)), 3))
    if len(qs) < 2:
        qs = np.unique(np.round([np.percentile(src, 30), np.percentile(src, 70)], 3))
    snapped = src.copy()
    for i, v in enumerate(src):
        snapped[i] = qs[int(np.argmin(np.abs(qs - v)))]
    vals = vals.copy()
    vals[nz] = snapped
    out[feat] = vals
    return out, [float(q) for q in qs]


def dense_rows(y0, y1, m_per_px, fine_m=60.0, fine_step=0.22, coarse_step=1.5):
    """Pixel rows. The lower fine_m metres (image bottom) are at most fine_step apart."""
    y0, y1 = int(y0), int(y1)
    if y1 <= y0:
        return [y0, y1]
    fine_px = max(1.0, fine_m / max(m_per_px, 1e-6))
    split = int(round(y1 - fine_px))
    split = int(np.clip(split, y0, y1))
    rows = []

    def fill(a, b, step_m):
        if b <= a:
            return
        step_px = max(0.35, step_m / max(m_per_px, 1e-6))
        n = max(2, int(np.ceil((b - a) / step_px)) + 1)
        for t in np.linspace(a, b, n):
            rows.append(int(round(t)))

    fill(y0, split, coarse_step)
    fill(split, y1, fine_step)
    rows.append(y0)
    rows.append(y1)
    return sorted(set(rows))


def build_grid(mask, relief, measures, width_scale=1.0, uv_dx=0.0, fine_step=0.22):
    h, w = mask.shape
    y0, y1 = int(measures["y0"]), int(measures["y1"])
    m_per_px = float(measures["m_per_px"])
    ys = dense_rows(y0, y1, m_per_px, fine_step=fine_step)
    spans = []
    for y in ys:
        xs = np.where(mask[int(np.clip(y, 0, h - 1))] > 0)[0]
        spans.append(None if len(xs) == 0 else (int(xs[0]), int(xs[-1])))
    for i, span in enumerate(spans):
        if span is not None:
            continue
        prev = next((spans[j] for j in range(i - 1, -1, -1) if spans[j]), None)
        nxt = next((spans[j] for j in range(i + 1, len(spans)) if spans[j]), None)
        spans[i] = prev or nxt or (0, 1)
    width_m = float(measures.get("bottom_px", 40)) * m_per_px
    cols = max(8, int(np.ceil(width_m / fine_step)) + 1)
    grid = []
    for y, span in zip(ys, spans):
        x_l, x_r = span
        mid = 0.5 * (x_l + x_r)
        x_l = mid + (x_l - mid) * width_scale
        x_r = mid + (x_r - mid) * width_scale
        row = []
        for c in range(cols):
            t = c / (cols - 1)
            x = int(np.clip(round(x_l + (x_r - x_l) * t + uv_dx), 0, w - 1))
            yy = int(np.clip(y, 0, h - 1))
            row.append({"x": x, "y": yy, "relief_m": float(relief[yy, x]), "w": w, "h": h})
        grid.append(row)
    spacing = {
        "rows": len(grid),
        "cols": cols,
        "fine_step_m": fine_step,
        "lower_60m_step_m": fine_step,
        "m_per_px": m_per_px,
    }
    return grid, spacing


def per_feature_depth(field, features, hero, shape):
    h, w = shape
    rows = []
    for feat in features:
        x0, y0, x1, y1 = gn_masks.box_px(feat["box"], w, h, pad=0)
        sel = np.zeros((h, w), bool)
        sel[y0:y1, x0:x1] = True
        sel &= hero.astype(bool)
        if sel.sum() < 10:
            rows.append({"id": feat.get("id"), "px": int(sel.sum()), "depth_m": 0.0})
            continue
        rows.append({
            "id": feat.get("id"),
            "px": int(sel.sum()),
            "depth_m": round(float(np.median(np.abs(field[sel]))), 3),
        })
    return rows


def local_axis_relief(positions, faces):
    """Same median-of-per-metre-spans rule as tools/object-gate/lib/probe.js."""
    pos = np.asarray(positions, np.float64)
    acc = {k: {} for k in ("+x", "-x", "+z", "-z")}
    for a, b, c in faces:
        pa, pb, pc = pos[a], pos[b], pos[c]
        n = np.cross(pb - pa, pc - pa)
        ar = np.linalg.norm(n) / 2.0
        if ar < 1e-6:
            continue
        n = n / np.linalg.norm(n)
        ax = int(np.argmax(np.abs(n)))
        if ax == 1 or abs(n[ax]) < 0.7:
            continue
        key = ("+" if n[ax] > 0 else "-") + ("x" if ax == 0 else "z")
        off = float((pa[ax] + pb[ax] + pc[ax]) / 3.0)
        y = float((pa[1] + pb[1] + pc[1]) / 3.0)
        yb = int(np.floor(y))
        slot = acc[key].setdefault(yb, [1e9, -1e9, 0.0, []])
        slot[0] = min(slot[0], off)
        slot[1] = max(slot[1], off)
        slot[2] += ar
        slot[3].append(off)
    relief = {}
    for key, bins in acc.items():
        spans = []
        for r in bins.values():
            if r[2] <= 0.2:
                continue
            outer = r[1] if key[0] == "+" else r[0]
            qs = [q for q in r[3] if (outer - q if key[0] == "+" else q - outer) <= 3.0]
            if qs:
                spans.append(max(qs) - min(qs))
        spans.sort()
        relief[key] = round(spans[len(spans) // 2], 3) if spans else 0.0
    return relief


def make_atlas(key_bgr, plates):
    """Left half is the key. Right half matches fusion5_blender.loop_uv (v=1 is image top)."""
    kh, kw = key_bgr.shape[:2]
    atlas = np.zeros((kh, kw * 2, 3), np.uint8)
    atlas[:, :kw] = key_bgr
    qw = kw // 2

    def paste(img, x0, y0, x1, y1):
        if img is None or x1 <= x0 or y1 <= y0:
            return
        tile = cv2.resize(img, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA)
        atlas[y0:y1, x0:x1] = tile

    paste(plates.get("back"), kw, 0, kw + qw, kh // 2)
    paste(plates.get("left"), kw, kh // 2, kw + qw, kh)
    paste(plates.get("right"), kw + qw, 0, kw * 2, kh // 2)
    paste(plates.get("top"), kw + qw, kh // 2, kw * 2, (kh * 3) // 4)
    # No separate bottom plate. The top Imagine plate fills that slot.
    paste(plates.get("top"), kw + qw, (kh * 3) // 4, kw * 2, kh)
    return atlas


def paint_views(positions, faces, atlas_bgr, views):
    """Painter's algorithm. Returns name -> BGR image."""
    pos = np.asarray(positions, np.float64)
    ah, aw = atlas_bgr.shape[:2]
    out = {}
    # UV is not stored per vertex. Colour the front from the left half via a later path.
    # This raster uses vertex colour stored on the position's source pixel, passed separately.
    return out


def raster_coloured(pos, faces, colours, w, h, fx, fy, cx, cy, light=None):
    """colours: uint8 Nx3 RGB. light is a unit vector in camera space, or None for albedo.

    Farther faces (more negative Z) are drawn first. The last write is the near surface.
    """
    pos = np.asarray(pos, np.float64)
    img = np.zeros((h, w, 3), np.uint8)
    depth = np.full((h, w), np.nan, np.float32)
    nrm = np.zeros((h, w, 3), np.uint8)
    order = []
    for i, (a, b, c) in enumerate(faces):
        z = (pos[a, 2] + pos[b, 2] + pos[c, 2]) / 3.0
        order.append((z, i))
    order.sort()
    for _z, i in order:
        a, b, c = faces[i]
        pts = []
        zs = []
        ok = True
        for k in (a, b, c):
            z = pos[k, 2]
            if z >= -1e-3:
                ok = False
                break
            u = fx * pos[k, 0] / -z + cx
            v = cy - fy * pos[k, 1] / -z
            pts.append([u, v])
            zs.append(-z)
        if not ok:
            continue
        n = np.cross(pos[b] - pos[a], pos[c] - pos[a])
        ln = np.linalg.norm(n) + 1e-9
        n = n / ln
        if light is None:
            col = colours[[a, b, c]].mean(0)
        else:
            shade = float(np.clip(abs(np.dot(n, light)), 0.15, 1.0))
            col = np.array([180, 180, 180], np.float64) * shade
        poly = np.array(pts, np.int32)
        if poly[:, 0].max() < 0 or poly[:, 1].max() < 0 or poly[:, 0].min() >= w or poly[:, 1].min() >= h:
            continue
        cv2.fillConvexPoly(img, poly, (int(col[0]), int(col[1]), int(col[2])))
        x0 = int(np.clip(poly[:, 0].min(), 0, w - 1))
        y0 = int(np.clip(poly[:, 1].min(), 0, h - 1))
        x1 = int(np.clip(poly[:, 0].max() + 1, 0, w))
        y1 = int(np.clip(poly[:, 1].max() + 1, 0, h))
        if x1 > x0 and y1 > y0:
            scratch = np.zeros((y1 - y0, x1 - x0), np.uint8)
            cv2.fillConvexPoly(scratch, poly - np.array([x0, y0], np.int32), 1)
            depth[y0:y1, x0:x1][scratch > 0] = np.float32(np.mean(zs))
        ncol = (np.clip(n, -1, 1) * 0.5 + 0.5) * 255
        cv2.fillConvexPoly(nrm, poly, (int(ncol[0]), int(ncol[1]), int(ncol[2])))
    return {"image": img, "depth": depth, "normal_png": nrm}


def vertex_colours(grid, key_bgr):
    """Front and back share the key colour of the source pixel. Sides pick that up at the seam."""
    rows = len(grid)
    cols = len(grid[0])
    cols_rgb = []
    for row in grid:
        for p in row:
            bgr = key_bgr[int(p["y"]), int(p["x"])]
            cols_rgb.append((int(bgr[2]), int(bgr[1]), int(bgr[0])))
    front = list(cols_rgb)
    back = list(cols_rgb)
    return np.array(front + back, np.uint8), rows, cols


def planned_mesh(grid, fx, fy, cx, cy, z0, depth_m):
    """Same frame as fusion5_blender: Z toward the camera, winding reversed."""
    pos, _uv = slab_mesh.build_positions(grid, fx, fy, cx, cy, z0, depth_m)
    pos = [(p[0], p[1], -p[2]) for p in pos]
    rows, cols = len(grid), len(grid[0])
    faces = [(c, b, a) for a, b, c in slab_mesh.build_faces(rows, cols)]
    return pos, faces


def project_overlay(planned, colours, w, h, fx, fy, cx, cy, out_dir):
    """Key-camera relief vs albedo, before Blender. Score is checks.relief_align.overlap."""
    pos, faces = planned
    light = np.array([0.55, 0.25, 0.80], np.float64)
    light = light / np.linalg.norm(light)
    alb = raster_coloured(pos, faces, colours, w, h, fx, fy, cx, cy, light=None)
    rel = raster_coloured(pos, faces, colours, w, h, fx, fy, cx, cy, light=light)
    alb_bgr = cv2.cvtColor(alb["image"], cv2.COLOR_RGB2BGR)
    rel_bgr = cv2.cvtColor(rel["image"], cv2.COLOR_RGB2BGR)
    cv2.imwrite(os.path.join(out_dir, "cheap-albedo.jpg"), alb_bgr)
    cv2.imwrite(os.path.join(out_dir, "cheap-shade.jpg"), rel_bgr)
    sc = overlap(Image.fromarray(rel["image"]), Image.fromarray(alb["image"]))
    save_overlay(os.path.join(out_dir, "cheap-overlay.jpg"),
                 os.path.join(out_dir, "cheap-shade.jpg"), os.path.join(out_dir, "cheap-albedo.jpg"))
    return sc


def cheap_gate(key_bgr, mask, relief):
    """Project silhouette + relief edges against the key crop. Bar 0.70 before Blender."""
    h, w = mask.shape
    albedo = key_bgr.copy()
    albedo[~mask.astype(bool)] = 0
    shade = np.full_like(key_bgr, 40)
    gy, gx = np.gradient(relief)
    mag = np.hypot(gx, gy)
    edge = np.zeros(mask.shape, bool)
    if mask.any() and mag[mask].size:
        thr = float(np.percentile(mag[mask], 88))
        edge = (mag >= max(thr, 1e-4)) & mask.astype(bool)
    shade[mask.astype(bool)] = (150, 150, 160)
    shade[edge] = (230, 230, 230)
    # Silhouette band so the outline is a relief edge.
    band = cv2.dilate(mask.astype(np.uint8), np.ones((3, 3), np.uint8)) - mask.astype(np.uint8)
    shade[band > 0] = (20, 20, 20)
    sc = overlap(Image.fromarray(cv2.cvtColor(shade, cv2.COLOR_BGR2RGB)),
                 Image.fromarray(cv2.cvtColor(albedo, cv2.COLOR_BGR2RGB)))
    sil = iou(mask, mask)  # placeholder replaced by caller when a cover exists
    return sc, shade, albedo, sil


def judge_view(render_path, key_path, view):
    url_r, _ = vision_api.data_url(render_path)
    url_k, _ = vision_api.data_url(key_path)
    prompt = (
        f"Compare the render ({view}) with the key crop of the broad slab tower just left of the road centre. "
        "Reply with STRICT JSON only: "
        '{"view":"%s","errors":[{"feature":"window_3","type":"offset","dx_m":0.2,"dy_m":0,"depth_m":null}],"score":0.0}'
        " type is one of offset, too_shallow, too_deep, too_wide, too_narrow, missing. "
        "score is 0..1 for how well the facade matches. No markdown."
    ) % view
    text, log = vision_api.complete([
        {"type": "image_url", "image_url": {"url": url_r}},
        {"type": "image_url", "image_url": {"url": url_k}},
        {"type": "text", "text": prompt},
    ], max_tokens=500)
    data = vision_api.extract_json(text)
    data["view"] = view
    data["usage"] = log
    data.setdefault("errors", [])
    data.setdefault("score", 0.0)
    return data


def apply_errors(state, errors):
    edits = []
    for err in errors or []:
        kind = str(err.get("type", ""))
        if kind == "offset":
            dx = float(err.get("dx_m") or 0.0)
            state["uv_dx"] = float(state.get("uv_dx", 0.0)) + dx / max(float(state["m_per_px"]), 1e-3)
            edits.append({"type": kind, "uv_dx": state["uv_dx"]})
        elif kind == "too_shallow":
            state["relief_scale"] = float(state.get("relief_scale", 1.0)) * 1.35
            edits.append({"type": kind, "relief_scale": state["relief_scale"]})
        elif kind == "too_deep":
            state["relief_scale"] = float(state.get("relief_scale", 1.0)) * 0.75
            edits.append({"type": kind, "relief_scale": state["relief_scale"]})
        elif kind == "too_wide":
            state["width_scale"] = float(state.get("width_scale", 1.0)) * 0.94
            edits.append({"type": kind, "width_scale": state["width_scale"]})
        elif kind == "too_narrow":
            state["width_scale"] = float(state.get("width_scale", 1.0)) * 1.06
            edits.append({"type": kind, "width_scale": state["width_scale"]})
        elif kind == "missing":
            state["relief_scale"] = float(state.get("relief_scale", 1.0)) * 1.15
            edits.append({"type": kind, "relief_scale": state["relief_scale"]})
    state["relief_scale"] = float(np.clip(state.get("relief_scale", 1.0), 0.4, 3.0))
    state["width_scale"] = float(np.clip(state.get("width_scale", 1.0), 0.8, 1.2))
    return edits


def sam_mask(image, box, out_npy):
    cmd = [VENV, os.path.join(GN, "baseline.py"), "--task", "sam", "--which", "small",
           "--image", image, "--out", out_npy, "--box", *[str(float(v)) for v in box]]
    proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-500:] or proc.stdout[-500:])
    arr = np.load(out_npy)
    return arr.astype(bool), json.loads(proc.stdout.strip().splitlines()[-1])


def camera_json(yaw_deg, light, fx, fy, cx, cy, width, height):
    """Object-to-camera. Yaw matches render_round: x' = c x + s z, z' = -s x + c z."""
    ang = float(np.deg2rad(yaw_deg))
    c, s = float(np.cos(ang)), float(np.sin(ang))
    extrinsic = [
        [c, 0.0, s, 0.0],
        [0.0, 1.0, 0.0, 0.0],
        [-s, 0.0, c, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
    return {
        "yaw_deg": yaw_deg,
        "light": light,
        "width": width,
        "height": height,
        "fx": fx, "fy": fy, "cx": cx, "cy": cy,
        "near_m": 0.2, "far_m": 800.0,
        "units": "m",
        "extrinsic_object_to_camera": extrinsic,
        "frame": "three.js camera: X right, Y up, Z toward the camera (negative)",
    }


def export_dataset(root, object_id, passes, meta):
    if not passes:
        return {"exported": False, "reason": meta.get("why", "gate failed"), "count": 0}
    count = 0
    base = os.path.join(root, "dataset", "i23d", object_id)
    for view in meta["views"]:
        d = os.path.join(base, view["name"])
        os.makedirs(d, exist_ok=True)
        Image.fromarray(view["image"]).save(os.path.join(d, "image.png"))
        np.save(os.path.join(d, "depth.npy"), view["depth"])
        np.save(os.path.join(d, "normal.npy"), view["normal"])
        Image.fromarray(view["normal_png"]).save(os.path.join(d, "normal.png"))
        Image.fromarray(view["mask"]).save(os.path.join(d, "mask.png"))
        json.dump(view["camera"], open(os.path.join(d, "camera.json"), "w"), indent=1)
        count += 1
    json.dump(meta["meta"], open(os.path.join(base, "meta.json"), "w"), indent=1)
    return {"exported": True, "path": base, "count": count}


def stage_preview(round_dir, atlas_path, fov):
    """Copy the mesh into the KC staging mirror. The live tree is not written."""
    import shutil
    staging = os.environ.get("FUSION5_STAGING", "/workspace/kc-staging/zb-tower3")
    vis = os.path.join(staging, "objects1", "vision")
    if not os.path.isdir(vis):
        return {"staged": False, "why": "staging vision dir missing"}
    glb = os.path.join(round_dir, "tower.glb")
    if not os.path.isfile(glb):
        return {"staged": False, "why": "no glb"}
    shutil.copy(glb, os.path.join(vis, "tower.glb"))
    if os.path.isfile(atlas_path):
        shutil.copy(atlas_path, os.path.join(vis, "albedo.png"))
    meta_path = os.path.join(vis, "tower-meta.json")
    meta = json.load(open(meta_path))
    meta["cameraSpace"] = True
    if "keycam" in meta:
        meta["keycam"]["fov"] = float(fov)
    json.dump(meta, open(meta_path, "w"), indent=1)
    shutil.copy(os.path.join(HERE, "runtime", "vision-tower.mjs"), os.path.join(staging, "tower.mjs"))
    return {"staged": True, "dir": vis, "fov": float(fov)}


def phone_budget(tris, tex_w, tex_h):
    ref_tris = 194000
    fps = 59.0 * ref_tris / max(int(tris), 1)
    gpu = tex_w * tex_h * 4 * 4 / 3 / 2**20
    return {
        "device": "Galaxy S20 FE",
        "triangles": int(tris),
        "drawCalls": 1,
        "texMB": round(gpu, 2),
        "fps_estimate": round(fps, 1),
        "limits": {"drawCalls": 12, "texMB": 260, "residentTrisInfo": 750000},
        "pass": int(tris) <= 750000 and gpu <= 260 and 1 <= 12,
    }


def ask_split(key_path, hero_box):
    url, _ = vision_api.data_url(key_path, max_w=1024)
    prompt = (
        "The hero is the broad dark slab just left of the road centre. "
        f"Its box is { [round(v, 4) for v in hero_box] } normalized 0..1, origin top-left. "
        "Name the neighbour blades that touch that slab (thinner towers), not the hero. "
        "Also box the painted features ON the hero only: glass, chrome columns, ladder, "
        "damage or torn band, cables, ledges. "
        "JSON: {\"neighbours\":[{\"id\":\"left-blade\",\"box\":[x0,y0,x1,y1]}],"
        "\"features\":[{\"id\":\"chrome\",\"box\":[x0,y0,x1,y1]}]}. "
        "Neighbour boxes must not cover the hero centre. Feature boxes must sit inside the hero box."
    )
    text, log = vision_api.complete([
        {"type": "image_url", "image_url": {"url": url}},
        {"type": "text", "text": prompt},
    ], max_tokens=700)
    data = vision_api.extract_json(text)
    neighbours, features = [], []
    for item in data.get("neighbours") or []:
        try:
            box = vision_api._norm_box(item.get("box"))
        except (TypeError, ValueError):
            continue
        if box_iou(box, hero_box) > 0.45:
            continue
        neighbours.append({"id": str(item.get("id", "blade")), "box": box})
    for item in data.get("features") or []:
        try:
            box = vision_api._norm_box(item.get("box"))
        except (TypeError, ValueError):
            continue
        features.append({"id": str(item.get("id", "part")), "box": box})
    return {"neighbours": neighbours, "features": features, "usage": log, "raw": text}


def load_key_and_relights(work):
    reg = os.path.join(work, "reg")
    os.makedirs(reg, exist_ok=True)
    key_src = os.path.join(SRC, "key-city3.jpg")
    if not os.path.isfile(os.path.join(CACHE, "reg", "key.jpg")) and os.path.isdir(os.path.join(CACHE, "..")):
        pass
    cached_reg = os.path.join(CACHE, "..", "..")  # unused
    src_reg = os.path.join(os.path.dirname(CACHE), "work", "reg") if False else os.path.join(CACHE, "reg")
    # The npy cache sits beside reg/ in the grok-native work dir. Prefer those registered plates.
    if os.path.isfile(os.path.join(src_reg, "key.jpg")):
        return src_reg, key_src
    names = ["clay.jpg", "relight-left.jpg", "relight-right.jpg", "relight-top.jpg", "relight-front.jpg"]
    key = cv2.imread(key_src)
    cv2.imwrite(os.path.join(reg, "key.jpg"), key)
    report = {}
    for name in names:
        src = cv2.imread(os.path.join(SRC, name))
        aligned, info = gn_register.align_to_key(src, key)
        cv2.imwrite(os.path.join(reg, name), aligned)
        gray_a = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY)
        gray_k = cv2.cvtColor(key, cv2.COLOR_BGR2GRAY)
        report[name] = {"ncc": gn_register._ncc(gray_a, gray_k, np.ones(gray_k.shape, bool)), "info": info}
    json.dump(report, open(os.path.join(reg, "register.json"), "w"), indent=1)
    return reg, key_src


def integrate_relief(reg, mask, m_per_px):
    key = cv2.imread(os.path.join(reg, "key.jpg"))
    names = ["relight-left.jpg", "relight-right.jpg", "relight-top.jpg", "relight-front.jpg"]
    images = []
    dropped = []
    weighted = []
    for name in names:
        img = cv2.imread(os.path.join(reg, name))
        if img is None:
            continue
        if img.shape[:2] != key.shape[:2]:
            img = cv2.resize(img, (key.shape[1], key.shape[0]))
        gray = gn_normals.luma(img)
        ncc = gn_register._ncc(
            cv2.cvtColor(img, cv2.COLOR_BGR2GRAY),
            cv2.cvtColor(key, cv2.COLOR_BGR2GRAY),
            np.ones(key.shape[:2], bool),
        )
        if name == "relight-front.jpg" and ncc < 0.55:
            dropped.append({"name": name, "ncc": round(float(ncc), 4), "action": "dropped"})
            continue
        images.append((name, gray))
        weighted.append({"name": name, "ncc": round(float(ncc), 4)})
    photo_n, _alb, resid, used = gn_normals.solve_normals(images, mask.astype(bool))
    clay = cv2.imread(os.path.join(reg, "clay.jpg"), cv2.IMREAD_GRAYSCALE)
    if clay is None or clay.shape != mask.shape:
        clay = np.zeros(mask.shape, np.uint8)
    z, info = gn_normals.integrate(photo_n, clay.astype(np.float64) / 255.0, mask.astype(bool), m_per_px)
    info["lights"] = used
    info["dropped"] = dropped
    info["ncc"] = weighted
    info["median_residual"] = float(np.median(resid[mask])) if mask.any() else None
    return z, photo_n, info


def affine_moge(z, mask, key_path, work):
    """Scale integrated relief onto MoGe-2. DA V2 is not loaded."""
    cached = os.path.join(CACHE, "moge.npy")
    if os.path.isfile(cached):
        depth = np.load(cached).astype(np.float64)
        hit = True
    else:
        out = os.path.join(work, "moge.npy")
        cmd = [VENV, os.path.join(GN, "baseline.py"), "--task", "moge", "--image", key_path, "--out", out, "--side", "384"]
        proc = subprocess.run(cmd, check=False, capture_output=True, text=True)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr[-400:])
        depth = np.load(out).astype(np.float64)
        hit = False
    h, w = mask.shape
    depth_r = cv2.resize(depth, (w, h), interpolation=cv2.INTER_LINEAR)
    # Plane residual is the facade relief MoGe still carries after a flat wall is removed.
    ys, xs = np.where(mask)
    zz = depth_r[ys, xs]
    A = np.stack([xs.astype(np.float64), ys.astype(np.float64), np.ones(len(xs))], 1)
    coef, _, _, _ = np.linalg.lstsq(A, zz, rcond=None)
    resid = np.zeros_like(depth_r)
    resid[ys, xs] = zz - A @ coef
    src = z[ys, xs]
    dst = resid[ys, xs]
    M = np.stack([src, np.ones(len(src))], 1)
    ab, _, _, _ = np.linalg.lstsq(M, dst, rcond=None)
    fitted = z * float(ab[0]) + float(ab[1])
    fitted = fitted - np.median(fitted[mask])
    return fitted, {
        "scale": float(ab[0]),
        "offset": float(ab[1]),
        "cache_hit": hit,
        "model": "moge-2",
        "licence": "MIT",
        "da_v2": "not used in shipped output",
    }


def build_mesh(grid, fx, fy, cx, cy, z0, depth_m, out_dir, atlas_path):
    spec = {"grid": grid, "fx": fx, "fy": fy, "cx": cx, "cy": cy, "Z0": z0, "depth_m": depth_m}
    os.makedirs(out_dir, exist_ok=True)
    slab = os.path.join(out_dir, "slab.json")
    json.dump(spec, open(slab, "w"))
    script = os.path.join(HERE, "fusion5_blender.py")
    proc = subprocess.run(
        ["blender", "--background", "--python", script, "--", slab, out_dir, atlas_path],
        check=False, capture_output=True, text=True,
    )
    open(os.path.join(out_dir, "blender.log"), "w").write(proc.stdout[-4000:] + "\n" + proc.stderr[-2000:])
    if proc.returncode != 0 or not os.path.isfile(os.path.join(out_dir, "mesh_stats.json")):
        raise RuntimeError("blender failed: " + (proc.stderr or proc.stdout)[-400:])
    stats = json.load(open(os.path.join(out_dir, "mesh_stats.json")))
    dump = json.load(open(os.path.join(out_dir, "mesh_dump.json")))
    return stats, dump


def render_round(dump, colours, key_bgr, fx, fy, cx, cy, out_dir, views):
    pos = np.array(dump["positions"], np.float64)
    faces = dump["faces"]
    h, w = key_bgr.shape[:2]
    light = np.array([0.55, 0.25, 0.80], np.float64)
    light = light / np.linalg.norm(light)
    paths = {}
    for name, yaw_deg, dist_scale in views:
        ang = np.deg2rad(yaw_deg)
        c, s = np.cos(ang), np.sin(ang)
        turned = pos.copy()
        x, z = pos[:, 0], pos[:, 2]
        turned[:, 0] = c * x + s * z
        turned[:, 2] = -s * x + c * z
        if dist_scale != 1.0:
            turned[:, 2] *= dist_scale
        alb = raster_coloured(turned, faces, colours, w, h, fx, fy, cx, cy, light=None)
        rel = raster_coloured(turned, faces, colours, w, h, fx, fy, cx, cy, light=light)
        ap = os.path.join(out_dir, f"{name}-albedo.jpg")
        rp = os.path.join(out_dir, f"{name}-relief.jpg")
        cv2.imwrite(ap, cv2.cvtColor(alb["image"], cv2.COLOR_RGB2BGR))
        cv2.imwrite(rp, cv2.cvtColor(rel["image"], cv2.COLOR_RGB2BGR))
        sc = overlap(rp, ap)
        save_overlay(os.path.join(out_dir, f"{name}-align.jpg"), rp, ap)
        paths[name] = {"albedo": ap, "relief": rp, "score": sc}
    return paths


def write_sheets(step, render_bgr, key_bgr, window):
    sys.path.insert(0, GN)
    import sheet as gn_sheet
    win = window or (0, key_bgr.shape[0], 0, key_bgr.shape[1])
    cv2.imwrite(os.path.join(step, "sheet-16x9.jpg"), gn_sheet.sheet_16x9(render_bgr, render_bgr, key_bgr, win))
    cv2.imwrite(os.path.join(step, "sheet-phone.jpg"), gn_sheet.sheet_phone(render_bgr, render_bgr, key_bgr, win))


def run(spec_path, step_dir):
    os.makedirs(step_dir, exist_ok=True)
    work = os.path.join(step_dir, "work")
    rounds = os.path.join(step_dir, "rounds")
    os.makedirs(work, exist_ok=True)
    os.makedirs(rounds, exist_ok=True)
    timing = {}
    costs = []
    spec = {}
    if spec_path and os.path.isfile(spec_path):
        import yaml
        spec = yaml.safe_load(open(spec_path)) or {}
    reg, key_src = clock(timing, "register_s", lambda: load_key_and_relights(work))
    key_bgr = cv2.imread(os.path.join(reg, "key.jpg"))
    h, w = key_bgr.shape[:2]
    pick = json.load(open(os.path.join(CACHE, "pick.json")))
    vision = json.load(open(os.path.join(CACHE, "vision.json")))
    hero_box = pick["chosen"]["box"]
    x0, y0, x1, y1 = gn_masks.box_px(hero_box, w, h, pad=0)
    seed = ((x0 + x1) // 2, (y0 + y1) // 2)

    def _split():
        return ask_split(os.path.join(reg, "key.jpg"), hero_box)

    print("FUSION5 vision split", flush=True)
    split = clock(timing, "vision_split_s", _split)
    costs.append(split["usage"])
    print("FUSION5 split neighbours", len(split["neighbours"]), "features", len(split["features"]),
          "usd", split["usage"].get("cost_usd"), flush=True)
    json.dump({"neighbours": split["neighbours"], "features": split["features"], "usage": split["usage"]},
              open(os.path.join(work, "split.json"), "w"), indent=1)

    hero_sam, sam_meta = clock(timing, "sam_hero_s", lambda: sam_mask(
        os.path.join(reg, "key.jpg"), [x0, y0, x1, y1], os.path.join(work, "sam-hero.npy")))
    neighbour_masks = []
    neighbour_boxes = []
    for i, nb in enumerate(split["neighbours"]):
        bx = gn_masks.box_px(nb["box"], w, h, pad=0)
        nm, _meta = sam_mask(os.path.join(reg, "key.jpg"), bx, os.path.join(work, f"sam-n{i}.npy"))
        neighbour_masks.append(nm)
        neighbour_boxes.append(bx)
    mask, leak = cut_neighbours(hero_sam, neighbour_masks, neighbour_boxes, seed)
    old = cv2.imread(os.path.join(CACHE, "mask.png"), cv2.IMREAD_GRAYSCALE)
    if old is not None and old.shape != mask.shape:
        old = cv2.resize(old, (w, h), interpolation=cv2.INTER_NEAREST)
    fusion_ref = cv2.imread(FUSION_MASK, cv2.IMREAD_GRAYSCALE) if os.path.isfile(FUSION_MASK) else None
    if fusion_ref is not None and fusion_ref.shape != mask.shape:
        fusion_ref = cv2.resize(fusion_ref, (w, h), interpolation=cv2.INTER_NEAREST)
    ious = {
        "vs_old_mask": None if old is None else round(iou(mask, old > 127), 4),
        "vs_fusion_reference": None if fusion_ref is None else round(iou(mask, fusion_ref > 127), 4),
        "vs_sam_hero": round(iou(mask, hero_sam), 4),
    }
    overlay = key_bgr.copy()
    overlay[mask] = (0.35 * overlay[mask] + 0.65 * np.array([40, 40, 220])).astype(np.uint8)
    cv2.imwrite(os.path.join(work, "mask-overlay.jpg"), overlay)
    cv2.imwrite(os.path.join(step_dir, "mask-overlay.jpg"), overlay)
    leak_ok = all(v == 0 for v in leak.values()) if leak else True
    json.dump({"leak": leak, "leak_ok": leak_ok, "iou": ious, "sam": sam_meta, "pixels": int(mask.sum())},
              open(os.path.join(work, "mask.json"), "w"), indent=1)

    height_m = float(vision["hero"]["height_m"])
    depth_m = float(vision["hero"]["depth_m"])
    measures = gn_parametric.measure_mask(mask.astype(np.uint8), height_m, depth_m)
    z_photo, _normals, ninfo = clock(timing, "normals_s", lambda: integrate_relief(reg, mask, measures["m_per_px"]))
    z_metric, moge_info = clock(timing, "moge_s", lambda: affine_moge(z_photo, mask, os.path.join(reg, "key.jpg"), work))
    json.dump({"normals": ninfo, "moge": moge_info, "measures": measures}, open(os.path.join(work, "relief-src.json"), "w"), indent=1)

    state = {
        "relief_scale": 1.0,
        "width_scale": 1.0,
        "uv_dx": 0.0,
        "m_per_px": measures["m_per_px"],
        "depth_m": depth_m,
    }
    features = split["features"] or vision.get("features") or []
    fov = float(np.clip(vision.get("fov_y_deg", 42.0), 25.0, 90.0))
    fy = (h * 0.5) / np.tan(np.deg2rad(fov) * 0.5)
    fx = fy
    cx, cy = (w - 1) / 2.0, (h - 1) / 2.0
    pix_h = max(1, int(measures["pix_h"]))
    z0 = fy * height_m / pix_h
    plates = {k: cv2.imread(p) for k, p in PLATES.items()}
    atlas = make_atlas(key_bgr, plates)
    atlas_path = os.path.join(work, "atlas.jpg")
    cv2.imwrite(atlas_path, atlas)

    round_rows = []
    best = None
    built = None
    for rnd in range(3):
        print("FUSION5 round", rnd, flush=True)
        rd = os.path.join(rounds, f"round-{rnd}")
        os.makedirs(rd, exist_ok=True)
        field = z_metric * float(state["relief_scale"])
        feat_m, feat_used = feature_mask((h, w), features, mask)
        clamped, clamp_info = clamp_feature_depth(field, feat_m)
        quant, levels = quantize_planes(clamped, feat_m, levels=4)
        per = per_feature_depth(quant, features, mask, (h, w))
        grid, spacing = build_grid(mask, quant, measures, state["width_scale"], state["uv_dx"])
        colours, _rows, _cols = vertex_colours(grid, key_bgr)
        planned = planned_mesh(grid, fx, fy, cx, cy, z0, state["depth_m"])
        n_front = (len(grid) - 1) * (len(grid[0]) - 1) * 2
        front_only = (planned[0], planned[1][:n_front])
        sc = clock(timing, f"cheap_{rnd}_s", lambda: project_overlay(
            front_only, colours, w, h, fx, fy, cx, cy, rd))
        row = {
            "round": rnd, "cheap": sc, "clamp": clamp_info, "levels": levels,
            "features": per, "state": dict(state), "spacing": spacing,
        }
        print("FUSION5 cheap", rnd, sc.get("overlap"), "rows", spacing["rows"], "cols", spacing["cols"], flush=True)
        if sc.get("overlap", 0) < BAR and rnd < 2:
            # Fix parameters before Blender. A low edge score widens the feature gain once.
            state["relief_scale"] = float(state["relief_scale"]) * 1.2
            row["built"] = False
            row["edit"] = "relief_scale up; overlay under 0.70"
            json.dump(row, open(os.path.join(rd, "judge.json"), "w"), indent=1)
            round_rows.append(row)
            continue
        stats, dump = clock(timing, f"blender_{rnd}_s", lambda: build_mesh(
            grid, fx, fy, cx, cy, z0, state["depth_m"], rd, atlas_path))
        colours, _rows, _cols = vertex_colours(grid, key_bgr)
        views = [("key", 0.0, 1.0), ("hero", 8.0, 1.0), ("30m", 18.0, 1.15), ("8m", 32.0, 0.72), ("side", 70.0, 1.05)]
        rendered = clock(timing, f"render_{rnd}_s", lambda: render_round(
            dump, colours, key_bgr, fx, fy, cx, cy, rd, views))
        align = {name: rec["score"] for name, rec in rendered.items()}
        relief_axes = local_axis_relief(dump["positions"], dump["faces"])
        judges = []
        for name in ("key", "hero", "30m", "8m", "side"):
            try:
                j = judge_view(rendered[name]["albedo"], os.path.join(reg, "key.jpg"), name)
            except Exception as exc:
                j = {"view": name, "errors": [], "score": 0.0, "error": str(exc)[:300]}
            if j.get("usage"):
                costs.append(j["usage"])
            judges.append(j)
            json.dump(j, open(os.path.join(rd, f"judge-{name}.json"), "w"), indent=1)
        edits = []
        for j in judges:
            edits.extend(apply_errors(state, j.get("errors")))
        row.update({
            "built": True,
            "mesh": stats,
            "align": {k: v.get("overlap") for k, v in align.items()},
            "relief_axes": relief_axes,
            "judges": [{k: j.get(k) for k in ("view", "score", "errors", "error")} for j in judges],
            "edits": edits,
        })
        json.dump(row, open(os.path.join(rd, "round.json"), "w"), indent=1)
        round_rows.append(row)
        best = row
        built = (stats, dump, grid, quant, colours, rendered)
        scores = [float(v.get("overlap") or 0) for v in align.values()]
        if scores and min(scores) >= BAR and all((relief_axes.get(k) or 0) > 0 for k in ("+x", "-x", "+z", "-z")):
            break

    numbers = {
        "method": "fusion5",
        "front_light": ninfo.get("dropped") or "kept",
        "iou": ious,
        "leak_ok": leak_ok,
        "leak": leak,
        "measures": measures,
        "moge": moge_info,
        "rounds": [{k: r.get(k) for k in ("round", "cheap", "align", "relief_axes", "built", "mesh")} for r in round_rows],
        "timing_s": timing,
        "vision_cost_usd": round(sum(float(c.get("cost_usd") or 0) for c in costs), 6),
        "vision_calls": costs,
    }
    passed = False
    why = "no mesh"
    dataset = {"exported": False, "reason": why, "count": 0}
    if best and best.get("built"):
        align = best.get("align") or {}
        axes = best.get("relief_axes") or {}
        feat_ok = any((f.get("depth_m") or 0) >= 0.3 for f in best.get("features") or [])
        align_ok = bool(align) and all((align.get(k) or 0) >= BAR for k in ("key", "hero", "30m", "8m", "side"))
        axis_ok = all((axes.get(k) or 0) > 0 for k in ("+x", "-x", "+z", "-z"))
        mesh_ok = (best.get("mesh") or {}).get("watertight") and (best.get("mesh") or {}).get("blender_boundary_edges", 1) == 0
        passed = bool(align_ok and axis_ok and feat_ok and mesh_ok and leak_ok)
        why = "pass" if passed else "align/relief/leak/mesh missed the bar"
        tris = (best.get("mesh") or {}).get("faces") or 0
        numbers["phone"] = phone_budget(tris, atlas.shape[1], atlas.shape[0])
        numbers["python_bars"] = passed
        # Blocking PASS includes the object gate. This process has not run it yet.
        numbers["verdict"] = "FAIL"
        numbers["why"] = why if not passed else "python bars met; object gate still required"
        # Sheets: phone portrait render beside the key.
        alb = cv2.imread(best and os.path.join(rounds, f"round-{best['round']}", "8m-albedo.jpg"))
        if alb is not None:
            import sheet as gn_sheet
            write_sheets(step_dir, alb, key_bgr, gn_sheet.focus_window(mask.astype(np.uint8)))
        numbers["python_bars"] = passed
        # The object gate is the blocking pass. Training views are written only after it.
        dataset = export_dataset(REPO, "zoneb-tower-hero", False, {
            "why": "object gate has not passed" if passed else why,
        })
        if passed:
            numbers["export_ready"] = best["round"]
        try:
            numbers["staging"] = stage_preview(os.path.join(rounds, f"round-{best['round']}"), atlas_path, fov)
        except Exception as exc:
            numbers["staging"] = {"staged": False, "why": str(exc)[:300]}
    else:
        numbers["verdict"] = "FAIL"
        numbers["why"] = why
        dataset = {"exported": False, "reason": why, "count": 0}
    numbers["dataset"] = {k: dataset.get(k) for k in ("exported", "path", "count", "reason")}
    json.dump(numbers, open(os.path.join(step_dir, "numbers.json"), "w"), indent=1)
    write_report(step_dir, numbers, round_rows, ninfo)
    return 0 if numbers.get("verdict") == "PASS" else 1


def write_report(step, numbers, rounds, ninfo):
    lines = [
        "# Fusion fix 5",
        "",
        f"Verdict: **{numbers.get('verdict', 'FAIL')}**. {numbers.get('why', '')}",
        "",
        f"Front light: {json.dumps(ninfo.get('dropped') or 'kept')}. NCC {json.dumps(ninfo.get('ncc'))}.",
        "",
        f"Mask IoU {json.dumps(numbers.get('iou'))}. Leak ok: {numbers.get('leak_ok')}.",
        "",
        f"Vision cost USD {numbers.get('vision_cost_usd')}. Calls {len(numbers.get('vision_calls') or [])}.",
        "",
        f"Phone: {json.dumps(numbers.get('phone'))}.",
        "",
        f"Dataset: {json.dumps(numbers.get('dataset'))}.",
        "",
        "## Rounds",
        "",
    ]
    for r in rounds:
        lines.append(f"- round {r.get('round')}: cheap {((r.get('cheap') or {}).get('overlap'))} "
                     f"align {json.dumps(r.get('align'))} relief {json.dumps(r.get('relief_axes'))} "
                     f"built {r.get('built')}")
    lines.append("")
    lines.append(f"Times: {json.dumps(numbers.get('timing_s'))}.")
    lines.append("")
    lines.append("Sheets: `sheet-16x9.jpg` and `sheet-phone.jpg` beside the key crop when a round built.")
    open(os.path.join(step, "REPORT.md"), "w").write("\n".join(lines) + "\n")


def run_cli(target):
    step = os.path.join(REPO, "steps", "fusion-fix5-1011")
    return run(target, step)


def main(argv=None):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", default=os.path.join(HERE, "specs", "zoneb-tower-vision.yaml"))
    ap.add_argument("--step", default=os.path.join(REPO, "steps", "fusion-fix5-1011"))
    a = ap.parse_args(argv)
    return run(a.spec, a.step)


if __name__ == "__main__":
    sys.exit(main())
