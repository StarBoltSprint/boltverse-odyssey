"""Geometry kernel for the vision stage. Driven by vision/tower.json.

Local frame (buffer space, axis-aligned so object-gate relief/crispness read the planes):
  +X width, +Y up, +Z toward the key camera. Front skin at z=0. Depth extrudes to -Z.
The runtime applies the basis (right, up, toward-camera) and the plane origin. Buffer
normals stay on the axes. A camera-facing diagonal in world space is still crisp here.
"""
import json, os
import numpy as np

KEY = "/workspace/zb-bible-1008/key-city3.jpg"
MASK = "/workspace/proj-1010/out/mask.png"
KEYCAM = "/workspace/proj-1010/keycam.json"
RECT = (398, 27, 561, 446)  # metrics.py expansion of the tower crop


def cam_mats(path=KEYCAM):
    """keycam mw is the camera world matrix (Three.js, column-major), not the view matrix."""
    kc = json.load(open(path))
    MW = np.array(kc["mw"], np.float64).reshape(4, 4).T
    PM = np.array(kc["pm"], np.float64).reshape(4, 4).T
    return kc, MW, PM


def project(world, MW, PM, wh=(1280, 720)):
    w, h = wh
    p = np.atleast_2d(np.asarray(world, np.float64))
    view = np.linalg.inv(MW)
    ph = np.concatenate([p, np.ones((len(p), 1))], 1)
    cam = (view @ ph.T).T
    z = -cam[:, 2]
    ndc_x = PM[0, 0] * (cam[:, 0] / z)
    ndc_y = PM[1, 1] * (cam[:, 1] / z)
    px = (ndc_x + 1) * 0.5 * w
    py = (1 - ndc_y) * 0.5 * h
    return px, py, z


def unproject_ray(px, py, MW, PM, wh=(1280, 720)):
    """Ray origin = camera position. Direction from the same decomposition project() inverts."""
    w, h = wh
    x = (px + 0.0) / w * 2 - 1
    y = 1 - (py + 0.0) / h * 2
    d = MW[:3, :3] @ np.array([x / PM[0, 0], y / PM[1, 1], -1.0])
    d = d / np.linalg.norm(d)
    return MW[:3, 3].copy(), d


def _contour(mask_path=MASK, eps_frac=0.002):
    import cv2
    m = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    ys, xs = np.where(m > 0)
    # component inside the metrics rect
    x0, y0, x1, y1 = RECT
    sel = (xs >= x0) & (xs < x1) & (ys >= y0) & (ys < y1)
    sub = np.zeros_like(m)
    sub[ys[sel], xs[sel]] = 255
    cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    eps = float(eps_frac) * cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, eps, True).reshape(-1, 2)
    return m, approx.astype(np.float64)


def derive_plane(mask_path=MASK, keycam=KEYCAM, eps_frac=0.002):
    """Front plane: through the mask's base-centre ray at y=base_y, normal toward the camera."""
    kc, MW, PM = cam_mats(keycam)
    m, poly = _contour(mask_path, eps_frac)
    # base = the two lowest (largest py) contour verts; centre between them
    order = np.argsort(poly[:, 1])
    base = poly[order[-2:]]
    bcx, bcy = base[:, 0].mean(), base[:, 1].mean()
    o, d = unproject_ray(bcx, bcy, MW, PM)
    # hit y = 20.2 (visual base from the camera-v2 fit). Plane is vertical.
    if abs(d[1]) < 1e-9:
        raise RuntimeError("base ray is horizontal")
    t = (20.2 - o[1]) / d[1]
    origin = o + d * t
    cam = np.array(kc["pos"], np.float64)
    toward = cam - origin
    toward[1] = 0.0
    toward /= np.linalg.norm(toward)
    up = np.array([0.0, 1.0, 0.0])
    right = np.cross(up, toward)
    right /= np.linalg.norm(right)
    # local XY of every contour vertex
    loc = []
    for px, py in poly:
        o2, d2 = unproject_ray(float(px), float(py), MW, PM)
        # intersect plane (origin, normal=toward). toward points at camera, plane faces camera.
        den = np.dot(d2, toward)
        tt = np.dot(origin - o2, toward) / den
        hit = o2 + d2 * tt
        rel = hit - origin
        loc.append([float(np.dot(rel, right)), float(np.dot(rel, up)), float(hit[1])])
    loc = np.array(loc, np.float64)
    # centre X in the local frame and move the origin with it, so the projection stays put
    shift = float(loc[:, 0].mean())
    origin = origin + shift * right
    loc[:, 0] -= shift
    return dict(origin=origin.tolist(), right=right.tolist(), up=up.tolist(), toward=toward.tolist(),
                poly_px=poly.tolist(), local_xy=loc[:, :2].tolist(), world_y=loc[:, 2].tolist(),
                width_m=float(loc[:, 0].max() - loc[:, 0].min()),
                height_m=float(loc[:, 1].max() - loc[:, 1].min()),
                base_y=float(min(loc[:, 2])), top_y=float(max(loc[:, 2])))


