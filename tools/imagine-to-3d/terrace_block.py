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
FREL, SREL = hp(fd, 12), hp(sd, 12)
AMP = 0.12
V, UVs, F = [], [], {'front': [], 'side': []}   # faces: (v idx tri), uv per vertex-in-face
def addv(p, uv): V.append(p); UVs.append(uv); return len(V) - 1
def fuv(x, y): return ((FX0 + x / S) / 1024, 1 - (FY0 - y / S) / 1024)
def suv(z, y): return ((SX0 + z / S) / 1024, 1 - (SY0 - y / S) / 1024)
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
            F[mat] += [(a, b, c), (a, c, d)]
def box_quad(c0, du, dv, nu, nv, mat, uvf, normal):  # plain quad grid on a rectangle
    us = np.linspace(0, 1, nu + 1); vs = np.linspace(0, 1, nv + 1)
    quadgrid(lambda u, v: np.add(np.add(c0, np.multiply(du, u)), np.multiply(dv, v)), us, vs, mat, uvf, normal)
def n_(L, g): return max(1, int(round(L / g)))
for k, t in enumerate(T):
    hw, z0, y0, y1 = t['hw'], t['z'], t['y0'], t['y1']
    dx0, dx1, dtop = DOORS[k]; X0, X1 = (dx0 - FX0) * S, (dx1 - FX0) * S; DY = ym(dtop)
    inside = lambda u, v, X0=X0, X1=X1, y0=y0, DY=DY: X0 < u < X1 and y0 <= v < DY
    xs = ticks(-hw, hw, GRID, (X0, X1)); ys = ticks(y0, y1, GRID, (DY,))
    # front facade (+Z) with the doorway hole, MoGe relief except at borders and door jambs (relief locked there)
    quadgrid(lambda u, v: (u, v, z0), xs, ys, 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1), keep=lambda u, v: not inside(u, v),
             relief=FREL if LOD < 2 else None, lock=lambda u, v, X0=X0, X1=X1, DY=DY: max(X0 - u, u - X1, v - DY, 0) if not inside(u, v) else 0)
    # doorway recess: back wall, jambs, lintel underside, floor
    box_quad((X0, y0, z0 - DOOR_D), (X1 - X0, 0, 0), (0, DY - y0, 0), n_(X1 - X0, GRID), n_(DY - y0, GRID), 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1))
    box_quad((X0, y0, z0), (0, 0, -DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), 'side', lambda p, z0=z0: suv(p[2] - z0 - 3.0, p[1]), (1, 0, 0))
    box_quad((X1, y0, z0 - DOOR_D), (0, 0, DOOR_D), (0, DY - y0, 0), n_(DOOR_D, SGRID), n_(DY - y0, SGRID), 'side', lambda p, z0=z0: suv(p[2] - z0 - 3.0, p[1]), (-1, 0, 0))
    box_quad((X0, DY, z0 - DOOR_D), (X1 - X0, 0, 0), (0, 0, DOOR_D), n_(X1 - X0, GRID), n_(DOOR_D, GRID), 'front', lambda p, DY=DY, z0=z0: fuv(p[0], DY - 0.02 - (z0 - p[2])), (0, -1, 0))
    box_quad((X0, y0 + 0.001, z0), (X1 - X0, 0, 0), (0, 0, -DOOR_D), n_(X1 - X0, GRID), n_(DOOR_D, GRID), 'front', lambda p, y0=y0, z0=z0: fuv(p[0], y0 + 0.05 + (z0 - p[2])), (0, 1, 0))
    # sides (+-X) from the side plate (right side = mirror of the left plate, declared)
    zs = ticks(BACK, z0, SGRID); ys2 = ticks(y0, y1, SGRID)
    quadgrid(lambda u, v: (-hw, v, u), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (-1, 0, 0), relief=SREL if LOD < 2 else None)
    quadgrid(lambda u, v: (hw, v, -u + z0 + BACK), zs, ys2, 'side', lambda p: suv(p[2], p[1]), (1, 0, 0), relief=SREL if LOD < 2 else None)
    # back (-Z): front plate reused (declared; never on the player path)
    box_quad((hw, y0, BACK), (-2 * hw, 0, 0), (0, y1 - y0, 0), n_(2 * hw, 0.8), n_(y1 - y0, 0.8), 'front', lambda p: fuv(-p[0], p[1]), (0, 0, -1))
    # cornice slab: overhang CORN_OUT front, CORN_SIDE sides; rounded front-bottom lip (quarter cylinder)
    c0, c1 = y1, t['c1']; cz = z0 + CORN_OUT; cw = hw + CORN_SIDE; R = min(LIP_R, (c1 - c0) * 0.5)
    nx = n_(2 * cw, GRID)
    box_quad((-cw, c0 + R, cz), (2 * cw, 0, 0), (0, c1 - c0 - R, 0), nx, n_(c1 - c0 - R, GRID), 'front', lambda p: fuv(p[0], p[1]), (0, 0, 1))
    seg = 8
    for s in range(seg):
        a0, a1 = np.pi / 2 * s / seg, np.pi / 2 * (s + 1) / seg
        P0 = lambda a: (0, c0 + R - R * np.cos(a), cz - R + R * np.sin(a))
        p0, p1 = P0(a0), P0(a1)
        box_quad((-cw, p1[1], p1[2]), (2 * cw, 0, 0), (0, p0[1] - p1[1], p0[2] - p1[2]), nx, 1, 'front', lambda p, c0=c0, R=R: fuv(p[0], c0 + R - R * (np.pi / 2 - np.arccos(np.clip((c0 + R - p[1]) / R, -1, 1)))), (0, 0, 1))
    # underside (-Y) behind the lip back to the wall: cornice snow pixels continued (stretch measured by the gate)
    box_quad((-cw, c0, z0), (2 * cw, 0, 0), (0, 0, cz - R - z0), nx, n_(cz - R - z0, GRID), 'front', lambda p, c0=c0: fuv(p[0], c0 + R - R * np.pi / 2 - ((cz - R) - p[2])), (0, -1, 0))
    # cornice ends (+-X) and top (+Y, no top plate: front cornice band stretched, declared)
    for sgn in (-1, 1):
        box_quad((sgn * cw, c0, BACK), (0, 0, cz - BACK), (0, c1 - c0, 0), n_(cz - BACK, SGRID), n_(c1 - c0, SGRID), 'side', lambda p: suv(p[2] - CORN_OUT, p[1]), (sgn, 0, 0))
    box_quad((-cw, c1, cz), (2 * cw, 0, 0), (0, 0, BACK - cz), n_(2 * cw, 0.8), n_(cz - BACK, 0.8), 'front', lambda p, c1=c1, c0=c0, cz=cz: fuv(p[0], c1 - 0.02 - (cz - p[2]) / (cz - BACK) * (c1 - c0 - 0.04)), (0, 1, 0))
    # icicles: cones under the front lip at the plate's own bright drip columns (rows just below the cornice)
    if True:
        img = np.asarray(Image.open(f'{step}/plates/plate-front.jpg').convert('L'), np.float32)
        r0 = int(FY0 - c0 / S)
        band = img[r0:r0 + 70]; xs_px = np.arange(int(FX0 - cw / S), int(FX0 + cw / S))
        for px in xs_px[::6]:
            col = band[:, px] > 150; L = 0
            while L < len(col) and col[L]: L += 1
            if L < 6: continue
            x = (px - FX0) * S; Lm = L * S; r = 0.07; ns = 6
            tip = addv((x, c0 - Lm, cz - R * 0.5), fuv(x, c0 - Lm)); ring = []
            for q in range(ns):
                a = 2 * np.pi * q / ns; p = (x + r * np.cos(a), c0 + 0.02, cz - R * 0.5 + r * np.sin(a)); ring.append(addv(p, fuv(p[0], p[1])))
            for q in range(ns): F['front'].append((ring[q], ring[(q + 1) % ns], tip))
