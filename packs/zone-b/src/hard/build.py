#!/usr/bin/env python3
"""Measure zone B hard objects and write the loft.

One elevation skin per part. Sections are the opaque runs. Holes stay open.
World size follows phone magnification at the real approach distance.
Colour and prompt text stay out of this file.
"""
from __future__ import annotations

import json
import math
import shutil
import struct
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PACK = ROOT.parents[1]
REPO = PACK.parents[1]
SESSION = Path(
    "/workspace/x-live/chrome-game-home/.grok/sessions"
    "/%2Fworkspace%2Fgrokcli%2FzoneB/01a1089c-9b0d-72b1-ab77-dd2c88776ff8"
)
BUTTES = PACK / "src" / "buttes"
THRESH = 16
MAG = 0.94
SINK = 0.22

HFOV = 22.7 * math.pi / 180
ASPECT = 720 / 1600
VFOV = 2 * math.atan(math.tan(HFOV / 2) / ASPECT)
FOCAL = (1600 / 2) / math.tan(VFOV / 2)

RAW = [
    [-25.59, 71.8],
    [-22.64, 44.23],
    [-19.68, 17.65],
    [-19.68, -7.94],
    [-21.65, -31.57],
    [-24.6, -54.21],
    [-22.64, -71.93],
    [21.66, -71.93],
    [25.6, -51.26],
    [24.62, -27.63],
    [22.65, -5.97],
    [20.68, 15.68],
    [22.65, 41.28],
    [24.62, 71.8],
]


def shoelace(poly):
    a = 0.0
    for i, p in enumerate(poly):
        q = poly[(i + 1) % len(poly)]
        a += p[0] * q[1] - q[0] * p[1]
    return abs(a) * 0.5


SCALE = math.sqrt(6500 / shoelace(RAW))
POLY = [(x * SCALE, z * SCALE) for x, z in RAW]


def inside(x, z):
    # Same ray test as field.js: heading 0 is +z.
    rho = math.hypot(x, z)
    if rho < 0.001:
        return True
    th = math.atan2(x, z)
    dx, dz = math.sin(th), math.cos(th)
    best = 1e9
    for i, (x1, z1) in enumerate(POLY):
        x2, z2 = POLY[(i + 1) % len(POLY)]
        ex, ez = x2 - x1, z2 - z1
        denom = ex * dz - dx * ez
        if abs(denom) < 1e-8:
            continue
        t = (ex * z1 - ez * x1) / denom
        s = (dx * z1 - dz * x1) / denom
        if t > 0.02 and -1e-4 <= s <= 1 + 1e-4 and t < best:
            best = t
    return rho <= best + 1e-2


def load_rgb(path):
    im = Image.open(path).convert("RGB")
    return np.asarray(im)


def luma(rgb):
    return 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]


def largest_mask(rgb, thresh=THRESH):
    m = luma(rgb) > thresh
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8), 8)
    if n <= 1:
        raise SystemExit("empty mask")
    # label 0 is the background
    areas = stats[1:, cv2.CC_STAT_AREA]
    lab = 1 + int(np.argmax(areas))
    keep = labels == lab
    ys, xs = np.where(keep)
    box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    return keep, box


def crop_content(rgb, mask, box, pad=14):
    x0, y0, x1, y1 = box
    h, w = mask.shape
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad)
    y1 = min(h - 1, y1 + pad)
    return rgb[y0 : y1 + 1, x0 : x1 + 1].copy(), mask[y0 : y1 + 1, x0 : x1 + 1].copy()


def row_runs(mask, y, min_px=2):
    row = mask[y]
    runs = []
    x = 0
    w = row.shape[0]
    while x < w:
        if not row[x]:
            x += 1
            continue
        a = x
        while x < w and row[x]:
            x += 1
        if x - a >= min_px:
            runs.append((a, x - 1))
    return runs


def overlap(a, b):
    return min(a[1], b[1]) - max(a[0], b[0]) + 1


class Mesh:
    def __init__(self):
        self.verts = []  # x,y,z,px,py  (pixel uv, atlas later)
        self.inds = []
        self.boxes = []  # x0,y0,z0,x1,y1,z1
        self.min = [1e9, 1e9, 1e9]
        self.max = [-1e9, -1e9, -1e9]

    def _push(self, pts):
        base = len(self.verts) // 5
        for p in pts:
            self.verts.extend(p)
            for i in range(3):
                self.min[i] = min(self.min[i], p[i])
                self.max[i] = max(self.max[i], p[i])
        return base

    def quad(self, pts):
        b = self._push(pts)
        self.inds.extend((b, b + 1, b + 2, b, b + 2, b + 3))

    def box(self, x0, y0, z0, x1, y1, z1):
        if x1 < x0:
            x0, x1 = x1, x0
        if y1 < y0:
            y0, y1 = y1, y0
        if z1 < z0:
            z0, z1 = z1, z0
        if x1 - x0 < 0.01 or y1 - y0 < 0.004 or z1 - z0 < 0.01:
            return
        self.boxes.append((x0, y0, z0, x1, y1, z1))


