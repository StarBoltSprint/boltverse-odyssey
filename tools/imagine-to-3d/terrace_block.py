"""Stepped terrace block (Zone D) from two Imagine plates: front elevation + left side profile.
Dims are read from the SAM2 silhouettes of the plates (shared px/m), relief on visible walls from MoGe-2 depth under its
own pixels (border-locked to 0 so every LOD keeps the identical silhouette). Doorways are real recesses, cornices are
real overhanging slabs with a rounded lip, icicles are cones at the plate's own icicle columns.
python3 terrace_block.py <stepdir> [--lod 0|1|2]  -> work/terrace-lodN.obj (+ .mtl) and work/terrace-lodN.json
"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
import os; sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../object-gate/py')); import ghost_streaks as GS
step = sys.argv[1]; LOD = int(sys.argv[sys.argv.index('--lod') + 1]) if '--lod' in sys.argv else 0
S = 0.0215                        # m per plate px (front height 685 px <-> 14.7 m; doors ~2.4 m)
FX0, FY0 = 535, 870               # front plate: x=0 column, ground row
SX0, SY0 = 890, 864               # side plate: facade (z=0) column, ground row
DOOR_D, CORN_OUT, CORN_SIDE, LIP_R = 1.5, 1.0, 0.6, 0.35
GRID = [0.12, 0.24, 0.48][LOD]; SGRID = [0.20, 0.40, 0.80][LOD]
# tiers from the front/side silhouettes: (half width, front z, wall y0, y1, cornice y1), back z = -16
def ym(row, y0=FY0): return (y0 - row) * S
T = [dict(hw=370 * S, z=0.0, y0=0.0, y1=ym(640), c1=ym(600)),
     dict(hw=345 * S, z=-135 * S, y0=ym(600), y1=ym(430), c1=ym(395)),
     dict(hw=308 * S, z=-315 * S, y0=ym(395), y1=ym(240), c1=ym(185))]
BACK = -744 * S
DOORS = [(477, 593, 691), (468, 568, 479), (461, 551, 270)]   # plate px x0,x1,top row (bottom = tier floor)
fd = np.load(f'{step}/work/plate-front-depth.npy'); sd = np.load(f'{step}/work/plate-side-depth.npy')
def hp(d, sig):
    r = d - ndi.gaussian_filter(d, sig); return np.clip(r, -0.6, 0.6)
FREL, SREL = ndi.gaussian_filter(hp(fd, 12), 2.5), ndi.gaussian_filter(hp(sd, 12), 2.5)   # slope-limited so UV stretch stays <= 1.3
AMP = 0.06
# v3.2 side relief >= 0.3 m: MoGe-2 depth of the side plate under its own (SAM2-masked) pixels, column-scale high-pass (sigma 24 px
# = 0.5 m, the basalt column pitch), smoothed 4 px; signed displacement up to +-AMP_SIDE (sides only, every LOD so the 40 m swap keeps the same surface)
SREL2 = ndi.gaussian_filter(hp(sd, 48), 16.0); AMP_SIDE = 0.26   # 1 m high-pass, 0.34 m smooth: slopes keep UV stretch <= 1.3
UNDER_OFF = [64 * S, 16 * S, 8 * S]   # first shadowed-basalt row below each cornice in the front plate (measured)
# v3.2: tier-1 front close plate (Imagine, plates/v32/t1-right.jpg = the frontal centre-door shot); door 396-641 px, top 397, sill 775
K2, C2, G2, XC2 = 378 / 3.85, 518.5, 775, -0.86          # plate px per m (door height 3.85 m), door centre col, ground row, door centre x (m)
X2A, X2B = XC2 - 512 / K2, XC2 + 500 / K2                  # facade x range covered by that plate
def f2uv(x, y): return ((C2 + (x - XC2) * K2) / 1024, 1 - (G2 - y * K2) / 1024)
V, UVs, F = [], [], {'front': [], 'front2': [], 'side': [], 'top': [], 'icefront': [], 'icefront2': [], 'iceside': []}
ICI = []
ROOTS = []; BANDS = []; GHOST = []   # v3.4: detected streaks that get NO cone -> cleaned out of the texture (work/clean_streaks.py)
NRM = {'front': [], 'front2': [], 'side': [], 'top': [], 'icefront': [], 'icefront2': [], 'iceside': []}   # intended outward normal per triangle (winding fix)
TX0 = 525
# v3.5: every +y face, ledge included, gets the same isotropic px/m from top.jpg.
# A 1024 plate cannot reach 154.6 px/m across a ~17 m ledge (that needs ~2600 px). 48 px/m is the
# densest isotropic pack that still fits the three disjoint bands (repetition forbids sharing texels).
TOP_SPM = 48.0
def _top_depth(k):
    z0 = T[k]['z']; cz = z0 + CORN_OUT; zend = T[k + 1]['z'] if k < 2 else BACK
    return cz, zend, abs(cz - zend)
_cursor = 16; TOP_ROW0 = {}
for _k in (2, 1, 0):
    _cz, _zend, _depth = _top_depth(_k); _rows = max(8, int(round(_depth * TOP_SPM)))
    TOP_ROW0[_k] = (_cursor, _cursor + _rows, _cz, _zend); _cursor += _rows + 8
assert _cursor < 1020, _cursor
ALIGN = []   # relief alignment: a geometric step exists only on a detected course line
def addv(p, uv): V.append(p); UVs.append(uv); return len(V) - 1
def fuv(x, y): return ((FX0 + x / S) / 1024, 1 - (FY0 - y / S) / 1024)
SIDEROWS = [(864, 645), (656, 480), (480, 288)]
def suv(z, y):
    k = 0 if y < T[0]['c1'] - 1e-6 else (1 if y < T[1]['c1'] - 1e-6 else 2)
    if abs(y - T[0]['c1']) < 1e-6 or abs(y - T[1]['c1']) < 1e-6: k = SIDE_K[0] if SIDE_K else k
    b, t = SIDEROWS[k]; f = (y - T[k]['y0']) / (T[k]['c1'] - T[k]['y0'])
    return ((SX0 + z / S) / 1024, 1 - (b + (t - b) * f) / 1024)
SIDE_K = []
def tuv(k, cz, p):
    r0, r1, czb, zend = TOP_ROW0[k]
    row = r0 + (czb - p[2]) / (czb - zend) * (r1 - r0)
    spm = abs(r1 - r0) / abs(czb - zend)   # same px/m on x and z (aniso ~ 1)
    return ((TX0 + p[0] * spm) / 1024, 1 - row / 1024)
_frontL = np.asarray(Image.open(f'{step}/plates/plate-front.jpg').convert('L'), np.float32)
def course_ys(y0, y1, x_lo, x_hi, door_top):
    """Horizontal basalt courses: a row where most columns share a strong luminance edge. Steps are cut only on these."""
    r0 = int(np.clip(round(FY0 - y1 / S), 2, 1021)); r1 = int(np.clip(round(FY0 - y0 / S), 2, 1021))
    if r1 - r0 < 24: return []
    c0 = int(np.clip(round(FX0 + x_lo / S), 1, 1022)); c1 = int(np.clip(round(FX0 + x_hi / S), 1, 1022))
    if c1 - c0 < 16: return []
    gy = np.abs(np.diff(_frontL[r0:r1, c0:c1], axis=0))
    thr = np.percentile(gy, 90); frac = ndi.gaussian_filter1d((gy > thr).mean(axis=1), 1.2)
    found = []
    for i in range(3, len(frac) - 3):
        if frac[i] < 0.48 or frac[i] < frac[i - 1] or frac[i] < frac[i + 1]: continue
        y = (FY0 - (r0 + i)) * S
        if found and abs(y - found[-1][0]) < 0.55:
            if frac[i] > found[-1][1]: found[-1] = (y, float(frac[i]))
            continue
        found.append((y, float(frac[i])))
    # only the band above the doorway: a step through the jamb would open the recess
    return [y for y, _s in found if door_top + 0.2 < y < y1 - 0.15][:5]
def under_x(x, X0, X1, m=0.25):
    # door columns carry the door's black top, not basalt: read the adjacent basalt instead (pure translation, no stretch)
    return (X1 + m + 4.5) - (x - (X0 - m)) if X0 - m < x < X1 + m else x   # flipped real basalt 4.5 m further along the same rows
def samp(a, uv):
    px = int(np.clip(uv[0] * 1024, 0, 1023)); py = int(np.clip((1 - uv[1]) * 1024, 0, 1023)); return float(a[py, px])
def ticks(a, b, step, must=()):
    t = sorted(set([a, b] + [m for m in must if a < m < b]))
    out = [t[0]]
    for i in range(len(t) - 1):
        n = max(1, int(round((t[i + 1] - t[i]) / step)))
        out += list(np.linspace(t[i], t[i + 1], n + 1)[1:])
    return np.array(out)
def quadgrid(P, us, vs, mat, uvf, normal, keep=lambda u, v: True, relief=None, border=0.3, lock=None, amp=None):
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
    COURSES = course_ys(y0, y1, -hw, hw, DY); STEP = 0.018
    for c in COURSES: ALIGN.append(dict(tier=k, courseY=round(c, 4), stepY=round(c, 4), deltaM=0.0, stepM=STEP))
    def z_of(v, z0=z0, cs=tuple(COURSES)):
        return z0 + STEP * sum(v >= c - 1e-6 for c in cs)
    xs = ticks(-hw, hw, GRID, (X0, X1)); ys = ticks(y0, y1, GRID, (DY,) + tuple(COURSES))
    # front facade (+Z) with the doorway hole, MoGe relief except at borders and door jambs (relief locked there)
    if k == 0:   # v3.2: three panels; the middle one is the close plate (flat: no MoGe-2 depth of the new plate, relief locked off)
        xs = ticks(-hw, hw, GRID, (X0, X1, X2A, X2B))
        for (xa, xb, m_, uvf_, rel) in ((-hw, X2A, 'front', lambda p: fuv(p[0], p[1]), FREL), (X2A, X2B, 'front2', lambda p: f2uv(p[0], p[1]), None), (X2B, hw, 'front', lambda p: fuv(p[0], p[1]), FREL)):
            sub = xs[(xs >= xa - 1e-9) & (xs <= xb + 1e-9)]
            quadgrid(lambda u, v, z_of=z_of: (u, v, z_of(v)), sub, ys, m_, uvf_, (0, 0, 1), keep=lambda u, v: not inside(u, v), relief=rel if LOD < 2 else None)
    else:
        quadgrid(lambda u, v, z_of=z_of: (u, v, z_of(v)), xs, ys, 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1), keep=lambda u, v: not inside(u, v),
             relief=FREL if LOD < 2 else None, lock=lambda u, v, X0=X0, X1=X1, DY=DY: 0.5 * max(X0 - u, u - X1, v - DY, 0) if not inside(u, v) else 0)
    DM, DUV = ('front2', f2uv) if k == 0 else ('front', fuv)
    # doorway recess: back wall, jambs, lintel underside, floor
    box_quad((X0, y0, z0 - DOOR_D), (X1 - X0, 0, 0), (0, DY - y0, 0), n_(X1 - X0, GRID), n_(DY - y0, GRID), DM, lambda p, DUV=DUV: DUV(p[0], p[1]), (0, 0, 1))
    # jambs (v3.2 root-cause fix): v3 folded the facade around the door edge (u = X0 - depth), a NEGATIVE u scale on the jamb island
    # = mirror image of the wall at the corner (the Rorschach). Now a translated strip of real basalt 0.35 m off the edge, u growing
    # in the same screen direction as the facade (positive scale, no mirror).
    JO = 0.35
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
    quadgrid(lambda u, v: (-hw, v, u), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (-1, 0, 0), relief=SREL2, amp=AMP_SIDE, border=1.0)
    quadgrid(lambda u, v: (hw, v, -u + z0 + BACK), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (1, 0, 0), relief=SREL2, amp=AMP_SIDE, border=1.0)
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
    def drips(img, r0, c_lo, c_hi, win=110, thr=135, mpp=S):
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
    PENDING = []; PLACED = []
    def queue_cone(base, Lm, r, uvc, seed, mat='front', meta=None):
        base = tuple(float(x) for x in base)
        PENDING.append(dict(base=base, Lm=float(Lm), r=float(r), uvc=uvc, seed=seed, mat=mat, meta=meta or {}))
        PLACED.append(dict(tier=k, side='left' if mat == 'side' else 'front', x=base[0], z=base[2]))
    def cone(base, Lm, r, uvc, seed, mat='front', r_cap=None):
        # v3.4.1: root ring is SUNK into the snow lip. Down the cone: 6 sides (12 -> 6 bridge).
        # Visible length below the lip is Lm; every LOD gets the identical cone.
        # v3.5: the cone samples the ORIGINAL plate (ice material) so inpainting the wall does not
        # strip the ice colour. Buried radius stays inside the neighbour gap (r_cap).
        n0, n1 = 12, 6   # Engine Core: 12 sides only on the buried root ring, 6 down the cone (old 6-side tip outline)
        imat = {'front': 'icefront', 'front2': 'icefront2', 'side': 'iceside'}[mat]
        def lip_y(z): return c0 if z <= cz - R else c0 + R - np.sqrt(max(0.0, R * R - (z - (cz - R)) ** 2))
        a0s = 2 * np.pi * np.arange(n0) / n0
        # v3.4.2: root ring buried 9 cm into the lip; width at the lip surface = streak width (r), then a short taper to the cone
        # body within ~7 cm (ring1, no constant-width neck); buried ring radius set so the line ring0->ring1 crosses the lip at r
        lipt = max(lip_y(base[2] + r * np.sin(a)) for a in a0s); top = lipt + 0.09
        sink = top - (c0 + 0.02); Lt = Lm + sink; by = top
        rb = float(np.clip(0.35 * r + 0.02, 0.02, 0.07)); h1 = (by - lipt) + 0.07; f1 = h1 / Lt
        # Buried ring radius = the streak radius, capped so neighbouring rings stay 6 mm apart.
        # The old 0.145 m lip-clearance radius made those 12-gons share edges (108 non-manifold).
        lip_room = ((cz - 0.03) - base[2]) if mat != 'side' else r * 1.6
        r0 = min(r, lip_room) if lip_room > 0.01 else r
        if r_cap is not None: r0 = min(r0, r_cap)
        r = r0
        rng = np.random.default_rng(seed); tipdx, tipdz = rng.uniform(-0.3, 0.3, 2) * r
        rb = min(rb, r0 * 0.55); mid = rb / max(r0, 1e-6)
        lipt = max(lipt, max(lip_y(base[2] + r0 * np.sin(a)) for a in a0s)); by = max(by, lipt + 0.09); sink = by - (c0 + 0.02); Lt = Lm + sink; h1 = (by - lipt) + 0.07; f1 = h1 / Lt
        dv = by - lipt   # UV v = metres below the lip surface (isotropic: buried ring sits on snow rows, lip line = streak top)
        ROOTS.append(dict(y=by, x=base[0], z=base[2], n=[0.0, -0.87, 0.5] if base[2] > cz - R - 0.05 else [0.0, -1.0, 0.0]))
        r = r0
        # per-face isotropic unwrap: each triangle gets its own UV copies, arc length measured from the face's centre angle, so
        # every face samples the streak's own plate column (no conical-unwrap shear); positions are shared after the weld
        P0 = [(base[0] + r * np.cos(a), by, base[2] + r * np.sin(a), a, r, -dv) for a in a0s]   # root UVs on the streak (icy grey), not the white lip snow
        a1s = 2 * np.pi * np.arange(n1) / n1 + np.pi / n1
        P1 = [(base[0] + r * mid * np.cos(a) + tipdx * f1, by - h1, base[2] + r * mid * np.sin(a) + tipdz * f1, a, r * mid, h1 - dv) for a in a1s]
        PT = (base[0] + tipdx, by - Lt, base[2] + tipdz, None, 0.0, Lt - dv)
        rad = lambda tri: ('radial', base[0] + tipdx * 0.5, base[2] + tipdz * 0.5, np.mean([V[i] for i in tri], 0))
        def face(*ps):
            angs = [p[3] for p in ps if p[3] is not None]; ac = np.angle(np.mean(np.exp(1j * np.array(angs))))
            ids = []
            for p in ps:
                da = 0.0 if p[3] is None else (p[3] - ac + np.pi) % (2 * np.pi) - np.pi
                ids.append(addv(p[:3], uvc(p[4] * da, p[5])))
            tri = tuple(ids); F[imat].append(tri); NRM[imat].append(rad(tri))
        for q in range(n0):   # 12 -> 6 bridge (ring1[j] sits over ring0[2j+1])
            face(P0[q], P0[(q + 1) % n0], P1[q // 2])
        for j in range(n1):
            face(P1[j], P0[(2 * j + 2) % n0], P1[(j + 1) % n1])
            face(P1[j], P1[(j + 1) % n1], PT)
        ring0 = [None] * n0
        capr = [addv(P0[q][:3], uvc(r * np.cos(a), -dv - r * (1 + np.sin(a)))) for q, a in enumerate(a0s)]   # isotropic disc, metres
        for q in range(1, n0 - 1):   # sealed root cap (fan, inside the lip)
            F[imat].append((capr[0], capr[q], capr[q + 1])); NRM[imat].append((0, 1, 0))
        return r0
    img = np.asarray(Image.open(f'{step}/plates/plate-front.jpg').convert('L'), np.float32)
    r0 = int(round(FY0 - c0 / S)); cl = int(FX0 - hw * 0.98 / S); ch = int(FX0 + hw * 0.98 / S)
    dr, brow = drips(img, r0, cl, ch); ytop = FY0 * S - brow * S   # plate row of the fringe baseline -> metres
    spans = [(cl, ch)] if k else [(cl, int(FX0 + X2A / S)), (int(FX0 + X2B / S), ch)]
    for c_a, c_b in spans: BANDS.append(dict(plate='plate-front', mask='work/plate-front-mask.png', tex='plates/v35/plate-front-v35.jpg', tier=k, side='front', row0=int(brow), rows=110, c_lo=c_a, c_hi=c_b, a=-FX0 * S / sc_c, b=S / sc_c))
    if k == 0:   # v3.2: drips inside the close plate's span come from its own pixels (98 px/m: real lengths, fewer raised stubs)
        img2 = np.asarray(Image.open(f'{step}/plates/v32/t1-right.jpg').convert('L'), np.float32)   # drips on the ORIGINAL pixels (the v3.3 grade only changes colour)
        r2 = 220; dr2_, _b2 = drips(img2, r2, 2, 1022, win=200, thr=100, mpp=1 / K2)   # this plate's own snow-body row and (darker) snow level
        ytop2 = (G2 - _b2) / K2   # cone UVs start at the plate's own fringe baseline
        pa, pb = int(C2 + (X2A + 0.1 - XC2) * K2), int(C2 + (X2B - 0.1 - XC2) * K2)
        BANDS.append(dict(plate='t1-right', mask='work/t1-right-mask.png', tex='plates/v35/t1-right-v35.jpg', tier=k, side='front', row0=int(_b2), rows=200, c_lo=max(2, pa), c_hi=min(1022, pb), a=(XC2 - C2 / K2) / sc_c, b=1 / (K2 * sc_c)))
        for px, L, wpx in dr2_:
            xm = XC2 + (px - C2) / K2; x = xm / sc_c; Lr = L / K2
            if Lr > 1.6 or Lr < 0.1 or not (X2A + 0.1 < xm < X2B - 0.1):
                GHOST.append(dict(plate='t1-right', col=int(px), row=int(_b2), lenPx=float(L), wPx=int(wpx))); continue
            # v3.4: true pixel length (no raise on this plate), root radius from the streak's real pixel width (key B: 10-30 cm roots)
            Lm = float(Lr); r = float(np.clip(wpx / K2 / 2, 0.05, 0.15)); rootW = round(wpx / K2, 3)
            queue_cone((x, c0 + 0.02, cz - R * 0.5), Lm, r, lambda u_m, h, xm=xm: f2uv(xm + u_m, ytop2 - h), px * 11 + 5, 'front2',
                       dict(plate='t1-right', rootWm=rootW, rawLenM=round(Lr, 3)))
    for px, L, wpx in dr:
        xp = (px - FX0) * S; x = xp / sc_c
        if (k == 0 and X2A < xp < X2B) or (k == 2 and L * S < 0.3) or L * S > 1.2:   # close-plate span / tier-3 clearance / snow run
            GHOST.append(dict(plate='plate-front', col=int(px), row=int(brow), lenPx=float(L), wPx=int(wpx))); continue
        Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(wpx * S / 2, 0.05, 0.15)); rootW = round(wpx * S, 3)
        queue_cone((x, c0 + 0.02, cz - R * 0.5), Lm, r, lambda u_m, h, xp=xp, ytop=ytop: fuv(xp + u_m, ytop - h), px * 7 + k, 'front',
                   dict(plate='plate-front', rootWm=rootW, rawLenM=round(L * S, 3)))
    # left cornice end (path side): drips from the side plate rows under this tier's cornice
    simg = np.asarray(Image.open(f'{step}/plates/plate-side.jpg').convert('L'), np.float32)
    b_, t_ = SIDEROWS[k]; srow = int(round(b_ + (t_ - b_) * (c0 - y0) / (c1 - y0)))
    dr2, _ = drips(simg, srow, int(SX0 + (BACK - CORN_OUT) / S) + 4, int(SX0) - 2)
    BANDS.append(dict(plate='plate-side', mask='work/plate-side-mask.png', tex='plates/v35/plate-side-v35.jpg', tier=k, side='left', row0=int(_), rows=110, c_lo=int(SX0 + (BACK + 0.2 - CORN_OUT) / S), c_hi=int(SX0 + (cz - 0.15 - CORN_OUT) / S), a=-SX0 * S + CORN_OUT, b=S))
    for px, L, wpx in dr2:
        z = (px - SX0) * S + CORN_OUT; Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(wpx * S / 2, 0.05, 0.15)); rootW = round(wpx * S, 3)
        if (k == 2 and L * S < 0.3) or L * S > 1.2 or z > cz - 0.15 or z < BACK + 0.2:
            GHOST.append(dict(plate='plate-side', col=int(px), row=int(_), lenPx=float(L), wPx=int(wpx))); continue
        zp = z - CORN_OUT
        queue_cone((-cw + r + 0.04, c0 + 0.02, z), Lm, r, lambda u_m, h, zp=zp: suv(zp + u_m, c0 - h), px * 13 + k, 'side',
                   dict(plate='plate-side', rootWm=rootW, rawLenM=round(L * S, 3)))
    # v3.4: every painted streak the gate's detector sees on this tier's ORIGINAL plates either gets real cones (it hangs from the
    # fringe line: curtain/drip -> one cone per ~0.25 m across its real width, each at its own column's pixel length, root = real
    # width / n) or is listed as a ghost and cleaned out of the texture by work/clean_streaks.py (free-hanging / too long / clearance).
    tipmin = [0.3, T[0]['c1'] + 0.3, T[1]['c1'] + 2.5][k]   # tier 3 keeps the 2.5 m clearance over the tier-2 top; tier 2 tips stay above the tier-1 top
    for b in [b for b in BANDS if b['tier'] == k]:
        src = {'t1-right': img2 if k == 0 else None, 'plate-front': img, 'plate-side': simg}[b['plate']]
        key = 'x' if b['side'] == 'front' else 'z'; mpp = abs(b['b']) * (sc_c if b['side'] == 'front' else 1)   # metres of PLATE per px
        for st in GS.detect(src, b, mpp):
            have = np.array([c[key] for c in PLACED if c['tier'] == k and c['side'] == b['side']] or [1e9])
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
                    xm = g * sc_c; uvf = lambda u_m, h, xm=xm: f2uv(xm + u_m, ytop2 - h); mat = 'front2'; base = (g, c0 + 0.02, cz - R * 0.5)
                elif b['plate'] == 'plate-front':
                    xp = g * sc_c; uvf = lambda u_m, h, xp=xp, ytop=ytop: fuv(xp + u_m, ytop - h); mat = 'front'; base = (g, c0 + 0.02, cz - R * 0.5)
                else:
                    zp = g - CORN_OUT; uvf = lambda u_m, h, zp=zp: suv(zp + u_m, c0 - h); mat = 'side'; base = (-cw + rr + 0.04, c0 + 0.02, g)
                queue_cone(base, Lm, rr, uvf, col * 17 + k, mat, dict(plate=b['plate'], src='v35-detector', rootWm=round(2 * rr, 3), rawLenM=round(Lm, 3)))
    # v3.5: one cone per streak centre. Doubles from the two detectors were welding into the same 12-gon.
    kept = []
    for it in sorted(PENDING, key=lambda q: -q['Lm']):
        bq = it['base']
        if any(np.hypot(bq[0] - kq['base'][0], bq[2] - kq['base'][2]) < 0.04 for kq in kept): continue
        kept.append(it)
    for i, it in enumerate(kept):
        bq = it['base']
        ds = [np.hypot(bq[0] - kq['base'][0], bq[2] - kq['base'][2]) for j, kq in enumerate(kept) if j != i]
        spacing = min(ds) if ds else 1.0
        r_cap = spacing * 0.5 - 0.003   # 6 mm gap between rings: the 1 mm probe weld cannot join them
        r_cap = max(0.012, r_cap)
        used = cone(bq, it['Lm'], it['r'], it['uvc'], it['seed'], it['mat'], r_cap)
        meta = dict(it['meta']); meta['rootWm'] = round(2 * used, 3)
        ICI.append(dict(tier=k, side='left' if it['mat'] == 'side' else 'front', x=round(bq[0], 3), z=round(bq[2], 3),
                        lenM=round(it['Lm'], 3), tipY=round(bq[1] - it['Lm'], 3), **meta))
    PENDING.clear()
# ground skirt hidden 0.3 m below 0 (grounded: lowest visible y = 0)
V = np.array(V); UVs = np.array(UVs)
flipped = 0
for m in F:
    for i, (a_, b_, c_) in enumerate(F[m]):
        d = NRM[m][i]
        if d[0] == 'radial': d = (d[3][0] - d[1], 0.0, d[3][2] - d[2])
        n = np.cross(V[b_] - V[a_], V[c_] - V[a_])
        if np.dot(n, d) < 0: F[m][i] = (a_, c_, b_); flipped += 1
o = f'{step}/work/terrace-lod{LOD}'
with open(o + '.obj', 'w') as f:
    f.write(f'mtllib terrace-lod{LOD}.mtl\n')
    for p in V: f.write('v %.4f %.4f %.4f\n' % tuple(p))
    for t in UVs: f.write('vt %.5f %.5f\n' % tuple(t))
    for m in ('front', 'front2', 'side', 'top', 'icefront', 'icefront2', 'iceside'):
        f.write(f'usemtl {m}\n')
        for a, b, c in F[m]: f.write(f'f {a+1}/{a+1} {b+1}/{b+1} {c+1}/{c+1}\n')
with open(o + '.mtl', 'w') as f:
    f.write('newmtl front\nmap_Kd ../plates/v35/plate-front-v35.jpg\nnewmtl front2\nmap_Kd ../plates/v35/t1-right-v35.jpg\nnewmtl side\nmap_Kd ../plates/v35/plate-side-v35.jpg\nnewmtl top\nmap_Kd ../plates/top.jpg\n'
            'newmtl icefront\nmap_Kd ../plates/plate-front.jpg\nnewmtl icefront2\nmap_Kd ../plates/v32/t1-right.jpg\nnewmtl iceside\nmap_Kd ../plates/plate-side.jpg\n')
ntri = sum(len(v) for v in F.values())
# per-triangle texel stretch (OBJ face order): metres per nominal plate px along both principal axes
st = []
dens = []
for m in ('front', 'front2', 'side', 'top', 'icefront', 'icefront2', 'iceside'):
    for a_, b_, c_ in F[m]:
        P = V[[a_, b_, c_]]; Q = UVs[[a_, b_, c_]] * 1024 * S
        e1, e2 = P[1] - P[0], P[2] - P[0]; t1 = e1 / max(np.linalg.norm(e1), 1e-12); nn = np.cross(e1, e2); nn /= max(np.linalg.norm(nn), 1e-12); t2 = np.cross(nn, t1)
        A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]]); B = np.array([Q[1] - Q[0], Q[2] - Q[0]]).T
        try: J = A @ np.linalg.inv(B); sv = np.linalg.svd(J, compute_uv=False); st.append(float(sv[0] / max(sv[1], 1e-9))); dens.append(float(sv[0]))
        except np.linalg.LinAlgError: st.append(1e9); dens.append(1e9)
np.save(f'{step}/work/terrace-lod{LOD}-stretch.npy', np.array(st, np.float32)); np.save(f'{step}/work/terrace-lod{LOD}-density.npy', np.array(dens, np.float32))
json.dump(ICI, open(o + '-icicles.json', 'w')); json.dump(GHOST, open(o + '-ghosts.json', 'w')); json.dump(BANDS, open(o + '-bands.json', 'w')); json.dump(ROOTS, open(o + '-roots.json', 'w'))
json.dump(dict(lod=LOD, tris=ntri, flippedForWinding=flipped, icicles=len(ICI), verts=len(V), aabb=[V.min(0).tolist(), V.max(0).tolist()], doorDepthM=DOOR_D, corniceOutM=CORN_OUT,
               mPerPx=S, tiers=T, back=BACK, topSpm=TOP_SPM, courses=ALIGN), open(o + '.json', 'w'), indent=1)
if LOD == 0: json.dump(dict(steps=ALIGN, rule='a step is cut only where course_ys found a horizontal basalt edge above the doorway'), open(f'{step}/work/relief-align-v35.json', 'w'), indent=1)
print(o, ntri, V.min(0).round(2), V.max(0).round(2))
