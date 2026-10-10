"""Blocky stratified mesa geometry (v2) from the Imagine views + sectioned Imagine plates.
Layers: strata heights read from the front plate's horizontal bedding lines; each layer = a prism whose outline is
the visual-hull level set (hull.py) at that height, made angular: straight cliff faces <= 16 m (one plate window each),
offset in/out at vertical fracture faces, caprock layers overhang the softer layer below (undercut), 0.35 m chamfer on
top edges. Fallen blocks + scree from the top plate's rubble ring. Every vertex carries plate id + plate pixel coords
(walls: arc length x height at PXM px/m, blocks: box faces) -> UV stretch 1.0 by construction; caps: shader cell mode.
Output: <out>.bin (float32) + <out>.json (per LOD offsets, plate windows, gate data)."""
import json, sys, zlib, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from masks import load, rock_mask

WALL_W, WALL_H = 1280, 720          # wall band plates (16 m x 9 m)
PXM = 80.0                            # wall px/m  (1280 / 16)
BLOCK_PXM = 320.0                     # b1: 1280 px over 4 m
VLO = {6: 2.6}                         # usable plate rows: w7's lowest 2.6 m shows sand -> never sampled
CAP = -1                              # plate id < 0 -> shader cap cells (c1/c2)

def strata_heights(front_img, meta, hmax, rng):
    a = load(front_img); m = rock_mask(a)
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    rows = np.array([lum[r][m[r]].mean() if m[r].sum() > 40 else np.nan for r in range(a.shape[0])])
    ok = ~np.isnan(rows); prof = np.interp(np.arange(len(rows)), np.nonzero(ok)[0], rows[ok])
    hp = prof - ndi.gaussian_filter1d(prof, 25)
    mins = [r for r in range(2, len(hp) - 2) if hp[r] == hp[r - 2:r + 3].min() and hp[r] < -0.01]
    ys = sorted({round((meta["base_row"] - r) / meta["pxm"], 2) for r in mins})
    ys = [y for y in ys if 0.8 < y < hmax - 0.8]
    out = [0.0]
    for y in ys + [hmax]:
        while y - out[-1] > 8.0: out.append(out[-1] + rng.uniform(4.0, 7.0))
        if y - out[-1] >= 2.0: out.append(y)
    if hmax - out[-1] > 0.3: out[-1] = hmax
    return out

TIERS = (0.6, 0.85)            # tier tops as a fraction of the mesa height
TIER_LVL = (0.30, 0.66, 0.90)   # hull level set used for each tier's outline
def clean_mask(m):
    lab, n = ndi.label(m)
    if n > 1:
        sz = ndi.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sz)))
    m = ndi.binary_fill_holes(m)
    st = ndi.generate_binary_structure(2, 1)
    return ndi.binary_opening(m, st, iterations=3)

def radial(mask, ax, cx, cz, n):
    g = ax[1] - ax[0]; R = []
    for k in range(n):
        a = 2 * np.pi * k / n; dx, dz = np.cos(a), np.sin(a); t = 0.0; r = 0.0
        while t < ax.max() * 1.5:
            j = int(round((cx + dx * t - ax[0]) / g)); i = int(round((cz + dz * t - ax[0]) / g))
            if 0 <= i < mask.shape[0] and 0 <= j < mask.shape[1] and mask[i, j]: r = t
            t += g / 2
        R.append(r)
    return np.array(R)

class Mesh:
    def __init__(s): s.P = []; s.A = []   # positions (x,y,z) per vertex, attrs (plate, col, row)
    def tri(s, p, a):
        s.P += p; s.A += a
    def quad(s, p0, p1, p2, p3, a0, a1, a2, a3):       # p0 p1 bottom (left,right), p2 p3 top (right,left), CCW from outside
        s.tri([p0, p1, p2], [a0, a1, a2]); s.tri([p0, p2, p3], [a0, a2, a3])

