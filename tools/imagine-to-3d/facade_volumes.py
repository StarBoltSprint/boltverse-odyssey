"""Real facade volumes for the vision tower. Sibling of hard_surface.py.

Locations come from SAM2 regions plus colour / shape rules (Grok vision of the
lower plates: glass grid, chrome strip, cable bundle, cracked pier, cornice).
Depth is MoGe-2 scaled by depth_relief.scale_facade_metres, then clipped to a
class floor and a face cap so a 174 m tower reads in metres, not centimetres.

The loft wall is already inset (multiview_tower wall_inset). Each box sits
outside that wall and stops short of the original shell, so the foot stays the
widest surface and d/w does not grow. Boxes are closed and axis-aligned
(hard_surface.axis_box). They are not welded into the wall.

UVs are the plate window on the cap. Depth faces use the same plate with a
span that matches the world aspect, so the singular-value ratio stays near 1.
""",
import json, os
import numpy as np

WALL_GAP = 0.02
SHELL_KEEP = 0.08  # stay this far inside the original shell
T_LO = 0.055       # below this the wall is still ramping out to the foot
T_HI = 0.88

CLASS_RANGE = {
    "cable": (0.55, 1.05),
    "chrome": (0.35, 0.55),
    "window": (0.45, 0.65),
    "cornice": (0.30, 0.50),
    "damage": (0.50, 0.80),
    "panel": (0.55, 0.70),
}
MAX_N = {"cable": 8, "chrome": 3, "window": 8, "cornice": 2, "damage": 8, "panel": 1}


def _interp_ring(rings, y):
    if y <= rings[0][0]:
        return rings[0]
    if y >= rings[-1][0]:
        return rings[-1]
    for i in range(len(rings) - 1):
        y0, y1 = rings[i][0], rings[i + 1][0]
        if y0 <= y <= y1:
            t = (y - y0) / max(1e-9, y1 - y0)
            return tuple(rings[i][k] + t * (rings[i + 1][k] - rings[i][k]) for k in range(6))
    return rings[-1]


def _shell(rings, y, face, s):
    _y, xmin, xmax, bx0, bx1, depth = _interp_ring(rings, y)
    s = float(np.clip(s, 0.0, 1.0))
    if face == "front":
        return np.array([xmin + s * (xmax - xmin), y, 0.0])
    if face == "back":
        return np.array([bx1 + s * (bx0 - bx1), y, -depth])
    if face == "right":
        return np.array([xmax + s * (bx1 - xmax), y, 0.0 + s * (-depth)])
    return np.array([bx0 + s * (xmin - bx0), y, -depth + s * depth])


def _limits(face, pts, protr, wall_inset):
    xs = [float(p[0]) for p in pts]
    ys = [float(p[1]) for p in pts]
    zs = [float(p[2]) for p in pts]
    if face == "front":
        z_shell = max(zs)
        z0 = z_shell - wall_inset + WALL_GAP
        z1 = min(z0 + protr, z_shell - SHELL_KEEP)
        return (min(xs), min(ys), z0), (max(xs), max(ys), z1), z1 - z0
    if face == "back":
        z_shell = min(zs)
        z1 = z_shell + wall_inset - WALL_GAP
        z0 = max(z1 - protr, z_shell + SHELL_KEEP)
        return (min(xs), min(ys), z0), (max(xs), max(ys), z1), z1 - z0
    if face == "right":
        x_shell = max(xs)
        x0 = x_shell - wall_inset + WALL_GAP
        x1 = min(x0 + protr, x_shell - SHELL_KEEP)
        return (x0, min(ys), min(zs)), (x1, max(ys), max(zs)), x1 - x0
    x_shell = min(xs)
    x1 = x_shell + wall_inset - WALL_GAP
    x0 = max(x1 - protr, x_shell + SHELL_KEEP)
    return (x0, min(ys), min(zs)), (x1, max(ys), max(zs)), x1 - x0


def _depth_for(cls, moge_abs):
    lo, hi = CLASS_RANGE[cls]
    mag = float(moge_abs) if moge_abs is not None else lo
    if mag < 0.45:
        mag = lo
    return float(np.clip(round(float(np.clip(mag, lo, hi)) / 0.05) * 0.05, lo, hi))