def polygon_iou(local_xy, origin, right, up, toward, MW, PM, mask):
    """Raster the front polygon (z=0) and score it against the mask inside RECT."""
    import cv2
    xy = np.asarray(local_xy, np.float64)
    world = (np.array(origin) + xy[:, 0:1] * np.array(right) + xy[:, 1:2] * np.array(up))
    px, py, _ = project(world, MW, PM)
    W, H = 1280, 720
    canvas = np.zeros((H, W), np.uint8)
    pts = np.round(np.stack([px, py], 1)).astype(np.int32)
    cv2.fillConvexPoly(canvas, pts, 255) if len(pts) <= 8 and _convex(pts) else cv2.fillPoly(canvas, [pts], 255)
    x0, y0, x1, y1 = RECT
    a = canvas[y0:y1, x0:x1] > 0
    b = mask[y0:y1, x0:x1] > 0
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / max(1, int(union)), canvas


def _convex(pts):
    if len(pts) < 3:
        return False
    s = 0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i] - pts[(i - 1) % n]
        x2, y2 = pts[(i + 1) % n] - pts[i]
        s += np.sign(x1 * y2 - y1 * x2)
    return abs(s) == n


def _ear_clip(poly):
    """Triangulate a simple polygon (CCW or CW). Returns list of (i,j,k)."""
    idx = list(range(len(poly)))
    p = np.asarray(poly, np.float64)
    def area(a, b, c):
        return (p[b, 0] - p[a, 0]) * (p[c, 1] - p[a, 1]) - (p[c, 0] - p[a, 0]) * (p[b, 1] - p[a, 1])
    def inside(a, b, c, q):
        s1, s2, s3 = area(a, b, q), area(b, c, q), area(c, a, q)
        return (s1 >= -1e-9 and s2 >= -1e-9 and s3 >= -1e-9) or (s1 <= 1e-9 and s2 <= 1e-9 and s3 <= 1e-9)
    tris = []
    guard = 0
    while len(idx) > 3 and guard < 5000:
        guard += 1
        n = len(idx)
        clipped = False
        for i in range(n):
            a, b, c = idx[(i - 1) % n], idx[i], idx[(i + 1) % n]
            if area(a, b, c) <= 1e-8:
                continue
            if any(inside(a, b, c, idx[j]) for j in range(n) if idx[j] not in (a, b, c)):
                continue
            tris.append((a, b, c))
            del idx[i]
            clipped = True
            break
        if not clipped:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def _box(vmin, vmax):
    """Closed box, shrunk 1 cm so neighbours do not weld into a non-manifold edge."""
    vmin = np.array(vmin, np.float64) + 0.01
    vmax = np.array(vmax, np.float64) - 0.01
    if np.any(vmax <= vmin):
        return np.zeros((0, 3)), np.zeros((0, 3), np.int32)
    x0, y0, z0 = vmin
    x1, y1, z1 = vmax
    v = np.array([
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ], np.float64)
    f = np.array([
        [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7],
        [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5],
        [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
    ], np.int32)
    return v, f


def _append(parts, v, f, mat):
    if len(v) == 0 or len(f) == 0:
        return
    parts.append((v, f, mat))


def _pip(x, y, poly):
    c = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0 + 1e-15) + x0:
            c = not c
    return c


def _signed_area(p):
    s = 0.0
    for i in range(len(p)):
        x0, y0 = p[i]
        x1, y1 = p[(i + 1) % len(p)]
        s += x0 * y1 - x1 * y0
    return s * 0.5


def _with_hole(outer, hole):
    """One simple polygon: outer ring plus a rectangular hole, joined by a seam."""
    o = np.asarray(outer, np.float64)
    h = np.asarray(hole, np.float64)
    if _signed_area(o) < 0:
        o = o[::-1]
    if _signed_area(h) > 0:
        h = h[::-1]
    d = ((o[:, None, 0] - h[None, :, 0]) ** 2 + (o[:, None, 1] - h[None, :, 1]) ** 2)
    i, j = np.unravel_index(np.argmin(d), d.shape)
    ring = np.concatenate([o[:i + 1], h[j:], h[:j + 1], o[i:]], 0)
    return ring


