#!/usr/bin/env python3
"""Planar wedge for the Zone B hero tower (key silhouette, one front plane, tilted back plane).

Depth Anything is used only to tilt and place that plane. The facade is not a wavy depth mesh.
Writes mesh/tower.json, atlas-key.png, albedo-key.png, preview.png, qc.json under --out.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import cv2

sys.path.insert(0, "/workspace/kc-wt/tools/imagine-to-3d")
import depth_relief as DR

KEY = "/workspace/zb-bible-1008/key-city3.jpg"
MASK_SRC = "/workspace/proj-1010/out/mask.png"
CAM = "/workspace/proj-1010/keycam.json"
W, H = 1280, 720


def load_cam():
    K = json.load(open(CAM))
    MW = np.array(K["mw"], np.float64).reshape(4, 4).T
    PM = np.array(K["pm"], np.float64).reshape(4, 4).T
    GA = np.array(K["H"], np.float64)
    return K, MW, PM, GA


def ray_dir(MW, PM, u, v):
    R = MW[:3, :3]
    x = (u + 0.5) / W * 2 - 1
    y = 1 - (v + 0.5) / H * 2
    d = R @ np.stack([x / PM[0, 0], y / PM[1, 1], -np.ones_like(np.asarray(x, float))], 0).reshape(3, -1)
    d = (d / np.linalg.norm(d, axis=0)).T
    return d.reshape(np.shape(np.asarray(u, float)) + (3,))


def project(MW, PM, P):
    view = np.linalg.inv(MW)
    ph = np.concatenate([np.asarray(P, float).reshape(-1, 3), np.ones((len(np.atleast_2d(P)), 1))], 1)
    cam = (view @ ph.T).T
    z = -cam[:, 2]
    ndc_x = PM[0, 0] * (cam[:, 0] / z)
    ndc_y = PM[1, 1] * (cam[:, 1] / z)
    u = (ndc_x + 1) * 0.5 * W
    v = (1 - ndc_y) * 0.5 * H
    return np.stack([u, v, z], 1)


def ground_at(GA, x, z):
    k = np.argmin((GA[:, 0] - x) ** 2 + (GA[:, 1] - z) ** 2)
    return float(GA[k, 2])


def signed_area(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))


def point_in_tri(p, a, b, c):
    v0, v1, v2 = c - a, b - a, p - a
    dot00, dot01, dot02 = np.dot(v0, v0), np.dot(v0, v1), np.dot(v0, v2)
    dot11, dot12 = np.dot(v1, v1), np.dot(v1, v2)
    den = dot00 * dot11 - dot01 * dot01
    if abs(den) < 1e-12:
        return False
    u = (dot11 * dot02 - dot01 * dot12) / den
    v = (dot00 * dot12 - dot01 * dot02) / den
    return u >= -1e-6 and v >= -1e-6 and u + v <= 1 + 1e-6


def earclip(P):
    """CCW ear clip. Returns triangle index triples into P."""
    P = np.asarray(P, float)
    n0 = len(P)
    if n0 < 3:
        return []
    idx = list(range(n0))
    if signed_area(P) < 0:
        idx.reverse()
    tris = []
    guard = 0
    while len(idx) > 3 and guard < n0 * n0:
        guard += 1
        n = len(idx)
        clipped = False
        for i in range(n):
            i0, i1, i2 = idx[(i - 1) % n], idx[i], idx[(i + 1) % n]
            a, b, c = P[i0], P[i1], P[i2]
            e1, e2 = b - a, c - b
            if e1[0] * e2[1] - e1[1] * e2[0] <= 1e-8:
                continue
            if any(point_in_tri(P[j], a, b, c) for j in idx if j not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2))
            del idx[i]
            clipped = True
            break
        if not clipped:
            break
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def contour_poly(mask, eps_frac):
    cnts, hier = cv2.findContours((mask > 0).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hier is None or not len(cnts):
        raise SystemExit("no contour")
    hier = hier[0]
    outers = [i for i, h in enumerate(hier) if h[3] < 0]
    oi = max(outers, key=lambda i: cv2.contourArea(cnts[i]))
    cnt = cnts[oi]
    eps = eps_frac * cv2.arcLength(cnt, True)
    approx = cv2.approxPolyDP(cnt, eps, True).reshape(-1, 2).astype(float)
    holes = []
    for i, h in enumerate(hier):
        if h[3] == oi and cv2.contourArea(cnts[i]) > 350:
            ha = cv2.approxPolyDP(cnts[i], eps * 0.8, True).reshape(-1, 2).astype(float)
            if len(ha) >= 3:
                holes.append(ha)
    holes.sort(key=lambda p: -abs(signed_area(p)))
    return approx, holes[:1]


def poly_mask(poly, holes, shape):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.round(poly).astype(np.int32)], 255)
    for h in holes:
        cv2.fillPoly(m, [np.round(h).astype(np.int32)], 0)
    return m > 0


def bridge(outer, hole):
    """Splice a hole ring into the outer ring (one bridge). Both Nx2."""
    o, h = np.asarray(outer, float), np.asarray(hole, float)
    if signed_area(h) > 0:
        h = h[::-1]
    d = ((o[:, None, :] - h[None, :, :]) ** 2).sum(2)
    i, j = np.unravel_index(np.argmin(d), d.shape)
    # outer 0..i, hole j..end+start..j, back to outer i..end
    return np.vstack([o[: i + 1], h[j:], h[: j + 1], o[i:]])


def fit_plane(MW, PM, mask, GA):
    """One plane: anchor at the t2-m3 station along the base ray, tilt from DA-V2."""
    R = MW[:3, :3]
    C = MW[:3, 3]
    key = np.asarray(Image.open(KEY).convert("RGB"))
    ys, xs = np.nonzero(mask)
    vb, ub = ys.max(), xs[ys > ys.max() - 6].mean()
    F = np.array([0.97933, 0, -0.20233])
    T2 = np.array([87.57584999575319, 0.0, -62.795895370291646])
    rb = ray_dir(MW, PM, np.array(ub), np.array(vb)).reshape(3)
    s_t2 = float((T2 - C) @ F)
    tb = s_t2 / float(rb @ F)
    Pb = C + tb * rb
    # DA on a context crop, scale-only, anchored at the base
    X0, Y0, X1, Y1 = 300, 0, 660, 560
    sess, kind = DR.session()
    disp = DR.disparity(sess, kind, Image.fromarray(key[Y0:Y1, X0:X1]))
    if disp.shape != (Y1 - Y0, X1 - X0):
        disp = np.asarray(Image.fromarray(disp.astype(np.float32)).resize((X1 - X0, Y1 - Y0), Image.BILINEAR))
    D = np.full((H, W), np.nan, np.float32)
    D[Y0:Y1, X0:X1] = disp
    dmed = np.nanmedian(D[mask])
    z_anchor = tb * float(rb @ (-R[:, 2]))
    zcam = z_anchor * (dmed / np.clip(D, 1e-6, None))
    # robust linear fit of camera-z over the mask (the plane's tilt)
    sel = mask & np.isfinite(zcam)
    uu, vv = np.meshgrid(np.arange(W), np.arange(H))
    samp = np.flatnonzero(sel.ravel())
    if len(samp) > 4000:
        samp = samp[:: len(samp) // 4000]
    A = np.stack([uu.ravel()[samp], vv.ravel()[samp], np.ones(len(samp))], 1)
    z = zcam.ravel()[samp]
    med = np.median(z)
    keep = np.abs(z - med) < 12
    coef, *_ = np.linalg.lstsq(A[keep], z[keep], rcond=None)
    # clamp tilt: a plane that tips more than ~12 m across the tower is the wavy failure
    span_u = (xs.max() - xs.min()) * coef[0]
    span_v = (ys.max() - ys.min()) * coef[1]
    lim = 8.0
    if abs(span_u) > lim:
        coef[0] *= lim / abs(span_u)
    if abs(span_v) > lim:
        coef[1] *= lim / abs(span_v)
    # plane in camera z: z = coef · (u, v, 1), forced through the anchor pixel
    z_pb = float(coef[0] * ub + coef[1] * vb + coef[2])
    coef[2] += z_anchor - z_pb

    def hit(u, v):
        d = ray_dir(MW, PM, np.asarray(u, float), np.asarray(v, float)).reshape(-1, 3)
        z = coef[0] * np.asarray(u, float) + coef[1] * np.asarray(v, float) + coef[2]
        # camera-z of a point C + t d is t * (d · fwd), fwd = -R[:,2]
        fwd = -R[:, 2]
        t = z.reshape(-1) / (d @ fwd)
        return C + d * t.reshape(-1, 1)

    nrm = None
    return hit, Pb, C, R, coef, z_anchor


def delight(rgb, mask):
    """Divide out a smooth luminance so a flat sun can relight. Panel-scale contrast stays."""
    r = rgb.astype(np.float32) / 255.0
    luma = 0.2126 * r[..., 0] + 0.7152 * r[..., 1] + 0.0722 * r[..., 2]
    im = Image.fromarray(np.clip(luma * 255, 0, 255).astype(np.uint8))
    sigma = max(im.size) / 7.0
    Ls = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma)), np.float32) / 255.0
    Ls = np.clip(Ls, 0.08, 0.85)
    # partial: full division flattens the glass; 0.55 keeps the broad dusk gradient removable
    ratio = (0.40 / Ls) ** 0.55
    out = np.clip(r * ratio[..., None], 0, 1)
    # outside the mask, neutral graphite sampled from the key (no invented colour)
    body = r[mask]
    if len(body):
        med = np.median(body, 0)
        out[~mask] = np.clip(med * (0.40 / max(np.median(luma[mask]), 0.08)) ** 0.55, 0, 1)
    return (out * 255).astype(np.uint8), ratio


def box_tris(center, ax, ay, az, sx, sy, sz):
    """12 tris of a box. ax,ay,az are unit axes. Returns (verts 36x3,)."""
    c = np.asarray(center, float)
    X, Y, Z = np.asarray(ax, float) * sx, np.asarray(ay, float) * sy, np.asarray(az, float) * sz
    p = []
    for i in (-1, 1):
        for j in (-1, 1):
            for k in (-1, 1):
                p.append(c + i * X + j * Y + k * Z)
    p = np.array(p)  # bit order ijk: 0..7
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    v = []
    for a, b, c_, d in faces:
        v.extend([p[a], p[b], p[c_], p[a], p[c_], p[d]])
    return np.array(v, np.float32)


def tube(points, radius, sides=5):
    P = np.asarray(points, float)
    v = []
    rings = []
    for i, p in enumerate(P):
        t = P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]
        t = t / (np.linalg.norm(t) + 1e-9)
        up = np.array([0.0, 1.0, 0.0])
        if abs(t @ up) > 0.9:
            up = np.array([1.0, 0.0, 0.0])
        n = np.cross(t, up); n /= np.linalg.norm(n)
        b = np.cross(t, n)
        ring = [p + radius * (np.cos(2 * np.pi * k / sides) * n + np.sin(2 * np.pi * k / sides) * b) for k in range(sides)]
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(sides):
            a, b = rings[i][k], rings[i][(k + 1) % sides]
            c, d = rings[i + 1][(k + 1) % sides], rings[i + 1][k]
            v.extend([a, d, c, a, c, b])
    return np.array(v, np.float32) if v else np.zeros((0, 3), np.float32)


def manifold_report(verts):
    """Non-indexed triangles (N,3,3). Weld at 2 mm. Returns open, nonmanifold, islands."""
    V = np.round(verts.reshape(-1, 3) / 0.002) * 0.002
    tris = V.reshape(-1, 3, 3)
    # map vertex -> id
    key = {}
    ids = np.empty(len(V), np.int32)
    for i, p in enumerate(V):
        k = (p[0], p[1], p[2])
        if k not in key:
            key[k] = len(key)
        ids[i] = key[k]
    ids = ids.reshape(-1, 3)
    from collections import Counter
    edges = Counter()
    for a, b, c in ids:
        for e in ((a, b), (b, c), (c, a)):
            e2 = (e[0], e[1]) if e[0] < e[1] else (e[1], e[0])
            edges[e2] += 1
    counts = np.array(list(edges.values()))
    # islands via triangle adjacency
    parent = np.arange(len(ids))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(i, j):
        a, b = find(i), find(j)
        if a != b:
            parent[b] = a

    edge_tri = {}
    for ti, (a, b, c) in enumerate(ids):
        for e in ((min(a, b), max(a, b)), (min(b, c), max(b, c)), (min(c, a), max(c, a))):
            if e in edge_tri:
                union(ti, edge_tri[e])
            else:
                edge_tri[e] = ti
    roots = {find(i) for i in range(len(ids))}
    return dict(open=int((counts == 1).sum()), nonmanifold=int((counts > 2).sum()), islands=len(roots), tris=int(len(tris)), welded=len(key))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "/workspace/zb-tower-hybrid-1010/mesh"
    os.makedirs(out, exist_ok=True)
    K, MW, PM, GA = load_cam()
    mask = np.asarray(Image.open(MASK_SRC).convert("L")) > 0
    key = np.asarray(Image.open(KEY).convert("RGB"))
    # silhouette: tighten the polygon until the filled IoU vs the mask holds
    best = None
    for frac in (0.004, 0.006, 0.009, 0.012, 0.018):
        poly, holes = contour_poly(mask, frac)
        pm = poly_mask(poly, holes, mask.shape)
        inter = np.logical_and(pm, mask).sum()
        union = np.logical_or(pm, mask).sum()
        iou = inter / max(1, union)
        print(f"poly frac {frac} verts {len(poly)} holes {len(holes)} iou {iou:.3f}")
        if best is None or iou > best[0]:
            best = (iou, poly, holes, frac)
        if iou >= 0.93 and len(poly) <= 48:
            best = (iou, poly, holes, frac)
            break
    iou_p, poly, holes, frac = best
    print("chosen", frac, "verts", len(poly), "iou", round(iou_p, 3))
    hit, Pb, C, R, coef, z_anchor = fit_plane(MW, PM, mask, GA)
    # Standing blade: boundary on the silhouette rays, on ONE nearly vertical plane
    # through the anchor. DA only supplies a few metres of tilt (not a camera-facing card).
    Nh = C - Pb
    Nh[1] = 0.0
    Nh = Nh / np.linalg.norm(Nh)
    dirs = ray_dir(MW, PM, poly[:, 0], poly[:, 1]).reshape(-1, 3)
    t_hit = float(np.dot(Pb - C, Nh)) / (dirs @ Nh)
    F3 = C + dirs * t_hit.reshape(-1, 1)
    lat_axis = np.cross(np.array([0.0, 1.0, 0.0]), Nh)
    lat_axis = lat_axis / np.linalg.norm(lat_axis)
    lat = (F3 - Pb) @ lat_axis
    # DA gradient across the tower, clamped to ±4 m, applied along the horizontal normal (still one plane)
    du = (poly[:, 0] - poly[:, 0].mean()) * coef[0] + (poly[:, 1] - poly[:, 1].mean()) * coef[1]
    du = np.clip(du, -4.0, 4.0)
    F3 = F3 + Nh * du.reshape(-1, 1)
    N = Nh
    # wedge: back plane is the front translated along -N, more at the base than the crown
    y = F3[:, 1]
    y0, y1 = float(y.min()), float(y.max())
    width = float(np.linalg.norm(F3[np.argmin(poly[:, 0])] - F3[np.argmax(poly[:, 0])]))
    # base width from the lowest 8% of the front
    base = F3[y < y0 + 0.08 * (y1 - y0)]
    if len(base) >= 2:
        width = max(width, float(np.linalg.norm(base.max(0) - base.min(0))))
    # horizontal width (xz)
    width = float(np.hypot(F3[:, 0].max() - F3[:, 0].min(), F3[:, 2].max() - F3[:, 2].min()))
    D0 = 0.58 * width
    D1 = 0.34 * width
    t = (y - y0) / max(1e-6, y1 - y0)
    B3 = F3 - N * (D0 + (D1 - D0) * t)[:, None]
    depth = float(D0)
    print(f"width {width:.2f} depth {depth:.2f} d/w {depth / width:.3f} height {y1 - y0:.2f}")

    # hole ring in 3D
    H3 = Bhole = None
    if holes:
        H3 = hit(holes[0][:, 0], holes[0][:, 1])
        th = (H3[:, 1] - y0) / max(1e-6, y1 - y0)
        Bhole = H3 - N * (D0 + (D1 - D0) * th)[:, None]

    def cap(front_pts, uv_pts, hole_pts=None, hole_uv=None):
        if hole_pts is not None and len(hole_pts):
            ring = bridge(uv_pts, hole_uv)
            # map ring rows back is not 1:1 with 3D. Triangulate in UV, then barycentric... 
            # Simpler: triangulate the bridged UV polygon and look up 3D by matching coordinates.
            tris = earclip(ring)
            src = np.vstack([front_pts, hole_pts])
            src_uv = np.vstack([uv_pts, hole_uv])
            # ring was built from uv order; rebuild the 3D ring the same way
            o, h = uv_pts, hole_uv
            if signed_area(h) > 0:
                h3 = hole_pts[::-1]
                h = h[::-1]
            else:
                h3 = hole_pts
            d = ((o[:, None, :] - h[None, :, :]) ** 2).sum(2)
            i, j = np.unravel_index(np.argmin(d), d.shape)
            ring3 = np.vstack([front_pts[: i + 1], h3[j:], h3[: j + 1], front_pts[i:]])
            return [(ring3[a], ring3[b], ring3[c]) for a, b, c in tris]
        tris = earclip(uv_pts)
        return [(front_pts[a], front_pts[b], front_pts[c]) for a, b, c in tris]

    hole_uv = holes[0] if holes else None
    front_tris = cap(F3, poly, H3, hole_uv)
    back_tris = cap(B3, poly, Bhole, hole_uv)
    # back winding opposite
    back_tris = [(c, b, a) for a, b, c in back_tris]

    def quad(a, b, c, d):
        return [(a, b, c), (a, c, d)]

    sides = []
    side_uvs = []
    n = len(F3)
    base_i = [i for i in range(n) if poly[i, 1] >= poly[:, 1].max() - 8]
    base_set = set(base_i)
    seg_len = np.linalg.norm(np.roll(F3, -1, 0) - F3, axis=1)
    chain = np.concatenate([[0.0], np.cumsum(seg_len)[:-1]])
    for i in range(n):
        # the bottom edge is closed by the plinth, not by a second side quad
        if i in base_set and (i + 1) % n in base_set:
            continue
        j = (i + 1) % n
        a, b, c, d = F3[i], F3[j], B3[j], B3[i]
        dep_a = float(np.linalg.norm(d - a))
        dep_b = float(np.linalg.norm(c - b))
        s0, s1 = float(chain[i]), float(chain[i] + seg_len[i])
        # u = arc length along the silhouette, v = metres from the front face toward the back
        ua, ub, uc, ud = (s0, 0.0), (s1, 0.0), (s1, dep_b), (s0, dep_a)
        sides += [(a, b, c), (a, c, d)]
        side_uvs += [np.array([ua, ub, uc], np.float32), np.array([ua, uc, ud], np.float32)]
    if H3 is not None:
        m = len(H3)
        for i in range(m):
            # tunnel, opposite winding so normals face the hole
            sides += quad(H3[(i + 1) % m], H3[i], Bhole[i], Bhole[(i + 1) % m])

    # plinth: drop the base edge vertically, shifted 1.5 m away from the camera so the
    # key view does not grow a skirt outside the mask. Covers the ~14 m buried strip.
    gy = ground_at(GA, float(Pb[0]), float(Pb[2]))
    sink = gy - 3.0  # ≥ 2 m under the dune
    plinth = []
    if len(base_i) >= 2:
        base_i = sorted(base_i, key=lambda i: poly[i, 0])
        # only the chain along the bottom, not the whole ring
        def drop(p):
            q = p.copy()
            q[1] = sink
            q = q - N * 1.5  # into the dune, away from the key camera
            return q
        for i in range(len(base_i) - 1):
            a, b = F3[base_i[i]], F3[base_i[i + 1]]
            plinth += quad(a, b, drop(b), drop(a))
            c, d = B3[base_i[i]], B3[base_i[i + 1]]
            plinth += quad(d, c, drop(c), drop(d))
        # close the two ends and the floor
        a, b = F3[base_i[0]], B3[base_i[0]]
        plinth += quad(a, b, drop(b), drop(a))
        a, b = B3[base_i[-1]], F3[base_i[-1]]
        plinth += quad(a, b, drop(b), drop(a))
        plinth += quad(drop(F3[base_i[0]]), drop(B3[base_i[0]]), drop(B3[base_i[-1]]), drop(F3[base_i[-1]]))
    print("plinth tris", len(plinth), "sink", round(sink, 2), "ground", round(gy, 2), "baseY", round(float(y0), 2), "strip", round(float(y0) - gy, 2))

    # atlas from the mask bbox, native pixels
    ub0, ub1 = int(poly[:, 0].min()), int(np.ceil(poly[:, 0].max()))
    vb0, vb1 = int(poly[:, 1].min()), int(np.ceil(poly[:, 1].max()))
    ub0, vb0 = max(0, ub0), max(0, vb0)
    ub1, vb1 = min(W, ub1 + 1), min(H, vb1 + 1)
    crop = key[vb0:vb1, ub0:ub1]
    am = mask[vb0:vb1, ub0:ub1]
    alb, ratio = delight(crop, am)
    rgba = np.dstack([crop, (am * 255).astype(np.uint8)])
    Image.fromarray(rgba, "RGBA").save(os.path.join(out, "atlas-key.png"))
    Image.fromarray(np.dstack([alb, (am * 255).astype(np.uint8)]), "RGBA").save(os.path.join(out, "albedo-key.png"))
    masked = crop[am > 0.5].astype(np.float32) / 255.0
    luma_m = masked.mean(1)

    def srgb_lin(c):
        c = np.clip(np.asarray(c, np.float32), 0, 1)
        return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)

    chrome_s = masked[luma_m >= np.percentile(luma_m, 90)].mean(0)
    cable_s = masked[luma_m <= np.percentile(luma_m, 12)].mean(0)
    panel_s = np.median(masked, 0)
    COL_CHROME = tuple(float(x) for x in srgb_lin(chrome_s))
    COL_CABLE = tuple(float(x) for x in srgb_lin(cable_s))
    COL_RUNG = tuple(float(x) for x in srgb_lin(0.65 * chrome_s + 0.35 * panel_s))
    print("trim srgb chrome", np.round(chrome_s, 3).tolist(), "cable", np.round(cable_s, 3).tolist())

    def uv_of(pix):
        return np.stack([(pix[:, 0] - ub0) / (ub1 - ub0), (pix[:, 1] - vb0) / (vb1 - vb0)], 1)

    # pack body triangles with face id and uvs
    # face: 0 front, 1 side (split left/right later by normal), 3 back, 5 plinth
    body_v, body_uv, body_key, body_face = [], [], [], []

    def add(tris, face, uvs_fn):
        for a, b, c in tris:
            pts = np.stack([a, b, c])
            body_v.append(pts)
            body_face.append(np.full(3, face, np.float32))
            body_uv.append(uvs_fn(pts))
            body_key.append(uvs_fn(pts))

    def front_uv(pts):
        pr = project(MW, PM, pts)
        return uv_of(pr[:, :2]).astype(np.float32)

    def side_uv(pts):
        # metres across the face, 1 uv = 1 m, scaled in the shader per plate
        h = pts[:, 1] - y0
        # horizontal arc length approx
        return np.stack([pts[:, 0] * 0.0 + pts[:, 2], h], 1).astype(np.float32)  # replaced below

    add(front_tris, 0, front_uv)
    add(back_tris, 3, lambda pts: front_uv(pts + N * 0))  # placeholder, planar metres below
    right = np.cross(N, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right) + 1e-9

    def plane_uv(pts):
        e1 = pts[1] - pts[0]
        e2 = pts[2] - pts[0]
        nrm = np.cross(e1, e2)
        ln = np.linalg.norm(nrm) + 1e-9
        nrm = nrm / ln
        uax = e1 / (np.linalg.norm(e1) + 1e-9)
        vax = np.cross(nrm, uax)
        vax = vax / (np.linalg.norm(vax) + 1e-9)
        rel = pts - pts[0]
        return np.stack([rel @ uax, rel @ vax], 1).astype(np.float32)

    for tri, uv in zip(sides, side_uvs):
        pts = np.stack(tri)
        nrm = np.cross(pts[1] - pts[0], pts[2] - pts[0])
        nrm = nrm / (np.linalg.norm(nrm) + 1e-9)
        face = 1 if float(nrm @ right) >= 0 else 2
        if abs(float(nrm @ np.array([0.0, 1.0, 0.0]))) > 0.72:
            face = 4
            uv = plane_uv(pts)
        body_v.append(pts.astype(np.float32))
        body_face.append(np.full(3, face, np.float32))
        body_uv.append(np.asarray(uv, np.float32))
        body_key.append(np.zeros((3, 2), np.float32))
    for tri in plinth:
        pts = np.stack(tri).astype(np.float32)
        body_v.append(pts)
        body_face.append(np.full(3, 5, np.float32))
        body_uv.append(plane_uv(pts))
        body_key.append(np.zeros((3, 2), np.float32))

    V = np.concatenate(body_v, 0).astype(np.float32)
    UV = np.concatenate(body_uv, 0).astype(np.float32)
    UK = np.concatenate(body_key, 0).astype(np.float32)
    FC = np.concatenate(body_face, 0).astype(np.float32)
    # Plate UVs in metres, origin at the face min. Key UVs stay projective on the front.
    right_uv = right / (np.linalg.norm(right) + 1e-9)
    # Front and back stay one continuous metre grid (isotropic on a plane).
    # Sides and the plinth already carry per-quad metre UVs; do not reproject them.
    for fid, use_n in ((0, False), (3, False)):
        m = FC == fid
        if not np.any(m):
            continue
        UV[m, 0] = V[m] @ right_uv
        UV[m, 1] = V[m, 1]
        UV[m, 0] -= UV[m, 0].min()
        UV[m, 1] -= UV[m, 1].min()

    # predicted key-camera mask
    pred = np.zeros((H, W), np.uint8)
    front = V.reshape(-1, 3, 3)[FC.reshape(-1, 3)[:, 0] == 0]
    for tri in front:
        pr = project(MW, PM, tri)
        if np.any(pr[:, 2] <= 0.5):
            continue
        cv2.fillConvexPoly(pred, np.round(pr[:, :2]).astype(np.int32), 255)
    pred_m = pred > 0
    inter = np.logical_and(pred_m, mask).sum()
    union = np.logical_or(pred_m, mask).sum()
    iou = float(inter / max(1, union))
    extra = int(np.logical_and(pred_m, ~mask).sum())
    missing = int(np.logical_and(mask, ~pred_m).sum())
    print(f"raster IoU {iou:.3f} extra {extra} missing {missing}")

    man = manifold_report(V.reshape(-1, 3, 3))
    print("manifold", man)

    # trim: ladder cage on the left of the front, chrome along both edges, three cables on the right
    right = np.cross(N, np.array([0.0, 1.0, 0.0]))
    right /= np.linalg.norm(right)
    up = np.array([0.0, 1.0, 0.0])
    origin = F3.mean(0)
    # left rail x at -0.32 of half-width
    half_w = width * 0.5
    cage_x = -0.30 * half_w
    y_a, y_b = y0 + 0.10 * (y1 - y0), y0 + 0.78 * (y1 - y0)
    proud = 0.62  # cage stands off the face

    def on_face(lat, yy, off):
        # point on the front plane: origin + right*lat + up*(yy-origin_y) is NOT on the plane.
        # Use the base point at this pixel column. Approximate: take the front point with closest (lat, y).
        return origin + right * lat + up * (yy - origin[1]) + N * off

    # The front is a tilted plane through F3, not necessarily origin+spans. Project on_face onto the plane.
    def snap(p, off):
        # closest front sample, then offset along N
        i = np.argmin(np.abs(F3[:, 1] - p[1]) + np.abs((F3 - origin) @ right - (p - origin) @ right))
        lat = (p - origin) @ right
        # rebuild from that height's center
        row = F3[np.abs(F3[:, 1] - F3[i, 1]) < 1.5]
        if len(row):
            mid = row.mean(0)
        else:
            mid = F3[i]
        return mid + right * (lat - (mid - origin) @ right) + N * off

    trim_v, trim_m, trim_c = [], [], []

    def add_box(center, ax, ay, az, sx, sy, sz, metal, color):
        verts = box_tris(center, ax, ay, az, sx, sy, sz)
        trim_v.append(verts)
        trim_m.append(np.full(len(verts), metal, np.float32))
        trim_c.append(np.tile(np.asarray(color, np.float32), (len(verts), 1)))

    # rails
    for lat in (cage_x - 0.48, cage_x + 0.48):
        p0 = snap(origin + right * lat + up * (y_a - origin[1]), proud)
        p1 = snap(origin + right * lat + up * (y_b - origin[1]), proud)
        add_box((p0 + p1) / 2, right, up, N, 0.045, np.linalg.norm(p1 - p0) / 2, 0.045, 0.72, COL_CHROME)
    # rungs + hoops
    rung_ys = np.arange(y_a + 0.4, y_b, 0.55)
    for yy in rung_ys:
        pL = snap(origin + right * (cage_x - 0.48) + up * (yy - origin[1]), proud)
        pR = snap(origin + right * (cage_x + 0.48) + up * (yy - origin[1]), proud)
        add_box((pL + pR) / 2, right, up, N, np.linalg.norm(pR - pL) / 2, 0.028, 0.028, 0.65, COL_RUNG)
    hoop_ys = np.arange(y_a + 1.2, y_b, 2.6)
    for yy in hoop_ys:
        for lat, off in ((cage_x - 0.48, proud), (cage_x + 0.48, proud), (cage_x, proud + 0.55)):
            pass
        pL = snap(origin + right * (cage_x - 0.55) + up * (yy - origin[1]), 0.08)
        pR = snap(origin + right * (cage_x + 0.55) + up * (yy - origin[1]), 0.08)
        pLo = snap(origin + right * (cage_x - 0.55) + up * (yy - origin[1]), proud + 0.15)
        pRo = snap(origin + right * (cage_x + 0.55) + up * (yy - origin[1]), proud + 0.15)
        # three sides of the hoop (open at the wall)
        add_box((pLo + pRo) / 2, right, up, N, np.linalg.norm(pRo - pLo) / 2, 0.03, 0.03, 0.7, COL_CHROME)
        add_box((pL + pLo) / 2, right, up, N, 0.03, 0.03, np.linalg.norm(pLo - pL) / 2, 0.7, COL_CHROME)
        add_box((pR + pRo) / 2, right, up, N, 0.03, 0.03, np.linalg.norm(pRo - pR) / 2, 0.7, COL_CHROME)
    # chrome edge strips along the silhouette (sample every segment)
    for i in range(n):
        a, b = F3[i], F3[(i + 1) % n]
        if np.linalg.norm(b - a) < 0.4:
            continue
        mid = (a + b) / 2 + N * 0.06
        tang = b - a
        tang /= np.linalg.norm(tang) + 1e-9
        bit = np.cross(N, tang)
        add_box(mid, tang, bit, N, np.linalg.norm(b - a) / 2, 0.09, 0.035, 0.94, COL_CHROME)
    # floor bands on the front, every 18 m
    for yy in np.arange(y0 + 14, y1 - 8, 18):
        row = F3[np.abs(F3[:, 1] - yy) < 6]
        if len(row) < 2:
            continue
        # a band across the local width
        lat = (F3 - origin) @ right
        # find left/right at this height by interpolating segments
        pL = snap(origin + right * (lat.min() * 0.86) + up * (yy - origin[1]), 0.05)
        pR = snap(origin + right * (lat.max() * 0.86) + up * (yy - origin[1]), 0.05)
        add_box((pL + pR) / 2, right, up, N, np.linalg.norm(pR - pL) / 2, 0.11, 0.04, 0.92, COL_CHROME)
    # cables: catenaries off the right edge
    cables = []
    for k, frac_h in enumerate((0.74, 0.62, 0.51, 0.42)):
        yy = y0 + frac_h * (y1 - y0)
        p0 = snap(origin + right * (half_w * 0.78) + up * (yy - origin[1]), 0.3)
        end = p0 + right * (10 + 3 * k) - up * (6 + 2 * k) - N * 2.5
        ts = np.linspace(0, 1, 16)
        sag = 1.6 + 0.4 * k
        pts = []
        for u in ts:
            p = (1 - u) * p0 + u * end
            p[1] -= sag * np.sin(np.pi * u)
            pts.append(p)
        cables.append(tube(pts, 0.045, 5))
    if cables:
        cv = np.concatenate(cables, 0)
        trim_v.append(cv)
        trim_m.append(np.full(len(cv), 0.35, np.float32))
        trim_c.append(np.tile(np.array(COL_CABLE, np.float32), (len(cv), 1)))

    TV = np.concatenate(trim_v, 0).astype(np.float32) if trim_v else np.zeros((0, 3), np.float32)
    TM = np.concatenate(trim_m, 0).astype(np.float32) if trim_m else np.zeros((0,), np.float32)
    TC = np.concatenate(trim_c, 0).astype(np.float32) if trim_c else np.zeros((0, 3), np.float32)
    print("body tris", len(V) // 3, "trim tris", len(TV) // 3)

    # chrome crop from the key (bright pixels inside the mask) — Imagine/key pixels, not a new call
    luma = key.astype(np.float32).mean(2)
    bright = mask & (luma > np.percentile(luma[mask], 92))
    if bright.any():
        ys, xs = np.nonzero(bright)
        chrome = key[max(0, ys.min() - 2): ys.max() + 3, max(0, xs.min() - 2): xs.max() + 3]
    else:
        chrome = key[vb0:vb0 + 16, ub0:ub0 + 16]
    Image.fromarray(chrome).save(os.path.join(out, "trim-crop.png"))

    def tri_stretch(p, uv):
        dp1, dp2 = p[1] - p[0], p[2] - p[0]
        du1, du2 = uv[1] - uv[0], uv[2] - uv[0]
        A = np.stack([du1, du2], 1)
        if abs(np.linalg.det(A)) < 1e-8:
            return None
        M = np.stack([dp1, dp2], 1) @ np.linalg.inv(A)
        s = np.linalg.svd(M, compute_uv=False)
        if s[1] < 1e-6:
            return None
        return float(s[0] / s[1])

    stretches = {}
    for fid in range(6):
        sel = FC.reshape(-1, 3)[:, 0] == fid
        ratios = []
        for p, uv in zip(V.reshape(-1, 3, 3)[sel], UV.reshape(-1, 3, 2)[sel]):
            r = tri_stretch(p, uv)
            if r is not None:
                ratios.append(r)
        stretches[str(fid)] = None if not ratios else round(float(max(ratios)), 3)
    print("uv stretch max", stretches)

    # compact mesh for the page (non-indexed floats)
    meta_cam = dict(
        mw=np.array(json.load(open(CAM))["mw"], np.float64).reshape(4, 4).T.astype(np.float64).T.reshape(-1).tolist(),
        pm=np.array(json.load(open(CAM))["pm"], np.float64).reshape(4, 4).T.astype(np.float64).T.reshape(-1).tolist(),
    )
    # mw/pm above: file is column-major; .T makes row-major; .T again returns column-major for THREE.Matrix4
    bin_path = os.path.join(out, "tower.bin")
    with open(bin_path, "wb") as bf:
        bf.write(b"TW01")
        for arr, dim in ((V, 3), (UV, 2), (UK, 2), (FC.reshape(-1, 1), 1)):
            bf.write(np.uint32(len(V)).tobytes())
            bf.write(np.ascontiguousarray(arr, np.float32).tobytes())
        bf.write(np.uint32(len(TV)).tobytes())
        bf.write(np.ascontiguousarray(TV, np.float32).tobytes())
        bf.write(np.ascontiguousarray(TM, np.float32).tobytes())
        bf.write(np.ascontiguousarray(TC, np.float32).tobytes())
    face_span = {}
    for fid in range(6):
        m = FC == fid
        if not np.any(m):
            continue
        face_span[str(fid)] = [round(float(UV[m, 0].max()), 3), round(float(UV[m, 1].max()), 3)]

    qc = dict(
        polyIou=round(float(iou_p), 3), rasterIou=round(iou, 3), extraPx=extra, missingPx=missing,
        width=round(width, 3), depth=round(depth, 3), dOverW=round(depth / width, 3),
        height=round(float(y1 - y0), 3), sink=round(float(y0 - sink), 3), groundY=round(gy, 3),
        baseY=round(float(y0), 3), stripBelow=round(float(y0 - gy), 3),
        bodyTris=int(len(V) // 3), trimTris=int(len(TV) // 3), planes="front + tilted back + side quads + plinth",
        manifold=man, crop=[ub0, vb0, ub1, vb1], anchor=Pb.tolist(), camPos=C.tolist(),
        normal=N.tolist(), right=right_uv.tolist(), D0=D0, D1=D1, polyVerts=int(len(poly)), hole=bool(holes),
        uvStretch=stretches, faceSpanM=face_span, mw=K["mw"], pm=K["pm"], keySize=[W, H],
        trimSrgb=dict(chrome=np.round(chrome_s, 4).tolist(), cable=np.round(cable_s, 4).tolist()),
    )
    # preview: mask vs raster
    vis = np.zeros((H, W, 3), np.uint8)
    vis[mask] = (40, 40, 40)
    vis[pred_m] = (40, 180, 60)
    vis[np.logical_and(mask, pred_m)] = (220, 220, 220)
    vis[np.logical_and(mask, ~pred_m)] = (220, 40, 40)
    Image.fromarray(vis).save(os.path.join(out, "preview-iou.png"))
    np.savez_compressed(
        os.path.join(out, "tower.npz"),
        position=V, uv=UV, uvKey=UK, face=FC,
        trimPos=TV, trimMetal=TM, trimColor=TC,
    )
    json.dump(qc, open(os.path.join(out, "qc.json"), "w"), indent=1)
    print(json.dumps({k: qc[k] for k in ("rasterIou", "dOverW", "height", "stripBelow", "sink", "bodyTris", "trimTris", "manifold")}, indent=1))


if __name__ == "__main__":
    main()