def build(prefix, front_img, top_img, lod, rng_seed=1008, windows=None, scale=1.0):
    rng = np.random.default_rng(rng_seed)
    H = np.load(prefix + "-H.npy"); meta = json.load(open(prefix + "-meta.json"))
    H = H * scale; meta = dict(meta); meta["pxm"] = meta["pxm"] / scale; meta["sink_m"] = meta["sink_m"] * scale; meta["tpx"] = meta["tpx"] / scale
    n = H.shape[0]; ax = (np.arange(n) - (n - 1) / 2) * meta["grid_m"] * scale
    hmax = float(H.max())
    ys = strata_heights(front_img, meta, hmax, np.random.default_rng(rng_seed))
    if lod == 2: ys = ys[::2] if ys[-1] in ys[::2] else ys[::2] + [ys[-1]]
    iz, ix = np.nonzero(H > 0.5); cx, cz = ax[ix].mean(), ax[iz].mean()
    rays = {0: 160, 1: 160, 2: 64}[lod]
    M = Mesh(); windows = windows if windows is not None else []
    layers = []
    rcache = {}
    for li in range(len(ys) - 1):
        y0, y1 = ys[li], ys[li + 1]
        # steep tiers (key-city3: tall vertical stacked-block cliffs, few big benches, flat top):
        # every layer of a tier shares the tier outline; strata only jut / undercut per face
        ym = 0.5 * (y0 + y1); tier = 0 if ym < TIERS[0] * hmax else (1 if ym < TIERS[1] * hmax else 2)
        lvl = TIER_LVL[tier] * hmax
        if tier not in rcache: rcache[tier] = radial(clean_mask(H >= lvl), ax, cx, cz, rays)
        R = rcache[tier].copy()
        if R.max() < 1.0: continue
        R = ndi.median_filter(R, 9, mode="wrap")
        hard = (li % 3 == 2) or li == len(ys) - 2          # caprock bands overhang
        layers.append(dict(y0=y0, y1=y1, R=R, hard=hard))
    # undercut below hard layers, overhang of the hard layer itself
    for k, L in enumerate(layers):
        L["off"] = 1.0 if L["hard"] else 0.0
        if k + 1 < len(layers) and layers[k + 1]["hard"]: L["off"] = -0.7
    seg_rng = np.random.default_rng(rng_seed + 7)
    angles = 2 * np.pi * np.arange(rays) / rays
    ring_out = []
    li_of = {id(L_): i_ for i_, L_ in enumerate(layers)}
    for k, L in enumerate(layers):
        y0 = L["y0"] - (meta["sink_m"] if k == 0 else 0.0); y1 = L["y1"]
        # angular faces: cut the ring into straight segments (<= 14 m), each pushed in/out (fracture steps)
        pts = np.stack([cx + np.cos(angles) * L["R"], cz + np.sin(angles) * L["R"]], 1)
        segs = []; i = 0
        while i < rays:
            # walk until 8..14 m of perimeter
            want = seg_rng.uniform(8.0, 14.0) if lod < 2 else 12.0; j = i; acc = 0.0
            while j < rays and acc < want:
                acc += np.linalg.norm(pts[(j + 1) % rays] - pts[j % rays]); j += 1
            segs.append((i, min(j, rays))); i = j
        ring = []   # list of (x, z, faceId) vertices around the layer, fracture steps between faces
        for si, (a, b) in enumerate(segs):
            pa, pb = pts[a % rays], pts[b % rays]
            if lod == 0 and b - a >= 4:   # one kink inside the face (natural, still flat pieces)
                m_ = pts[(a + b) // 2 % rays]; mid = 0.5 * (pa + pb); m_ = mid + 0.45 * (m_ - mid)
                chain = [pa, m_, pb]
            else:
                chain = [pa, pb]
            d = pb - pa; nrm = np.array([d[1], -d[0]]); nrm /= np.linalg.norm(nrm) + 1e-9
            c = np.array([cx, cz]); 
            if np.dot(nrm, 0.5 * (pa + pb) - c) < 0: nrm = -nrm
            push = L["off"] + (seg_rng.uniform(-1.6, 1.6) if lod < 2 else 0.0)
            ring.append([p + nrm * push for p in chain])
        L["ring"] = ring
        # --- walls: each face (straight cliff face or fracture connector) gets plate windows keyed by
        #     (layer, face, piece, band) -> LOD0 and LOD1 sample the same Imagine pixels (no texture pop).
        wcache = {"n": -1}
        def window(face_len, h, centre, key):
            wr = np.random.default_rng(zlib.crc32(repr((rng_seed,) + key).encode()))
            best = None; bscore = 1e9
            if windows:
                if len(windows) != wcache["n"]:
                    wcache["C"] = np.array([w["c"] for w in windows]); wcache["n"] = len(windows)
                dd = np.linalg.norm(wcache["C"] - np.asarray(centre), axis=1); near = [windows[i] for i in np.nonzero(dd < REPEAT_R)[0]]
            else: near = []
            for _ in range(3000):
                p = int(wr.integers(0, 8)); vlo = VLO.get(p, 0.0)
                if 9.0 - h < vlo - 1e-6: continue
                u0 = wr.uniform(0, max(0.0, 16.0 - face_len)); v0 = wr.uniform(vlo, max(vlo, 9.0 - h)); fl = int(wr.integers(0, 2))
                cand = dict(p=p, u0=u0, v0=v0, fl=fl, L=face_len, h=h, c=np.array(centre), key=key)
                sc_ = window_score(cand, near)
                if sc_ < bscore: best, bscore = cand, sc_
                if sc_ == 0: break
            if best is None: best = dict(p=0, u0=0.0, v0=max(0.0, 9.0 - h), fl=0, L=face_len, h=h, c=np.array(centre), key=key)
            windows.append(best); return best["p"], best["u0"], best["v0"], best["fl"]
        ch = 0.35 if lod < 2 else 0.0
        cc = np.array([cx, cz])
        inset = lambda p: p - (p - cc) / (np.linalg.norm(p - cc) + 1e-9) * ch
        faces = []
        for k_, chain in enumerate(ring):
            faces.append((("f", li_of[id(L)], k_), chain))
            nxt = ring[(k_ + 1) % len(ring)]
            faces.append((("c", li_of[id(L)], k_), [chain[-1], nxt[0]]))
        ytop = y1 - ch
        nb = max(1, int(np.ceil((ytop + ch * 1.41 - y0) / 5.5)))
        yb = [y0 + (ytop - y0) * r_ / nb for r_ in range(nb + 1)]
        for key, chain in faces:
            # arc length along the face, cut into pieces <= 15.5 m (one window each)
            segl = [np.linalg.norm(chain[i + 1] - chain[i]) for i in range(len(chain) - 1)]
            tot = sum(segl)
            if tot < 1e-3: continue
            npc = int(np.ceil(tot / 10.5)); plen = tot / npc
            ccum = np.concatenate([[0], np.cumsum(segl)])
            def at(sv):
                i = min(int(np.searchsorted(ccum, sv, side="right") - 1), len(segl) - 1)
                t = (sv - ccum[i]) / max(segl[i], 1e-9); return chain[i] + (chain[i + 1] - chain[i]) * t
            for pc in range(npc):
                s0, s1 = pc * plen, (pc + 1) * plen
                cuts = [s0] + [c_ for c_ in ccum[1:-1] if s0 < c_ < s1] + [s1]
                for r_ in range(nb):
                    ya, yc = yb[r_], yb[r_ + 1]
                    top_band = r_ == nb - 1
                    pl, u0, v0, fl = window(plen, yc - ya + (ch * 1.41 if top_band else 0), np.append(0.5 * (at(s0) + at(s1)), 0.5 * (ya + yc)), key + (pc, r_, lod == 2))
                    A = (lambda pl, u0, v0, ya, s0, fl: (lambda sv, y: [pl, (u0 + ((plen - (sv - s0)) if fl else (sv - s0))) * PXM, (9.0 - (v0 + (y - ya))) * PXM]))(pl, u0, v0, ya, s0, fl)
                    for ci in range(len(cuts) - 1):
                        sa, sb = cuts[ci], cuts[ci + 1]; p0, p1 = at(sa), at(sb)
                        if RELIEF is not None and GRID[lod] > 0:
                            relief_patch(M, p0, p1, sa, sb, ya, yc, A, pl, lod)
                        else:
                            M.quad([p1[0], ya, p1[1]], [p0[0], ya, p0[1]], [p0[0], yc, p0[1]], [p1[0], yc, p1[1]], A(sb, ya), A(sa, ya), A(sa, yc), A(sb, yc))   # outward winding (checked: wallWinding)
                        if top_band and ch > 0:
                            i0, i1 = inset(p0), inset(p1)
                            ed = (p1 - p0) / max(np.linalg.norm(p1 - p0), 1e-9)
                            def cuv(ip, sbase, pbase):
                                dd = ip - pbase; along = float(np.dot(dd, ed)); perp = float(np.linalg.norm(dd - along * ed))
                                return sbase + along, yc + float(np.hypot(perp, y1 - yc))
                            ua0, va0 = cuv(i0, sa, p0); ua1, va1 = cuv(i1, sb, p1)
                            M.quad([p1[0], yc, p1[1]], [p0[0], yc, p0[1]], [i0[0], y1, i0[1]], [i1[0], y1, i1[1]], A(sb, yc), A(sa, yc), A(ua0, va0), A(ua1, va1))
        flat = [p for chain in ring for p in chain]
        # caps (top + bottom), fan from the centre, shader cap cells
        poly = flat
        top_ring = [inset(p) for p in poly] if ch > 0 else poly
        for q in range(len(top_ring)):
            a_, b_ = top_ring[q], top_ring[(q + 1) % len(top_ring)]
            M.tri([[cx, y1, cz], [b_[0], y1, b_[1]], [a_[0], y1, a_[1]]], [[CAP, 0, 0]] * 3)
            if L["hard"] or L["off"] > 0:   # overhang underside
                a2, b2 = poly[q], poly[(q + 1) % len(poly)]
                M.tri([[cx, y0, cz], [a2[0], y0, a2[1]], [b2[0], y0, b2[1]]], [[CAP, 0, 0]] * 3)
        ring_out.append(dict(y0=y0, y1=y1, ring=[[float(p[0]), float(p[1])] for p in poly]))
    # --- fallen blocks + scree around the foot (density from the top plate's rubble ring) and on wide ledges
    block_start = len(M.P)
    tm = rock_mask(load(top_img)); tcx, tcy = meta["top_c"]; tpx = meta["tpx"]
    base = layers[0]["ring"]; base_pts = np.array([p for c in base for p in c])
    nblk = {0: 420, 1: 120, 2: 30}[lod]
    brng = np.random.default_rng(rng_seed + 99)
    placed = 0; tries = 0; placed_id = 0
    while placed < nblk and tries < nblk * 30:
        tries += 1
        k = brng.integers(0, len(base_pts)); p = base_pts[k]; c = np.array([cx, cz]); dirv = (p - c) / (np.linalg.norm(p - c) + 1e-9)
        out = brng.uniform(-0.5, 14.0) ** 1.0
        q = p + dirv * out + brng.normal(0, 2.0, 2)
        col = int(tcx + q[0] * tpx); row = int(tcy - (-q[1]) * tpx)   # hull z3 = -z_local; q is (x, z_local)? (radial built on hull grid: z = z3)
        if 0 <= row < tm.shape[0] and 0 <= col < tm.shape[1] and not tm[row, col] and brng.random() < 0.8: continue
        big = brng.random() < (0.15 if lod == 0 else 0.6)
        s = brng.uniform(1.2, 4.0) if big else brng.uniform(0.25, 0.9)
        if lod == 1 and s < 0.9: continue
        if lod == 2 and s < 2.0: continue
        sx, sy, sz = s * brng.uniform(0.7, 1.4), s * brng.uniform(0.45, 0.9), s * brng.uniform(0.7, 1.4)
        yaw = brng.uniform(0, np.pi); tilt = brng.normal(0, 0.18, 2)
        y = -0.35 * sy
        corners = np.array([[x_, y_, z_] for y_ in (0, 1) for z_ in (-0.5, 0.5) for x_ in (-0.5, 0.5)], float)
        corners[:, 1] *= 1.0; corners *= [sx, sy, sz]; corners += brng.uniform(-0.06, 0.06, corners.shape) * s
        cy, sy_ = np.cos(yaw), np.sin(yaw)
        Rm = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]])
        Rt = np.array([[1, 0, 0], [0, np.cos(tilt[0]), -np.sin(tilt[0])], [0, np.sin(tilt[0]), np.cos(tilt[0])]])
        W_ = (corners @ Rt.T) @ Rm.T + [q[0], y, q[1]]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        for f in faces:
            a_, b_, c_, d_ = [W_[i] for i in f]
            ex = b_ - a_; ex /= np.linalg.norm(ex); nq = np.cross(b_ - a_, d_ - a_); ey = np.cross(nq, ex); ey /= np.linalg.norm(ey)
            uvq = [(float(np.dot(p_ - a_, ex)), float(np.dot(p_ - a_, ey))) for p_ in (a_, b_, c_, d_)]
            umin = min(u for u, _ in uvq); vmin = min(v for _, v in uvq); uvq = [(u - umin, v - vmin) for u, v in uvq]
            ul = max(u for u, _ in uvq); vl = max(v for _, v in uvq)
            if s >= 1.2:   # big blocks: a wall plate window
                pl, u0, v0, _fl = window(min(ul, 16), min(vl, 9), np.append(q, 0.0), ("b", placed_id, tuple(f)))
                A = lambda u, v: [pl, (u0 + u) * PXM, (9.0 - (v0 + v)) * PXM]
            else:          # small: the block-face plate (320 px/m) window
                u0 = brng.uniform(0, max(0.01, 4.0 - ul)); v0 = brng.uniform(0.75, max(0.76, 2.25 - vl))   # b1: lowest 0.75 m has sand
                A = lambda u, v: [8, (u0 + u) * BLOCK_PXM, (2.25 - (v0 + v)) * BLOCK_PXM]
            M.quad(list(a_), list(b_), list(c_), list(d_), *[A(u, v) for u, v in uvq])
        placed += 1; placed_id += 1
    P = np.array(M.P, np.float32); At = np.array(M.A, np.float32)
    # drop degenerate triangles (zero-length fracture connectors / collapsed fan slivers), keep block bookkeeping
    t3 = P.reshape(-1, 3, 3); ar = 0.5 * np.linalg.norm(np.cross(t3[:, 1] - t3[:, 0], t3[:, 2] - t3[:, 0]), axis=1)
    q = np.round(t3 / 1e-3).astype(np.int64)
    coll = (q[:, 0] == q[:, 1]).all(1) | (q[:, 1] == q[:, 2]).all(1) | (q[:, 0] == q[:, 2]).all(1)
    keep = (ar > 1e-5) & ~coll; nb_ = block_start // 3; keep[nb_:] = True
    block_start = int(keep[:nb_].sum()) * 3
    P = t3[keep].reshape(-1, 3); At = At.reshape(-1, 3, 3)[keep].reshape(-1, 3)
    # hull grid z is hull z3; three local z = -z3
    P[:, 2] *= -1
    P = P.reshape(-1, 3, 3)[:, [0, 2, 1]].reshape(-1, 3)     # flip winding to match the z mirror
    At = At.reshape(-1, 3, 3)[:, [0, 2, 1]].reshape(-1, 3)
    return P, At, dict(blockStart=block_start, strata=ys, layers=len(layers), blocks=placed, rings=ring_out), windows

