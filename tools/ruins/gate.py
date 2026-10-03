"""Loft the zone gate from the front elevation. Depth follows each section profile."""

import cv2
import numpy as np

from geom import Mesh, content_box, enclosed_holes, plate_mask, width_profile


def side_depth_ratio(path):
    from geom import load_rgb

    _w, _h, lum, _ = load_rgb(path)
    stone, _, _ = plate_mask(lum)
    x0, y0, x1, y1 = content_box(stone)
    return (x1 - x0 + 1) / max(1, y1 - y0 + 1), (x0, y0, x1, y1)


def build_gate(inbox, numbers):
    from geom import load_rgb

    front = inbox / "front.jpg"
    side = inbox / "side.jpg"
    w, h, lum, _ = load_rgb(front)
    stone, origin, thr = plate_mask(lum)
    # Voids between the jambs, including a walk opening that meets the ground
    # (that one is not an enclosed hole, because the border shows through it).
    between = np.zeros(stone.shape, dtype=bool)
    for y in range(stone.shape[0]):
        xs = np.flatnonzero(stone[y])
        if xs.size < 2:
            continue
        left = int(xs[0])
        right = int(xs[-1])
        span = ~stone[y, left:right]
        if span.any():
            between[y, left:right] = span
    voids = enclosed_holes(stone, min_area=800)
    hole = between.copy()
    for _area, extra in voids:
        hole = hole | extra
    # Keep only large void components so a hairline crack is not a doorway.
    nlab, labels, stats, _ = cv2.connectedComponentsWithStats(hole.astype(np.uint8), 4)
    arch = None
    arch_tall = 0
    hole = np.zeros(stone.shape, dtype=bool)
    void_n = 0
    for lab in range(1, nlab):
        area = int(stats[lab, cv2.CC_STAT_AREA])
        if area < 800:
            continue
        comp = labels == lab
        hole = hole | comp
        void_n += 1
        box = content_box(comp)
        tall = box[3] - box[1]
        if tall > arch_tall:
            arch_tall = tall
            arch = comp
    if arch is None:
        raise SystemExit("gate: no opening between the jambs")
    x0, y0, x1, y1 = content_box(stone)
    hx0, hy0, hx1, hy1 = content_box(arch)
    content_h = y1 - y0 + 1
    content_w = x1 - x0 + 1
    height_m = float(numbers["gate"]["heightM"])
    m_per_px = height_m / content_h
    depth_ratio, side_box = side_depth_ratio(side)
    depth_m = height_m * depth_ratio
    prof_l, box_l = width_profile(inbox / "sec-pier-l.jpg")
    prof_r, box_r = width_profile(inbox / "sec-pier-r.jpg")
    prof_t, box_t = width_profile(inbox / "sec-lintel.jpg")
    if float(np.mean(np.abs(prof_l - prof_r))) < 0.03:
        raise SystemExit("gate: pier sections look mirrored")

    step = int(numbers["gate"].get("gridStepPx", 4))
    cx = (x0 + x1) * 0.5
    gh = max(1, (y1 - y0) // step)
    gw = max(1, (x1 - x0) // step)
    sub_s = stone[y0 : y0 + gh * step, x0 : x0 + gw * step]
    sub_h = hole[y0 : y0 + gh * step, x0 : x0 + gw * step]
    solid_frac = sub_s.reshape(gh, step, gw, step).mean(axis=(1, 3))
    hole_frac = sub_h.reshape(gh, step, gw, step).mean(axis=(1, 3))
    solid = (solid_frac > 0.35) & (hole_frac < 0.5)

    def depth_at(px, py):
        if py <= hy0 and hx0 <= px <= hx1:
            t = (px - x0) / max(1, x1 - x0)
            p = prof_t[min(len(prof_t) - 1, int(t * len(prof_t)))]
            return depth_m * (0.55 + 0.45 * float(p))
        if px < (hx0 + hx1) * 0.5:
            t = (y1 - py) / max(1, y1 - y0)
            p = prof_l[min(len(prof_l) - 1, int(t * len(prof_l)))]
            return depth_m * (0.55 + 0.45 * float(p))
        t = (y1 - py) / max(1, y1 - y0)
        p = prof_r[min(len(prof_r) - 1, int(t * len(prof_r)))]
        return depth_m * (0.55 + 0.45 * float(p))

    def world(px, py, z):
        return ((px - cx) * m_per_px, (y1 - py) * m_per_px, z)

    def uv_front(px, py):
        return px / max(1, w - 1), 1.0 - py / max(1, h - 1)

    sw, sh, slum, _ = load_rgb(side)
    sstone, _, _ = plate_mask(slum)
    sx0, sy0, sx1, sy1 = content_box(sstone)

    def uv_side(z, depth, py):
        u = (sx0 + (z / max(depth, 1e-4)) * (sx1 - sx0)) / max(1, sw - 1)
        frac = (y1 - py) / max(1, y1 - y0)
        img_y = sy0 + (1.0 - frac) * (sy1 - sy0)
        v = 1.0 - img_y / max(1, sh - 1)
        return float(u), float(v)

    front_m = Mesh(0)
    side_m = Mesh(1)
    cells = {}
    for iy in range(gh):
        for ix in range(gw):
            if not solid[iy, ix]:
                continue
            px = x0 + ix * step
            py = y0 + iy * step
            px2 = px + step
            py2 = py + step
            depth = depth_at((px + px2) * 0.5, (py + py2) * 0.5)
            cells[(ix, iy)] = (px, py, px2, py2, depth)

    for (ix, iy), (px, py, px2, py2, depth) in cells.items():
        c00 = world(px, py, 0.0)
        c10 = world(px2, py, 0.0)
        c11 = world(px2, py2, 0.0)
        c01 = world(px, py2, 0.0)
        u00, v00 = uv_front(px, py)
        u10, v10 = uv_front(px2, py)
        u11, v11 = uv_front(px2, py2)
        u01, v01 = uv_front(px, py2)
        front_m.quad((
            (*c00, u00, v00),
            (*c10, u10, v10),
            (*c11, u11, v11),
            (*c01, u01, v01),
        ))
        b00 = world(px, py, -depth)
        b10 = world(px2, py, -depth)
        b11 = world(px2, py2, -depth)
        b01 = world(px, py2, -depth)
        front_m.quad((
            (*b10, u10, v10),
            (*b00, u00, v00),
            (*b01, u01, v01),
            (*b11, u11, v11),
        ))
        seams = (
            ((ix - 1, iy), px, py, px, py2),
            ((ix + 1, iy), px2, py, px2, py2),
            ((ix, iy - 1), px, py, px2, py),
            ((ix, iy + 1), px, py2, px2, py2),
        )
        for nkey, ax, ay, bx, by in seams:
            if nkey in cells:
                continue
            p0 = world(ax, ay, 0.0)
            p1 = world(bx, by, 0.0)
            p2 = world(bx, by, -depth)
            p3 = world(ax, ay, -depth)
            s0 = uv_side(0.0, depth, ay)
            s1 = uv_side(0.0, depth, by)
            s2 = uv_side(depth, depth, by)
            s3 = uv_side(depth, depth, ay)
            side_m.quad((
                (*p0, *s0),
                (*p1, *s1),
                (*p2, *s2),
                (*p3, *s3),
            ))

    def span(pred):
        xs, ys, ds = [], [], []
        for (ix, iy), (px, py, px2, py2, depth) in cells.items():
            if pred(px, py, px2, py2):
                xs.extend((px, px2))
                ys.extend((py, py2))
                ds.append(depth)
        if not xs:
            return None
        ax, bx = min(xs), max(xs)
        ay, by = min(ys), max(ys)
        x_a, y_a, _ = world(ax, ay, 0)
        x_b, y_b, _ = world(bx, by, 0)
        depth = float(np.median(ds))
        return {
            "cx": (x_a + x_b) * 0.5,
            "cy": (y_a + y_b) * 0.5,
            "cz": -0.5 * depth,
            "hx": abs(x_b - x_a) * 0.5,
            "hy": abs(y_b - y_a) * 0.5,
            "hz": depth * 0.5,
        }

    # Arch is the largest hole. Piers stop at its sides. The lintel is the stone above it.
    left = span(lambda px, py, px2, py2: px2 <= hx0 + step)
    right = span(lambda px, py, px2, py2: px >= hx1 - step)
    lintel = span(lambda px, py, px2, py2: py2 <= hy0 + step)
    colliders = []
    for name, box in (("pier-l", left), ("pier-r", right), ("lintel", lintel)):
        if not box:
            continue
        box["name"] = name
        colliders.append(box)

    ox, oy, _ = world((hx0 + hx1) * 0.5, (hy0 + hy1) * 0.5, 0)
    parts = [
        {
            "id": "pier-l",
            "measure": "front.jpg",
            "spot": [int(x0), int(hy0), int(hx0), int(y1)],
            "section": "sec-pier-l.jpg",
            "sectionBox": list(map(int, box_l)),
            "skin": "front.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "left jamb of the one loft; section scales thickness only",
        },
        {
            "id": "pier-r",
            "measure": "front.jpg",
            "spot": [int(hx1), int(hy0), int(x1), int(y1)],
            "section": "sec-pier-r.jpg",
            "sectionBox": list(map(int, box_r)),
            "skin": "front.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "right jamb, different section, not a mirrored copy",
        },
        {
            "id": "lintel",
            "measure": "front.jpg",
            "spot": [int(x0), int(y0), int(x1), int(hy0)],
            "section": "sec-lintel.jpg",
            "sectionBox": list(map(int, box_t)),
            "skin": "front.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "stone above the opening; section profile scales thickness",
        },
        {
            "id": "opening",
            "measure": "front.jpg",
            "spot": [int(hx0), int(hy0), int(hx1), int(hy1)],
            "section": None,
            "skin": None,
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "largest enclosed void; no faces on those cells and no collider",
        },
        {
            "id": "ring-motif",
            "measure": "front.jpg",
            "spot": [int(hx0), int(hy0), int(hx1), int(hy1)],
            "section": None,
            "skin": "front.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "carved in the skin, not a second volume",
        },
    ]
    # Bounds in local metres.
    xs, ys, zs = [], [], []
    for mesh in (front_m, side_m):
        arr = mesh.xyzuv
        for i in range(0, len(arr), 5):
            xs.append(arr[i])
            ys.append(arr[i + 1])
            zs.append(arr[i + 2])
    min_d = numbers["focalPx"] * height_m / max(1, content_h)
    report = {
        "threshold": round(thr, 2),
        "frontBox": [int(x0), int(y0), int(x1), int(y1)],
        "holeBox": [int(hx0), int(hy0), int(hx1), int(hy1)],
        "holeCount": int(void_n),
        "origin": [int(origin[0]), int(origin[1])],
        "contentH": int(content_h),
        "contentW": int(content_w),
        "heightM": height_m,
        "widthM": round(content_w * m_per_px, 3),
        "depthM": round(depth_m, 3),
        "sideBox": list(map(int, side_box)),
        "texelsPerM": round(1.0 / m_per_px, 2),
        "minApproachM": round(min_d, 3),
        "openingLocal": [round(ox, 3), round(oy, 3)],
        "quadsFront": len(front_m.idx) // 6,
        "quadsSide": len(side_m.idx) // 6,
        "bounds": {
            "min": [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)],
            "max": [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
        },
        "pierProfileMae": round(float(np.mean(np.abs(prof_l - prof_r))), 4),
        "openingClear": True,
    }
    # Opening centre must not sit on a solid cell.
    ocx = int((hx0 + hx1) * 0.5)
    ocy = int((hy0 + hy1) * 0.5)
    ix = (ocx - x0) // step
    iy = (ocy - y0) // step
    if (ix, iy) in cells:
        report["openingClear"] = False
    return [front_m, side_m], colliders, parts, report
