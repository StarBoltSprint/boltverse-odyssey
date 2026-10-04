"""Loft the zone gate from the front elevation. Depth follows each section profile.

The front skin keeps the elevation. Thickness faces use the surface plate when
one is in the inbox, packed into the same atlas (no scale-up).
"""

import cv2
import numpy as np

from geom import Mesh, content_box, plate_mask, width_profile


def side_depth_ratio(path):
    from geom import load_rgb

    _w, _h, lum, _ = load_rgb(path)
    stone, _, _ = plate_mask(lum)
    x0, y0, x1, y1 = content_box(stone)
    return (x1 - x0 + 1) / max(1, y1 - y0 + 1), (x0, y0, x1, y1)


def gateway_stone(lum):
    """Union the large components. A hairline seam must not drop a slab."""
    border = np.concatenate([lum[0, :], lum[-1, :], lum[:, 0], lum[:, -1]])
    base = float(np.median(border))
    thr = max(16.0, base + 18.0)
    bw = (lum > thr).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(bw, 4)
    areas = []
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area >= 800:
            areas.append((area, i))
    areas.sort(reverse=True)
    if not areas:
        raise SystemExit("gate: no stone")
    top = areas[0][0]
    stone = np.zeros(lum.shape, dtype=bool)
    origin = (0, 0)
    joined = 0
    for area, i in areas:
        if area < top * 0.25:
            break
        stone |= labels == i
        joined += 1
        if area == top:
            ys, xs = np.where(labels == i)
            origin = (int(xs[0]), int(ys[0]))
    return stone, origin, thr, joined