REPEAT_R = 30.0     # same Imagine pixels (same plate, same flip, >50 % overlap) never twice within this distance
ADJ_R = 7.0         # neighbouring faces/bands never show any of the same plate pixels
def overlap(a, b):
    du = min(a["u0"] + a["L"], b["u0"] + b["L"]) - max(a["u0"], b["u0"]); dv = min(a["v0"] + a["h"], b["v0"] + b["h"]) - max(a["v0"], b["v0"])
    if du <= 0 or dv <= 0: return 0.0
    return du * dv / max(min(a["L"] * a["h"], b["L"] * b["h"]), 1e-6)
def window_score(c, W):
    s = 0
    for w in W:
        d = float(np.linalg.norm(w["c"] - c["c"]))
        if w["p"] != c["p"]: continue
        if d < ADJ_R and overlap(w, c) > 0.0: s += 1
        elif d < REPEAT_R and w["fl"] == c["fl"] and overlap(w, c) > 0.5: s += 1
    return s

def winding(P, At, block_start):
    """fraction of cliff-wall / cap / block triangles whose winding faces outward (walls: away from the mesa axis,
    caps: up for tops; blocks: away from the block centre)."""
    t = P.reshape(-1, 3, 3); a = At.reshape(-1, 3, 3)[:, 0, 0]
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]); c = t.mean(1)
    nb = block_start // 3
    wall = (a[:nb] >= 0); ar = np.linalg.norm(n, axis=1) > 1e-6
    hor = np.abs(n[:, 1]) < 0.3 * np.linalg.norm(n, axis=1)
    sel = wall & ar[:nb] & hor[:nb]
    radial = (n[:nb, 0] * c[:nb, 0] + n[:nb, 2] * c[:nb, 2])
    wall_out = float((radial[sel] > 0).mean()) if sel.any() else 1.0
    bl = t[nb:].reshape(-1, 12, 3, 3); bn = n[nb:].reshape(-1, 12, 3); bc = bl.reshape(-1, 36, 3).mean(1)
    bout = float(((bn * (bl.mean(2) - bc[:, None])).sum(2) > 0).mean()) if len(bl) else 1.0
    return dict(wallOut=round(wall_out, 3), blockOut=round(bout, 3))