def build_mesh(doc, extras=True, parts_on=None):
    """Semantic JSON → disjoint sealed shells (one vertex buffer).

    mat: 0 body, 1 chrome, 2 sand, 3 rust (damage back wall).
    """
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    depth = float(doc["size"]["depth_m"])
    mullion = float(doc["panels"]["mullionDepth_m"])
    sink = float(doc["sand"]["sinkBelowBase_m"])
    y0 = float(xy[:, 1].min())
    y1 = float(xy[:, 1].max())
    x0 = float(xy[:, 0].min())
    x1 = float(xy[:, 0].max())
    # Sealed prism. The damage cavity is cut in Blender (boolean) from this shell.
    parts = []
    tris = _ear_clip(xy)
    if len(tris) < len(xy) - 2:
        raise RuntimeError(f"ear clip failed: {len(tris)} tris for {len(xy)} verts")
    n = len(xy)
    front_v = np.concatenate([xy, np.zeros((n, 1))], 1)
    back_v = front_v.copy(); back_v[:, 2] = -depth
    pv = np.concatenate([front_v, back_v], 0)
    pf = []
    for a, b, c in tris:
        pf.append([a, b, c])
        pf.append([n + c, n + b, n + a])
    for i in range(n):
        j = (i + 1) % n
        pf.append([i, j, n + j])
        pf.append([i, n + j, n + i])
    _append(parts, pv, np.array(pf, np.int32), 0)
    dmg = doc["damage"]["holes"][0]
    du0 = x0 + float(dmg["u0"]) * (x1 - x0)
    du1 = x0 + float(dmg["u1"]) * (x1 - x0)
    dv0 = y0 + float(dmg["v0"]) * (y1 - y0)
    dv1 = y0 + float(dmg["v1"]) * (y1 - y0)
    meta = dict(x=[float(x0), float(x1)], y=[float(y0), float(y1)], depth=depth, sink=sink, mullion=mullion)
    if not extras:
        return _merge(parts), meta
    on = parts_on or {}
    def want(name):
        return on.get(name, True)
    # --- proud mullion grid on the front, inset from the silhouette ---
    bay_w = float(doc["panels"]["bayWidth_m"])
    floor_h = float(doc["panels"]["floorHeight_m"])
    inset = 1.8
    # vertical strips and horizontal bands, same proud depth (one extra plane)
    z_proud = mullion
    # skip the damage window so the recess stays readable
    dmg = doc["damage"]["holes"][0]
    du0 = x0 + dmg["u0"] * (x1 - x0)
    du1 = x0 + dmg["u1"] * (x1 - x0)
    dv0 = y0 + dmg["v0"] * (y1 - y0)
    dv1 = y0 + dmg["v1"] * (y1 - y0)

    def overlaps_hole(xa, xb, ya, yb):
        return not (xb < du0 or xa > du1 or yb < dv0 or ya > dv1)

    def x_at(y):
        xs = []
        for i in range(len(xy)):
            ax, ay = xy[i]; bx, by = xy[(i + 1) % len(xy)]
            if (ay > y) == (by > y):
                continue
            xs.append(ax + (bx - ax) * (y - ay) / (by - ay + 1e-15))
        if len(xs) < 2:
            return None
        return min(xs), max(xs)

    def inside_box(xa, xb, ya, yb, margin=0.35):
        for y in (ya, (ya + yb) * 0.5, yb):
            sp = x_at(y)
            if sp is None or xa < sp[0] + margin or xb > sp[1] - margin:
                return False
        return True

    # vertical mullions, clipped to the silhouette
    x = x0 + inset
    while x < x1 - inset:
        xa, xb = x, min(x + 0.28, x1 - inset)
        # sample a few y spans so a mullion follows the taper instead of one full-height box
        y = y0 + inset
        while y < y1 - inset:
            yb = min(y + floor_h * 0.5, y1 - inset)
            if inside_box(xa, xb, y, yb) and not overlaps_hole(xa, xb, y, yb):
                _append(parts, *_box([xa, y, 0.0], [xb, yb, z_proud]), 0)
            y = yb
        x += bay_w
    # horizontal chrome floor bands, clipped per row
    y = y0 + floor_h
    band = float(doc["chrome"]["floorBandWidth_m"])
    while y < y1 - inset:
        sp = x_at(y + band * 0.5)
        if sp and not overlaps_hole(sp[0] + 0.8, sp[1] - 0.8, y, y + band):
            _append(parts, *_box([sp[0] + 0.8, y, 0.0], [sp[1] - 0.8, y + band, z_proud]), 1)
        y += floor_h
    # right-edge chrome, clipped
    cw = float(doc["chrome"]["edgeWidth_m"])
    y = y0 + 2.0
    while y < y1 - 2.0:
        yb = min(y + 6.0, y1 - 2.0)
        sp = x_at((y + yb) * 0.5)
        if sp:
            xa, xb = sp[1] - 0.7 - cw, sp[1] - 0.7
            if inside_box(xa, xb, y, yb, 0.2):
                _append(parts, *_box([xa, y, 0.0], [xb, yb, z_proud]), 1)
        y = yb
    # inward side steps (second ±X plane) kept inside the prism
    y = y0 + 3.0
    while y < y1 - 3.0:
        yb = min(y + 8.0, y1 - 3.0)
        sp = x_at((y + yb) * 0.5)
        if sp and sp[1] - sp[0] > 3.0:
            _append(parts, *_box([sp[0] + 0.15, y, -depth + 0.4], [sp[0] + 0.15 + mullion, yb, -1.5]), 0)
            _append(parts, *_box([sp[1] - 0.15 - mullion, y, -depth + 0.4], [sp[1] - 0.15, yb, -1.5]), 0)
        y = yb
    # back rib: second −Z plane, inside the back face
    _append(parts, *_box([x0 + 3.0, y0 + 4.0, -depth], [x1 - 3.0, y1 - 4.0, -depth + mullion]), 0)
    # --- ladder cage on the inner right edge, same proud plane as the chrome (no new bin) ---
    lad = doc["ladder"]
    ly0 = y0 + float(lad["bottom_m"])
    ly1 = min(y0 + float(lad["top_m"]), y1 - 3.0)
    rail_gap = float(lad["railSpacing_m"])
    rung = float(lad["rungPitch_m"])
    hoop = float(lad["hoopPitch_m"])
    spm = x_at((ly0 + ly1) * 0.5)
    lx = (spm[1] - 1.3) if spm else (x1 - 1.3)
    for s in (-0.5, 0.5):
        _append(parts, *_box([lx - 0.06, ly0, 0.02 + s * rail_gap], [lx + 0.06, ly1, 0.02 + mullion * 0.5 + s * rail_gap]), 1)
    yy = ly0 + 0.5
    while yy < ly1:
        _append(parts, *_box([lx - 0.05, yy, 0.02 - rail_gap * 0.45], [lx + 0.05, yy + 0.07, 0.02 + mullion]), 1)
        yy += rung
    yy = ly0 + hoop * 0.5
    while yy < ly1:
        _append(parts, *_box([lx - 0.45, yy, 0.02], [lx + 0.15, yy + 0.07, 0.02 + mullion]), 1)
        yy += hoop
    # cables, inside the right flank
    for i, cbl in enumerate(doc["cables"]):
        zc = -2.0 - i * 0.5
        ya = y0 + float(cbl["anchorV"]) * (y1 - y0)
        yb = ya - float(cbl["sag_m"])
        _append(parts, *_box([lx - 0.8, yb, zc], [lx, ya, zc + 0.05]), 1)
    # sand apron below the visual base. It widens the key silhouette; depth stays behind the skin.
    sand_top = y0 + min(1.2, float(doc["sand"]["drift_m"]["front"]))
    spb = x_at(y0 + 0.2)
    if spb:
        _append(parts, *_box([spb[0] + 0.6, y0 - sink, -depth + 0.3], [spb[1] - 0.6, sand_top, -0.8]), 2)
    return _merge(parts), dict(x=[float(x0), float(x1)], y=[float(y0), float(y1)], depth=depth, sink=sink, mullion=mullion,
                              hole=[float(du0), float(dv0), float(du1), float(dv1)], recess=float(min(float(dmg["depth_m"]), depth * 0.45)))