def _regions(rgb, labels, mask):
    import cv2
    H, W = mask.shape
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0].astype(np.float32) * (100.0 / 255.0)
    sat = np.hypot(lab[:, :, 1].astype(np.float32) - 128.0, lab[:, :, 2].astype(np.float32) - 128.0)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    sub_a = int(mask.sum())
    cols = np.flatnonzero(mask.any(0))
    rows = np.flatnonzero(mask.any(1))
    if cols.size < 2 or rows.size < 2 or sub_a < 100:
        return []
    out = []
    for i in np.unique(labels):
        i = int(i)
        if i <= 0:
            continue
        m = (labels == i) & mask
        area = int(m.sum())
        if area < 400:
            continue
        ys, xs = np.where(m)
        r0, r1, c0, c1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
        bh, bw = r1 - r0 + 1, c1 - c0 + 1
        solidity = area / max(1, bh * bw)
        out.append(dict(
            id=i, r0=r0, r1=r1, c0=c0, c1=c1, bh=bh, bw=bw, area=area,
            solidity=float(solidity),
            L=float(L[m].mean()), sat=float(sat[m].mean()), Lstd=float(L[m].std()),
            vert=float(np.abs(gx[m]).mean()), horiz=float(np.abs(gy[m]).mean()),
            frac=area / sub_a, mask=m,
        ))
    return out


def _class_of(reg, subject_h):
    tall = reg["bh"] > 2.0 * max(1, reg["bw"])
    if reg["L"] > 62 and reg["sat"] < 22 and tall and reg["bw"] < 0.18 * subject_h:
        return "chrome"
    if reg["L"] < 48 and reg["frac"] > 0.04 and reg["solidity"] > 0.40 and reg["bh"] < 4.0 * max(1, reg["bw"]):
        return "window"
    if reg["vert"] > 1.30 * max(1e-3, reg["horiz"]) and 28 < reg["L"] < 78 and reg["bh"] > 1.3 * max(1, reg["bw"]) and reg["solidity"] < 0.90 and reg["frac"] > 0.01:
        return "cable"
    if reg["Lstd"] > 16 and reg["solidity"] < 0.58 and reg["frac"] < 0.22 and reg["area"] > 800:
        return "damage"
    foot = reg["r0"] > 0.75 * subject_h
    if foot and reg["bw"] > 0.35 * subject_h and reg["bh"] < 0.22 * subject_h:
        return "cornice"
    return None


def _s_pair(c0, c1, cols):
    a, b = float(cols[0]), float(cols[-1])
    span = max(1.0, b - a)
    return float(np.clip((c0 - a) / span, 0, 1)), float(np.clip((c1 - a) / span, 0, 1))


def _t_pair(r0, r1, H, band, t_cut):
    def one(row):
        u = row / max(1, H - 1)
        if band == "lower":
            return float(t_cut) * (1.0 - u)
        return 1.0 - u
    t_top, t_bot = one(r0), one(r1)
    if t_top < t_bot:
        t_top, t_bot = t_bot, t_top
    return t_bot, t_top


def _clamp_t(t0, t1, band, t_cut):
    lo, hi = T_LO, T_HI
    if band == "lower":
        hi = min(hi, float(t_cut) - 1e-3)
    else:
        lo = max(lo, float(t_cut) + 0.012)
    a, b = max(t0, lo), min(t1, hi)
    if b - a < 0.004:
        return None
    return a, b


def _cable_tracks(reg, cols, ppm):
    m = reg["mask"]
    H, W = m.shape
    dark = None
    tracks = []
    c0, c1 = reg["c0"], reg["c1"]
    # dark-luma columns inside the bundle
    col_on = []
    for c in range(c0, c1 + 1):
        sl = m[:, c]
        if sl.sum() < 8:
            col_on.append(False)
            continue
        # reuse mask density as the strand signal: a cable plate is striped,
        # so a column that is only partly inside the region is a gap.
        col_on.append(True)
    # split the bbox into vertical runs of similar width using the mask's
    # column occupancy valleys.
    occ = m[:, c0:c1 + 1].mean(0) if c1 > c0 else np.zeros(1)
    on = occ > 0.15
    runs = []
    i = 0
    while i < len(on):
        if not on[i]:
            i += 1
            continue
        j = i
        while j < len(on) and on[j]:
            j += 1
        runs.append((c0 + i, c0 + j - 1))
        i = j
    if not runs:
        runs = [(c0, c1)]
    # cluster runs closer than 0.15 m
    merged = []
    for a, b in runs:
        if merged and (a - merged[-1][1]) / max(ppm, 1e-3) < 0.15:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    for a, b in merged:
        w_m = (b - a + 1) / max(ppm, 1e-3)
        if w_m < 0.18 and len(merged) > 1:
            continue
        w_m = float(np.clip(max(w_m, 0.30), 0.30, 0.80))
        s0, s1 = _s_pair(a, b, cols)
        # force the tube to the metric width around its centre
        sm = 0.5 * (s0 + s1)
        # face width is recovered by the caller; keep the pixel span here
        tracks.append((s0, s1, w_m))
        if len(tracks) >= MAX_N["cable"]:
            break
    return tracks