# ---- depth_relief stage hook: per wall plate relief maps (metres, from depth_relief.py), applied as in/out
#      displacement of the shell only; faded to 0 within FADE_M of every window/face border (watertight seams).
RELIEF = None; RELIEF_L = {}
GRID = {0: 1.0, 1: 3.0, 2: 0.0}     # displacement grid (m) per LOD; LOD2 keeps the plain shell
FADE_M = 0.75
def load_relief(dirpath, walls):
    global RELIEF
    RELIEF = [np.load(f"{dirpath}/{w}-relief.npy") for w in walls]
    for lod, g in GRID.items():
        if g > 0: RELIEF_L[lod] = [ndi.gaussian_filter(r, 0.5 * g * PXM) for r in RELIEF]
def sample(r, col, row):
    h, w = r.shape; c = np.clip(col - 0.5, 0, w - 1.001); q = np.clip(row - 0.5, 0, h - 1.001)
    c0 = c.astype(int); q0 = q.astype(int); fc = c - c0; fq = q - q0
    return (r[q0, c0] * (1 - fc) * (1 - fq) + r[q0, c0 + 1] * fc * (1 - fq) + r[q0 + 1, c0] * (1 - fc) * fq + r[q0 + 1, c0 + 1] * fc * fq)
def relief_patch(M, p0, p1, sa, sb, ya, yc, A, pl, lod):
    g = GRID[lod]; Ls = sb - sa; Hy = yc - ya
    nu = max(1, int(np.ceil(Ls / g))); nv = max(1, int(np.ceil(Hy / g)))
    n = np.array([p1[1] - p0[1], p0[0] - p1[0]]); n = n / (np.linalg.norm(n) + 1e-9)   # outward (matches the quad winding)
    us = np.linspace(0, 1, nu + 1); vs = np.linspace(0, 1, nv + 1)
    S = sa + us[None, :] * Ls; Y = ya + vs[:, None] * Hy
    S = np.broadcast_to(S, (nv + 1, nu + 1)); Y = np.broadcast_to(Y, (nv + 1, nu + 1))
    uv = np.array([[A(s_, y_) for s_, y_ in zip(rs, ry)] for rs, ry in zip(S, Y)])     # (nv+1, nu+1, 3)
    d = sample(RELIEF_L[lod][int(pl)], uv[..., 1], uv[..., 2])
    edge = np.minimum.reduce([S - sa, sb - S, Y - ya, yc - Y])
    t = np.clip(edge / FADE_M, 0, 1); d = d * t * t * (3 - 2 * t)
    X = p0[0] + (p1[0] - p0[0]) * us[None, :] + n[0] * d; Z = p0[1] + (p1[1] - p0[1]) * us[None, :] + n[1] * d
    for j in range(nv):
        for i in range(nu):
            q = [(j, i + 1), (j, i), (j + 1, i), (j + 1, i + 1)]
            P4 = [[X[a, b], Y[a, b], Z[a, b]] for a, b in q]; U4 = [list(uv[a, b]) for a, b in q]
            M.quad(*P4, *U4)