def _merge(parts):
    vs, fs, ms = [], [], []
    o = 0
    for v, f, mat in parts:
        vs.append(v)
        fs.append(f + o)
        ms.append(np.full(len(f), mat, np.int32))
        o += len(v)
    return np.concatenate(vs), np.concatenate(fs), np.concatenate(ms)


def uvs_for(V, F, atlas=2048):
    """Per-triangle planar metres packed into the atlas. Pixel aspect matches the face
    so the world→texel Jacobian is ~1 (stretch p95 ≤ 1.3)."""
    uv = np.zeros((len(V), 2), np.float64)
    # group triangles by quantised normal
    used = np.zeros(len(V), np.uint8)
    charts = []
    for t in range(len(F)):
        i, j, k = F[t]
        if used[i] and used[j] and used[k]:
            continue
        a, b, c = V[i], V[j], V[k]
        n = np.cross(b - a, c - a)
        ln = np.linalg.norm(n)
        if ln < 1e-9:
            continue
        n /= ln
        axis = int(np.argmax(np.abs(n)))
        # collect this triangle only (charts are per triangle, then packed — simple and stretch-safe)
        if axis == 0:
            p2 = np.array([[a[2], a[1]], [b[2], b[1]], [c[2], c[1]]])
        elif axis == 1:
            p2 = np.array([[a[0], a[2]], [b[0], b[2]], [c[0], c[2]]])
        else:
            p2 = np.array([[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]])
        charts.append((t, p2))
        used[i] = used[j] = used[k] = 1
    # pack charts in a shelf along X, metres → pixels at 8 px/m (unique plate is honestly low)
    pxm = 8.0
    x = 4.0
    y = 4.0
    row_h = 0.0
    for t, p2 in charts:
        p2 = p2 - p2.min(0)
        w, h = float(p2[:, 0].max()) + 1e-3, float(p2[:, 1].max()) + 1e-3
        pw, ph = w * pxm + 4, h * pxm + 4
        if x + pw > atlas - 2:
            x = 4.0
            y += row_h + 4
            row_h = 0.0
        if y + ph > atlas - 2:
            # overflow: stack anyway (still valid uvs, may collide — rare at this px/m)
            y = 4.0
        for e, vi in enumerate(F[t]):
            uv[vi, 0] = (x + 2 + p2[e, 0] * pxm) / atlas
            uv[vi, 1] = (y + 2 + p2[e, 1] * pxm) / atlas
        x += pw
        row_h = max(row_h, ph)
    return uv, pxm