def _boxes_for_region(reg, cls, face, band, cols, rows, H, t_cut, ppm, height, moge_abs):
    """Return list of (s0,s1,t0,t1,protrusion,cls)."""
    s0, s1 = _s_pair(reg["c0"], reg["c1"], cols)
    t0, t1 = _t_pair(reg["r0"], reg["r1"], H, band, t_cut)
    ct = _clamp_t(t0, t1, band, t_cut)
    if ct is None:
        return []
    t0, t1 = ct
    P = _depth_for(cls, moge_abs)
    face_w = max(1.0, (cols[-1] - cols[0]) / max(ppm, 1e-3))
    boxes = []
    if cls == "cable":
        tracks = _cable_tracks(reg, cols, ppm)
        span_s = max(1e-3, s1 - s0)
        for a, b, w_m in tracks:
            ds = w_m / face_w
            sm = 0.5 * ((a + b) if False else 0.5 * (a + b))
            # a,b are s already from _s_pair inside tracks... tracks returns s0,s1,w
            sm = 0.5 * (a + b)
            ds = min(ds, max(0.01, b - a))
            boxes.append((sm - 0.5 * ds, sm + 0.5 * ds, t0, t1, P, "cable"))
        return boxes
    if cls == "window":
        thick = 0.42 / face_w
        th = 0.42 / max(1.0, height)
        # four bars on the mask outline
        if s1 - s0 > 2.2 * thick and t1 - t0 > 2.2 * th:
            boxes.append((s0, s0 + thick, t0, t1, P, "window"))
            boxes.append((s1 - thick, s1, t0, t1, P, "window"))
            boxes.append((s0, s1, t1 - th, t1, P, "window"))
            boxes.append((s0, s1, t0, t0 + th, P, "window"))
            return boxes
    if cls == "damage":
        # proud blocks on the mask boundary, the crack stays on the wall
        m = reg["mask"]
        step = max(4, int(round(0.45 * ppm)))
        n = 0
        r0, r1, c0, c1 = reg["r0"], reg["r1"], reg["c0"], reg["c1"]
        for r in range(r0, r1, step):
            for c in range(c0, c1, step):
                sl = m[r:r + step, c:c + step]
                if sl.size < 4 or sl.mean() < 0.25 or sl.mean() > 0.92:
                    continue
                ss0, ss1 = _s_pair(c, min(c1, c + step), cols)
                tt = _clamp_t(*_t_pair(r, min(r1, r + step), H, band, t_cut), band, t_cut)
                if tt is None:
                    continue
                boxes.append((ss0, ss1, tt[0], tt[1], P, "damage"))
                n += 1
                if n >= MAX_N["damage"]:
                    return boxes
        if boxes:
            return boxes
    boxes.append((s0, s1, t0, t1, P, cls))
    return boxes


def _uv_name(face, band):
    return face + "-lower" if band == "lower" else face


def _plate_uv(mt, face, band, s, t):
    mt._UV_BAND = "lower" if band == "lower" else "upper"
    return (_uv_name(face, band), float(mt.map_u(None, face, t, s)), float(mt.map_v(face, t)))