def topo(P):
    """weld (1 mm) and count edges used by > 2 triangles (non-manifold) + degenerate triangles; relief spike = max
    |normal-direction offset| jump between welded neighbours."""
    q = np.round(P / 1e-3).astype(np.int64); _, idx = np.unique(q, axis=0, return_inverse=True); idx = idx.ravel()
    T = idx.reshape(-1, 3); deg = int(((T[:, 0] == T[:, 1]) | (T[:, 1] == T[:, 2]) | (T[:, 0] == T[:, 2])).sum())
    E = np.sort(np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), axis=1)
    _, cnt = np.unique(E, axis=0, return_counts=True)
    return dict(nonManifoldEdges=int((cnt > 2).sum()), degenerateTris=deg)

def stretch_px(P, At):
    """per triangle: UV px vs 3D metres, for plate>=0 triangles; returns (min px/m, max anisotropic stretch)."""
    t = P.reshape(-1, 3, 3); a = At.reshape(-1, 3, 3); sel = a[:, 0, 0] >= 0; t = t[sel]; a = a[sel]
    e1 = t[:, 1] - t[:, 0]; e2 = t[:, 2] - t[:, 0]; f1 = a[:, 1, 1:] - a[:, 0, 1:]; f2 = a[:, 2, 1:] - a[:, 0, 1:]
    # local 2D frame of the triangle
    x = e1 / (np.linalg.norm(e1, axis=1, keepdims=True) + 1e-9); nrm = np.cross(e1, e2); y = np.cross(nrm, x); y /= np.linalg.norm(y, axis=1, keepdims=True) + 1e-9
    Mg = np.stack([np.stack([(e1 * x).sum(1), (e2 * x).sum(1)], 1), np.stack([(e1 * y).sum(1), (e2 * y).sum(1)], 1)], 1)   # 2x2 geom
    Mu = np.stack([np.stack([f1[:, 0], f2[:, 0]], 1), np.stack([f1[:, 1], f2[:, 1]], 1)], 1)
    ok = 0.5 * np.linalg.norm(nrm, axis=1) > 1e-3
    J = Mu[ok] @ np.linalg.inv(Mg[ok])
    sv = np.linalg.svd(J, compute_uv=False)
    area = 0.5 * np.linalg.norm(nrm[ok], axis=1)
    bad = np.nonzero(sv[:, 1] < 60)[0]
    if len(bad): print("lowpx", len(bad), t[ok][bad[:2]].tolist(), a[ok][bad[:2]].tolist(), file=sys.stderr)
    return dict(minPxPerM=float(sv[:, 1].min()), p01PxPerM=float(np.percentile(sv[:, 1], 1)), maxStretch=float((sv[:, 0] / np.maximum(sv[:, 1], 1e-6)).max()),
                areaM2=float(area.sum()))