def raster_mesh(V, F, origin, right, up, toward, MW, PM, wh=(1280, 720)):
    """Painter's raster from camera-v2 (far triangles first). Returns uint8 HxW."""
    import cv2
    W, H = wh
    basis = np.stack([right, up, toward], 1)  # columns = local axes in world
    world = (basis @ V.T).T + np.asarray(origin, np.float64)
    px, py, depth = project(world, MW, PM, wh)
    # depth: larger wclip is closer in three.js perspective (w = -z_view roughly). Use 1/w as depth key.
    img = np.zeros((H, W), np.uint8)
    order = []
    for t in range(len(F)):
        i, j, k = [int(x) for x in F[t]]
        if not np.isfinite([px[i], py[i], px[j], py[j], px[k], py[k]]).all():
            continue
        z = float(depth[i] + depth[j] + depth[k]) / 3
        area = (px[j] - px[i]) * (py[k] - py[i]) - (px[k] - px[i]) * (py[j] - py[i])
        if area >= 0:
            continue
        order.append((z, t))
    order.sort(reverse=True)  # far (larger camera-space depth) first
    for z, t in order:
        i, j, k = [int(x) for x in F[t]]
        pts = np.round(np.array([[px[i], py[i]], [px[j], py[j]], [px[k], py[k]]])).astype(np.int32)
        if pts[:, 0].max() < 0 or pts[:, 1].max() < 0 or pts[:, 0].min() >= W or pts[:, 1].min() >= H:
            continue
        cv2.fillConvexPoly(img, pts, 255)
    return img


def iou_rect(img, mask):
    x0, y0, x1, y1 = RECT
    a = img[y0:y1, x0:x1] > 0
    b = mask[y0:y1, x0:x1] > 0
    inter = int(np.logical_and(a, b).sum())
    union = int(np.logical_or(a, b).sum())
    extra = int(np.logical_and(a, ~b).sum())
    miss = int(np.logical_and(~a, b).sum())
    return float(inter) / max(1, union), extra, miss


def _x_at(xy, y):
    xs = []
    n = len(xy)
    for i in range(n):
        ax, ay = xy[i]
        bx, by = xy[(i + 1) % n]
        if (ay > y) == (by > y):
            continue
        xs.append(ax + (bx - ax) * (y - ay) / (by - ay + 1e-15))
    if len(xs) < 2:
        return None
    return min(xs), max(xs)


def _overlaps_hole(hole, xa, xb, ya, yb):
    if not hole:
        return False
    hx0, hy0, hx1, hy1 = [float(v) for v in hole[:4]]
    return not (xb < hx0 or xa > hx1 or yb < hy0 or ya > hy1)


def _xz_span(parts):
    xs, zs = [], []
    for v, f, mat in parts:
        if len(v) == 0:
            continue
        xs.append(float(v[:, 0].min())); xs.append(float(v[:, 0].max()))
        zs.append(float(v[:, 2].min())); zs.append(float(v[:, 2].max()))
    return min(xs), max(xs), min(zs), max(zs)