def _append_box(V, F, uvs, lo, hi, face, band, s0, s1, t0, t1, mt):
    from hard_surface import axis_box
    built = axis_box(lo, hi)
    if built is None:
        return V, F, uvs, False
    bV, bF, quads = built
    # s,t at the eight corners. x grows with s on the front; other faces use
    # the feature window on the cap and an aspect-matched strip on the sides.
    s0, s1 = float(np.clip(s0, 0, 1)), float(np.clip(s1, 0, 1))
    t0, t1 = float(np.clip(t0, 0, 1)), float(np.clip(t1, 0, 1))
    if s1 < s0:
        s0, s1 = s1, s0
    if t1 < t0:
        t0, t1 = t1, t0
    name_band = band
    mt._UV_BAND = "lower" if band == "lower" else "upper"
    u0 = float(mt.map_u(None, face, t0, s0))
    u1 = float(mt.map_u(None, face, t0, s1))
    v0 = float(mt.map_v(face, t0))
    v1 = float(mt.map_v(face, t1))
    du_f = abs(u1 - u0)
    dv_f = abs(v1 - v0)
    height = max(1e-3, abs(hi[1] - lo[1]))
    width = max(1e-3, abs(hi[0] - lo[0]) if face in ("front", "back") else abs(hi[2] - lo[2]))
    # One texel density, the plate's own ppm. Deriving it from the box's AABB
    # versus the mask window stretched the cap by the taper (the right cap
    # also collapsed when s was tied to x). image_px makes u and v fractions
    # land on the same pixels-per-metre after bake_uv.
    win, _lower = mt._window(face)
    if win and win.get("image_px") and win.get("ppm"):
        iw, ih = win["image_px"]
        ppm = float(win["ppm"])
        du_per_m = ppm / max(1, int(iw))
        dv_per_m = ppm / max(1, int(ih))
    else:
        du_per_m = du_f / width
        dv_per_m = dv_f / height
    name = _uv_name(face, name_band)
    uc = 0.5 * (u0 + u1)
    vc = 0.5 * (v0 + v1)
    # Every face, including the outer cap, takes its UV from its own edge
    # lengths. Indexing the cap by the box's x (s0 on x0, s1 on x1) collapsed
    # the right and left caps, which sit at constant x. The outer cap still
    # samples the feature: the rect is centred on the plate window.

    def edge_uv(a, b, c, d):
        o = bV[a]
        e1 = bV[b] - o
        e2 = bV[d] - o
        g11 = float(np.dot(e1, e1))
        g22 = float(np.dot(e2, e2))
        g12 = float(np.dot(e1, e2))
        det = g11 * g22 - g12 * g12
        L1 = max(1e-6, g11 ** 0.5)
        L2 = max(1e-6, g22 ** 0.5)
        du = du_per_m * L1
        dv = dv_per_m * L2
        out4 = []
        for k in (a, b, c, d):
            w = bV[k] - o
            if abs(det) < 1e-12:
                su, sv = 0.0, 0.0
            else:
                su = (float(np.dot(w, e1)) * g22 - float(np.dot(w, e2)) * g12) / det
                sv = (float(np.dot(w, e2)) * g11 - float(np.dot(w, e1)) * g12) / det
            out4.append((name, float(uc + (su - 0.5) * du), float(vc + (sv - 0.5) * dv)))
        return out4

    tri_uvs = []
    for a, b, c, d in quads:
        uv4 = edge_uv(a, b, c, d)
        tri_uvs.append(uv4[0:3])
        tri_uvs.append((uv4[0], uv4[2], uv4[3]))
    base = len(V)
    V = np.vstack([V, bV])
    F = np.vstack([F, bF + base])
    uvs.extend(tri_uvs)
    return V, F, uvs, True