def build_gate(inbox, numbers):
    from geom import load_rgb

    front = inbox / "front.jpg"
    side = inbox / "side.jpg"
    detail_path = inbox / "detail.jpg"
    w, h, lum, _ = load_rgb(front)
    stone, origin, thr, joined = gateway_stone(lum)
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
    nlab, labels, stats, _ = cv2.connectedComponentsWithStats(between.astype(np.uint8), 4)
    holes = []
    for lab in range(1, nlab):
        area = int(stats[lab, cv2.CC_STAT_AREA])
        if area < 800:
            continue
        comp = labels == lab
        box = content_box(comp)
        holes.append((box[3] - box[1], area, comp, box))
    if not holes:
        raise SystemExit("gate: no opening between the jambs")
    holes.sort(reverse=True)
    _tall, _area, arch, (hx0, hy0, hx1, hy1) = holes[0]
    hole = np.zeros(stone.shape, dtype=bool)
    for _t, _a, comp, _b in holes:
        hole |= comp
    x0, y0, x1, y1 = content_box(stone)
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

    step = int(numbers["gate"].get("gridStepPx", 5))
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

    has_detail = detail_path.is_file()
    if has_detail:
        dw, dh, _, _ = load_rgb(detail_path)
    else:
        dw, dh = w, h
    atlas_w = float(w + (dw if has_detail else 0))
    if not has_detail:
        atlas_w = float(w)

    def uv_front(px, py):
        u = (px / max(1, w - 1)) * (w / atlas_w)
        v = 1.0 - py / max(1, h - 1)
        return u, v

    tile_t = (float(dh) / max(depth_m, 0.3)) if has_detail else (float(h) / max(depth_m, 0.3))
    tile_m = (float(dw) / tile_t) if has_detail else (float(w) / tile_t)
    u_off = (w / atlas_w) if has_detail else 0.0
    u_scale = ((dw / atlas_w) if has_detail else 1.0)

    def uv_face(mode, x_m, y_m, z_m):
        if mode == "x":
            across = x_m
        else:
            across = y_m
        span = across % tile_m
        if span < 0:
            span += tile_m
        u_img = span / max(tile_m, 1e-4)
        v_img = max(0.0, min(1.0, -z_m / max(depth_m, 1e-4)))
        return u_off + u_scale * u_img, v_img

    mesh = Mesh(0)
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
        mesh.quad((
            (*c00, u00, v00),
            (*c10, u10, v10),
            (*c11, u11, v11),
            (*c01, u01, v01),
        ))
        b00 = world(px, py, -depth)
        b10 = world(px2, py, -depth)
        b11 = world(px2, py2, -depth)
        b01 = world(px, py2, -depth)
        mesh.quad((
            (*b10, u10, v10),
            (*b00, u00, v00),
            (*b01, u01, v01),
            (*b11, u11, v11),
        ))
        seams = (
            ((ix - 1, iy), px, py, px, py2, "y"),
            ((ix + 1, iy), px2, py, px2, py2, "y"),
            ((ix, iy - 1), px, py, px2, py, "x"),
            ((ix, iy + 1), px, py2, px2, py2, "x"),
        )
        for nkey, ax, ay, bx, by, mode in seams:
            if nkey in cells:
                continue
            p0 = world(ax, ay, 0.0)
            p1 = world(bx, by, 0.0)
            p2 = world(bx, by, -depth)
            p3 = world(ax, ay, -depth)
            s0 = uv_face(mode, p0[0], p0[1], 0.0)
            s1 = uv_face(mode, p1[0], p1[1], 0.0)
            s2 = uv_face(mode, p2[0], p2[1], -depth)
            s3 = uv_face(mode, p3[0], p3[1], -depth)
            mesh.quad((
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

    left = span(lambda px, py, px2, py2: px2 <= hx0 + step)
    right = span(lambda px, py, px2, py2: px >= hx1 - step)
    lintel = span(lambda px, py, px2, py2: py2 <= hy0 + step)
    ox, oy, _ = world((hx0 + hx1) * 0.5, (hy0 + hy1) * 0.5, 0)
    # Clear width is the median run through the middle of the tall void.
    widths = []
    for y in range(hy0 + (hy1 - hy0) // 5, hy1 - (hy1 - hy0) // 5):
        xs = np.flatnonzero(arch[y])
        if xs.size:
            widths.append(int(xs[-1] - xs[0] + 1))
    clear_px = int(np.median(widths)) if widths else (hx1 - hx0)
    opening_w = clear_px * m_per_px
    opening_h = (hy1 - hy0 + 1) * m_per_px
    ring_box = None
    for _t, _a, _c, box in holes[1:]:
        ring_box = [int(v) for v in box]
        break
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
            "note": "slab above the opening; section profile scales thickness",
        },
        {
            "id": "opening",
            "measure": "front.jpg",
            "spot": [int(hx0), int(hy0), int(hx1), int(hy1)],
            "section": None,
            "skin": None,
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "tall void; no faces on those cells",
        },
        {
            "id": "ring-motif",
            "measure": "front.jpg",
            "spot": ring_box or [int(hx0), int(hy0), int(hx1), int(hy0)],
            "section": None,
            "skin": "front.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "painted on the elevation, not a second volume",
        },
        {
            "id": "passage-wall",
            "measure": "detail.jpg" if has_detail else "side.jpg",
            "spot": [0, 0, int(dw if has_detail else w), int(dh if has_detail else h)],
            "section": None,
            "skin": "detail.jpg" if has_detail else "side.jpg",
            "erasedFrom": None,
            "inpaintCall": None,
            "note": "skin of the thickness faces of the same loft, not a second solid",
        },
    ]
    xs, ys, zs = [], [], []
    arr = mesh.xyzuv
    for i in range(0, len(arr), 5):
        xs.append(arr[i])
        ys.append(arr[i + 1])
        zs.append(arr[i + 2])
    front_t = 1.0 / m_per_px
    near_t = tile_t
    min_d = numbers["focalPx"] / max(front_t, 1e-6)
    report = {
        "threshold": round(thr, 2),
        "joinedComponents": int(joined),
        "frontBox": [int(x0), int(y0), int(x1), int(y1)],
        "holeBox": [int(hx0), int(hy0), int(hx1), int(hy1)],
        "holeCount": int(len(holes)),
        "origin": [int(origin[0]), int(origin[1])],
        "contentH": int(content_h),
        "contentW": int(content_w),
        "heightM": height_m,
        "widthM": round(content_w * m_per_px, 3),
        "depthM": round(depth_m, 3),
        "openingWidthM": round(opening_w, 3),
        "openingHeightM": round(opening_h, 3),
        "sideBox": list(map(int, side_box)),
        "texelsPerM": round(front_t, 2),
        "nearTexelsPerM": round(near_t, 2),
        "nearTileM": round(tile_m, 3),
        "minApproachM": round(min_d, 3),
        "nearApproachM": round(numbers["focalPx"] / max(near_t, 1e-6), 3),
        "openingLocal": [round(ox, 3), round(oy, 3), round(-0.5 * depth_m, 3)],
        # Opening in local metres: x left, x right, sill y, top y. Colliders keep it walkable.
        "openingBoxM": [
            round((hx0 - cx) * m_per_px, 3),
            round((hx1 - cx) * m_per_px, 3),
            round((y1 - hy1) * m_per_px, 3),
            round((y1 - hy0) * m_per_px, 3),
        ],
        "quads": len(mesh.idx) // 6,
        "bounds": {
            "min": [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)],
            "max": [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
        },
        "pierProfileMae": round(float(np.mean(np.abs(prof_l - prof_r))), 4),
        "openingClear": True,
        "atlas": {
            "frontU": [0.0, round(w / atlas_w, 4)],
            "nearU": [round(w / atlas_w, 4), 1.0] if has_detail else [0.0, 1.0],
            "frontTexels": round(front_t, 2),
            "nearTexels": round(near_t, 2),
        },
        "detailPlate": has_detail,
        "spans": {"pier-l": left, "pier-r": right, "lintel": lintel},
    }
    ocx = int((hx0 + hx1) * 0.5)
    ocy = int((hy0 + hy1) * 0.5)
    ix = (ocx - x0) // step
    iy = (ocy - y0) // step
    if (ix, iy) in cells:
        report["openingClear"] = False
    if opening_w < 6.0:
        raise SystemExit("gate opening is under 6 m: " + str(round(opening_w, 2)))
    return [mesh], parts, report