def _add_da_steps(parts, xy, depth, steps, hole):
    """Two flat +z planes (and the same on the back) per Depth Anything band.

    The band is a run measured on the painted front strip. Proud runs sit on
    the outer plane; recessed runs sit on the inner plane. Depths are fixed
    so the crispness bins stay at two planes. No bay grid.
    """
    outer = (0.12, 0.58)
    inner = (0.02, 0.10)
    for st in steps:
        ya, yb = float(st["y0"]), float(st["y1"])
        if yb - ya < 0.6:
            continue
        u0, u1 = float(st["u0"]), float(st["u1"])
        sl = _x_at(xy, (ya + yb) * 0.5)
        if sl is None:
            continue
        w = sl[1] - sl[0]
        if w < 1.0:
            continue
        a, b = sl[0] + u0 * w, sl[0] + u1 * w
        ok = True
        for y in (ya, (ya + yb) * 0.5, yb):
            s2 = _x_at(xy, float(y))
            if s2 is None:
                ok = False
                break
            a = max(a, s2[0] + 0.15)
            b = min(b, s2[1] - 0.15)
        if not ok or b - a < 0.4 or _overlaps_hole(hole, a, b, ya, yb):
            continue
        left = (sl[0] + 0.25, a - 0.08)
        right = (b + 0.08, sl[1] - 0.25)

        def place(xa, xb, z0, z1, z_back0, z_back1):
            if xb - xa < 0.4:
                return
            if _overlaps_hole(hole, xa, xb, ya, yb):
                return
            _append(parts, *_box([xa, ya, z0], [xb, yb, z1]), 0)
            _append(parts, *_box([xa, ya, -depth + z_back0], [xb, yb, -depth + z_back1]), 0)

        # back offsets are negative (outward is -Z). Same u as the front image.
        if st.get("proud"):
            place(a, b, outer[0], outer[1], -0.58, -0.12)
            place(left[0], left[1], inner[0], inner[1], -0.10, -0.02)
            place(right[0], right[1], inner[0], inner[1], -0.10, -0.02)
        else:
            place(a, b, inner[0], inner[1], -0.10, -0.02)
            place(left[0], left[1], outer[0], outer[1], -0.58, -0.12)
            place(right[0], right[1], outer[0], outer[1], -0.58, -0.12)


def _add_sand(parts, xy_y0, y1, sink, drift_m):
    """Plug under the whole lower footprint, plus a shallow drift at the foot.

    The plug bottom is y0 - sink. Its xz is every solid already built, plus a
    margin (2 m on a tower, 5 cm on the selftest box) so a corner ray cannot
    miss it. The drift stays inside that xz.
    """
    xmin, xmax, zmin, zmax = _xz_span(parts)
    height = float(y1 - xy_y0)
    margin = 0.05 if height < 30.0 else 2.0
    _append(parts, *_box(
        [xmin - margin, xy_y0 - sink, zmin - margin],
        [xmax + margin, xy_y0 - 0.02, zmax + margin]), 2)
    drift = min(1.2, float(drift_m or 1.0))
    _append(parts, *_box(
        [xmin - margin + 0.08, xy_y0 - 0.35, max(zmin + 0.4, -2.0)],
        [xmax + margin - 0.08, xy_y0 + drift, -0.06]), 2)


def _inset_poly(poly, dist=0.003):
    p = np.asarray(poly, np.float64)
    if len(p) > 1 and np.linalg.norm(p[0] - p[-1]) < 1e-4:
        p = p[:-1]
    c = p.mean(axis=0)
    d = p - c
    n = np.linalg.norm(d, axis=1, keepdims=True) + 1e-9
    step = np.minimum(dist, (n * 0.25).ravel())
    return p - d / n * step[:, None]


def _orient_ccw(p):
    area = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]
        x2, y2 = p[(i + 1) % len(p)]
        area += x1 * y2 - x2 * y1
    if area < 0:
        return p[::-1]
    return p