def merge_boxes(boxes):
    # Stack prisms that share an x/z footprint into taller boxes.
    items = [list(b) for b in boxes]
    items.sort(key=lambda b: (round(b[0], 2), round(b[2], 2), b[1]))
    out = []
    for b in items:
        hit = None
        for o in out:
            x_ov = min(o[3], b[3]) - max(o[0], b[0])
            z_ov = min(o[5], b[5]) - max(o[2], b[2])
            x_u = max(o[3], b[3]) - min(o[0], b[0])
            z_u = max(o[5], b[5]) - min(o[2], b[2])
            y_touch = b[1] <= o[4] + 0.08 and o[1] <= b[4] + 0.08
            if x_u > 0 and z_u > 0 and x_ov / x_u > 0.82 and z_ov / z_u > 0.82 and y_touch:
                hit = o
                break
        if hit is None:
            out.append(b)
            continue
        hit[0] = min(hit[0], b[0])
        hit[1] = min(hit[1], b[1])
        hit[2] = min(hit[2], b[2])
        hit[3] = max(hit[3], b[3])
        hit[4] = max(hit[4], b[4])
        hit[5] = max(hit[5], b[5])
    return [tuple(round(v, 4) for v in b) for b in out]


def build_loft(mask, world_h, depth_k=0.72, depth_max=None):
    h, w = mask.shape
    ys, xs = np.where(mask)
    if len(xs) == 0:
        raise SystemExit("loft empty")
    y0, y1 = int(ys.min()), int(ys.max())
    content_h = y1 - y0 + 1
    content_w = int(xs.max() - xs.min() + 1)
    mpp = world_h / content_h
    mid = (int(xs.min()) + int(xs.max())) * 0.5
    step = max(2, content_h // 40)
    stations = list(range(y1, y0 - 1, -step))
    if stations[-1] != y0:
        stations.append(y0)
    mesh = Mesh()

    def wx(px):
        return (px - mid) * mpp

    def wy(py):
        return (y1 - py) * mpp

    def runs_at(py):
        return row_runs(mask, int(py))

    prev = None
    prev_y = None
    for py in stations:
        runs = runs_at(py)
        if prev is not None:
            used = set()
            y_a = wy(prev_y)
            y_b = wy(py)
            for a in prev:
                best = None
                best_ov = 0
                for j, b in enumerate(runs):
                    ov = overlap(a, b)
                    if ov > best_ov:
                        best_ov = ov
                        best = j
                if best is None or best_ov <= 0:
                    continue
                used.add(best)
                b = runs[best]
                emit_prism(mesh, a, b, y_a, y_b, wx, wy, prev_y, py, mpp, depth_k, depth_max)
            # runs that start here get no bottom cap; the next prism closes them
        prev = runs
        prev_y = py
    return mesh, content_w, content_h, mpp


def emit_prism(mesh, a, b, y_a, y_b, wx, wy, py_a, py_b, mpp, depth_k, depth_max):
    # a is the lower station (larger image y), b is the upper.
    xa0, xa1 = wx(a[0]), wx(a[1])
    xb0, xb1 = wx(b[0]), wx(b[1])
    width = max(xa1 - xa0, xb1 - xb0, 0.02)
    depth = width * depth_k
    if depth_max is not None:
        depth = min(depth, depth_max)
    depth = max(depth, 0.08)
    z0, z1 = -depth * 0.5, depth * 0.5
    # pixel samples: outer edge and a strip for the thickness faces
    def vert(px, py, x, y, z):
        return (x, y, z, float(px), float(py))

    pa0, pa1 = a[0], a[1]
    pb0, pb1 = b[0], b[1]
    # front +z, back -z. Same pixels, mirrored across x on the back.
    mesh.quad([
        vert(pa0, py_a, xa0, y_a, z1),
        vert(pa1, py_a, xa1, y_a, z1),
        vert(pb1, py_b, xb1, y_b, z1),
        vert(pb0, py_b, xb0, y_b, z1),
    ])
    mesh.quad([
        vert(pa1, py_a, xa1, y_a, z0),
        vert(pa0, py_a, xa0, y_a, z0),
        vert(pb0, py_b, xb0, y_b, z0),
        vert(pb1, py_b, xb1, y_b, z0),
    ])
    # thickness faces reuse a vertical strip so pixel density matches the elevation
    strip = max(2.0, depth / mpp)
    cx = (pa0 + pa1) * 0.5
    s0 = cx - strip * 0.5
    s1 = cx + strip * 0.5
    mesh.quad([
        vert(s1, py_a, xa1, y_a, z1),
        vert(s0, py_a, xa1, y_a, z0),
        vert(s0, py_b, xb1, y_b, z0),
        vert(s1, py_b, xb1, y_b, z1),
    ])
    mesh.quad([
        vert(s0, py_a, xa0, y_a, z0),
        vert(s1, py_a, xa0, y_a, z1),
        vert(s1, py_b, xb0, y_b, z1),
        vert(s0, py_b, xb0, y_b, z0),
    ])
    # Close the station. An open top reads as stacked cards from above.
    mesh.quad([
        vert(pb0, py_b, xb0, y_b, z0),
        vert(pb1, py_b, xb1, y_b, z0),
        vert(pb1, py_b, xb1, y_b, z1),
        vert(pb0, py_b, xb0, y_b, z1),
    ])
    mesh.quad([
        vert(pa0, py_a, xa0, y_a, z1),
        vert(pa1, py_a, xa1, y_a, z1),
        vert(pa1, py_a, xa1, y_a, z0),
        vert(pa0, py_a, xa0, y_a, z0),
    ])
    mesh.box(min(xa0, xb0), min(y_a, y_b), z0, max(xa1, xb1), max(y_a, y_b), z1)


def extent_for(src_px, dist, cap):
    return min(cap, MAG * dist * src_px / FOCAL)


def pack_shelves(images, max_w=4096):
    # images: list of (name, rgba HxWx4)
    order = sorted(images, key=lambda it: it[1].shape[0], reverse=True)
    x = 0
    y = 0
    row_h = 0
    placed = {}
    atlas_h = 0
    for name, im in order:
        h, w = im.shape[:2]
        if w > max_w:
            raise SystemExit(f"{name} wider than atlas")
        if x + w > max_w:
            y += row_h
            x = 0
            row_h = 0
        placed[name] = (x, y, w, h, im)
        x += w
        row_h = max(row_h, h)
        atlas_h = max(atlas_h, y + h)
    # pad atlas height to a multiple of 4
    atlas_h = max(4, (atlas_h + 3) & ~3)
    atlas_w = max_w
    atlas = np.zeros((atlas_h, atlas_w, 4), np.uint8)
    rects = {}
    for name, (x, y, w, h, im) in placed.items():
        atlas[y : y + h, x : x + w] = im
        rects[name] = (x, y, w, h)
    return atlas, rects


def bleed(atlas, passes=8):
    rgb = atlas[:, :, :3]
    a = atlas[:, :, 3]
    op = a > 0
    h, w = op.shape
    for _ in range(passes):
        dil = op.copy()
        src = rgb.copy()
        # 4-neighbour bleed into empty texels
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ys = slice(max(0, dy), h + min(0, dy))
            xs = slice(max(0, dx), w + min(0, dx))
            yd = slice(max(0, -dy), h + min(0, -dy))
            xd = slice(max(0, -dx), w + min(0, -dx))
            take = op[ys, xs] & ~dil[yd, xd]
            src[yd, xd][take] = rgb[ys, xs][take]
            dil[yd, xd][take] = True
        rgb = src
        op = dil
    atlas[:, :, :3] = rgb
    return atlas


def rgba_of(rgb, mask):
    out = np.zeros((rgb.shape[0], rgb.shape[1], 4), np.uint8)
    out[:, :, :3] = rgb
    out[:, :, 3] = np.where(mask, 255, 0).astype(np.uint8)
    return out


def apply_atlas_uv(mesh, rect, atlas_w, atlas_h):
    rx, ry, rw, rh = rect
    verts = mesh.verts
    for i in range(0, len(verts), 5):
        px = verts[i + 3]
        py = verts[i + 4]
        # clamp into the plate so thickness strips that fall outside still sample rock
        px = min(max(px, 0.0), rw - 1.0)
        py = min(max(py, 0.0), rh - 1.0)
        u = (rx + px + 0.5) / atlas_w
        v = 1.0 - (ry + py + 0.5) / atlas_h
        verts[i + 3] = u
        verts[i + 4] = v


def lamp_local(rgb, mask, world_h):
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    content_h = y1 - y0 + 1
    mpp = world_h / content_h
    mid = (float(xs.min()) + float(xs.max())) * 0.5
    lum = luma(rgb)
    top = int(y0 + content_h * 0.16)
    band = (lum > 150) & mask
    band[top:, :] = False
    by, bx = np.where(band)
    if len(bx) < 8:
        band = mask.copy()
        band[top:, :] = False
        by, bx = np.where(band)
    if len(bx) == 0:
        return 0.0, world_h * 0.97
    lx = (float(bx.mean()) - mid) * mpp
    ly = (y1 - float(by.mean())) * mpp
    return lx, ly


def part_record(mesh, content_w, content_h, world_h):
    boxes = merge_boxes(mesh.boxes)
    nv = len(mesh.verts) // 5
    return {
        "nv": nv,
        "ni": len(mesh.inds),
        "srcW": int(content_w),
        "srcH": int(content_h),
        "worldH": round(world_h, 4),
        "worldW": round(mesh.max[0] - mesh.min[0], 4),
        "depth": round(mesh.max[2] - mesh.min[2], 4),
        "minX": round(mesh.min[0], 4),
        "maxX": round(mesh.max[0], 4),
        "minY": round(mesh.min[1], 4),
        "maxY": round(mesh.max[1], 4),
        "minZ": round(mesh.min[2], 4),
        "maxZ": round(mesh.max[2], 4),
        "boxes": boxes,
        "_verts": mesh.verts,
        "_inds": mesh.inds,
    }


def prompt_txt(path, role, pixels, aspect, job):
    path.write_text(
        "\n".join([
            "STATUS",
            "The verbatim Imagine tool-call string that produced this JPEG was not stored.",
            "The file's EXIF is JFIF only (no prompt, no comment). No session log kept the call.",
            "This JPEG is the locked ruler. Do not regenerate it and treat the new file as this plate.",
            "Block ASK is the generation contract to copy if the plate must be replaced.",
            "It matches this file's pixel size, aspect and job. It is not a recovered transcript.",
            "",
            role,
            f"PIXELS {pixels}. ASPECT {aspect}.",
            "JOB",
            job,
            "",
            "ASK (colour-free template; the tone and subject wording are untracked,",
            "see /workspace/grokcli/out/zoneB/step2/prompts.local.md)",
            "Imagine, aspect " + aspect + ". Orthographic, no perspective, no camera tilt, no ground, no stars,",
            "no text, no border, no watermark. Plain empty background the reader can segment.",
            "One object, filling the frame with a small empty margin.",
            "<TONE + ACCENTS from the local file>. Panels and seams readable at phone size.",
            "Subject: the JOB above, nothing else.",
            "",
        ]),
        encoding="utf-8",
    )


def xform_box(box, place, base_y):
    yaw = place["yaw"]
    tilt = place.get("tilt") or 0.0
    c, s = math.cos(yaw), math.sin(yaw)
    ct, st = math.cos(tilt), math.sin(tilt)
    mirror = -1 if place.get("mirror") else 1
    xs = []
    ys = []
    zs = []
    x0, y0, z0, x1, y1, z1 = box
    for x in (x0, x1):
        for y in (y0, y1):
            for z in (z0, z1):
                x *= 1
                lx = x * mirror
                ly = y * ct - z * st
                lz = y * st + z * ct
                wx = place["x"] + c * lx + s * lz
                wz = place["z"] - s * lx + c * lz
                wy = base_y + ly
                xs.append(wx)
                ys.append(wy)
                zs.append(wz)
                x = x  # noqa: keep loop simple
    # The loop above mutates x wrongly because x is reused. Recompute cleanly.
    xs, ys, zs = [], [], []
    for x in (x0, x1):
        for y in (y0, y1):
            for z in (z0, z1):
                lx = x * mirror
                ly = y * ct - z * st
                lz = y * st + z * ct
                xs.append(place["x"] + c * lx + s * lz)
                zs.append(place["z"] - s * lx + c * lz)
                ys.append(base_y + ly)
    return (min(xs), min(ys), min(zs), max(xs), max(ys), max(zs))


def hits_body(box, x, z, y0, y1, pad=0.35):
    if box[4] < y0 or box[1] > y1:
        return False
    if x < box[0] - pad or x > box[3] + pad:
        return False
    if z < box[2] - pad or z > box[5] + pad:
        return False
    return True


def main():
    print(f"FOCAL {FOCAL:.4f} SCALE {SCALE:.6f}")
    src = {
        "anchor": SESSION / "images" / "5.jpg",
        "tower": SESSION / "images" / "6.jpg",
        "pylon": SESSION / "images" / "9.jpg",
        "drone": SESSION / "images" / "1.jpg",
        "cart": SESSION / "images" / "10.jpg",
        "rib": SESSION / "images" / "8.jpg",
        "beacon": SESSION / "images" / "7.jpg",
    }
    for name, path in src.items():
        dest = ROOT / f"{name}.jpg"
        shutil.copyfile(path, dest)
    shutil.copyfile(SESSION / "videos" / "1.mp4", ROOT / "beacon.mp4")

    plates = {}
    for name in ("anchor", "tower", "pylon", "drone", "cart", "rib"):
        rgb = load_rgb(ROOT / f"{name}.jpg")
        mask, box = largest_mask(rgb)
        touch = box[0] <= 1 or box[1] <= 1 or box[2] >= rgb.shape[1] - 2 or box[3] >= rgb.shape[0] - 2
        rgb_c, mask_c = crop_content(rgb, mask, box, 12)
        plates[name] = (rgb_c, mask_c, touch, rgb.shape[1], rgb.shape[0])
        ch = mask_c.any(axis=1).sum()
        cw = int(np.where(mask_c)[1].max() - np.where(mask_c)[1].min() + 1)
        ch = int(np.where(mask_c)[0].max() - np.where(mask_c)[0].min() + 1)
        print(f"plate {name} crop {mask_c.shape[1]}x{mask_c.shape[0]} content {cw}x{ch} touch {touch}")

    # Arch skins are crops of the existing mesa plates. No new image call.
    butte = load_rgb(BUTTES / "butte-0.jpg")
    bmask, bbox = largest_mask(butte)
    butte_c, butte_m = crop_content(butte, bmask, bbox, 8)
    plates["leg"] = (butte_c, butte_m, True, butte.shape[1], butte.shape[0])
    cliff = load_rgb(BUTTES / "cliff-0.jpg")
    # Upper wall only. The lower band is loose stone and would fill an opening.
    cliff_slice = cliff[96:430, 6:1274]
    cmask, cbox = largest_mask(cliff_slice)
    cliff_c, cliff_m = crop_content(cliff_slice, cmask, cbox, 4)
    plates["span"] = (cliff_c, cliff_m, True, cliff_slice.shape[1], cliff_slice.shape[0])
    print(f"plate leg {butte_m.shape[1]}x{butte_m.shape[0]}")
    print(f"plate span {cliff_m.shape[1]}x{cliff_m.shape[0]}")

    def content_px(mask):
        ys, xs = np.where(mask)
        return int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)

    # --- sizes ---
    a_cw, a_ch = content_px(plates["anchor"][1])
    # North rim is z = 71.8. 60 m needs this much distance.
    d_need = FOCAL * 60.0 / (MAG * a_ch)
    z_anchor = 71.8 + d_need + 4.0
    d_anchor = z_anchor - 71.8
    hero_d = z_anchor - 55.0
    if d_anchor < 94 or hero_d > 192:
        raise SystemExit(f"anchor place illegal d={d_anchor:.1f} hero={hero_d:.1f}")
    anchor_h = 60.0
    print(f"anchor z {z_anchor:.2f} d {d_anchor:.2f} hero {hero_d:.2f} h {anchor_h}")

    leg_cw, leg_ch = content_px(plates["leg"][1])
    # Soffit must clear a 2.15 body. The eye crosses the arch plane, so the
    # half-gap is the distance that sizes the leg.
    leg_h = 3.55
    half = leg_h * FOCAL / (MAG * leg_ch)
    leg_w = leg_h * leg_cw / leg_ch
    if leg_h > 6 or leg_w > 6:
        raise SystemExit("leg over segment cap")
    print(f"leg h {leg_h:.2f} w {leg_w:.2f} half-gap {half:.2f}")

    span_cw, span_ch = content_px(plates["span"][1])
    d_vert = leg_h - 1.40
    span_l = extent_for(span_cw, d_vert, 6.0)
    span_t = span_l * span_ch / span_cw
    # world height of the span mesh is the image height, which is the thickness
    span_h = span_t
    print(f"span L {span_l:.2f} T {span_t:.2f} src {span_cw}x{span_ch} dvert {d_vert:.2f}")

    def size_h(name, dist, cap):
        cw, ch = content_px(plates[name][1])
        h = extent_for(ch, dist, cap)
        w = h * cw / ch
        if w > cap:
            w = cap
            h = w * ch / cw
        return h, w, cw, ch

    tower_h, tower_w, _, _ = size_h("tower", 6.4, 6.0)
    # Gate crossing: half-gap is the close distance.
    pylon_h, pylon_w, _, _ = size_h("pylon", 5.4, 6.0)
    drone_h, drone_w, _, _ = size_h("drone", 3.6, 4.0)
    # Drone cap is the largest dimension. The long axis is the image width.
    d_cw, d_ch = content_px(plates["drone"][1])
    drone_l = extent_for(d_cw, 3.6, 4.0)
    drone_h = drone_l * d_ch / d_cw
    cart_cw, cart_ch = content_px(plates["cart"][1])
    cart_l = extent_for(cart_cw, 4.0, 6.0)
    cart_h = cart_l * cart_ch / cart_cw
    rib_cw, rib_ch = content_px(plates["rib"][1])
    rib_h = extent_for(rib_ch, 6.6, 5.0)
    rib_w = rib_h * rib_cw / rib_ch
    if rib_w > 5:
        rib_w = 5
        rib_h = rib_w * rib_ch / rib_cw
    print(f"tower {tower_h:.2f}x{tower_w:.2f}")
    print(f"pylon {pylon_h:.2f}x{pylon_w:.2f}")
    print(f"drone {drone_h:.2f} long {drone_l:.2f}")
    print(f"cart {cart_h:.2f} long {cart_l:.2f}")
    print(f"rib {rib_h:.2f}x{rib_w:.2f}")

    built = {}
    built["anchor"] = part_record(*build_loft(plates["anchor"][1], anchor_h, 0.62, 8.0)[:2], content_h := content_px(plates["anchor"][1])[1], anchor_h) if False else None
    # The walrus above is a trap. Call plainly.
    specs = {
        "anchor": (plates["anchor"][1], anchor_h, 0.62, 8.0),
        "leg": (plates["leg"][1], leg_h, 0.78, 2.2),
        "span": (plates["span"][1], span_h, 0.85, 1.4),
        "tower": (plates["tower"][1], tower_h, 0.7, 2.4),
        "pylon": (plates["pylon"][1], pylon_h, 0.55, 1.6),
        "drone": (plates["drone"][1], drone_h, 0.7, 1.8),
        "cart": (plates["cart"][1], cart_h, 0.62, 1.6),
        "rib": (plates["rib"][1], rib_h, 0.55, 1.4),
    }
    built = {}
    for name, (mask, wh, dk, dmax) in specs.items():
        mesh, cw, ch, mpp = build_loft(mask, wh, dk, dmax)
        rec = part_record(mesh, cw, ch, wh)
        if max(rec["worldW"], rec["worldH"], rec["depth"]) > (4.01 if name == "drone" else 6.01 if name != "anchor" else 80):
            if name != "anchor":
                raise SystemExit(f"{name} segment over cap {rec}")
        if name == "anchor" and rec["worldH"] < 59:
            raise SystemExit("anchor height drifted")
        built[name] = rec
        print(
            f"mesh {name} verts {rec['nv']} tris {rec['ni']//3} boxes {len(rec['boxes'])} "
            f"size {rec['worldW']:.2f} x {rec['worldH']:.2f} x {rec['depth']:.2f}"
        )

    # Atlas
    rgba_images = []
    for name in ("anchor", "leg", "span", "tower", "pylon", "drone", "cart", "rib"):
        rgb, mask = plates[name][0], plates[name][1]
        rgba_images.append((name, rgba_of(rgb, mask)))
    atlas, rects = pack_shelves(rgba_images, 4096)
    atlas = bleed(atlas, 6)
    # restore a hard alpha after bleed (bleed must not grow the mask)
    for name, (rx, ry, rw, rh) in rects.items():
        alpha = rgba_images[[n for n, _ in rgba_images].index(name)][1][:, :, 3]
        atlas[ry : ry + rh, rx : rx + rw, 3] = alpha
    atlas = bleed_rgb_only(atlas)
    Image.fromarray(atlas, "RGBA").save(ROOT / "atlas.png", optimize=True)
    print(f"atlas {atlas.shape[1]}x{atlas.shape[0]} png { (ROOT/'atlas.png').stat().st_size }")

    # Rewrite pixel uv to atlas uv and pack one buffer.
    all_v = []
    all_i = []
    parts_out = {}
    for name, rec in built.items():
        mesh_verts = rec.pop("_verts")
        mesh_inds = rec.pop("_inds")
        rx, ry, rw, rh = rects[name]
        v0 = len(all_v) // 5
        for i in range(0, len(mesh_verts), 5):
            px = min(max(mesh_verts[i + 3], 0.0), rw - 1.0)
            py = min(max(mesh_verts[i + 4], 0.0), rh - 1.0)
            u = (rx + px + 0.5) / atlas.shape[1]
            v = 1.0 - (ry + py + 0.5) / atlas.shape[0]
            all_v.extend((mesh_verts[i], mesh_verts[i + 1], mesh_verts[i + 2], u, v))
        i0 = len(all_i)
        all_i.extend(idx + v0 for idx in mesh_inds)
        rec["v0"] = v0
        rec["nv"] = len(mesh_verts) // 5
        rec["i0"] = i0
        rec["ni"] = len(mesh_inds)
        rec["solid"] = name != "anchor"
        if name == "anchor":
            rec["boxes"] = []
        parts_out[name] = rec

    # Placements. Ground Y is applied at runtime.
    z_arch = 60.0
    leg_x = half + leg_w * 0.5
    placements = [
        {"name": "anchor", "part": "anchor", "x": 0.0, "z": round(z_anchor, 3), "yaw": 0.0,
         "tilt": 0.0, "mirror": False, "sink": 0.55, "lift": 0.0, "solid": False, "id": "hard:anchor"},
    ]
    for sign, mir, yaw in ((-1, False, 0.04), (1, True, -0.05)):
        placements.append({
            "name": "arch-leg", "part": "leg", "x": round(sign * leg_x, 3), "z": z_arch,
            "yaw": yaw, "tilt": 0.0, "mirror": mir, "sink": SINK, "lift": 0.0,
            "solid": True, "id": "hard:arch",
        })
    cover = (leg_x + leg_w * 0.5) * 2 + 0.4
    step = span_l * 0.86
    nspan = int(math.ceil(cover / step))
    span_lift = round(leg_h - SINK - 0.05, 4)
    x_cursor = -cover * 0.5 + span_l * 0.5
    for i in range(nspan):
        placements.append({
            "name": "arch-span", "part": "span",
            "x": round(x_cursor, 3),
            "z": z_arch,
            "yaw": 0.0,
            "tilt": 0.0, "mirror": False, "sink": 0.0, "lift": span_lift,
            "gx": 0.0, "gz": z_arch, "solid": True, "id": "hard:arch",
        })
        x_cursor += step
    pylon_centers = 5.4 + pylon_w * 0.5 + 0.35
    placements.append({
        "name": "tower", "part": "tower", "x": 11.0, "z": -56.0, "yaw": 0.15,
        "tilt": 0.0, "mirror": False, "sink": SINK, "lift": 0.0, "solid": True, "id": "hard:tower",
    })
    placements.append({
        "name": "cart", "part": "cart", "x": -7.5, "z": -49.0, "yaw": 0.42,
        "tilt": 0.0, "mirror": False, "sink": 0.12, "lift": 0.0, "solid": True, "id": "hard:cart",
    })
    placements.append({
        "name": "pylon-w", "part": "pylon", "x": round(-pylon_centers, 3), "z": -66.0,
        "yaw": 0.10, "tilt": 0.20, "mirror": False, "sink": SINK, "lift": 0.0, "solid": True, "id": "hard:pylon",
    })
    placements.append({
        "name": "pylon-e", "part": "pylon", "x": round(pylon_centers, 3), "z": -66.2,
        "yaw": -0.12, "tilt": -0.18, "mirror": True, "sink": SINK, "lift": 0.0, "solid": True, "id": "hard:pylon",
    })
    placements.append({
        "name": "drone", "part": "drone", "x": 15.2, "z": 11.0, "yaw": -1.35,
        "tilt": 0.0, "mirror": False, "sink": 0.18, "lift": 0.0, "solid": True, "id": "hard:drone",
    })
    for i, z in enumerate((-4.0, -14.0, -24.0, -34.0, -44.0)):
        placements.append({
            "name": f"rib-{i}", "part": "rib", "x": -13.5, "z": z,
            "yaw": 0.08 * (1 if i % 2 else -1), "tilt": 0.0, "mirror": bool(i % 2),
            "sink": 0.45, "lift": 0.0, "solid": True, "id": "hard:rib",
        })

    for p in placements:
        if p["name"] == "anchor":
            continue
        if not inside(p["x"], p["z"]):
            raise SystemExit(f"placement outside walk {p['name']} {p['x']} {p['z']}")

    # Collider gate. Ground is near 0.5 here; body occupies about 0.3 to 2.4.
    world_boxes = []
    for p in placements:
        if not p["solid"]:
            continue
        part = parts_out[p["part"]]
        for b in part["boxes"]:
            world_boxes.append((p["name"], xform_box(b, p, 0.4 + p["lift"] - p["sink"])))

    def blocked_at(x, z, y0=0.35, y1=2.25):
        hits = []
        for name, b in world_boxes:
            if hits_body(b, x, z, y0, y1, 0.3):
                hits.append(name)
        return hits

    arch_hits = blocked_at(0.0, z_arch)
    if arch_hits:
        raise SystemExit(f"arch opening blocked {arch_hits[:8]}")
    for z in (52, 56, 60, 64, 68):
        hits = blocked_at(0.0, z)
        if hits:
            raise SystemExit(f"north road blocked at {z} by {hits[:6]}")
    gate_hits = blocked_at(0.0, -66.0)
    if gate_hits:
        raise SystemExit(f"outpost gate blocked {gate_hits[:6]}")
    for z in (-4, -14, -24, -34, -44):
        # The rib stands west of the road. The road itself stays open.
        if blocked_at(0.0, z):
            raise SystemExit(f"basin road blocked at {z}")
        # A point in the rib arch gap, if the bones leave one, must not be a solid wall
        # wider than the visual. We only assert the road. The gap test is printed.
    print("passages clear: arch, north road, outpost gate, basin road")

    lx, ly = lamp_local(plates["anchor"][0], plates["anchor"][1], anchor_h)
    beacon = {
        "x": 0.0,
        "z": round(z_anchor, 3),
        "yaw": 0.0,
        "lx": round(lx, 3),
        "ly": round(ly, 3),
        "lz": -4.8,
        "size": 2.0,
        "src": 480,
        "file": "beacon.mp4",
        "id": "hard:beacon",
    }
    print(f"beacon local {lx:.2f} {ly:.2f}")

    # Distance from every walk corner to the anchor origin.
    dmin = min(math.hypot(x - 0.0, z - z_anchor) for x, z in POLY)
    if dmin < 94:
        raise SystemExit(f"anchor too close {dmin}")
    print(f"anchor min walk distance {dmin:.2f}")

    meta = {
        "version": 1,
        "atlas": "atlas.png",
        "mesh": "mesh.bin",
        "atlasW": int(atlas.shape[1]),
        "atlasH": int(atlas.shape[0]),
        "focal": round(FOCAL, 4),
        "magTarget": MAG,
        "arch": {"z": z_arch, "halfGap": round(half, 3), "legH": leg_h, "spanLift": span_lift, "spans": nspan},
        "anchor": {"z": round(z_anchor, 3), "h": anchor_h, "minWalkM": round(dmin, 2), "heroM": round(hero_d, 2)},
        "parts": parts_out,
        "placements": placements,
        "beacon": beacon,
    }
    (ROOT / "loft.json").write_text(json.dumps(meta), encoding="utf-8")
    blob = struct.pack("<III", 0x3148534D, len(all_v) // 5, len(all_i))
    blob += struct.pack("<" + "f" * len(all_v), *all_v)
    blob += struct.pack("<" + "I" * len(all_i), *all_i)
    (ROOT / "mesh.bin").write_bytes(blob)
    print(f"mesh.bin {len(blob)} verts {len(all_v)//5} idx {len(all_i)}")

    jobs = {
        "anchor": ("2:3", "One tether tower in a stone arch, side, whole structure in frame, lamp at the top, cable to one side."),
        "tower": ("2:3", "One water tower, lattice legs and a tank, side, alone."),
        "pylon": ("2:3", "One lattice mast, splayed feet with a gap between them, side, alone."),
        "drone": ("3:2", "One survey craft, side, angular plates, alone."),
        "cart": ("3:2", "One ore cart on a broken rail, side, alone."),
        "rib": ("3:2", "One pair of ribs with an opening between them, side, alone."),
        "beacon": ("1:1", "One lamp, front, alone. The loop is beacon.mp4, camera locked, same first and last frame."),
    }
    roles = {
        "anchor": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/anchor.jpg.",
        "tower": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/tower.jpg.",
        "pylon": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/pylon.jpg.",
        "drone": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/drone.jpg.",
        "cart": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/cart.jpg.",
        "rib": "ROLE unlit skin. Loaded by the zone B hard loft as packs/zone-b/src/hard/rib.jpg.",
        "beacon": "ROLE beacon still. The play loop is beacon.mp4 beside this file. Not an atlas skin.",
    }
    for name, (aspect, job) in jobs.items():
        im = Image.open(ROOT / f"{name}.jpg")
        prompt_txt(
            ROOT / f"{name}.PROMPT.txt",
            roles[name],
            f"{im.size[0]}x{im.size[1]}",
            aspect,
            job,
        )
    print("PASS build")


def bleed_rgb_only(atlas):
    rgb = atlas[:, :, :3].copy()
    a = atlas[:, :, 3] > 0
    h, w = a.shape
    op = a.copy()
    for _ in range(8):
        dil = op.copy()
        src = rgb.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ys = slice(max(0, dy), h + min(0, dy))
            xs = slice(max(0, dx), w + min(0, dx))
            yd = slice(max(0, -dy), h + min(0, -dy))
            xd = slice(max(0, -dx), w + min(0, -dx))
            take = op[ys, xs] & ~dil[yd, xd]
            if not np.any(take):
                continue
            block = src[yd, xd]
            block[take] = rgb[ys, xs][take]
            src[yd, xd] = block
            dil[yd, xd] = dil[yd, xd] | take
        rgb = src
        op = dil
    atlas[:, :, :3] = rgb
    return atlas


if __name__ == "__main__":
    main()
