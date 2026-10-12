"""Stepped terrace block (Zone D) from two Imagine plates: front elevation + left side profile.
Dims are read from the SAM2 silhouettes of the plates (shared px/m), relief on visible walls from MoGe-2 depth under its
own pixels (border-locked to 0 so every LOD keeps the identical silhouette). Doorways are real recesses, cornices are
real overhanging slabs with a rounded lip, icicles are cones at the plate's own icicle columns.
python3 terrace_block.py <stepdir> [--lod 0|1|2]  -> work/terrace-lodN.obj (+ .mtl) and work/terrace-lodN.json
"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
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
DOORS = [(496, 579, 691), (468, 568, 479), (461, 551, 270)]   # plate px x0,x1,top row (bottom = tier floor)
fd = np.load(f'{step}/work/plate-front-depth.npy'); sd = np.load(f'{step}/work/plate-side-depth.npy')
def hp(d, sig):
    r = d - ndi.gaussian_filter(d, sig); return np.clip(r, -0.6, 0.6)
FREL, SREL = ndi.gaussian_filter(hp(fd, 12), 2.5), ndi.gaussian_filter(hp(sd, 12), 2.5)   # slope-limited so UV stretch stays <= 1.3
AMP = 0.06
UNDER_OFF = [64 * S, 16 * S, 8 * S]   # first shadowed-basalt row below each cornice in the front plate (measured)
V, UVs, F = [], [], {'front': [], 'side': [], 'top': []}
ICI = []
NRM = {'front': [], 'side': [], 'top': []}   # intended outward normal per triangle (winding fix)
TS, TX0 = 0.029, 525          # top plate: m per px across, centre column
TOPROWS = [(720, 665), (520, 484), (340, 116)]   # per tier: (front-lip row, row at next tier front / back)   # faces: (v idx tri), uv per vertex-in-face
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
    r0, r1 = TOPROWS[k]; zend = T[k + 1]['z'] if k < 2 else BACK
    row = r0 + (cz - p[2]) / (cz - zend) * (r1 - r0)
    return ((TX0 + p[0] / TS) / 1024, 1 - row / 1024)
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
def quadgrid(P, us, vs, mat, uvf, normal, keep=lambda u, v: True, relief=None, border=0.3, lock=None):
    """P(u,v)->xyz on a planar face; quads in (us x vs); relief displaces along normal, locked to 0 near borders."""
    idx = {}
    for i, u in enumerate(us):
        for j, v in enumerate(vs):
            p = np.array(P(u, v), float); uv = uvf(p)
            if relief is not None:
                db = min(u - us[0], us[-1] - u, v - vs[0], vs[-1] - v)
                if lock is not None: db = min(db, lock(u, v))
                w = np.clip(db / border, 0, 1)
                p = p + np.array(normal) * AMP * w * samp(relief, uv) / 0.6
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
    quadgrid(lambda u, v: (u, v, z0), xs, ys, 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1), keep=lambda u, v: not inside(u, v),
             relief=FREL if LOD < 2 else None, lock=lambda u, v, X0=X0, X1=X1, DY=DY: 0.5 * max(X0 - u, u - X1, v - DY, 0) if not inside(u, v) else 0)
    # doorway recess: back wall, jambs, lintel underside, floor
    box_quad((X0, y0, z0 - DOOR_D), (X1 - X0, 0, 0), (0, DY - y0, 0), n_(X1 - X0, GRID), n_(DY - y0, GRID), 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1))
    box_quad((X0, y0, z0), (0, 0, -DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), 'front', lambda p, z0=z0, X0=X0: fuv(X0 - (z0 - p[2]), p[1]), (1, 0, 0))
    box_quad((X1, y0, z0 - DOOR_D), (0, 0, DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), 'front', lambda p, z0=z0, X1=X1: fuv(X1 + (z0 - p[2]), p[1]), (-1, 0, 0))
    box_quad((X0, DY, z0 - DOOR_D), (X1 - X0, 0, 0), (0, 0, DOOR_D), n_(X1 - X0, GRID), n_(DOOR_D, GRID), 'front', lambda p, DY=DY, z0=z0: fuv(p[0], DY - 0.02 - (z0 - p[2])), (0, -1, 0))
    # (v3.1) no separate door floor: tier 1 = bottom cap hole (ground shows), tiers 2/3 = the lower top face kept there (sealed)
    if k == 0:
        bx = ticks(-hw, hw, 0.8, (X0, X1)); bz = ticks(BACK, z0, 0.8, (z0 - DOOR_D,))
        quadgrid(lambda u, v: (u, 0.0, v), bx, bz, 'top', lambda p: tuv(0, T[0]['z'] + CORN_OUT, p), (0, -1, 0),
                 keep=lambda u, v, X0=X0, X1=X1, z0=z0: not (X0 < u < X1 and v > z0 - DOOR_D))
    # sides (+-X) from the side plate (right side = mirror of the left plate, declared)
    zs = ticks(BACK, z0, SGRID); ys2 = ticks(y0, y1, SGRID)
    quadgrid(lambda u, v: (-hw, v, u), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (-1, 0, 0), relief=SREL if LOD < 2 else None)
    quadgrid(lambda u, v: (hw, v, -u + z0 + BACK), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (1, 0, 0), relief=SREL if LOD < 2 else None)
    # back (-Z): front plate reused (declared; never on the player path)
    box_quad((hw, y0, BACK), (-2 * hw, 0, 0), (0, y1 - y0, 0), n_(2 * hw, 0.8), n_(y1 - y0, 0.8), 'front', lambda p: fuv(-p[0], p[1]), (0, 0, -1))
    # cornice slab: overhang CORN_OUT front, CORN_SIDE sides; rounded front-bottom lip (quarter cylinder)
    c0, c1 = y1, t['c1']; cz = z0 + CORN_OUT; cw = hw + CORN_SIDE; R = min(LIP_R, (c1 - c0) * 0.5)
    nx = n_(2 * cw, GRID)
    box_quad((-cw, c0 + R, cz), (2 * cw, 0, 0), (0, c1 - c0 - R, 0), nx, n_(c1 - c0 - R, GRID), 'front', lambda p, hw=hw, cw=cw: fuv(p[0] * hw / cw * 0.98, p[1]), (0, 0, 1))
    seg = 8
    for s in range(seg):
        a0, a1 = np.pi / 2 * s / seg, np.pi / 2 * (s + 1) / seg
        P0 = lambda a: (0, c0 + R - R * np.cos(a), cz - R + R * np.sin(a))
        p0, p1 = P0(a0), P0(a1)
        box_quad((-cw, p1[1], p1[2]), (2 * cw, 0, 0), (0, p0[1] - p1[1], p0[2] - p1[2]), nx, 1, 'front', lambda p, c0=c0, R=R, hw=hw, cw=cw: fuv(p[0] * hw / cw * 0.98, c0 + R - R * (np.pi / 2 - np.arccos(np.clip((c0 + R - p[1]) / R, -1, 1)))), (0, 0, 1))
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
    def drips(img, r0, c_lo, c_hi):
        # per column: tip = end of the bright run that starts in the snow body (r0-20); drip = tip below the fringe baseline
        sub = img[r0 - 20:r0 + 110, c_lo:c_hi] > 135; sub = sub | (np.roll(sub, 1, 0) & np.roll(sub, -1, 0))
        tips = np.array([np.argmin(np.r_[c, False]) if c[0] else 0 for c in sub.T], float)
        base = np.percentile(tips[tips > 0], 30) if (tips > 0).any() else 0
        L = ndi.median_filter(np.clip(tips - base, 0, None), 3); out = []
        for j in range(len(L)):
            if L[j] >= 3 and L[j] == L[max(0, j - 2):j + 3].max() and (not out or j - out[-1][0] >= 4): out.append((j, L[j]))
        return [(c_lo + j, l) for j, l in out], int(r0 - 20 + base)
    def cone(base, Lm, r, uvc, seed):
        rng = np.random.default_rng(seed); tipdx, tipdz = rng.uniform(-0.3, 0.3, 2) * r; mid = 0.55 + rng.uniform(-0.1, 0.1)
        rings = []
        for (h, rr) in ((0.0, r), (0.45, r * mid)):
            ring = []
            for q in range(ns):
                a_ = 2 * np.pi * q / ns; p = (base[0] + rr * np.cos(a_) + tipdx * h, base[1] - Lm * h, base[2] + rr * np.sin(a_) + tipdz * h)
                ring.append(addv(p, uvc(abs(((a_ + np.pi) % (2 * np.pi)) - np.pi) / np.pi, Lm * h, rr / r)))
            rings.append(ring)
        tip = addv((base[0] + tipdx, base[1] - Lm, base[2] + tipdz), uvc(0.5, Lm, 0.0))
        cap = addv((base[0], base[1], base[2]), uvc(0.5, 0.0, 0.0))
        for q in range(ns):
            q1 = (q + 1) % ns; A, B = rings[0], rings[1]
            for tri in ((A[q], A[q1], B[q1]), (A[q], B[q1], B[q]), (B[q], B[q1], tip)):
                F['front'].append(tri); cpt = np.mean([V[i] for i in tri], 0); NRM['front'].append(('radial', base[0] + tipdx * 0.5, base[2] + tipdz * 0.5, cpt))
            F['front'].append((A[q], A[q1], cap)); NRM['front'].append((0, 1, 0))   # sealed base cap (inside the lip)
    img = np.asarray(Image.open(f'{step}/plates/plate-front.jpg').convert('L'), np.float32)
    r0 = int(round(FY0 - c0 / S)); cl = int(FX0 - hw * 0.98 / S); ch = int(FX0 + hw * 0.98 / S)
    dr, brow = drips(img, r0, cl, ch); ytop = FY0 * S - brow * S   # plate row of the fringe baseline -> metres
    for px, L in dr:
        xp = (px - FX0) * S; x = xp / sc_c; Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(0.04 + 0.06 * Lm, 0.05, 0.11))
        if k == 2 and L * S < 0.3: continue   # tier 3: no raised stubs (clearance over the tier-2 top)
        if L * S > 1.2: continue   # a bright run longer than 1.2 m is snow/wall, not a drip: never clamp it into a cone
        cone((x, c0 + 0.02, cz - R * 0.5), Lm, r, lambda t, h, sc=1.0, xp=xp, r=r, ytop=ytop: fuv(xp + np.pi * r * sc * (t - 0.5), ytop - h), px * 7 + k)
        ICI.append(dict(tier=k, side='front', rawLenM=round(L * S, 3), x=round(x, 3), z=round(cz - R * 0.5, 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
    # left cornice end (path side): drips from the side plate rows under this tier's cornice
    simg = np.asarray(Image.open(f'{step}/plates/plate-side.jpg').convert('L'), np.float32)
    b_, t_ = SIDEROWS[k]; srow = int(round(b_ + (t_ - b_) * (c0 - y0) / (c1 - y0)))
    dr2, _ = drips(simg, srow, int(SX0 + (BACK - CORN_OUT) / S) + 4, int(SX0) - 2)
    for px, L in dr2:
        z = (px - SX0) * S + CORN_OUT; Lm = float(np.clip(L * S, 0.3, 1.2)); r = float(np.clip(0.04 + 0.06 * Lm, 0.05, 0.11))
        if k == 2 and L * S < 0.3: continue
        if L * S > 1.2: continue
        if z > cz - 0.15 or z < BACK + 0.2: continue
        zp = z - CORN_OUT
        cone((-cw + 0.12, c0 + 0.02, z), Lm, r, lambda t, h, sc=1.0, zp=zp, r=r: suv(zp + np.pi * r * sc * (t - 0.5), c0 - h), px * 13 + k)
        ICI.append(dict(tier=k, side='left', rawLenM=round(L * S, 3), x=round(-cw + 0.12, 3), z=round(z, 3), lenM=round(Lm, 3), tipY=round(c0 + 0.02 - Lm, 3)))
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
    for m in ('front', 'side', 'top'):
        f.write(f'usemtl {m}\n')
        for a, b, c in F[m]: f.write(f'f {a+1}/{a+1} {b+1}/{b+1} {c+1}/{c+1}\n')
with open(o + '.mtl', 'w') as f:
    f.write('newmtl front\nmap_Kd ../plates/plate-front.jpg\nnewmtl side\nmap_Kd ../plates/plate-side.jpg\nnewmtl top\nmap_Kd ../plates/top.jpg\n')
ntri = sum(len(v) for v in F.values())
# per-triangle texel stretch (OBJ face order): metres per nominal plate px along both principal axes
st = []
dens = []
for m in ('front', 'side', 'top'):
    for a_, b_, c_ in F[m]:
        P = V[[a_, b_, c_]]; Q = UVs[[a_, b_, c_]] * 1024 * S
        e1, e2 = P[1] - P[0], P[2] - P[0]; t1 = e1 / max(np.linalg.norm(e1), 1e-12); nn = np.cross(e1, e2); nn /= max(np.linalg.norm(nn), 1e-12); t2 = np.cross(nn, t1)
        A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]]); B = np.array([Q[1] - Q[0], Q[2] - Q[0]]).T
        try: J = A @ np.linalg.inv(B); sv = np.linalg.svd(J, compute_uv=False); st.append(float(sv[0] / max(sv[1], 1e-9))); dens.append(float(sv[0]))
        except np.linalg.LinAlgError: st.append(1e9); dens.append(1e9)
np.save(f'{step}/work/terrace-lod{LOD}-stretch.npy', np.array(st, np.float32)); np.save(f'{step}/work/terrace-lod{LOD}-density.npy', np.array(dens, np.float32))
json.dump(ICI, open(o + '-icicles.json', 'w'))
json.dump(dict(lod=LOD, tris=ntri, flippedForWinding=flipped, icicles=len(ICI), verts=len(V), aabb=[V.min(0).tolist(), V.max(0).tolist()], doorDepthM=DOOR_D, corniceOutM=CORN_OUT,
               mPerPx=S, tiers=T, back=BACK), open(o + '.json', 'w'), indent=1)
print(o, ntri, V.min(0).round(2), V.max(0).round(2))