def _extrude_poly(poly, z0, z1):
    """Closed shell. Top faces +Z. A 3 mm inset is applied by the caller so a weld stays manifold."""
    p = np.asarray(poly, np.float64)
    if len(p) > 1 and np.linalg.norm(p[0] - p[-1]) < 1e-4:
        p = p[:-1]
    if len(p) < 3 or z1 - z0 < 0.01:
        return np.zeros((0, 3)), np.zeros((0, 3), np.int32)
    p = _orient_ccw(p)
    tris = _ear_clip(p)
    if len(tris) < 1:
        c = p.mean(0)
        if not _pip(float(c[0]), float(c[1]), p):
            return np.zeros((0, 3)), np.zeros((0, 3), np.int32)
        p = np.concatenate([p, c.reshape(1, 2)], 0)
        n0 = len(p) - 1
        tris = [(n0, i, (i + 1) % n0) for i in range(n0)]
    n = len(p)
    bot = np.concatenate([p, np.full((n, 1), z0)], 1)
    top = np.concatenate([p, np.full((n, 1), z1)], 1)
    V = np.concatenate([bot, top], 0)
    F = []
    for a, b, c in tris:
        F.append([a, c, b])
        F.append([n + a, n + b, n + c])
    for i in range(n):
        j = (i + 1) % n
        F.append([i, j, n + j])
        F.append([i, n + j, n + i])
    return V, np.asarray(F, np.int32)


def _add_segments(parts, segments):
    """Proud plates for positive depth_cm. Negative depth_cm is one cutter, cited by segment id."""
    cutter_V, cutter_F, off = [], [], 0
    for seg in segments:
        cm = float(seg["depth_cm"])
        poly = seg["poly_m"]
        if cm <= -1.0:
            V, F = _extrude_poly(poly, cm / 100.0, 0.9)
            if len(F) == 0:
                continue
            cutter_V.append(V)
            cutter_F.append(F + off)
            off += len(V)
            continue
        if cm < 2.0:
            continue
        V, F = _extrude_poly(_inset_poly(poly), 0.02, cm / 100.0)
        _append(parts, V, F, 1)
    if not cutter_V:
        return None
    return np.concatenate(cutter_V, 0), np.concatenate(cutter_F, 0)


def massing(doc, da_steps=None, segments=None):
    """Silhouette prism + wedge back + buried sand apron + feature shells.

    Damage is a cutter box (Blender boolean). Chrome / ladder / cable shells
    exist only when a feature bbox places them. Panel rhythm is not geometry.
    Returns (V, F, M), meta. Shells are 1 cm apart so a position weld stays manifold.
    """
    xy = np.array(doc["silhouette"]["localXY_m"], np.float64)
    depth = float(doc["size"]["depth_m"])
    taper = float(doc.get("plan", {}).get("backScale", 0.72))
    sink = float(doc["sand"]["sinkBelowBase_m"])
    y0 = float(xy[:, 1].min())
    y1 = float(xy[:, 1].max())
    x0 = float(xy[:, 0].min())
    x1 = float(xy[:, 0].max())
    parts = []
    tris = _ear_clip(xy)
    if len(tris) < len(xy) - 2:
        raise RuntimeError(f"ear clip failed: {len(tris)} tris for {len(xy)} verts")
    n = len(xy)
    front = np.concatenate([xy, np.zeros((n, 1))], 1)
    back_xy = xy * np.array([taper, 1.0])
    back = np.concatenate([back_xy, np.full((n, 1), -depth)], 1)
    pv = np.concatenate([front, back], 0)
    pf = []
    for a, b, c in tris:
        pf.append([a, b, c])
        pf.append([n + c, n + b, n + a])
    for i in range(n):
        j = (i + 1) % n
        pf.append([i, j, n + j])
        pf.append([i, n + j, n + i])
    _append(parts, pv, np.array(pf, np.int32), 0)

    hole = None
    for feat in doc.get("features", {}).get("front", []):
        kind = feat.get("type")
        bx, by, bw, bh = feat["bbox_normalized"]
        # bbox is 0..1 of the FACE (y down). At each height the local width is the silhouette, not the AABB.
        yb = y1 - by * (y1 - y0)
        ya = y1 - (by + bh) * (y1 - y0)
        if ya > yb:
            ya, yb = yb, ya
        def span_at(y, u0, u1):
            sl = _x_at(xy, y)
            if sl is None:
                return None
            w = sl[1] - sl[0]
            return sl[0] + u0 * w, sl[0] + u1 * w
        if kind in ("damage", "hole", "opening"):
            mid = span_at((ya + yb) * 0.5, bx, bx + bw)
            if mid is None:
                continue
            hole = [float(mid[0]), float(ya), float(mid[1]), float(yb), float(feat.get("depth_m", 2.5))]
            continue
        if kind not in ("chrome", "ladder", "cable"):
            continue
        # Segment plates replace the one-box shells and the 2 m depth bands.
        if da_steps is not None or segments is not None:
            continue
        proud = float(feat.get("depth_m", 0.35)) if float(feat.get("relative_depth", 0.5)) >= 0.5 else 0.0
        if proud <= 0 or yb - ya < 0.3:
            continue
        # one shell per feature, X taken at mid-height and inset so the taper cannot leak
        mid = span_at((ya + yb) * 0.5, bx, bx + bw)
        if mid is None or mid[1] - mid[0] < 0.12:
            continue
        # shrink until every sample height still contains the shell
        a, b = mid
        for y in np.linspace(ya, yb, 8):
            sl = _x_at(xy, float(y))
            if sl is None:
                a, b = 0, -1
                break
            a = max(a, sl[0] + 0.3)
            b = min(b, sl[1] - 0.2)
        if b - a < 0.12:
            continue
        _append(parts, *_box([a, ya, 0.02], [b, yb, proud]), 1)
    cutter = None
    if segments:
        cutter = _add_segments(parts, segments)
    elif da_steps:
        _add_da_steps(parts, xy, depth, da_steps, hole)
    drift = 1.0
    sand = doc.get("sand") or {}
    if isinstance(sand.get("drift_m"), dict):
        drift = float(sand["drift_m"].get("front") or 1.0)
    _add_sand(parts, y0, y1, sink, drift)
    V, F, M = _merge(parts)
    meta = dict(x=[x0, x1], y=[y0, y1], depth=depth, sink=sink, taper=taper, hole=hole,
                tris=int(len(F)), cutter=cutter, span=[float(x0), float(y0), float(y1)])
    return (V, F, M), meta


