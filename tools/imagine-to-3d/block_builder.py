"""JSON-profiled stepped block.

Plate pixel constants live in the profile (tools/imagine-to-3d/profiles/terrace-zd.json
for Zone D). Relief is the MoGe-2 high-pass multiplied by the SAM2 mask after that
high-pass, so a sample that lands inside the mask stays the same number. Border lock
still forces the displacement to 0 at the face edge, so every LOD keeps one silhouette.

python3 block_builder.py <stepdir> --profile <json> [--lod N] [--out prefix]
"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
import tools.gate.streaks as GS


def apply_sam2(relief, mask):
    """Zero relief off the SAM2 mask. Inside pixels are unchanged."""
    m = np.asarray(mask)
    if m.shape != np.asarray(relief).shape:
        raise ValueError("SAM2 mask %s != relief %s" % (m.shape, np.asarray(relief).shape))
    if m.dtype.kind == "b" or (np.issubdtype(m.dtype, np.number) and float(m.max()) <= 1.0):
        m = m.astype(np.float32)
    else:
        m = (m > 127).astype(np.float32)
    return np.asarray(relief) * m


def triangle_aniso(P, Q):
    """σmax/σmin of the 3D-metres ← UV-metres Jacobian. Same ratio the stretch npy stores."""
    e1, e2 = P[1] - P[0], P[2] - P[0]
    n1 = float(np.linalg.norm(e1))
    nn = np.cross(e1, e2)
    ln = float(np.linalg.norm(nn))
    if n1 < 1e-12 or ln < 1e-14:
        return 1e9
    t1 = e1 / n1
    t2 = np.cross(nn / ln, t1)
    A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]], float)
    B = np.array([Q[1] - Q[0], Q[2] - Q[0]], float).T
    if abs(float(np.linalg.det(B))) < 1e-18:
        return 1e9
    J = A @ np.linalg.inv(B)
    sv = np.linalg.svd(J, compute_uv=False)
    return float(sv[0] / max(sv[1], 1e-12))


def _conformal_uv(P, Q, target):
    """Rescale Q in its principal frame so anisotropy == target. Centroid and area stay. det > 0."""
    e1, e2 = P[1] - P[0], P[2] - P[0]
    t1 = e1 / np.linalg.norm(e1)
    nn = np.cross(e1, e2)
    nn = nn / np.linalg.norm(nn)
    t2 = np.cross(nn, t1)
    A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]], float)
    B = np.array([Q[1] - Q[0], Q[2] - Q[0]], float).T
    J = A @ np.linalg.inv(B)
    _U, sv, Vt = np.linalg.svd(J, full_matrices=True)
    g = math.sqrt(max(float(sv[0] * sv[1]), 1e-24))
    s0 = g * math.sqrt(target)
    s1 = g / math.sqrt(target)
    M = Vt.T @ np.diag([sv[0] / s0, sv[1] / s1]) @ Vt
    c = Q.mean(0)
    return (Q - c) @ M.T + c


def cap_uv_anisotropy(V, UVs, F, limit, metres_per_uv):
    """Pull every triangle to anisotropy <= limit.

    Positions and the triangle list stay. A corner whose vertex is shared keeps the
    original vt for every triangle that already passes, and the over-limit triangle
    gets its own vt. OBJ uv is written at 5 decimals, so the fit is re-measured
    after that rounding.
    Returns (uv array, uv-index triple per face, parallel to F).
    """
    import math as _math
    limit = float(limit)
    target = min(limit - 1e-3, limit * 0.96)
    V = np.asarray(V, float)
    uvs = [np.asarray(u, float).copy() for u in np.asarray(UVs, float)]
    use = np.zeros(len(V), np.int32)
    for tris in F.values():
        for a, b, c in tris:
            use[a] += 1
            use[b] += 1
            use[c] += 1
    scale = float(metres_per_uv)
    uv_faces = {}

    def fit(P, Q):
        Qn = np.array(Q, float)
        for _ in range(6):
            if triangle_aniso(P, Qn) <= limit:
                break
            aim = target if triangle_aniso(P, Qn) > target * 1.01 else max(1.01, target * 0.9)
            Qn = _conformal_uv(P, Qn, aim)
            Qn = np.round(Qn / scale, 5) * scale
        return Qn

    for m, tris in F.items():
        out = []
        for tri in tris:
            vi = [int(i) for i in tri]
            P = V[vi]
            Q = np.stack([uvs[i] for i in vi]) * scale
            r0 = triangle_aniso(P, Q)
            if r0 <= limit or r0 >= 1e8:
                out.append(tuple(vi))
                continue
            Qn = fit(P, Q)
            ti = []
            for k, i in enumerate(vi):
                uv = np.round(Qn[k] / scale, 5)
                if use[i] == 1:
                    uvs[i] = uv
                    ti.append(i)
                else:
                    uvs.append(uv)
                    ti.append(len(uvs) - 1)
            out.append(tuple(ti))
        uv_faces[m] = out
    return np.asarray(uvs, float), uv_faces


def build(step, prof, LOD, out=None):
    S = float(prof["mPerPx"])
    FX0 = float(prof["frontOrigin"]["col"])
    FY0 = float(prof["frontOrigin"]["row"])
    SX0 = float(prof["sideOrigin"]["col"])
    SY0 = float(prof["sideOrigin"]["row"])
    DOOR_D = float(prof["doorDepthM"])
    CORN_OUT = float(prof["corniceOutM"])
    CORN_SIDE = float(prof["corniceSideM"])
    LIP_R = float(prof["lipRadiusM"])
    GRID = float(prof["gridM"][LOD])
    SGRID = float(prof["sideGridM"][LOD])
    NATIVE = int(prof["nativePx"])
    N1 = NATIVE - 1
    close = prof["close"]
    N2 = NATIVE - int(close["cropHiPad"])
    CROP0 = int(close["cropLo"])
    CLOSE_ROW = int(close["dripRow"])
    CLOSE_WIN = int(close["dripWin"])
    CLOSE_THR = float(close["dripThr"])
    DRIP_WIN = int(prof["icicles"]["win"])
    DRIP_THR = float(prof["icicles"]["thr"])
    SINK = float(prof["icicles"]["sinkM"])
    JAMB = float(prof["jambOffsetM"])
    FRONT_BORDER = float(prof["relief"]["frontBorderM"])
    SIDE_BORDER = float(prof["relief"]["sideBorderM"])
    AMP = float(prof["relief"]["ampFront"])
    AMP_SIDE = float(prof["relief"]["ampSide"])
    clip = float(prof["relief"]["clip"])

    def ym(row, y0=FY0):
        return (y0 - row) * S

    T = []
    for tspec in prof["tiers"]:
        T.append(dict(
            hw=tspec["hwPx"] * S,
            z=(0.0 if tspec["zPx"] == 0 else -tspec["zPx"] * S),
            y0=(0.0 if tspec["y0Row"] is None else ym(tspec["y0Row"])),
            y1=ym(tspec["y1Row"]),
            c1=ym(tspec["c1Row"]),
        ))
    BACK = -float(prof["backPx"]) * S
    DOORS = [tuple(d) for d in prof["doors"]]
    files = prof["files"]
    fd = np.load(os.path.join(step, files["depthFront"]))
    sd = np.load(os.path.join(step, files["depthSide"]))

    def hp(d, sig):
        return np.clip(d - ndi.gaussian_filter(d, sig), -clip, clip)

    rel = prof["relief"]
    FREL = ndi.gaussian_filter(hp(fd, rel["frontHpSigma"]), rel["frontSmooth"])
    SREL = ndi.gaussian_filter(hp(sd, rel["frontHpSigma"]), rel["frontSmooth"])
    SREL2 = ndi.gaussian_filter(hp(sd, rel["sideHpSigma"]), rel["sideSmooth"])
    FREL = apply_sam2(FREL, np.asarray(Image.open(os.path.join(step, files["maskFront"])).convert("L")))
    SREL = apply_sam2(SREL, np.asarray(Image.open(os.path.join(step, files["maskSide"])).convert("L")))
    del SREL  # historical sigma-12 side pass; the mesh displaces with SREL2
    SREL2 = apply_sam2(SREL2, np.asarray(Image.open(os.path.join(step, files["maskSide"])).convert("L")))
    UNDER_OFF = [float(p) * S for p in prof["underOffPx"]]
    K2 = float(close["pxPerMNum"]) / float(close["doorHeightM"])
    C2 = float(close["centreCol"])
    G2 = float(close["groundRow"])
    XC2 = float(close["centreXM"])
    X2A = XC2 - float(close["spanA"]) / K2
    X2B = XC2 + float(close["spanB"]) / K2
    top = prof["top"]
    TS = float(top["mPerPx"])
    TX0 = float(top["centreCol"])
    TOPROWS = [tuple(r) for r in top["rows"]]
    SIDEROWS = [tuple(r) for r in prof["sideRows"]]
    files = prof["files"]
    PLATE_FRONT = files["plateFront"]
    PLATE_CLOSE = files["plateClose"]
    PLATE_SIDE = files["plateSide"]
    MASK_FRONT = files["maskFront"]
    MASK_CLOSE = files["maskClose"]
    MASK_SIDE = files["maskSide"]
    TEX_FRONT = files["texFront"]
    TEX_CLOSE = files["texClose"]
    TEX_SIDE = files["texSide"]
    for relp in (PLATE_FRONT, PLATE_CLOSE, PLATE_SIDE, TEX_FRONT, TEX_CLOSE, TEX_SIDE, files["texTop"]):
        im = Image.open(os.path.join(step, relp))
        if im.size != (NATIVE, NATIVE):
            raise SystemExit("plate %s is %sx%s, native is %s" % (relp, im.size[0], im.size[1], NATIVE))
    name = prof.get("outputName", "block")
    OUT = out or os.path.join(step, "work", "%s-lod%s" % (name, LOD))
    os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
    MTL = (
        "newmtl front\nmap_Kd %s\nnewmtl front2\nmap_Kd %s\nnewmtl side\nmap_Kd %s\nnewmtl top\nmap_Kd %s\n"
        % (files["mtlFront"], files["mtlClose"], files["mtlSide"], files["mtlTop"])
    )
    def f2uv(x, y): return ((C2 + (x - XC2) * K2) / NATIVE, 1 - (G2 - y * K2) / NATIVE)
    V, UVs, F = [], [], {'front': [], 'front2': [], 'side': [], 'top': []}
    ICI = []
    BANDS = []; GHOST = []   # v3.4: detected streaks that get NO cone -> cleaned out of the texture (work/clean_streaks.py)
    NRM = {'front': [], 'front2': [], 'side': [], 'top': []}   # intended outward normal per triangle (winding fix)
    def addv(p, uv): V.append(p); UVs.append(uv); return len(V) - 1
    def fuv(x, y): return ((FX0 + x / S) / NATIVE, 1 - (FY0 - y / S) / NATIVE)
    def suv(z, y):
        k = 0 if y < T[0]['c1'] - 1e-6 else (1 if y < T[1]['c1'] - 1e-6 else 2)
        if abs(y - T[0]['c1']) < 1e-6 or abs(y - T[1]['c1']) < 1e-6: k = SIDE_K[0] if SIDE_K else k
        b, t = SIDEROWS[k]; f = (y - T[k]['y0']) / (T[k]['c1'] - T[k]['y0'])
        return ((SX0 + z / S) / NATIVE, 1 - (b + (t - b) * f) / NATIVE)
    SIDE_K = []
    def tuv(k, cz, p):
        r0, r1 = TOPROWS[k]; zend = T[k + 1]['z'] if k < 2 else BACK
        row = r0 + (cz - p[2]) / (cz - zend) * (r1 - r0)
        # v3.3: isotropic planar projection: the top plate is oblique (rows foreshortened), so x uses the SAME px/m as this
        # tier's row band (was 1/TS across = 2.4-4.7x stretch); centre band of real top-plate pixels, nothing invented
        spm = abs(r1 - r0) / abs(cz - zend)
        return ((TX0 + p[0] * spm) / NATIVE, 1 - row / NATIVE)
    def under_x(x, X0, X1, m=0.25):
        # door columns carry the door's black top, not basalt: read the adjacent basalt instead (pure translation, no stretch)
        return (X1 + m + 4.5) - (x - (X0 - m)) if X0 - m < x < X1 + m else x   # flipped real basalt 4.5 m further along the same rows
    def samp(a, uv):
        px = int(np.clip(uv[0] * NATIVE, 0, N1)); py = int(np.clip((1 - uv[1]) * NATIVE, 0, N1)); return float(a[py, px])
    def ticks(a, b, step, must=()):
        t = sorted(set([a, b] + [m for m in must if a < m < b]))
        out = [t[0]]
        for i in range(len(t) - 1):
            n = max(1, int(round((t[i + 1] - t[i]) / step)))
            out += list(np.linspace(t[i], t[i + 1], n + 1)[1:])
        return np.array(out)
    def quadgrid(P, us, vs, mat, uvf, normal, keep=lambda u, v: True, relief=None, border=FRONT_BORDER, lock=None, amp=None):
        """P(u,v)->xyz on a planar face; quads in (us x vs); relief displaces along normal, locked to 0 near borders."""
        idx = {}
        for i, u in enumerate(us):
            for j, v in enumerate(vs):
                p = np.array(P(u, v), float); uv = uvf(p)
                if relief is not None:
                    db = min(u - us[0], us[-1] - u, v - vs[0], vs[-1] - v)
                    if lock is not None: db = min(db, lock(u, v))
                    w = np.clip(db / border, 0, 1)
                    p = p + np.array(normal) * (AMP if amp is None else amp) * w * samp(relief, uv) / 0.6
                idx[i, j] = addv(p, uv)
        for i in range(len(us) - 1):
            for j in range(len(vs) - 1):
                if not keep((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2): continue
                a, b, c, d = idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]
                F[mat] += [(a, b, c), (a, c, d)]; NRM[mat] += [tuple(normal), tuple(normal)]
    def box_quad(c0, du, dv, nu, nv, mat, uvf, normal):  # plain quad grid on a rectangle
        us = np.linspace(0, 1, nu + 1); vs = np.linspace(0, 1, nv + 1)
        quadgrid(lambda u, v: np.add(np.add(c0, np.multiply(du, u)), np.multiply(dv, v)), us, vs, mat, uvf, normal)
    def n_(L, g): return max(1, int(round(L / g)))
    for k, t in enumerate(T):
        hw, z0, y0, y1 = t['hw'], t['z'], t['y0'], t['y1']
        SIDE_K[:] = [k]
        dx0, dx1, dtop = DOORS[k]; X0, X1 = (dx0 - FX0) * S, (dx1 - FX0) * S; DY = ym(dtop)
        inside = lambda u, v, X0=X0, X1=X1, y0=y0, DY=DY: X0 < u < X1 and y0 <= v < DY
        xs = ticks(-hw, hw, GRID, (X0, X1)); ys = ticks(y0, y1, GRID, (DY,))
        # front facade (+Z) with the doorway hole, MoGe relief except at borders and door jambs (relief locked there)
        if k == 0:   # v3.2: three panels; the middle one is the close plate (flat: no MoGe-2 depth of the new plate, relief locked off)
            xs = ticks(-hw, hw, GRID, (X0, X1, X2A, X2B))
            for (xa, xb, m_, uvf_, rel) in ((-hw, X2A, 'front', lambda p: fuv(p[0], p[1]), FREL), (X2A, X2B, 'front2', lambda p: f2uv(p[0], p[1]), None), (X2B, hw, 'front', lambda p: fuv(p[0], p[1]), FREL)):
                sub = xs[(xs >= xa - 1e-9) & (xs <= xb + 1e-9)]
                quadgrid(lambda u, v: (u, v, z0), sub, ys, m_, uvf_, (0, 0, 1), keep=lambda u, v: not inside(u, v), relief=rel if LOD < 2 else None)
        else:
            quadgrid(lambda u, v: (u, v, z0), xs, ys, 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1), keep=lambda u, v: not inside(u, v),
                 relief=FREL if LOD < 2 else None, lock=lambda u, v, X0=X0, X1=X1, DY=DY: 0.5 * max(X0 - u, u - X1, v - DY, 0) if not inside(u, v) else 0)
        DM, DUV = ('front2', f2uv) if k == 0 else ('front', fuv)
        # doorway recess: back wall, jambs, lintel underside, floor
        box_quad((X0, y0, z0 - DOOR_D), (X1 - X0, 0, 0), (0, DY - y0, 0), n_(X1 - X0, GRID), n_(DY - y0, GRID), DM, lambda p, DUV=DUV: DUV(p[0], p[1]), (0, 0, 1))
        # jambs (v3.2 root-cause fix): v3 folded the facade around the door edge (u = X0 - depth), a NEGATIVE u scale on the jamb island
        # = mirror image of the wall at the corner (the Rorschach). Now a translated strip of real basalt 0.35 m off the edge, u growing
        # in the same screen direction as the facade (positive scale, no mirror).
        JO = JAMB
        box_quad((X0, y0, z0), (0, 0, -DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), DM, lambda p, z0=z0, X0=X0, DUV=DUV: DUV(X0 - JO - DOOR_D + (z0 - p[2]), p[1]), (1, 0, 0))
        box_quad((X1, y0, z0 - DOOR_D), (0, 0, DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), DM, lambda p, z0=z0, X1=X1, DUV=DUV: DUV(X1 + JO + DOOR_D - (z0 - p[2]), p[1]), (-1, 0, 0))
        box_quad((X0, DY, z0 - DOOR_D), (X1 - X0, 0, 0), (0, 0, DOOR_D), n_(X1 - X0, GRID), n_(DOOR_D, GRID), DM, lambda p, DY=DY, z0=z0, DUV=DUV: DUV(p[0], DY - 0.02 - (z0 - p[2])), (0, -1, 0))
        # (v3.1) no separate door floor: tier 1 = bottom cap hole (ground shows), tiers 2/3 = the lower top face kept there (sealed)
        if k == 0:
            bx = ticks(-hw, hw, 0.8, (X0, X1)); bz = ticks(BACK, z0, 0.8, (z0 - DOOR_D,))
            quadgrid(lambda u, v: (u, 0.0, v), bx, bz, 'top', lambda p: tuv(0, T[0]['z'] + CORN_OUT, p), (0, -1, 0),
                     keep=lambda u, v, X0=X0, X1=X1, z0=z0: not (X0 < u < X1 and v > z0 - DOOR_D))
        # sides (+-X) from the side plate (right side = mirror of the left plate, declared)
        zs = ticks(BACK, z0, SGRID); ys2 = ticks(y0, y1, SGRID)
        quadgrid(lambda u, v: (-hw, v, u), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (-1, 0, 0), relief=SREL2, amp=AMP_SIDE, border=SIDE_BORDER)
        quadgrid(lambda u, v: (hw, v, -u + z0 + BACK), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (1, 0, 0), relief=SREL2, amp=AMP_SIDE, border=SIDE_BORDER)
        # back (-Z): front plate reused (declared; never on the player path)
        box_quad((hw, y0, BACK), (-2 * hw, 0, 0), (0, y1 - y0, 0), n_(2 * hw, 0.8), n_(y1 - y0, 0.8), 'front', lambda p: fuv(-p[0], p[1]), (0, 0, -1))
        # cornice slab: overhang CORN_OUT front, CORN_SIDE sides; rounded front-bottom lip (quarter cylinder)
        c0, c1 = y1, t['c1']; cz = z0 + CORN_OUT; cw = hw + CORN_SIDE; R = min(LIP_R, (c1 - c0) * 0.5)
        nx = n_(2 * cw, GRID)
        # v3.4: tier-1 cornice front + rounded lip inside the close plate's span take their pixels from t1-right (the plate that
        # actually sees them frontally at 98 px/m) instead of plate-front's 46 px/m snow band (the soft horizontal smear at 8 m)
        scx = hw / cw * 0.98
        spans = [(-cw, cw, 'front', fuv)] if k else [(-cw, X2A / scx, 'front', fuv), (X2A / scx, X2B / scx, 'front2', f2uv), (X2B / scx, cw, 'front', fuv)]
        for (sa, sb, mm, uvf) in spans:
            nxs = n_(sb - sa, GRID)
            box_quad((sa, c0 + R, cz), (sb - sa, 0, 0), (0, c1 - c0 - R, 0), nxs, n_(c1 - c0 - R, GRID), mm, lambda p, scx=scx, uvf=uvf: uvf(p[0] * scx, p[1]), (0, 0, 1))
            seg = 8
            for s in range(seg):
                a0, a1 = np.pi / 2 * s / seg, np.pi / 2 * (s + 1) / seg
                P0 = lambda a: (0, c0 + R - R * np.cos(a), cz - R + R * np.sin(a))
                p0, p1 = P0(a0), P0(a1)
                box_quad((sa, p1[1], p1[2]), (sb - sa, 0, 0), (0, p0[1] - p1[1], p0[2] - p1[2]), nxs, 1, mm, lambda p, c0=c0, R=R, scx=scx, uvf=uvf: uvf(p[0] * scx, c0 + R - R * (np.pi / 2 - np.arccos(np.clip((c0 + R - p[1]) / R, -1, 1)))), (0, 0, 1))
        # underside (-Y) behind the lip back to the wall: cornice snow pixels continued (stretch measured by the gate)
        sc_ = hw / cw * 0.98; xa_, xb_ = (X0 - 0.25) / sc_, (X1 + 0.25) / sc_
        for (ua, ub) in ((-cw, xa_), (xa_, xb_), (xb_, cw)):   # split at the door-shift seam so no quad straddles it
            box_quad((ua, c0, z0), (ub - ua, 0, 0), (0, 0, cz - R - z0), n_(ub - ua, GRID), n_(cz - R - z0, GRID), 'front',
                     lambda p, c0=c0, k=k, X0=X0, X1=X1, sc_=sc_, ua=ua, ub=ub: fuv(under_x(np.clip(p[0], ua + 1e-6, ub - 1e-6) * sc_, X0, X1), c0 - UNDER_OFF[k] - ((cz - R) - p[2])), (0, -1, 0))
        for sgn in (-1, 1):
            xa, xb = (hw, cw) if sgn > 0 else (-cw, -hw)
            box_quad((xa, c0, BACK), (xb - xa, 0, 0), (0, 0, z0 - BACK), n_(cw - hw, GRID), n_(z0 - BACK, SGRID), 'side',
                     lambda p, c0=c0, hw=hw: suv(p[2], c0 - 0.02 - (abs(p[0]) - hw)), (0, -1, 0))
        box_quad((cw, c0, BACK), (-2 * cw, 0, 0), (0, c1 - c0, 0), n_(2 * cw, 0.8), n_(c1 - c0, 0.3), 'front', lambda p, hw=hw, cw=cw: fuv(-p[0] * hw / cw * 0.98, p[1]), (0, 0, -1))
        # cornice ends (+-X) and top (+Y, no top plate: front cornice band stretched, declared)
        for sgn in (-1, 1):
            uvE = lambda p: suv(p[2] - CORN_OUT, p[1])
            box_quad((sgn * cw, c0, BACK), (0, 0, cz - R - BACK), (0, c1 - c0, 0), n_(cz - R - BACK, SGRID), n_(c1 - c0, SGRID), 'side', uvE, (sgn, 0, 0))
            box_quad((sgn * cw, c0 + R, cz - R), (0, 0, R), (0, c1 - c0 - R, 0), 1, n_(c1 - c0 - R, SGRID), 'side', uvE, (sgn, 0, 0))
            # quarter-disc end cap that follows the rounded lip (same 8 arc points as the lip strips)
            ctr = addv((sgn * cw, c0 + R, cz - R), uvE((0, c0 + R, cz - R))); arc = []
            for sg in range(9):
                a_ = np.pi / 2 * sg / 8; p = (sgn * cw, c0 + R - R * np.cos(a_), cz - R + R * np.sin(a_)); arc.append(addv(p, uvE(p)))
            for sg in range(8): F['side'].append((ctr, arc[sg], arc[sg + 1])); NRM['side'].append((sgn, 0, 0))
        if k < 2:   # top face with a hole exactly under the next tier (minus its doorway notch, which stays as that door's floor)
            tn = T[k + 1]; nx0, nx1, _ = DOORS[k + 1]; NX0, NX1 = (nx0 - FX0) * S, (nx1 - FX0) * S
            tx = ticks(-cw, cw, 0.8, (-tn['hw'], tn['hw'], NX0, NX1)); tz = ticks(BACK, cz, 0.8, (tn['z'], tn['z'] - DOOR_D))
            hole = lambda u, v, tn=tn, NX0=NX0, NX1=NX1: (-tn['hw'] < u < tn['hw'] and v < tn['z']) and not (NX0 < u < NX1 and v > tn['z'] - DOOR_D)
            quadgrid(lambda u, v: (u, c1, v), tx, tz, 'top', lambda p, k=k, cz=cz: tuv(k, cz, p), (0, 1, 0), keep=lambda u, v, hole=hole: not hole(u, v))
        else:
            box_quad((-cw, c1, cz), (2 * cw, 0, 0), (0, 0, BACK - cz), n_(2 * cw, 0.8), n_(cz - BACK, 0.8), 'top', lambda p, k=k, cz=cz: tuv(k, cz, p), (0, 1, 0))
        # icicles (v3): one irregular cone under each white drip streak of the plate (front: plate-front under the lip;
        # left end: plate-side). Same cones (count, length, position) in every LOD; only radial segments drop 6 -> 4 -> 3.
        ns = 6; sc_c = hw / cw * 0.98   # 6 radial segments in every LOD: 6->4->3 failed the LOD outline gate (15 m: 725 px, blob 12)
        def drips(img, r0, c_lo, c_hi, win=DRIP_WIN, thr=DRIP_THR, mpp=S):
            # per column: tip = end of the bright run that starts in the snow body (r0-20); drip = tip below the fringe baseline
            sub = img[r0 - 20:r0 + win, c_lo:c_hi] > thr; sub = sub | (np.roll(sub, 1, 0) & np.roll(sub, -1, 0))
            tips = np.array([np.argmin(np.r_[c, False]) if c[0] else 0 for c in sub.T], float)
            base = np.percentile(tips[tips > 0], 30) if (tips > 0).any() else 0
            L = ndi.median_filter(np.clip(tips - base, 0, None), 3); out = []
            for j in range(len(L)):
                if L[j] >= 3 and L[j] == L[max(0, j - 2):j + 3].max() and (not out or j - out[-1][0] >= 4): out.append((j, L[j]))
            # v3.4: root width = contiguous columns whose drip reaches >= 1/3 of this streak's length (real pixel width)
            res = []
            for j, l in out:
                a_ = j; b_ = j
                while a_ > 0 and L[a_ - 1] >= l / 3: a_ -= 1
                while b_ < len(L) - 1 and L[b_ + 1] >= l / 3: b_ += 1
                res.append((c_lo + j, l, b_ - a_ + 1, a_, b_))
            # v3.4 curtains: a root wider than ~0.3 m is a fused curtain -> one cone per `step` px across it, each at its own
            # column's real pixel length (only where that column itself is a drip, L >= 3 px); peaks already inside a curtain merge
            out2, done = [], set()
            for c, l, w, a_, b_ in res:
                if (a_, b_) in done: continue
                done.add((a_, b_))
                if w * mpp <= 0.3: out2.append((c, l, w)); continue
                n = max(2, int(round(w * mpp / 0.25))); cols = np.linspace(a_, b_, n).round().astype(int)
                for jj in cols:
                    if L[jj] >= 3: out2.append((c_lo + int(jj), float(L[jj]), max(1, int(round(w / n)))))
            return out2, int(r0 - 20 + base)
        def cone(base, Lm, r, uvc, seed, mat='front'):
            # v3.4.1: root ring has 10 sides and is SUNK into the snow lip (its highest point under the lip surface + 3 cm, so no cap
            # or root rim is visible); the root's UVs continue up into the plate's snow rows above the fringe, so the visible root
            # carries lip-snow pixels and grades into the streak pixels below. Down the cone: 6 sides (12 -> 6 bridge). 34 tris/cone.
            # Visible length below the lip is unchanged (Lm); every LOD gets the identical cone.
            n0, n1 = 12, 6   # Engine Core: 12 sides only on the buried root ring, 6 down the cone (old 6-side tip outline)
            def lip_y(z): return c0 if z <= cz - R else c0 + R - np.sqrt(max(0.0, R * R - (z - (cz - R)) ** 2))
            a0s = 2 * np.pi * np.arange(n0) / n0
            top = max(lip_y(base[2] + r * np.sin(a)) for a in a0s) + SINK
            sink = top - (c0 + 0.02); Lt = Lm + sink; by = top
            rng = np.random.default_rng(seed); tipdx, tipdz = rng.uniform(-0.3, 0.3, 2) * r; mid = 0.55 + rng.uniform(-0.1, 0.1)
            h1 = sink + 0.45 * Lm; f1 = h1 / Lt
            # per-face isotropic unwrap: each triangle gets its own UV copies, arc length measured from the face's centre angle, so
            # every face samples the streak's own plate column (no conical-unwrap shear); positions are shared after the weld
            P0 = [(base[0] + r * np.cos(a), by, base[2] + r * np.sin(a), a, r, -sink) for a in a0s]
            a1s = 2 * np.pi * np.arange(n1) / n1 + np.pi / n1
            P1 = [(base[0] + r * mid * np.cos(a) + tipdx * f1, by - h1, base[2] + r * mid * np.sin(a) + tipdz * f1, a, r * mid, 0.45 * Lm) for a in a1s]
            PT = (base[0] + tipdx, by - Lt, base[2] + tipdz, None, 0.0, Lm)
            rad = lambda tri: ('radial', base[0] + tipdx * 0.5, base[2] + tipdz * 0.5, np.mean([V[i] for i in tri], 0))
            def face(*ps):
                angs = [p[3] for p in ps if p[3] is not None]; ac = np.angle(np.mean(np.exp(1j * np.array(angs))))
                ids = []
                for p in ps:
                    da = 0.0 if p[3] is None else (p[3] - ac + np.pi) % (2 * np.pi) - np.pi
                    ids.append(addv(p[:3], uvc(0.5 + p[4] * da / (np.pi * r), p[5], 1.0)))
                tri = tuple(ids); F[mat].append(tri); NRM[mat].append(rad(tri))
            for q in range(n0):   # 12 -> 6 bridge (ring1[j] sits over ring0[2j+1])
                face(P0[q], P0[(q + 1) % n0], P1[q // 2])
            for j in range(n1):
                face(P1[j], P0[(2 * j + 2) % n0], P1[(j + 1) % n1])
                face(P1[j], P1[(j + 1) % n1], PT)
            ring0 = [None] * n0
            capr = [addv(P0[q][:3], uvc(0.5 + np.cos(a) / np.pi, -sink - r * (1 + np.sin(a)), 1.0)) for q, a in enumerate(a0s)]   # isotropic disc UVs
            for q in range(1, n0 - 1):   # sealed root cap (fan, inside the lip)
                F[mat].append((capr[0], capr[q], capr[q + 1])); NRM[mat].append((0, 1, 0))
        img = np.asarray(Image.open(os.path.join(step, PLATE_FRONT)).convert('L'), np.float32)
        r0 = int(round(FY0 - c0 / S)); cl = int(FX0 - hw * 0.98 / S); ch = int(FX0 + hw * 0.98 / S)
        dr, brow = drips(img, r0, cl, ch); ytop = FY0 * S - brow * S   # plate row of the fringe baseline -> metres
        spans = [(cl, ch)] if k else [(cl, int(FX0 + X2A / S)), (int(FX0 + X2B / S), ch)]
        for c_a, c_b in spans: BANDS.append(dict(plate='plate-front', mask=MASK_FRONT, tex=TEX_FRONT, tier=k, side='front', row0=int(brow), rows=DRIP_WIN, c_lo=c_a, c_hi=c_b, a=-FX0 * S / sc_c, b=S / sc_c))
        if k == 0:   # v3.2: drips inside the close plate's span come from its own pixels (98 px/m: real lengths, fewer raised stubs)
            img2 = np.asarray(Image.open(os.path.join(step, PLATE_CLOSE)).convert('L'), np.float32)   # drips on the ORIGINAL pixels (the v3.3 grade only changes colour)
            r2 = CLOSE_ROW; dr2_, _b2 = drips(img2, r2, CROP0, N2, win=CLOSE_WIN, thr=CLOSE_THR, mpp=1 / K2)   # this plate's own snow-body row and (darker) snow level
            ytop2 = (G2 - _b2) / K2   # cone UVs start at the plate's own fringe baseline
            pa, pb = int(C2 + (X2A + 0.1 - XC2) * K2), int(C2 + (X2B - 0.1 - XC2) * K2)
            BANDS.append(dict(plate='t1-right', mask=MASK_CLOSE, tex=TEX_CLOSE, tier=k, side='front', row0=int(_b2), rows=CLOSE_WIN, c_lo=max(CROP0, pa), c_hi=min(N2, pb), a=(XC2 - C2 / K2) / sc_c, b=1 / (K2 * sc_c)))
            for px, L, wpx in dr2_:
                xm = XC2 + (px - C2) / K2; x = xm / sc_c; Lr = L / K2
                if Lr > 1.6 or Lr < 0.1 or not (X2A + 0.1 < xm < X2B - 0.1):
                    GHOST.append(dict(plate='t1-right', col=int(px), row=int(_b2), lenPx=float(L), wPx=int(wpx))); continue
                # v3.4: true pixel length (no raise on this plate), root radius from the streak's real pixel width (key B: 10-30 cm roots)
                Lm = float(Lr); r = float(np.clip(wpx / K2 / 2, 0.05, 0.15)); rootW = round(wpx / K2, 3)
                cone((x, c0 + 0.02, cz - R * 0.5), Lm, r, lambda t, h, sc=1.0, xm=xm, r=r: f2uv(xm + np.pi * r * sc * (t - 0.5), ytop2 - h), px * 11 + 5, 'front2')
                ICI.append(dict(tier=k, side='front', plate='t1-right', rootWm=rootW, rawLenM=round(Lr, 3), x=round(x, 3), z=round(cz - R * 0.5, 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
        for px, L, wpx in dr:
            xp = (px - FX0) * S; x = xp / sc_c
            if (k == 0 and X2A < xp < X2B) or (k == 2 and L * S < 0.3) or L * S > 1.2:   # close-plate span / tier-3 clearance / snow run
                GHOST.append(dict(plate='plate-front', col=int(px), row=int(brow), lenPx=float(L), wPx=int(wpx))); continue
            Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(wpx * S / 2, 0.05, 0.15)); rootW = round(wpx * S, 3)
            cone((x, c0 + 0.02, cz - R * 0.5), Lm, r, lambda t, h, sc=1.0, xp=xp, r=r, ytop=ytop: fuv(xp + np.pi * r * sc * (t - 0.5), ytop - h), px * 7 + k)
            ICI.append(dict(tier=k, side='front', rootWm=rootW, rawLenM=round(L * S, 3), x=round(x, 3), z=round(cz - R * 0.5, 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
        # left cornice end (path side): drips from the side plate rows under this tier's cornice
        simg = np.asarray(Image.open(os.path.join(step, PLATE_SIDE)).convert('L'), np.float32)
        b_, t_ = SIDEROWS[k]; srow = int(round(b_ + (t_ - b_) * (c0 - y0) / (c1 - y0)))
        dr2, _ = drips(simg, srow, int(SX0 + (BACK - CORN_OUT) / S) + 4, int(SX0) - 2)
        BANDS.append(dict(plate='plate-side', mask=MASK_SIDE, tex=TEX_SIDE, tier=k, side='left', row0=int(_), rows=DRIP_WIN, c_lo=int(SX0 + (BACK + 0.2 - CORN_OUT) / S), c_hi=int(SX0 + (cz - 0.15 - CORN_OUT) / S), a=-SX0 * S + CORN_OUT, b=S))
        for px, L, wpx in dr2:
            z = (px - SX0) * S + CORN_OUT; Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(wpx * S / 2, 0.05, 0.15)); rootW = round(wpx * S, 3)
            if (k == 2 and L * S < 0.3) or L * S > 1.2 or z > cz - 0.15 or z < BACK + 0.2:
                GHOST.append(dict(plate='plate-side', col=int(px), row=int(_), lenPx=float(L), wPx=int(wpx))); continue
            zp = z - CORN_OUT
            cone((-cw + r + 0.04, c0 + 0.02, z), Lm, r, lambda t, h, sc=1.0, zp=zp, r=r: suv(zp + np.pi * r * sc * (t - 0.5), c0 - h), px * 13 + k)
            ICI.append(dict(tier=k, side='left', rootWm=rootW, rawLenM=round(L * S, 3), x=round(-cw + r + 0.04, 3), z=round(z, 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
        # v3.4: every painted streak the gate's detector sees on this tier's ORIGINAL plates either gets real cones (it hangs from the
        # fringe line: curtain/drip -> one cone per ~0.25 m across its real width, each at its own column's pixel length, root = real
        # width / n) or is listed as a ghost and cleaned out of the texture by work/clean_streaks.py (free-hanging / too long / clearance).
        tipmin = [0.3, T[0]['c1'] + 0.3, T[1]['c1'] + 2.5][k]   # tier 3 keeps the 2.5 m clearance over the tier-2 top; tier 2 tips stay above the tier-1 top
        for b in [b for b in BANDS if b['tier'] == k]:
            src = {'t1-right': img2 if k == 0 else None, 'plate-front': img, 'plate-side': simg}[b['plate']]
            key = 'x' if b['side'] == 'front' else 'z'; mpp = abs(b['b']) * (sc_c if b['side'] == 'front' else 1)   # metres of PLATE per px
            # bands.json keeps the step-relative mask string (ghost CLI cwd = step). detect opens a file, so resolve here.
            bb = dict(b)
            if bb.get("mask") and not os.path.isabs(bb["mask"]):
                bb["mask"] = os.path.join(step, bb["mask"])
            for st in GS.detect(src, bb, mpp):
                have = np.array([c[key] for c in ICI if c['tier'] == k and c['side'] == b['side']] or [1e9])
                xg = b['a'] + b['b'] * st['col']
                if np.min(np.abs(have - xg)) <= max(0.2, st['widthM'] / 2): continue
                colpx = src[min(b['row0'], st['r0']):st['r0'] + 1, st['col']]   # hangs from the fringe = bright pixels connect it to the snow body
                attached = (ndi.binary_closing(colpx > 60, iterations=2) | (colpx > 60)).all() if len(colpx) else True
                near = (st['r0'] - b['row0']) * mpp <= (1.5 if attached else 0.35)   # starts at the fringe line (not a free-hanging painted streak lower on the wall)
                Lfr = (st['r1'] - min(b['row0'], st['r0'])) * mpp   # real length from the fringe line to the streak tip
                hang = (attached or st['r0'] - b['row0'] <= 8) and near and Lfr <= 2.5 and c0 + 0.02 - Lfr >= tipmin
                if not hang:
                    GHOST.append(dict(plate=b['plate'], tier=k, side=b['side'], c0=st['c0'], c1=st['c1'], r0=st['r0'], r1=st['r1'], lenM=st['lenM'], why='free-hanging/long/clearance')); continue
                n = max(1, int(round(st['widthM'] / 0.25))); cols = st['cols']; pick = [cols[int(i)] for i in np.linspace(0, len(cols) - 1, n).round()]
                rr = float(np.clip(st['widthM'] / n / 2, 0.05, 0.15))
                for col, Lc, r0c in pick:
                    Lm = float((r0c - min(b['row0'], r0c)) * mpp + Lc)   # fringe -> this column's tip
                    if Lc < 0.15 or Lm > 2.5 or c0 + 0.02 - Lm < tipmin: continue
                    g = b['a'] + b['b'] * col
                    if b['plate'] == 't1-right':
                        xm = g * sc_c; uvf = lambda t, h, sc=1.0, xm=xm, r=rr: f2uv(xm + np.pi * r * sc * (t - 0.5), ytop2 - h); mat = 'front2'; base = (g, c0 + 0.02, cz - R * 0.5)
                    elif b['plate'] == 'plate-front':
                        xp = g * sc_c; uvf = lambda t, h, sc=1.0, xp=xp, r=rr, ytop=ytop: fuv(xp + np.pi * r * sc * (t - 0.5), ytop - h); mat = 'front'; base = (g, c0 + 0.02, cz - R * 0.5)
                    else:
                        zp = g - CORN_OUT; uvf = lambda t, h, sc=1.0, zp=zp, r=rr: suv(zp + np.pi * r * sc * (t - 0.5), c0 - h); mat = 'side'; base = (-cw + rr + 0.04, c0 + 0.02, g)
                    cone(base, Lm, rr, uvf, col * 17 + k, mat)
                    ICI.append(dict(tier=k, side=b['side'], plate=b['plate'], src='v34-detector', rootWm=round(2 * rr, 3), rawLenM=round(Lm, 3), x=round(base[0], 3), z=round(base[2], 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
    # ground skirt hidden 0.3 m below 0 (grounded: lowest visible y = 0)
    V = np.array(V); UVs = np.array(UVs)
    flipped = 0
    for m in F:
        for i, (a_, b_, c_) in enumerate(F[m]):
            d = NRM[m][i]
            if d[0] == 'radial': d = (d[3][0] - d[1], 0.0, d[3][2] - d[2])
            n = np.cross(V[b_] - V[a_], V[c_] - V[a_])
            if np.dot(n, d) < 0: F[m][i] = (a_, c_, b_); flipped += 1
    # Cone bridges and side-relief quads exceed 1.3. Rescale those UV triangles
    # only. Shared corners that already pass keep their vt, so the grid does not move.
    uv_cap = float(prof.get("uvAnisotropyMax", 1.3))
    UVs, UVF = cap_uv_anisotropy(V, UVs, F, uv_cap, NATIVE * S)
    o = OUT
    with open(o + '.obj', 'w') as f:
        f.write('mtllib ' + os.path.basename(OUT) + '.mtl\n')
        for p in V: f.write('v %.4f %.4f %.4f\n' % tuple(p))
        for t in UVs: f.write('vt %.5f %.5f\n' % tuple(t))
        for m in ('front', 'front2', 'side', 'top'):
            f.write(f'usemtl {m}\n')
            for (a, b, c), (ta, tb, tc) in zip(F[m], UVF[m]):
                f.write(f'f {a+1}/{ta+1} {b+1}/{tb+1} {c+1}/{tc+1}\n')
    with open(o + '.mtl', 'w') as f:
        f.write(MTL)
    ntri = sum(len(v) for v in F.values())
    # per-triangle texel stretch (OBJ face order): metres per nominal plate px along both principal axes
    st = []
    dens = []
    for m in ('front', 'front2', 'side', 'top'):
        for (a_, b_, c_), (ta, tb, tc) in zip(F[m], UVF[m]):
            P = V[[a_, b_, c_]]; Q = UVs[[ta, tb, tc]] * NATIVE * S
            e1, e2 = P[1] - P[0], P[2] - P[0]; t1 = e1 / max(np.linalg.norm(e1), 1e-12); nn = np.cross(e1, e2); nn /= max(np.linalg.norm(nn), 1e-12); t2 = np.cross(nn, t1)
            A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]]); B = np.array([Q[1] - Q[0], Q[2] - Q[0]]).T
            try: J = A @ np.linalg.inv(B); sv = np.linalg.svd(J, compute_uv=False); st.append(float(sv[0] / max(sv[1], 1e-9))); dens.append(float(sv[0]))
            except np.linalg.LinAlgError: st.append(1e9); dens.append(1e9)
    np.save(OUT + '-stretch.npy', np.array(st, np.float32)); np.save(OUT + '-density.npy', np.array(dens, np.float32))
    json.dump(ICI, open(o + '-icicles.json', 'w')); json.dump(GHOST, open(o + '-ghosts.json', 'w')); json.dump(BANDS, open(o + '-bands.json', 'w'))
    json.dump(dict(lod=LOD, tris=ntri, flippedForWinding=flipped, icicles=len(ICI), verts=len(V), aabb=[V.min(0).tolist(), V.max(0).tolist()], doorDepthM=DOOR_D, corniceOutM=CORN_OUT,
                   mPerPx=S, tiers=T, back=BACK, uvStretchMax=(round(float(np.max(st)), 6) if st else None), uvStretchOver13Frac=(round(float(np.mean(np.asarray(st) > 1.3)), 6) if st else None), reliefUnderSam2=True), open(o + '.json', 'w'), indent=1)
    print(o, ntri, V.min(0).round(2), V.max(0).round(2))


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if len(a) < 1 or "--profile" not in a:
        print("usage: block_builder.py <stepdir> --profile <json> [--lod N] [--out prefix]", file=sys.stderr)
        return 2
    step = a[0]
    prof = json.load(open(a[a.index("--profile") + 1]))
    lod = int(a[a.index("--lod") + 1]) if "--lod" in a else 0
    out = a[a.index("--out") + 1] if "--out" in a else None
    build(step, prof, lod, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
