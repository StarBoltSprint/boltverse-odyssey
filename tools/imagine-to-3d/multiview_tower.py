"""Hero tower as one watertight solid from the 10 Oct multi-view plates.

Front colour is the key projection (homography in the vision folder).
Left, back and right colour are the turnaround sheet panels.
view-top is not a roof plan: the crown cap is not painted from it.
view-under is soffit crops: they paint ledge undersides only when a ledge exists.
Relief is MoGe-2 metres on that face, high-pass, then the measured cell median.
No new Imagine image. Placement layout is not written.

  python3 tools/imagine-to-3d/multiview_tower.py --work steps/multiview-tower-1011/work
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
ROOT = os.path.dirname(os.path.dirname(HERE))
TOOLS = os.path.dirname(HERE)
if TOOLS not in sys.path:
    sys.path.insert(0, TOOLS)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

SHEET = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/sheet-turnaround.jpg"
VIEW_TOP = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-top.jpg"
VIEW_UNDER = "/workspace/i23d-auto/zoneb-tower-hero/imagine/in/view-under.jpg"
KEY = "/workspace/zb-bible-1008/key-city3.jpg"
TOWER_JSON = "/workspace/i23d-auto/zoneb-tower-vision/vision/tower.json"
HOMO = "/workspace/i23d-auto/zoneb-tower-vision/vision/homography.json"
OLD_CUTS = {
    "left": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-left.jpg",
    "back": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-back.jpg",
    "right": "/workspace/i23d-auto/zoneb-tower-hero/masks/_src-view-right.jpg",
}
NAMES = ("front", "left", "back", "right")


def split_sheet(rgb):
    """Vertical gutters are light-grey columns. A run under 40 px is a joint, not a panel."""
    mean = rgb.mean(axis=(0, 2))
    std = rgb.std(axis=(0, 2))
    grey = (mean > 165) & (std < 14)
    runs = []
    s = None
    for x, g in enumerate(grey):
        if g and s is None:
            s = x
        elif not g and s is not None:
            runs.append((s, x - 1))
            s = None
    if s is not None:
        runs.append((s, rgb.shape[1] - 1))
    gutters = [(a, b) for a, b in runs if (b - a + 1) >= 40 and a > 4 and b < rgb.shape[1] - 5]
    bounds = [0]
    for a, b in gutters:
        bounds.append((a + b) // 2)
    bounds.append(rgb.shape[1])
    panels = []
    for i in range(len(bounds) - 1):
        sub = rgb[:, bounds[i]:bounds[i + 1]]
        sm, ss = sub.mean(axis=(0, 2)), sub.std(axis=(0, 2))
        cg = (sm > 165) & (ss < 14)
        xs = np.where(~cg)[0]
        if len(xs) < 30:
            continue
        p = sub[:, xs[0]:xs[-1] + 1]
        rm, rs = p.mean(axis=(1, 2)), p.std(axis=(1, 2))
        rg = (rm > 165) & (rs < 14)
        ys = np.where(~rg)[0]
        if len(ys) < 30:
            continue
        p = p[ys[0]:ys[-1] + 1]
        panels.append(p)
    return panels, gutters


def subject_mask(rgb):
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]], 0).astype(np.float32)
    bg = np.median(border, 0)
    dist = np.linalg.norm(rgb.astype(np.float32) - bg, axis=2)
    m = dist > 16
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)) > 0
    n, lab = cv2.connectedComponents(m.astype(np.uint8))
    if n <= 1:
        return m, bg
    counts = [(lab == i).sum() for i in range(1, n)]
    keep = 1 + int(np.argmax(counts))
    return lab == keep, bg


def mask_widths(mask):
    """Foreground pixel width at each row, top of the image first."""
    h = mask.shape[0]
    out = np.zeros(h, np.float32)
    for y in range(h):
        xs = np.where(mask[y])[0]
        out[y] = 0 if len(xs) == 0 else float(xs[-1] - xs[0] + 1)
    return out


def silhouette_iou(a, b):
    a = cv2.resize(a.astype(np.uint8), (128, 360), interpolation=cv2.INTER_NEAREST) > 0
    b = cv2.resize(b.astype(np.uint8), (128, 360), interpolation=cv2.INTER_NEAREST) > 0
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter / max(1, union))


def key_spans(doc):
    poly = np.asarray(doc["silhouette"]["localXY_m"], np.float32)
    y0 = float(poly[:, 1].min())
    y1 = float(poly[:, 1].max())
    return poly, y0, y1


def span_at(poly, y):
    """Horizontal chord of the key silhouette at height y. Returns xmin, xmax."""
    n = len(poly)
    xs = []
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 <= y <= y1) or (y1 <= y <= y0):
            if abs(y1 - y0) < 1e-6:
                xs.extend([float(x0), float(x1)])
            else:
                t = (y - y0) / (y1 - y0)
                xs.append(float(x0 + t * (x1 - x0)))
    if len(xs) < 2:
        return None
    return min(xs), max(xs)


def reinhard(src, src_m, ref, ref_m):
    s = cv2.cvtColor(src, cv2.COLOR_RGB2LAB).astype(np.float32)
    r = cv2.cvtColor(ref, cv2.COLOR_RGB2LAB).astype(np.float32)
    sm, ss = s[src_m].mean(0), s[src_m].std(0) + 1e-6
    rm, rs = r[ref_m].mean(0), r[ref_m].std(0) + 1e-6
    out = (s - sm) / ss * rs + rm
    out = np.clip(out, 0, 255).astype(np.uint8)
    return cv2.cvtColor(out, cv2.COLOR_LAB2RGB)


def delta_e(a, am, b, bm):
    la = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)[am]
    lb = cv2.cvtColor(b, cv2.COLOR_RGB2LAB).astype(np.float32)[bm]
    if len(la) == 0 or len(lb) == 0:
        return None
    return float(np.linalg.norm(la.mean(0) - lb.mean(0)))


def edge_strip(rgb, mask, side, frac=0.08):
    h, w = mask.shape
    n = max(4, int(w * frac))
    m = np.zeros_like(mask)
    if side == "left":
        m[:, :n] = mask[:, :n]
    else:
        m[:, -n:] = mask[:, -n:]
    return m


def metric_outward(path, mask, ppm):
    """MoGe-2 metres. Positive = nearer than the face plane (sticks out)."""
    npy = path + ".moge.npy"
    py = "/workspace/.venv-sam2/bin/python"
    script = os.path.join(HERE, "moge_depth.py")
    if not os.path.isfile(npy):
        r = subprocess.run([py, script, path, npy], capture_output=True, text=True, timeout=900)
        if r.returncode != 0 or not os.path.isfile(npy):
            raise RuntimeError((r.stderr or r.stdout or "moge failed")[-800:])
    depth = np.load(npy).astype(np.float32)
    if depth.shape[:2] != mask.shape[:2]:
        depth = np.asarray(Image.fromarray(depth).resize((mask.shape[1], mask.shape[0]), Image.BILINEAR), np.float32)
    fill = float(np.median(depth[mask])) if mask.any() else float(np.median(depth))
    filled = depth.copy()
    filled[~mask] = fill
    sig = max(1.5, 3.0 * ppm)
    fine = max(0.8, 0.4 * ppm)
    from scipy import ndimage as ndi
    hp = ndi.gaussian_filter(filled, fine) - ndi.gaussian_filter(filled, sig)
    # depth larger = farther. Outward (toward the camera) is the near residual.
    outward = -hp
    outward[~mask] = 0
    return outward.astype(np.float32)


def quantise_measured(outward, mask, ppm):
    """Cell median of the measured metres. Levels are not retargeted to a bar."""
    h, w = outward.shape
    cell_y = max(4, int(round(1.0 * ppm)))
    cell_x = max(4, int(round(1.0 * ppm)))
    q = np.zeros_like(outward)
    levels = []
    for y0 in range(0, h, cell_y):
        for x0 in range(0, w, cell_x):
            sl = outward[y0:y0 + cell_y, x0:x0 + cell_x]
            sm = mask[y0:y0 + cell_y, x0:x0 + cell_x]
            if sm.sum() < 8:
                continue
            med = float(np.median(sl[sm]))
            levels.append(med)
            q[y0:y0 + cell_y, x0:x0 + cell_x] = med
    if not levels:
        return q, {"p99_m": 0.0, "planes": 0}
    vals = np.array(sorted(levels), np.float32)
    # Merge measured levels within 5 cm, then agglomerate the nearest
    # remaining medians until at most 8 planes. Each plane stays a median
    # of measured cells. Nothing is scaled toward the 0.3 m bar.
    clusters = [[float(vals[0])]]
    for v in vals[1:]:
        if abs(float(v) - float(np.median(clusters[-1]))) < 0.05:
            clusters[-1].append(float(v))
        else:
            clusters.append([float(v)])
    while len(clusters) > 8:
        gaps = [abs(float(np.median(clusters[i + 1])) - float(np.median(clusters[i]))) for i in range(len(clusters) - 1)]
        j = int(np.argmin(gaps))
        clusters[j] = clusters[j] + clusters[j + 1]
        del clusters[j + 1]
    kept = [float(np.median(c)) for c in clusters]
    snapped = q.copy()
    for y0 in range(0, h, cell_y):
        for x0 in range(0, w, cell_x):
            sm = mask[y0:y0 + cell_y, x0:x0 + cell_x]
            if sm.sum() < 8:
                snapped[y0:y0 + cell_y, x0:x0 + cell_x] = 0
                continue
            med = float(np.median(q[y0:y0 + cell_y, x0:x0 + cell_x][sm]))
            nearest = min(kept, key=lambda L: abs(L - med))
            snapped[y0:y0 + cell_y, x0:x0 + cell_x] = nearest
    snapped[~mask] = 0
    p99 = float(np.percentile(np.abs(snapped[mask]), 99)) if mask.any() else 0.0
    return snapped.astype(np.float32), {
        "p99_m": round(p99, 4),
        "planes": len(kept),
        "level_min_m": round(min(kept), 4),
        "level_max_m": round(max(kept), 4),
    }


def per_metre_span(inset, mask):
    h = inset.shape[0]
    spans = []
    for y in range(h):
        xs = inset[y][mask[y]]
        if xs.size < 4:
            continue
        spans.append(float(xs.max() - xs.min()))
    if not spans:
        return 0.0
    return float(np.median(spans))


def sample_inset(inset, u, v):
    """u,v in 0..1. v 0 is the foot (inset row 0 is the top of the image)."""
    h, w = inset.shape
    col = int(np.clip(round(u * (w - 1)), 0, w - 1))
    row = int(np.clip(round((1.0 - v) * (h - 1)), 0, h - 1))
    return float(inset[row, col])


def build_mesh(poly, y0, y1, depth_ratio, back_ratio, insets, ny=96):
    """Loft. Front at z=0, body toward -z, up +y. Shared vertices, per-loop UVs later."""
    ys = np.linspace(y0, y1, ny)
    rings = []
    for y in ys:
        chord = span_at(poly, float(y))
        if chord is None:
            chord = span_at(poly, float(np.clip(y, y0 + 1e-3, y1 - 1e-3)))
        xmin, xmax = chord
        t = (float(y) - y0) / max(1e-6, y1 - y0)
        # The key polygon closes on one vertex at the foot. That point is the
        # outline's join, not a spire. The visible foot is the chord just above it.
        if t < 0.012:
            wide = span_at(poly, float(y0 + 0.012 * (y1 - y0)))
            if wide:
                xmin, xmax = wide
        fw = max(1e-3, xmax - xmin)
        depth = fw * float(np.interp(t, depth_ratio[0], depth_ratio[1]))
        br = float(np.interp(t, back_ratio[0], back_ratio[1]))
        cx = 0.5 * (xmin + xmax)
        bw = fw * br
        bx0, bx1 = cx - 0.5 * bw, cx + 0.5 * bw
        rings.append((float(y), xmin, xmax, bx0, bx1, depth))
    nxf, nz = 24, 8
    verts = []
    # index of ring vertex. layout per ring: front nxf, right nz-1, back nxf, left nz-1
    stride = nxf + (nz - 1) + nxf + (nz - 1)
    for y, xmin, xmax, bx0, bx1, depth in rings:
        for i in range(nxf):
            u = i / (nxf - 1)
            x = xmin + u * (xmax - xmin)
            off = sample_inset(insets["front"], u, (y - y0) / (y1 - y0))
            verts.append((x, y, 0.0 + off))
        for i in range(1, nz):
            u = i / nz
            x = xmax + u * (bx1 - xmax)
            z = 0.0 + u * (-depth)
            off = sample_inset(insets["right"], u, (y - y0) / (y1 - y0))
            # outward is roughly +x; a positive outward moves +x
            verts.append((x + off, y, z))
        for i in range(nxf):
            u = i / (nxf - 1)
            x = bx1 + u * (bx0 - bx1)
            off = sample_inset(insets["back"], u, (y - y0) / (y1 - y0))
            verts.append((x, y, -depth - off))
        for i in range(1, nz):
            u = i / nz
            x = bx0 + u * (xmin - bx0)
            z = -depth + u * depth
            off = sample_inset(insets["left"], u, (y - y0) / (y1 - y0))
            verts.append((x - off, y, z))
    V = np.asarray(verts, np.float64)
    faces = []
    uvs = []

    def quad(a, b, c, d, uv):
        # a-b-c-d around the face. Two tris a-b-c, a-c-d.
        faces.append((a, b, c))
        faces.append((a, c, d))
        uvs.append(uv[0:3])
        uvs.append((uv[0], uv[2], uv[3]))

    def uv_of(face, u, v):
        return (face, u, v)  # placeholder, packed later

    gx0 = min(min(r[1], r[3]) for r in rings)
    gx1 = max(max(r[2], r[4]) for r in rings)
    gw = max(1e-3, gx1 - gx0)

    def gu(x):
        return float(np.clip((x - gx0) / gw, 0, 1))

    for r in range(ny - 1):
        y = rings[r][0]
        v0 = (y - y0) / (y1 - y0)
        v1 = (rings[r + 1][0] - y0) / (y1 - y0)
        base = r * stride
        nxt = (r + 1) * stride
        # front u follows metres, the same map as the key projection
        for i in range(nxf - 1):
            def xu(ring, i):
                xmin, xmax = ring[1], ring[2]
                return xmin + (i / (nxf - 1)) * (xmax - xmin)
            u0, u1 = gu(xu(rings[r], i)), gu(xu(rings[r], i + 1))
            u0b, u1b = gu(xu(rings[r + 1], i)), gu(xu(rings[r + 1], i + 1))
            quad(base + i, base + i + 1, nxt + i + 1, nxt + i,
                 [uv_of("front", u0, v0), uv_of("front", u1, v0), uv_of("front", u1b, v1), uv_of("front", u0b, v1)])
        # right: indices nxf .. nxf+nz-2, plus corners front last and back first
        right_idx = [base + nxf - 1] + [base + nxf + i for i in range(nz - 1)] + [base + nxf + (nz - 1)]
        right_idx_n = [nxt + nxf - 1] + [nxt + nxf + i for i in range(nz - 1)] + [nxt + nxf + (nz - 1)]
        for i in range(len(right_idx) - 1):
            u0, u1 = i / (len(right_idx) - 1), (i + 1) / (len(right_idx) - 1)
            quad(right_idx[i], right_idx[i + 1], right_idx_n[i + 1], right_idx_n[i],
                 [uv_of("right", u0, v0), uv_of("right", u1, v0), uv_of("right", u1, v1), uv_of("right", u0, v1)])
        # back starts at nxf + (nz - 1)
        b0 = nxf + (nz - 1)
        for i in range(nxf - 1):
            # back panel u=0 is the viewer's left, which is the high-x side of this ring
            def xback(ring, i):
                bx0, bx1 = ring[3], ring[4]
                return bx1 + (i / (nxf - 1)) * (bx0 - bx1)
            u0, u1 = gu(xback(rings[r], i)), gu(xback(rings[r], i + 1))
            u0b, u1b = gu(xback(rings[r + 1], i)), gu(xback(rings[r + 1], i + 1))
            quad(base + b0 + i, base + b0 + i + 1, nxt + b0 + i + 1, nxt + b0 + i,
                 [uv_of("back", u0, v0), uv_of("back", u1, v0), uv_of("back", u1b, v1), uv_of("back", u0b, v1)])
        l0 = b0 + nxf
        left_idx = [base + b0 + nxf - 1] + [base + l0 + i for i in range(nz - 1)] + [base + 0]
        left_idx_n = [nxt + b0 + nxf - 1] + [nxt + l0 + i for i in range(nz - 1)] + [nxt + 0]
        for i in range(len(left_idx) - 1):
            u0, u1 = i / (len(left_idx) - 1), (i + 1) / (len(left_idx) - 1)
            quad(left_idx[i], left_idx[i + 1], left_idx_n[i + 1], left_idx_n[i],
                 [uv_of("left", u0, v0), uv_of("left", u1, v0), uv_of("left", u1, v1), uv_of("left", u0, v1)])
    # caps from the first and last ring, no invented roof paint
    foot = 0
    top = (ny - 1) * stride
    # bottom: outward -Y. The ring is CCW seen from +Z / outside, so from below it is CW.
    # Use a fan. Centre vertex.
    def centre(ring_base, zsign):
        ids = list(range(ring_base, ring_base + stride))
        c = V[ids].mean(0)
        if zsign < 0:
            c[1] = V[ids, 1].min()
        else:
            c[1] = V[ids, 1].max()
        verts_i = len(V)
        return c, ids

    # rebuild V with centres appended after faces of the walls are indexed
    foot_c = V[0:stride].mean(0)
    top_c = V[top:top + stride].mean(0)
    foot_c[1] = y0
    top_c[1] = y1
    V = np.vstack([V, foot_c, top_c])
    ic_foot = len(V) - 2
    ic_top = len(V) - 1
    for i in range(stride):
        j = (i + 1) % stride
        # bottom outward -Y: foot ring order seen from above is CCW-ish; flip
        faces.append((ic_foot, foot + j, foot + i))
        uvs.append([(0.02, 0.02), (0.02, 0.02), (0.02, 0.02)])
        faces.append((ic_top, top + i, top + j))
        uvs.append([(0.02, 0.98), (0.02, 0.98), (0.02, 0.98)])
    F = np.asarray(faces, np.int32)
    # fix winding so front faces point +Z
    front = F[0]
    a, b, c = V[front[0]], V[front[1]], V[front[2]]
    n = np.cross(b - a, c - a)
    if n[2] < 0:
        F = F[:, ::-1]
        uvs = [[u[2], u[1], u[0]] for u in uvs]
    V, F, uvs = weld_closed(V, F, uvs, y0, y1)
    return V, F, uvs, rings


def weld_closed(V, F, uvs, y0, y1, tol=0.002, tip=0.05):
    """The key crown and foot are points. Every vertex on that row becomes one vertex.

    Relief must not leave a ring of copies there: those copies share edges and
    the cap is non-manifold. A face that collapses is dropped. The wall
    triangle with one tip vertex and two vertices on the next ring stays.
    """
    def key_of(p):
        if abs(float(p[1]) - y0) <= tip:
            return ("foot",)
        if abs(float(p[1]) - y1) <= tip:
            return ("crown",)
        return tuple(np.round(p / tol).astype(np.int64))

    remap = {}
    new_v = []
    inv = np.empty(len(V), np.int32)
    for i, p in enumerate(V):
        k = key_of(p)
        j = remap.get(k)
        if j is None:
            j = len(new_v)
            remap[k] = j
            new_v.append(V[i])
        inv[i] = j
    for tag in (("foot",), ("crown",)):
        ids = [i for i, p in enumerate(V) if key_of(p) == tag]
        if ids and tag in remap:
            new_v[remap[tag]] = np.mean(np.asarray(V)[ids], axis=0)
    faces = []
    out_uv = []
    for f, uv in zip(F, uvs):
        nf = [int(inv[int(x)]) for x in f]
        if len(set(nf)) < 3:
            continue
        faces.append(nf)
        out_uv.append(uv)
    V2 = np.asarray(new_v, np.float64)
    F2 = np.asarray(faces, np.int32)
    used = np.zeros(len(V2), np.bool_)
    used[F2.ravel()] = True
    compact = np.full(len(V2), -1, np.int32)
    kept = np.flatnonzero(used)
    compact[kept] = np.arange(len(kept))
    return V2[kept], compact[F2], out_uv


def pack_atlas(images):
    """images: name -> rgb. Horizontal strip, no upscale. Returns atlas, uv rects in 0..1 (u0,v0,u1,v1) with v up."""
    h = max(im.shape[0] for im in images.values())
    w = sum(im.shape[1] for im in images.values())
    atlas = np.full((h, w, 3), 180, np.uint8)
    rects = {}
    x = 0
    for name, im in images.items():
        ih, iw = im.shape[:2]
        y = h - ih  # sit on the bottom of the strip; image row 0 is the top
        atlas[y:y + ih, x:x + iw] = im
        # glTF v 0 at the foot. Image bottom is the foot, which we placed at atlas row h-1.
        # flipY false: v=0 samples row 0 of the image file, and the file's row 0 is the top of the atlas.
        # So v=0 is the top of the atlas (sky of the strip) and v=1 is the bottom.
        # Foot of the tower must be v=1. The image bottom is at atlas row h-1, v = (h-1)/(h-1) = 1. Good.
        # Image top is at atlas row y, v = y / (h-1).
        v_top = y / max(1, h - 1)
        v_bot = (y + ih - 1) / max(1, h - 1)
        u0 = x / max(1, w - 1)
        u1 = (x + iw - 1) / max(1, w - 1)
        rects[name] = (u0, v_top, u1, v_bot)
        x += iw
    return atlas, rects


def bake_uv(raw_uvs, rects):
    out = np.zeros((len(raw_uvs), 3, 2), np.float64)
    for i, tri in enumerate(raw_uvs):
        for k, item in enumerate(tri):
            if isinstance(item, tuple) and len(item) == 3 and isinstance(item[0], str):
                name, u, v = item
                u0, vt, u1, vb = rects[name]
                # v is 0 at the foot. Image foot is vb (larger v in this packing).
                out[i, k, 0] = u0 + float(u) * (u1 - u0)
                out[i, k, 1] = vb + float(v) * (vt - vb)
            else:
                out[i, k, 0] = float(item[0])
                out[i, k, 1] = float(item[1])
    return out


def project_front(homo_path, key_path, poly, y0, y1, ppm):
    """Sample the key through the stored homography. One source pixel is never enlarged."""
    homo = json.load(open(homo_path))
    H = np.asarray(homo["homography_key_to_uv"], np.float64)
    try:
        Hinv = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        Hinv = None
    key = np.asarray(Image.open(key_path).convert("RGB"))
    kh, kw = key.shape[:2]
    x0 = float(homo["x0"])
    yy0 = float(homo["y0"])
    yy1 = float(homo["y1"])
    h = max(1e-6, yy1 - yy0)
    atlas = int(homo["atlas"])
    height = y1 - y0
    # width from the widest chord
    widths = []
    for y in np.linspace(y0, y1, 32):
        c = span_at(poly, float(y))
        if c:
            widths.append(c[1] - c[0])
    width = max(widths) if widths else 46.0
    ppm = min(ppm, 4.0)
    ih = max(8, int(round(height * ppm)))
    iw = max(8, int(round(width * ppm)))
    img = np.zeros((ih, iw, 3), np.uint8)
    xmin = min(span_at(poly, float(y))[0] for y in np.linspace(y0, y1, 16) if span_at(poly, float(y)))
    for row in range(ih):
        v_m = 1.0 - row / max(1, ih - 1)  # row 0 is the top
        y = y0 + v_m * (y1 - y0)
        chord = span_at(poly, float(y))
        if chord is None:
            continue
        xa, xb = chord
        for col in range(iw):
            u = col / max(1, iw - 1)
            x = xmin + u * width
            if x < xa - 0.2 or x > xb + 0.2:
                continue
            uu = (x - x0) / h
            vv = (yy1 - y) / h
            ax = uu * (atlas - 1)
            ay = vv * (atlas - 1)
            if Hinv is None:
                continue
            p = Hinv @ np.array([ax, ay, 1.0])
            if abs(p[2]) < 1e-8:
                continue
            px, py = p[0] / p[2], p[1] / p[2]
            if px < 0 or py < 0 or px >= kw - 1 or py >= kh - 1:
                continue
            x0i, y0i = int(px), int(py)
            tx, ty = px - x0i, py - y0i
            c00 = key[y0i, x0i].astype(np.float32)
            c10 = key[y0i, x0i + 1].astype(np.float32)
            c01 = key[y0i + 1, x0i].astype(np.float32)
            c11 = key[y0i + 1, x0i + 1].astype(np.float32)
            img[row, col] = (c00 * (1 - tx) * (1 - ty) + c10 * tx * (1 - ty) + c01 * (1 - tx) * ty + c11 * tx * ty).astype(np.uint8)
    return img


def classify_top(rgb):
    mask, _ = subject_mask(rgb)
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return {"shows_roof_plan": False, "reason": "no subject"}
    bh = int(ys.max() - ys.min() + 1)
    bw = int(xs.max() - xs.min() + 1)
    return {
        "shows_roof_plan": bool(bh / max(1, bw) < 1.2 and bh < rgb.shape[0] * 0.45),
        "bbox_hw": round(bh / max(1, bw), 3),
        "bands": 1,
        "used_for": None,
    }


def classify_under(rgb):
    mask, _ = subject_mask(rgb)
    row = mask.mean(1) > 0.02
    bands = 0
    prev = False
    for c in row:
        if c and not prev:
            bands += 1
        prev = bool(c)
    return {"bands": bands, "shows_soffit": bands >= 1, "used_for": "not a base plan; no ledge shelf was cut, so the pixels are not projected"}


def ncc_resize(a, b):
    a = cv2.resize(cv2.cvtColor(a, cv2.COLOR_RGB2GRAY), (64, 128)).astype(np.float32)
    b = cv2.resize(cv2.cvtColor(b, cv2.COLOR_RGB2GRAY), (64, 128)).astype(np.float32)
    a = (a - a.mean()) / (a.std() + 1e-6)
    b = (b - b.mean()) / (b.std() + 1e-6)
    return float((a * b).mean())


def main():
    t0 = time.time()
    work = None
    for i, a in enumerate(sys.argv):
        if a == "--work" and i + 1 < len(sys.argv):
            work = sys.argv[i + 1]
    if work is None:
        work = os.path.join(ROOT, "steps", "multiview-tower-1011", "work")
    os.makedirs(work, exist_ok=True)
    from common.align import camera as align_camera
    report = {"plates": {}, "rounds": []}
    # Week-2 / scene-strict lens. Stored avenue yaw is not copied into the layout.
    report["camera"] = {
        "module": "tools/common/align/camera.py",
        "project": "align.camera.project",
        "fov_y_deg": 88.0,
        "pitch_three_deg": -7.674,
        "eye_m": 1.77,
        "roll_deg": 0.17,
        "heading_deg": 248.531,
        "copied_stored_yaw": False,
        "front_sample": "key-city3 through the stored facade homography (solved under this lens). One source pixel is never enlarged.",
    }
    _ = align_camera.project
    sheet = np.asarray(Image.open(SHEET).convert("RGB"))
    panels, gutters = split_sheet(sheet)
    report["plates"]["sheet_gutters"] = gutters
    report["plates"]["panel_count"] = len(panels)
    if len(panels) != 4:
        json.dump(report, open(os.path.join(work, "multiview.json"), "w"), indent=1)
        raise SystemExit(f"expected 4 panels, got {len(panels)}")
    masks = []
    for i, name in enumerate(NAMES):
        Image.fromarray(panels[i]).save(os.path.join(work, f"panel-{name}.jpg"), quality=92)
        m, bg = subject_mask(panels[i])
        masks.append(m)
        Image.fromarray((m.astype(np.uint8) * 255)).save(os.path.join(work, f"mask-{name}.png"))
        h, w = panels[i].shape[:2]
        report["plates"][name] = {"px": [w, h], "hw": round(h / max(1, w), 3), "bg": [round(float(x), 1) for x in bg]}
    # what each panel shows, from the measured aspect and the prompt order
    report["plates"]["faces"] = {
        "front": "broad glass elevation, concrete pier on the viewer's right, sheared crown, two damage bands. Check only.",
        "left": "profile: concrete pier and cables, glass sliver on the viewer's left.",
        "back": "broad glass elevation, concrete pier on the viewer's left, damage not a copy of the front.",
        "right": "profile: concrete pier and cables, glass on the viewer's right.",
    }
    top = np.asarray(Image.open(VIEW_TOP).convert("RGB"))
    und = np.asarray(Image.open(VIEW_UNDER).convert("RGB"))
    report["plates"]["view_top"] = classify_top(top)
    report["plates"]["view_under"] = classify_under(und)
    report["plates"]["old_cuts"] = {}
    for name, path in OLD_CUTS.items():
        old = np.asarray(Image.open(path).convert("RGB"))
        report["plates"]["old_cuts"][name] = {
            "px": list(old.shape[:2][::-1]),
            "ncc_vs_sheet_panel": round(ncc_resize(old, panels[NAMES.index(name)]), 3),
            "reused": False,
            "reason": "desert perspective with sky and dunes, not the grey sheet",
        }
    # SAM2 feature masks. The silhouette stays the grey-distance mask.
    import fusion
    sam_log = []
    for i, name in enumerate(NAMES):
        sam_dir = os.path.join(work, f"sam-{name}")
        os.makedirs(sam_dir, exist_ok=True)
        labels = fusion._try_sam2(panels[i], masks[i], sam_log, sam_dir)
        report["plates"][name]["sam2"] = labels is not None
        if labels is not None:
            np.save(os.path.join(work, f"feat-{name}.npy"), labels)
    report["plates"]["sam2_log"] = sam_log
    report["plates"]["mask_method"] = "grey-distance silhouette (flat plate). SAM2 hiera-tiny for features when it returns. rembg is not installed."

    doc = json.load(open(TOWER_JSON))
    poly, y0, y1 = key_spans(doc)
    height = y1 - y0
    # ratios along the normalised height, foot -> crown. Image row 0 is the crown.
    front_w = mask_widths(masks[0])[::-1]
    def ratio(mask):
        w = mask_widths(mask)[::-1]
        n = min(len(w), len(front_w))
        src = np.linspace(0, 1, n)
        r = w[:n] / np.maximum(front_w[:n], 1.0)
        r = np.clip(r, 0.15, 1.4)
        return src, r
    depth_l = ratio(masks[1])
    depth_r = ratio(masks[3])
    depth_ratio = (depth_l[0], 0.5 * (depth_l[1] + np.interp(depth_l[0], depth_r[0], depth_r[1])))
    back_ratio = ratio(masks[2])
    # base d/w and h/w from the plates and the key chord
    base = span_at(poly, y0 + 0.02 * height)
    fw = base[1] - base[0]
    d_over_w = float(depth_ratio[1][0])
    h_over_w = float(height / fw)
    report["proportions"] = {
        "height_m": round(height, 3),
        "width_m": round(fw, 3),
        "depth_over_w_base": round(d_over_w, 3),
        "h_over_w": round(h_over_w, 3),
        "source": "width and height from the key silhouette; depth/width from left and right panel widths at the same height",
    }
    # Front first, then colour-match each hidden face's shared edge to that key projection.
    ppm_front = 419.0 / height
    front_img = project_front(HOMO, KEY, poly, y0, y1, ppm_front)
    front_m = front_img.sum(2) > 8
    seam = {}
    for idx, side in ((1, "left"), (3, "right")):
        src_edge = edge_strip(panels[idx], masks[idx], "right" if side == "left" else "left")
        ref_edge = edge_strip(front_img, front_m, side)
        before = delta_e(panels[idx], src_edge, front_img, ref_edge)
        img = reinhard(panels[idx], src_edge, front_img, ref_edge)
        after = delta_e(img, src_edge, front_img, ref_edge)
        if side == "left":
            left_img = img
        else:
            right_img = img
        seam[side] = {"delta_e_before": before, "delta_e_after": after, "reference": "key-front"}
    back_edge = edge_strip(panels[2], masks[2], "left")
    ref_edge = edge_strip(right_img, masks[3], "right")
    before = delta_e(panels[2], back_edge, right_img, ref_edge)
    back_img = reinhard(panels[2], back_edge, right_img, ref_edge)
    after = delta_e(back_img, back_edge, right_img, ref_edge)
    seam["back"] = {"delta_e_before": before, "delta_e_after": after, "reference": "graded-right, itself matched to the key front"}
    report["seams"] = {
        k: {kk: (None if vv is None else round(vv, 3) if isinstance(vv, float) else vv) for kk, vv in d.items()}
        for k, d in seam.items()
    }

    # feather 12 px at the shared corners
    def feather(a, b, a_side, b_side, n=12):
        if a_side == "right":
            aa = a[:, -n:].astype(np.float32)
        else:
            aa = a[:, :n].astype(np.float32)
        if b_side == "left":
            bb = b[:, :n].astype(np.float32)
        else:
            bb = b[:, -n:].astype(np.float32)
        bb = cv2.resize(bb, (n, a.shape[0]))
        ramp = np.linspace(0, 1, n, dtype=np.float32)[None, :, None]
        mixed = aa * (1 - ramp) + bb * ramp if a_side == "left" else aa * ramp + bb * (1 - ramp)
        if a_side == "right":
            a[:, -n:] = mixed.astype(np.uint8)
        else:
            a[:, :n] = mixed.astype(np.uint8)
        return a
    # left panel's right edge meets the key front's left edge
    left_img = feather(left_img, front_img, "right", "left")
    right_img = feather(right_img, front_img, "left", "right")
    back_img = feather(back_img, right_img, "left", "left")

    # MoGe on each painted face. One process, one weight load.
    Image.fromarray(front_img).save(os.path.join(work, "front-key.jpg"), quality=92)
    face_img = {"front": front_img, "left": left_img, "back": back_img, "right": right_img}
    for name, im in face_img.items():
        Image.fromarray(im).save(os.path.join(work, f"grade-{name}.jpg"), quality=90)
    # masks for graded images: front is the projected tower (nonzero), others are the sheet masks
    face_mask = {
        "front": front_img.sum(2) > 8,
        "left": masks[1],
        "back": masks[2],
        "right": masks[3],
    }
    # left/right/back masks match the original panel size, which the graded images kept
    insets = {}
    relief_report = {}
    batch = []
    for name, im in face_img.items():
        path = os.path.join(work, f"grade-{name}.jpg")
        npy = path + ".moge.npy"
        if not os.path.isfile(npy):
            batch.extend([path, npy])
    if batch:
        py = "/workspace/.venv-sam2/bin/python"
        script = os.path.join(HERE, "moge_depth.py")
        r = subprocess.run([py, script, *batch], capture_output=True, text=True, timeout=1800)
        print(r.stdout[-600:] if r.stdout else "")
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout or "moge batch failed")[-800:])
    for name, im in face_img.items():
        m = face_mask[name]
        if m.shape[:2] != im.shape[:2]:
            m = cv2.resize(m.astype(np.uint8), (im.shape[1], im.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
        path = os.path.join(work, f"grade-{name}.jpg")
        ppm = im.shape[0] / height
        outward = metric_outward(path, m, ppm)
        q, meta = quantise_measured(outward, m, ppm)
        insets[name] = q
        meta["per_metre_median_span_m"] = round(per_metre_span(q, m), 4)
        meta["ppm"] = round(ppm, 3)
        relief_report[name] = meta
        np.save(os.path.join(work, f"inset-{name}.npy"), q)
    report["relief_faces"] = relief_report

    # cheap 2D: silhouette of the loft profile vs the panel, stripe on the front
    from common.align.metrics import strict_geometry
    # build a binary of the key front chord as the render silhouette and compare to the front panel
    key_mask = np.zeros(panels[0].shape[:2], np.uint8)
    hh, ww = key_mask.shape
    for row in range(hh):
        y = y1 - (row / max(1, hh - 1)) * height
        c = span_at(poly, float(y))
        if not c:
            continue
        # map metres across the panel width via the panel's own mask chord
        xs = np.where(masks[0][row])[0]
        if len(xs) < 2:
            continue
        key_mask[row, xs[0]:xs[-1] + 1] = 1
    report["cheap"] = {
        "front_panel_vs_key_chord_iou": round(silhouette_iou(key_mask, masks[0]), 4),
        "note": "The front panel is a check. The solid outline is the key chord.",
    }
    geo = strict_geometry(front_img, np.asarray(Image.open("/workspace/i23d-auto/zoneb-tower-vision/vision/key-crop.jpg").convert("RGB")))
    report["cheap"]["front_vs_key_strict_geometry"] = geo["strict"]
    report["cheap"]["stripe"] = geo["stripe"]

    V, F, raw_uv, rings = build_mesh(poly, y0, y1, depth_ratio, back_ratio, insets, ny=80)
    atlas, rects = pack_atlas(face_img)
    UV = bake_uv(raw_uv, rects)
    # Caps are unpainted (view-top is not a roof plan). Give them grey-padding
    # UVs at the front face's px/m so the jacobian is finite.
    ah, aw = atlas.shape[:2]
    ppm_cap = ah / max(1e-6, y1 - y0) if False else (face_img["front"].shape[0] / max(1e-6, y1 - y0))
    x0 = float(V[:, 0].min())
    z0 = float(V[:, 2].min())
    for i, f in enumerate(F):
        if abs(float(UV[i, 0, 0]) - 0.02) > 1e-6:
            continue
        for k in range(3):
            x, z = float(V[f[k], 0]), float(V[f[k], 2])
            UV[i, k, 0] = float(np.clip(0.002 + (x - x0) * ppm_cap / aw, 0, 0.12))
            UV[i, k, 1] = float(np.clip(0.002 + (z - z0) * ppm_cap / ah, 0, 0.45))
    Image.fromarray(atlas).save(os.path.join(work, "albedo.png"))
    # flat normal; the geometry holds the relief. A mismatched old normal would invent shading.
    normal = np.zeros((*atlas.shape[:2], 3), np.uint8)
    normal[..., 0] = 128
    normal[..., 1] = 128
    normal[..., 2] = 255
    Image.fromarray(normal).save(os.path.join(work, "normal.png"))
    np.savez(os.path.join(work, "tower.npz"), V=V, F=F, UV=UV)
    sizes = V.max(0) - V.min(0)
    report["mesh_preview"] = {
        "verts": int(len(V)),
        "faces": int(len(F)),
        "size_m": [round(float(s), 3) for s in sizes],
        "h_over_w": round(float(sizes[1] / max(1e-6, sizes[0])), 3),
        "d_over_w": round(float(sizes[2] / max(1e-6, sizes[0])), 3),
    }
    # axis relief from vertex offsets vs the unmoved hull is the inset span already logged
    report["relief_axes_note"] = "Per-face median span is in relief_faces. World axes are scored by the object gate on the glb."
    blender = "/home/box/.local/bin/blender"
    script = os.path.join(HERE, "vision_mesh.py")
    glb = os.path.join(work, "tower.glb")
    rep_path = os.path.join(work, "vision-mesh.json")
    r = subprocess.run(
        [blender, "-b", "-P", script, "--", os.path.join(work, "tower.npz"), glb, rep_path],
        capture_output=True, text=True, timeout=180,
    )
    report["blender_rc"] = r.returncode
    report["blender_tail"] = ((r.stdout or "") + "\n" + (r.stderr or ""))[-1200:]
    if os.path.isfile(rep_path):
        report["vision_mesh"] = json.load(open(rep_path))
    report["seconds"] = round(time.time() - t0, 3)
    json.dump(report, open(os.path.join(work, "multiview.json"), "w"), indent=1)
    print(json.dumps({k: report[k] for k in ("proportions", "mesh_preview", "seams", "cheap", "blender_rc", "seconds")}, indent=1))
    if r.returncode not in (0, 2):
        print(r.stderr[-1500:])
        raise SystemExit(r.returncode or 1)


if __name__ == "__main__":
    main()