def split_tris(V, F):
    """One vertex per corner so UVs do not overwrite a shared corner."""
    nv = np.zeros((len(F) * 3, 3), np.float64)
    nf = np.zeros((len(F), 3), np.int32)
    for t, (a, b, c) in enumerate(F):
        nv[3 * t:3 * t + 3] = V[[a, b, c]]
        nf[t] = [3 * t, 3 * t + 1, 3 * t + 2]
    return nv, nf


def uvs_split(V, F, xspan, yspan, depth):
    """Planar UV per split triangle. Front (normal +Z) maps onto the face 0..1."""
    V, F = split_tris(V, F)
    uv = np.zeros((len(V), 2), np.float64)
    x0, x1 = xspan
    y0, y1 = yspan
    for t in range(len(F)):
        i, j, k = F[t]
        a, b, c = V[i], V[j], V[k]
        n = np.cross(b - a, c - a)
        ln = np.linalg.norm(n) or 1.0
        n /= ln
        for e, p in enumerate((a, b, c)):
            if abs(n[2]) >= abs(n[0]) and abs(n[2]) >= abs(n[1]):
                uv[F[t][e]] = [(p[0] - x0) / (x1 - x0 + 1e-9), (p[1] - y0) / (y1 - y0 + 1e-9)]
            elif abs(n[0]) >= abs(n[1]):
                uv[F[t][e]] = [np.clip(-p[2] / depth, 0, 1), (p[1] - y0) / (y1 - y0 + 1e-9)]
            else:
                uv[F[t][e]] = [(p[0] - x0) / (x1 - x0 + 1e-9), np.clip(-p[2] / depth, 0, 1)]
    return V, F, uv


def manifold_counts(V, F):
    """Weld at 1 mm. Return open edges, non-manifold edges, triangles."""
    key = np.round(V * 1000).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    edges = {}
    for a, b, c in F:
        for u, v in ((a, b), (b, c), (c, a)):
            i, j = int(inv[u]), int(inv[v])
            if i == j:
                continue
            e = (i, j) if i < j else (j, i)
            edges[e] = edges.get(e, 0) + 1
    open_e = sum(1 for n in edges.values() if n == 1)
    nm = sum(1 for n in edges.values() if n > 2)
    return open_e, nm, len(F)


if __name__ == "__main__":
    import cv2
    d = derive_plane()
    print("width", round(d["width_m"], 2), "height", round(d["height_m"], 2), "base", round(d["base_y"], 2), "top", round(d["top_y"], 2))
    print("verts", len(d["poly_px"]))
    kc, MW, PM = cam_mats()
    mask = cv2.imread(MASK, cv2.IMREAD_GRAYSCALE)
    iou, canvas = polygon_iou(d["local_xy"], d["origin"], d["right"], d["up"], d["toward"], MW, PM, mask)
    print("polygon IoU", round(iou, 4))
    os.makedirs("/workspace/zb-tower-vision-1010/look", exist_ok=True)
    cv2.imwrite("/workspace/zb-tower-vision-1010/look/poly-raster.jpg", canvas)
    json.dump({k: d[k] for k in d if k != "local_xy"}, open("/tmp/vision-derive.json", "w"), indent=1)
    json.dump(d["local_xy"], open("/tmp/vision-local.json", "w"))