if __name__ == "__main__":
    prefix, front_img, top_img, out = sys.argv[1:5]
    scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0; seed = int(sys.argv[6]) if len(sys.argv) > 6 else 1008
    if len(sys.argv) > 7 and sys.argv[7] != "-":
        load_relief(sys.argv[7], ["w1", "w2", "w3", "w9", "w5", "w6", "w7", "w8"])
    blobs = []; info = {"lods": [], "scale": scale, "seed": seed}; off = 0; windows = []
    for lod in (0, 1, 2):
        P, At, meta, windows = build(prefix, front_img, top_img, lod, rng_seed=seed, windows=[], scale=scale)
        info.setdefault("windows", []).append([[w["p"], round(w["u0"], 2), round(w["v0"], 2), round(float(w["c"][0]), 1), round(float(w["c"][1]), 1)] for w in windows])
        st = stretch_px(P, At); st.update(winding(P, At, meta["blockStart"])); st.update(topo(P))
        st["relief"] = RELIEF is not None and GRID[lod] > 0
        info["lods"].append(dict(lod=lod, tris=len(P) // 3, offset=off, verts=len(P), stretch=st, **{k: meta[k] for k in ("layers", "blocks", "blockStart")}))
        if lod == 0:
            W_ = windows; clash = 0; adj = 0
            C = np.array([w["c"] for w in W_])
            for i_ in range(len(W_)):
                dd = np.linalg.norm(C[i_ + 1:] - C[i_], axis=1)
                for j_ in np.nonzero(dd < REPEAT_R)[0] + i_ + 1:
                    a_, b_ = W_[i_], W_[j_]
                    if a_["p"] != b_["p"]: continue
                    if dd[j_ - i_ - 1] < ADJ_R and overlap(a_, b_) > 0.0: adj += 1
                    elif a_["fl"] == b_["fl"] and overlap(a_, b_) > 0.5: clash += 1
            info["adjSamePlate"] = adj
            info["repeatClash"] = clash; info["windowsN"] = len(W_)
        if lod == 0: info["strata"] = meta["strata"]; info["rings"] = meta["rings"]
        blobs.append(np.concatenate([P, At], 1).astype(np.float32).ravel()); off += len(P)
    np.concatenate(blobs).tofile(out + ".bin")
    json.dump(info, open(out + "-geo.json", "w"))
    print(json.dumps({k: v for k, v in info.items() if k != "rings"}, indent=1))