# ground skirt hidden 0.3 m below 0 (grounded: lowest visible y = 0)
V = np.array(V); UVs = np.array(UVs)
o = f'{step}/work/terrace-lod{LOD}'
with open(o + '.obj', 'w') as f:
    f.write(f'mtllib terrace-lod{LOD}.mtl\n')
    for p in V: f.write('v %.4f %.4f %.4f\n' % tuple(p))
    for t in UVs: f.write('vt %.5f %.5f\n' % tuple(t))
    for m in ('front', 'side'):
        f.write(f'usemtl {m}\n')
        for a, b, c in F[m]: f.write(f'f {a+1}/{a+1} {b+1}/{b+1} {c+1}/{c+1}\n')
with open(o + '.mtl', 'w') as f:
    f.write('newmtl front\nmap_Kd ../plates/plate-front.jpg\nnewmtl side\nmap_Kd ../plates/plate-side.jpg\n')
ntri = sum(len(v) for v in F.values())
# per-triangle texel stretch (OBJ face order): metres per nominal plate px along both principal axes
st = []
for m in ('front', 'side'):
    for a_, b_, c_ in F[m]:
        P = V[[a_, b_, c_]]; Q = UVs[[a_, b_, c_]] * 1024 * S
        e1, e2 = P[1] - P[0], P[2] - P[0]; t1 = e1 / max(np.linalg.norm(e1), 1e-12); nn = np.cross(e1, e2); nn /= max(np.linalg.norm(nn), 1e-12); t2 = np.cross(nn, t1)
        A = np.array([[e1 @ t1, e2 @ t1], [e1 @ t2, e2 @ t2]]); B = np.array([Q[1] - Q[0], Q[2] - Q[0]]).T
        try: J = A @ np.linalg.inv(B); sv = np.linalg.svd(J, compute_uv=False); st.append(float(max(sv[0], 1 / max(sv[1], 1e-9))))
        except np.linalg.LinAlgError: st.append(1e9)
np.save(f'{step}/work/terrace-lod{LOD}-stretch.npy', np.array(st, np.float32))
json.dump(dict(lod=LOD, tris=ntri, verts=len(V), aabb=[V.min(0).tolist(), V.max(0).tolist()], doorDepthM=DOOR_D, corniceOutM=CORN_OUT,
               mPerPx=S, tiers=T, back=BACK), open(o + '.json', 'w'), indent=1)
print(o, ntri, V.min(0).round(2), V.max(0).round(2))