def attach(V, F, uvs, rings, ctx):
    """Add volumes. ctx keys: y0, y1, wall_inset, images, masks, labels, depths, t_cut, out."""
    import sys
    mt = sys.modules.get("__main__")
    if mt is None or not hasattr(mt, "_PLANAR"):
        import multiview_tower as mt
    from depth_relief import scale_facade_metres

    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    uvs = list(uvs)
    y0 = float(ctx["y0"])
    y1 = float(ctx["y1"])
    height = max(1e-6, y1 - y0)
    wall_inset = float(ctx["wall_inset"])
    t_cut = float(ctx["t_cut"])
    features = []
    counts = {k: 0 for k in MAX_N}
    for face in ("front", "right", "back", "left"):
        for band in ("lower", "upper"):
            key = face if band == "upper" else face + "-lower"
            rgb = ctx["images"].get(key)
            labels = ctx["labels"].get(key)
            mask = ctx["masks"].get(key if band == "upper" else face)
            # lower masks are stored under the face name in lower_masks
            if band == "lower":
                mask = ctx["lower_masks"].get(face)
                rgb = ctx["images"].get(face + "-lower")
                labels = ctx["labels"].get(face + "-lower")
                depth = ctx["depths"].get(face + "-lower")
            else:
                mask = ctx["masks"].get(face)
                rgb = ctx["images"].get(face)
                labels = ctx["labels"].get(face)
                depth = ctx["depths"].get(face)
            if rgb is None or labels is None or mask is None or depth is None:
                continue
            mask = np.asarray(mask).astype(bool)
            if mask.shape[:2] != rgb.shape[:2]:
                import cv2
                mask = cv2.resize(mask.astype(np.uint8), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
            if labels.shape[:2] != rgb.shape[:2]:
                import cv2
                labels = cv2.resize(labels.astype(np.int32), (rgb.shape[1], rgb.shape[0]), interpolation=cv2.INTER_NEAREST)
            if depth.shape[:2] != rgb.shape[:2]:
                from PIL import Image
                depth = np.asarray(Image.fromarray(np.asarray(depth, np.float32)).resize((rgb.shape[1], rgb.shape[0]), Image.BILINEAR), np.float32)
            scaled, meta = scale_facade_metres(depth, mask, height if band == "upper" else ctx.get("lower_m", 25.0))
            regs = _regions(rgb, labels, mask)
            H = rgb.shape[0]
            cols = np.flatnonzero(mask.any(0))
            if cols.size < 2:
                continue
            ppm = (H / float(ctx.get("lower_m", 25.0))) if band == "lower" else (H / height)
            face_boxes = []
            for reg in regs:
                cls = _class_of(reg, H)
                if cls is None:
                    continue
                if counts[cls] >= MAX_N[cls] and cls != "window":
                    continue
                m = reg["mask"]
                med = float(np.median(np.abs(scaled[m]))) if m.any() else 0.0
                for box in _boxes_for_region(reg, cls, face, band, cols, None, H, t_cut, ppm, height, med):
                    face_boxes.append((box, med, meta))
                    counts[box[5]] = counts.get(box[5], 0) + 1
            # every face needs a metric protrusion or the oblique row fails
            have = any(b[0][4] >= 0.52 for b in face_boxes)
            if not have and regs and band == "lower":
                big = max(regs, key=lambda r: r["area"])
                med = float(np.median(np.abs(scaled[big["mask"]]))) if big["mask"].any() else 0.0
                for box in _boxes_for_region(big, "panel", face, band, cols, None, H, t_cut, ppm, height, med):
                    face_boxes.append((box, med, meta))
            for (s0, s1, t0, t1, P, cls), med, meta in face_boxes:
                if s1 - s0 < 0.004 or t1 - t0 < 0.003:
                    continue
                y_a = y0 + t0 * height
                y_b = y0 + t1 * height
                pts = [
                    _shell(rings, y_a, face, s0), _shell(rings, y_a, face, s1),
                    _shell(rings, y_b, face, s1), _shell(rings, y_b, face, s0),
                ]
                lo, hi, got = _limits(face, pts, P, wall_inset)
                if got < 0.25:
                    continue
                if hi[1] - lo[1] < 0.30:
                    continue
                span = abs(hi[0] - lo[0]) if face in ("front", "back") else abs(hi[2] - lo[2])
                if span < 0.22:
                    continue
                # keep the foot as the lowest surface
                if lo[1] < y0 + 0.02:
                    lo = (lo[0], y0 + 0.02, lo[2])
                V, F, uvs, ok = _append_box(V, F, uvs, lo, hi, face, band, s0, s1, t0, t1, mt)
                if not ok:
                    continue
                features.append({
                    "face": face, "band": band, "class": cls,
                    "xy_m": [round(float(0.5 * (lo[0] + hi[0])), 3), round(float(0.5 * (lo[1] + hi[1])), 3), round(float(0.5 * (lo[2] + hi[2])), 3)],
                    "size_m": [round(float(hi[0] - lo[0]), 3), round(float(hi[1] - lo[1]), 3), round(float(hi[2] - lo[2]), 3)],
                    "protrusion_m": round(float(got), 3),
                    "s": [round(float(s0), 4), round(float(s1), 4)],
                    "t": [round(float(t0), 4), round(float(t1), 4)],
                    "source": "sam2+vision",
                    "moge_median_m": round(float(med), 4),
                    "moge_scale": meta.get("scale"),
                    "moge_p99_m": meta.get("p99_m"),
                })
    out = ctx.get("out")
    if out:
        os.makedirs(out, exist_ok=True)
        json.dump({"wall_inset_m": wall_inset, "shell_keep_m": SHELL_KEEP, "class_range_m": CLASS_RANGE, "features": features}, open(os.path.join(out, "features.json"), "w"), indent=1)
    return V, F, uvs, features
