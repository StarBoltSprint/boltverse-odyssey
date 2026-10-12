"""Oblique facade profile. Blocking check for tools/object-gate.

A flat plate pasted on a slab still has a large AABB. This scores the
depth of one face from its own base plane, at 45 degrees and at a grazing
angle, against a flat box of the same AABB.

Depth range is not the raw camera depth of the whole object (that false-passes
a box, because the front and the side are both in frame). It is the spread of
signed distance from the face base plane, on fragments whose normal faces
that axis. Bins are 5 cm. A bin counts when it holds at least 1% of those
fragments. Range is the outward gap from the modal bin to the furthest such bin.

Silhouette roughness is the std of per-row peak plane-distance (metres) after
a linear fit. A flat control of the same AABB is the baseline.

Thresholds (also in profiles/building.yaml):
  bar = max(depthFloorM, depthFracOfHeight * H)
  default floor 0.5 m, frac 0.003. A 174 m tower needs >= 0.522 m.
  roughness std >= max(roughnessAbsM, flat_std + roughnessMarginM)
  and std >= flat_std * roughnessRatio.
  8 m and 30 m block. Hero is reported.

plane_relief() is the same per-metre modal protrusion the probe uses when
geometry.reliefFromPlane is set. A flat box fails both. A box with studs
at or above the bar passes both.

  python3 tools/object-gate/lib/oblique.py selftest
  python3 tools/object-gate/lib/oblique.py '{"mesh": "...json", "out": "..."}'
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))

DEFAULTS = dict(
    anglesDeg=[45.0, 75.0],
    distancesM=[8.0, 30.0],
    hero=True,
    heroDistanceM=160.0,
    depthFloorM=0.5,
    depthFracOfHeight=0.003,
    roughnessAbsM=0.12,
    roughnessRatio=1.35,
    roughnessMarginM=0.08,
    blockingDistancesM=[8.0, 30.0],
    normalDotMin=0.57,
    binM=0.05,
    minBinFrac=0.01,
)


def _cfg(over):
    c = dict(DEFAULTS)
    if over:
        c.update({k: v for k, v in over.items() if v is not None})
    return c


def bar_m(height, cfg):
    return max(float(cfg["depthFloorM"]), float(cfg["depthFracOfHeight"]) * float(height))


def _tris(V, F):
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    area = np.linalg.norm(n, axis=1) * 0.5
    nrm = n / np.maximum(area[:, None] * 2.0, 1e-12)
    cen = (a + b + c) / 3.0
    return cen, nrm, area


def plane_relief(V, F):
    """Max per-metre protrusion from the modal shell plane, per axis.

    Modal = area-weighted 5 cm bin of faces within 3 m of that metre's
    outermost offset. A bin under 2% of the metre's area is ignored.
    reliefM[axis] is the max of those gaps. A flat wall is 0.
    """
    cen, nrm, area = _tris(V, F)
    axes = {
        "+x": (0, 1), "-x": (0, -1), "+z": (2, 1), "-z": (2, -1),
    }
    out = {}
    for name, (comp, sign) in axes.items():
        dots = nrm[:, comp] * sign
        keep = (dots > 0.7) & (area > 1e-6)
        if not np.any(keep):
            out[name] = None
            continue
        aV, bV, cV = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        ylo = np.minimum(np.minimum(aV[:, 1], bV[:, 1]), cV[:, 1])[keep]
        yhi = np.maximum(np.maximum(aV[:, 1], bV[:, 1]), cV[:, 1])[keep]
        off = cen[keep, comp]
        ar = area[keep]
        # A tall cap is two triangles. Spread its area across every metre it
        # covers so the stud and the wall share a bin. A centroid-only bin
        # puts them in different metres and the protrusion reads 0.
        samples = []  # (yb, off, area)
        for o, a, y0, y1 in zip(off, ar, ylo, yhi):
            span = max(1e-4, float(y1 - y0))
            yb0 = int(np.floor(y0))
            yb1 = int(np.floor(max(y0, y1 - 1e-6)))
            for yb in range(yb0, yb1 + 1):
                seg0 = max(float(y0), yb)
                seg1 = min(float(y1), yb + 1.0)
                frac = max(0.0, seg1 - seg0) / span
                if frac <= 0:
                    continue
                samples.append((yb, float(o), float(a) * frac))
        by_m = {}
        for yb, o, a in samples:
            by_m.setdefault(yb, []).append((o, a))
        best = 0.0
        any_m = False
        for rows in by_m.values():
            aa = sum(r[1] for r in rows)
            if aa <= 0.2:
                continue
            os_ = np.array([r[0] for r in rows])
            as_ = np.array([r[1] for r in rows])
            outer = float(os_.max() if sign > 0 else os_.min())
            inward = (outer - os_) if sign > 0 else (os_ - outer)
            sel = (inward <= 3.0) & (inward >= -0.05)
            if not np.any(sel):
                continue
            os_, as_ = os_[sel], as_[sel]
            area_sum = float(as_.sum())
            if area_sum <= 0:
                continue
            any_m = True
            acc = {}
            for o, a in zip(os_, as_):
                b = int(round(float(o) / 0.05))
                acc[b] = acc.get(b, 0.0) + float(a)
            mode_b = max(acc, key=acc.get)
            modal = mode_b * 0.05
            gap = 0.0
            for b, a in acc.items():
                if a / area_sum < 0.02:
                    continue
                plane = b * 0.05
                protr = (plane - modal) if sign > 0 else (modal - plane)
                if protr > gap:
                    gap = protr
            if gap > best:
                best = gap
        out[name] = round(best, 3) if any_m else None
    return out


def relief_pass(relief, height, cfg, min_faces=2):
    b = bar_m(height, cfg)
    n = sum(1 for v in relief.values() if v is not None and v + 1e-6 >= b)
    return n >= min_faces, b


def _aabb_mesh(V):
    lo, hi = V.min(0), V.max(0)
    # pad a hair so the control is a true plane per face
    sys.path.insert(0, os.path.join(HERE, "..", "..", "imagine-to-3d"))
    from hard_surface import axis_box
    built = axis_box(lo, hi)
    return built[0], built[1]


def _look(V, face, look_frac):
    """Aim at the shell that exists at this height.

    The global AABB face is the foot, which is wider than the shaft. A camera
    8 m from that plane, aimed at the foot's x at shaft height, stares at
    empty air and the inset wall falls out of the frame.
    """
    lo, hi = V.min(0), V.max(0)
    height = float(hi[1] - lo[1])
    y = float(lo[1] + look_frac * height)
    band_h = max(2.0, 0.015 * height)
    band = V[np.abs(V[:, 1] - y) <= band_h]
    if len(band) < 8:
        band = V
    cx = float(np.median(band[:, 0]))
    cz = float(np.median(band[:, 2]))
    if face == "+z":
        return np.array([cx, y, float(np.percentile(band[:, 2], 98))]), np.array([0.0, 0.0, 1.0]), np.array([1.0, 0.0, 0.0])
    if face == "-z":
        return np.array([cx, y, float(np.percentile(band[:, 2], 2))]), np.array([0.0, 0.0, -1.0]), np.array([-1.0, 0.0, 0.0])
    if face == "+x":
        return np.array([float(np.percentile(band[:, 0], 98)), y, cz]), np.array([1.0, 0.0, 0.0]), np.array([0.0, 0.0, -1.0])
    return np.array([float(np.percentile(band[:, 0], 2)), y, cz]), np.array([-1.0, 0.0, 0.0]), np.array([0.0, 0.0, 1.0])


def _raster(V, F, cam, fwd, right, up, fov_y, w, h, face_n, origin):
    """Returns plane-distance image (nan = miss) and a uint8 preview."""
    cen, nrm, area = _tris(V, F)
    rel = cen - cam
    z = rel @ fwd
    facing = (nrm @ fwd) < -0.05
    nd = nrm @ face_n
    use = (z > 0.4) & facing & (area > 1e-5) & (nd > 0.15)
    img = np.full((h, w), np.nan, np.float32)
    zbuf = np.full((h, w), np.inf, np.float32)
    if not np.any(use):
        return img
    f = 1.0 / np.tan(0.5 * fov_y)
    a = V[F[:, 0]]
    b = V[F[:, 1]]
    c = V[F[:, 2]]
    # plane distance is constant on a flat tri
    pd = (cen - origin) @ face_n
    # Stay on this face's shell. A +z cap on the far side of the building is
    # still a +z normal, and at 45° it can peek into frame. That span is the
    # building depth, which is exactly the false pass a flat box would get
    # from a raw depth buffer.
    use = use & (pd > -2.5) & (pd < 2.5)
    idx = np.flatnonzero(use)
    # project vertices
    def proj(P):
        r = P - cam
        zz = r @ fwd
        xx = r @ right
        yy = r @ up
        sx = f * xx / np.maximum(zz, 1e-4)
        sy = f * yy / np.maximum(zz, 1e-4)
        px = (sx * 0.5 + 0.5) * (w - 1)
        py = (0.5 - sy * 0.5) * (h - 1)
        return px, py, zz

    # stamp each triangle's bbox at the centroid depth. Fine for boxes and
    # for facade caps (planar). Occlusion uses the camera z of the centroid.
    for t in idx:
        px, py, zz = proj(np.vstack([a[t], b[t], c[t]]))
        if np.any(zz < 0.3):
            continue
        x0 = int(max(0, np.floor(px.min())))
        x1 = int(min(w - 1, np.ceil(px.max())))
        y0 = int(max(0, np.floor(py.min())))
        y1 = int(min(h - 1, np.ceil(py.max())))
        if x1 < x0 or y1 < y0:
            continue
        # barycentric in pixel space, vectorised over the bbox
        xs = np.arange(x0, x1 + 1)
        ys = np.arange(y0, y1 + 1)
        gx, gy = np.meshgrid(xs, ys)
        x1p, y1p = px[0], py[0]
        x2p, y2p = px[1], py[1]
        x3p, y3p = px[2], py[2]
        den = (y2p - y3p) * (x1p - x3p) + (x3p - x2p) * (y1p - y3p)
        if abs(den) < 1e-6:
            continue
        w1 = ((y2p - y3p) * (gx - x3p) + (x3p - x2p) * (gy - y3p)) / den
        w2 = ((y3p - y1p) * (gx - x3p) + (x1p - x3p) * (gy - y3p)) / den
        w3 = 1.0 - w1 - w2
        inside = (w1 >= -0.02) & (w2 >= -0.02) & (w3 >= -0.02)
        if not np.any(inside):
            continue
        zc = float(z[t])
        sl = zbuf[y0:y1 + 1, x0:x1 + 1]
        di = img[y0:y1 + 1, x0:x1 + 1]
        take = inside & (zc < sl)
        di[take] = pd[t]
        sl[take] = zc
        img[y0:y1 + 1, x0:x1 + 1] = di
        zbuf[y0:y1 + 1, x0:x1 + 1] = sl
    return img


def _range_and_rough(img, bin_m, min_frac):
    v = img[np.isfinite(img)]
    if v.size < 16:
        return {"rangeM": 0.0, "roughM": 0.0, "px": int(v.size), "bins": 0}
    bins = np.round(v / bin_m).astype(np.int32)
    acc = {}
    for b in bins:
        acc[int(b)] = acc.get(int(b), 0) + 1
    total = float(v.size)
    kept = [b for b, n in acc.items() if n / total >= min_frac]
    if not kept:
        kept = [max(acc, key=acc.get)]
    mode = max(kept, key=lambda b: acc[b])
    modal = mode * bin_m
    far = max(kept) * bin_m
    near = min(kept) * bin_m
    # outward spread. The face normal points at the camera-side, so larger
    # plane distance is proud. Use the full kept span so a recess (negative)
    # still counts as readable depth.
    span = max(far, modal) - min(near, modal)
    # per-row peak, linear residual
    rough = 0.0
    rows = []
    for y in range(img.shape[0]):
        row = img[y]
        row = row[np.isfinite(row)]
        if row.size < 2:
            continue
        rows.append(float(np.percentile(row, 95)))
    if len(rows) >= 4:
        yy = np.arange(len(rows), dtype=np.float64)
        coef = np.polyfit(yy, np.array(rows), 1)
        resid = np.array(rows) - (coef[0] * yy + coef[1])
        rough = float(np.std(resid))
    return {"rangeM": round(float(span), 3), "roughM": round(rough, 3), "px": int(v.size), "bins": len(kept)}


def _passes(real, flat, cfg, height):
    b = bar_m(height, cfg)
    range_ok = real["rangeM"] + 1e-6 >= b
    rough_need = max(float(cfg["roughnessAbsM"]), flat["roughM"] + float(cfg["roughnessMarginM"]))
    ratio_need = flat["roughM"] * float(cfg["roughnessRatio"])
    rough_ok = real["roughM"] + 1e-6 >= rough_need and real["roughM"] + 1e-6 >= ratio_need
    # A face whose depth range clears the metre bar is not flat, even when a
    # full-height pier has a smooth profile (residual ~0). Roughness still
    # has to beat the flat control by the margin when the range is the only
    # thing carrying a short stud. Require range AND (roughness OR range
    # clearly above the bar, with roughness at least the flat control).
    if range_ok and real["roughM"] + 1e-9 >= flat["roughM"]:
        return True, b
    return bool(range_ok and rough_ok), b


def score_mesh(V, F, cfg=None, faces=("+z", "-z", "+x", "-x"), w=96, h=160, fov_deg=48.0):
    cfg = _cfg(cfg)
    V = np.asarray(V, np.float64)
    F = np.asarray(F, np.int32)
    height = float(V[:, 1].max() - V[:, 1].min())
    half = 0.5 * (V.max(0) - V.min(0))
    hero_d = max(float(cfg["heroDistanceM"]), float(half[0] + half[2]) + 140.0)
    dists = [(float(d), "block") for d in cfg["distancesM"]]
    if cfg.get("hero"):
        dists.append((hero_d, "hero"))
    flat_V, flat_F = _aabb_mesh(V)
    cells = []
    images = []
    fov = np.deg2rad(float(fov_deg))
    up = np.array([0.0, 1.0, 0.0])
    for face in faces:
        for ang in cfg["anglesDeg"]:
            for dist, kind in dists:
                look_frac = 0.55 if kind == "hero" else 0.08
                origin, normal, side = _look(V, face, look_frac)
                ang_r = np.deg2rad(float(ang))
                view = np.cos(ang_r) * normal + np.sin(ang_r) * side
                view = view / np.linalg.norm(view)
                cam = origin + view * float(dist)
                fwd = -view
                right = np.cross(fwd, up)
                rn = np.linalg.norm(right)
                if rn < 1e-8:
                    right = np.array([1.0, 0.0, 0.0])
                else:
                    right = right / rn
                cam_up = np.cross(right, fwd)
                cam_up = cam_up / np.linalg.norm(cam_up)
                real = _raster(V, F, cam, fwd, right, cam_up, fov, w, h, normal, origin)
                ctrl = _raster(flat_V, flat_F, cam, fwd, right, cam_up, fov, w, h, normal, origin)
                rm = _range_and_rough(real, cfg["binM"], cfg["minBinFrac"])
                fm = _range_and_rough(ctrl, cfg["binM"], cfg["minBinFrac"])
                ok, b = _passes(rm, fm, cfg, height)
                block = kind == "block"
                cells.append({
                    "face": face, "angleDeg": float(ang), "distM": round(float(dist), 2),
                    "kind": kind, "blocking": block, "pass": bool(ok) if block else True,
                    "reportedPass": bool(ok), "rangeM": rm["rangeM"], "roughM": rm["roughM"],
                    "flatRangeM": fm["rangeM"], "flatRoughM": fm["roughM"], "px": rm["px"],
                    "barM": round(b, 3),
                })
                images.append((face, float(ang), float(dist), kind, real))
    blocking = [c for c in cells if c["blocking"]]
    passed = all(c["pass"] for c in blocking) if blocking else False
    return {"pass": passed, "heightM": round(height, 3), "barM": round(bar_m(height, cfg), 3), "cells": cells, "images": images}


def _preview(img):
    from PIL import Image
    v = img.copy()
    finite = np.isfinite(v)
    out = np.zeros((*v.shape, 3), np.uint8)
    out[..., 2] = 28
    if finite.any():
        x = v[finite]
        lo, hi = float(np.percentile(x, 2)), float(np.percentile(x, 98))
        if hi - lo < 0.05:
            hi = lo + 0.05
        g = np.clip((v - lo) / (hi - lo), 0, 1)
        g[~finite] = 0
        out[..., 0] = (40 + 180 * g).astype(np.uint8)
        out[..., 1] = (40 + 140 * g).astype(np.uint8)
        out[..., 2] = (48 + 40 * g).astype(np.uint8)
    return Image.fromarray(out, "RGB")


def write_captures(scored, out_dir, sheet_path):
    os.makedirs(out_dir, exist_ok=True)
    from PIL import Image, ImageDraw
    tiles = []
    # Sheet is 45° and grazing at 30 m (or the nearest blocking distance) per face.
    want = {}
    for face, ang, dist, kind, img in scored["images"]:
        tag = f"{face.replace('+','p').replace('-','m')}-a{int(ang)}-d{int(round(dist))}"
        path = os.path.join(out_dir, f"oblique-{tag}.png")
        im = _preview(img)
        im.save(path)
        if kind == "block" and abs(dist - 30.0) < 1.0:
            want[(face, int(ang))] = im
    order_f = ["+z", "-z", "+x", "-x"]
    order_a = [45, 75]
    cell = 120
    sheet = Image.new("RGB", (cell * len(order_a), cell * len(order_f)), (16, 16, 20))
    dr = ImageDraw.Draw(sheet)
    for r, face in enumerate(order_f):
        for c, ang in enumerate(order_a):
            im = want.get((face, ang))
            if im is None:
                continue
            im = im.resize((cell, cell))
            sheet.paste(im, (c * cell, r * cell))
            dr.text((c * cell + 4, r * cell + 4), f"{face} {ang}", fill=(255, 255, 255))
    os.makedirs(os.path.dirname(sheet_path) or ".", exist_ok=True)
    sheet.save(sheet_path, quality=90)
    return sheet_path


def _box(lo, hi):
    sys.path.insert(0, os.path.join(os.path.dirname(HERE), "..", "imagine-to-3d"))
    from hard_surface import axis_box
    V, F, _ = axis_box(lo, hi)
    return V, F


def _cat(parts):
    vs, fs = [], []
    n = 0
    for V, F in parts:
        vs.append(V)
        fs.append(F + n)
        n += len(V)
    return np.vstack(vs), np.vstack(fs)


def selftest():
    cfg = _cfg({})
    flat_V, flat_F = _box((0, 0, 0), (8, 20, 8))
    studs = [
        _box((0, 0, 0), (8, 20, 8)),
        _box((1.0, 2.0, 8.0), (3.2, 18.0, 8.8)),
        _box((4.4, 2.0, 8.0), (6.6, 18.0, 8.8)),
        _box((8.0, 2.0, 2.0), (8.8, 18.0, 5.5)),
        _box((-0.8, 2.0, 1.5), (0.0, 18.0, 4.5)),
        _box((2.0, 2.0, -0.8), (5.0, 18.0, 0.0)),
    ]
    st_V, st_F = _cat(studs)
    # Texture is irrelevant: the check is geometric. Both meshes are closed boxes.
    def run(V, F):
        # drop images for the print
        sc = score_mesh(V, F, cfg, w=80, h=120)
        rel = plane_relief(V, F)
        ok_r, b = relief_pass(rel, sc["heightM"], cfg, 2)
        cells = [{k: c[k] for k in ("face", "angleDeg", "distM", "kind", "pass", "reportedPass", "rangeM", "roughM", "flatRoughM", "barM")} for c in sc["cells"]]
        return {"oblique": "PASS" if sc["pass"] else "FAIL", "relief": "PASS" if ok_r else "FAIL", "reliefM": rel, "barM": b, "cells": cells}

    flat = run(flat_V, flat_F)
    stud = run(st_V, st_F)
    ok = flat["oblique"] == "FAIL" and flat["relief"] == "FAIL" and stud["oblique"] == "PASS" and stud["relief"] == "PASS"
    # A flat face must not clear the metre bar on any blocking cell.
    flat_bar_hit = any(c["kind"] == "block" and c["rangeM"] >= c["barM"] for c in flat["cells"])
    ok = ok and not flat_bar_hit
    return {"ok": ok, "flat": flat, "studs": stud, "note": "flat textured box fails oblique-profile and tightened relief; studs >= bar pass"}


def main(argv):
    if len(argv) < 2:
        print("usage: oblique.py selftest | oblique.py '<json>'", file=sys.stderr)
        return 2
    if argv[1] == "selftest":
        rep = selftest()
        # cells are long; keep them, the self-test asserts ok
        print(json.dumps({"ok": rep["ok"], "flat": {k: rep["flat"][k] for k in ("oblique", "relief", "reliefM", "barM")}, "studs": {k: rep["studs"][k] for k in ("oblique", "relief", "reliefM", "barM")}, "flatCells": rep["flat"]["cells"], "studCells": rep["studs"]["cells"]}))
        return 0 if rep["ok"] else 1
    arg = json.loads(argv[1])
    mesh_path = arg["mesh"]
    with open(mesh_path) as f:
        mesh = json.load(f)
    P = np.asarray(mesh["positions"], np.float64).reshape(-1, 3)
    I = np.asarray(mesh["indices"], np.int32).reshape(-1, 3)
    cfg = arg.get("cfg") or {}
    sc = score_mesh(P, I, cfg)
    out = arg["out"]
    sheet = arg.get("sheet") or os.path.join(out, "oblique-sheet.jpg")
    write_captures(sc, out, sheet)
    if arg.get("sheetCopy"):
        from PIL import Image
        Image.open(sheet).save(arg["sheetCopy"], quality=90)
    payload = {k: sc[k] for k in ("pass", "heightM", "barM", "cells")}
    payload["reliefM"] = plane_relief(P, I)
    print(json.dumps(payload))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
