"""blender_wall.py: walls from ONE Imagine plate (+ its MoGe-2 depth) with real, pixel-guided relief. No mesh generator.
Method proven on the Zone D 6 m door-wall proof (wall-proof-1013 v3/v4, 2026-10-13), made automatic here:
  * stone: vertical columns between the plate's own column edges (dark minima of the median column profile); each edge
    wanders row by row onto the darkest pixel within +-5 px (chips), shadowed pixels near an edge carve in, column tops start
    where the pixels leave the shadow band under the cornice. Depth scaled to SCALE x the MoGe-2 read of those pixels
    (default 1.15, allowed 1.0-1.3: nothing beyond the pixels).
  * cornice + snow cap: real slab, protrusion = MoGe-2 read (wall depth - cap depth), rounded profile, mitred corners.
  * door recesses: hole found from the dark pixels inside a search box, 1.5 m deep; jambs / lintel underside / cornice
    underside / tops are their OWN faces textured by pure translation from real neighbouring pixels (never stretched).
  * icicles: cones only where the plate shows bright drip streaks under a cornice lip (length/width from the pixels).
  * no decimation: every LOD is rebuilt at its own grid, sized from the triangle budget (no collapse facets).
CLI:
  python3 blender_wall.py build  <scene.json> --out DIR [--lods 0,1,2]   -> DIR/<name>-lodN.glb, DIR/<name>-lodN.json
  python3 blender_wall.py check  <model.glb> <check.json>                 -> per-feature depth ratio, stretch, facets: PASS/FAIL
  python3 blender_wall.py selftest                                        -> bad cases FAIL, good case PASS
"""
import json, os, struct, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.environ.get("BLENDER", "blender")
RATIO_MIN, RATIO_MAX, STRETCH_MAX = 0.7, 1.3, 1.3

# ----------------------------------------------------------------------------------------------------- plate helpers
_IMG = {}
CACHE = {}
PAPP = {}
EDGE = {}
PLATES = [None]
_HP = {}
def HPL(L):
    if id(L) not in _HP: _HP[id(L)] = nd.gaussian_filter(L, 1.0) - nd.gaussian_filter(L, 5)
    return _HP[id(L)]
def lum(path):
    if path not in _IMG: _IMG[path] = np.asarray(Image.open(path).convert("L"), np.float32) / 255
    return _IMG[path]

def moge_reads(depth, L, stone_box, cap_box=None):
    """apparent depths from MoGe-2 (metric): stone relief p95-p5 of the high-pass (cap 0.2, floor 0.03), cornice protrusion."""
    d = np.load(depth); x0, y0, x1, y1 = stone_box
    hp = d - nd.gaussian_filter(d, 6); s = hp[y0:y1, x0:x1]
    stone = float(np.clip(np.percentile(s, 95) - np.percentile(s, 5), 0.03, 0.2))
    cap = None
    if cap_box:
        a, b, c, e = cap_box; cap = float(np.clip(np.median(d[y0:y1, x0:x1]) - np.median(d[b:e, a:c]), 0.2, 0.8))
    return stone, cap

def column_edges(L, c0, c1, r0, r1, min_gap=10):
    p = nd.gaussian_filter1d(np.median(L[r0:r1, c0:c1], 0), 2); loc = nd.uniform_filter1d(p, 17)
    e = [c0]
    for i in range(3, len(p) - 3):
        c = c0 + i
        if p[i] == p[max(0, i - 6):i + 7].min() and p[i] < loc[i] - 0.003 and c - e[-1] >= min_gap: e.append(c)
    if c1 - e[-1] < min_gap: e[-1] = c1
    else: e.append(c1)
    return e

def find_door(L, box, thr=0.09, min_area_px=0, min_h_px=0):
    x0, y0, x1, y1 = box; m = nd.binary_opening(nd.gaussian_filter(L, 1)[y0:y1, x0:x1] < thr, iterations=2)
    lab, n = nd.label(m)
    if not n: return None
    k = 1 + int(np.argmax(nd.sum(m, lab, range(1, n + 1)))); ys, xs = np.nonzero(lab == k)
    R = lab == k; R = R[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    cols = xs.min() + np.nonzero(R.mean(0) > 0.5)[0]; rows = ys.min() + np.nonzero(R.mean(1) > 0.5)[0]
    if not len(cols) or not len(rows): return None
    if len(cols) * len(rows) < min_area_px or len(rows) < min_h_px: return None
    return dict(c0=x0 + int(cols.min()), c1=x0 + int(cols.max()) + 1, top=y0 + int(rows.min()))

def drip_streaks(L, c0, c1, row0, maxlen=60, thr=0.55, minlen=8):
    out = []
    for c in range(c0, c1):
        col = nd.gaussian_filter1d(L[row0:row0 + maxlen, c], 1); n = 0
        while n < len(col) and col[n] > thr: n += 1
        if n >= minlen: out.append([c, n])
    st = []
    for c, n in out:
        if st and c - st[-1]["c1"] <= 2: st[-1]["c1"] = c; st[-1]["n"] = max(st[-1]["n"], n)
        else: st.append(dict(c0=c, c1=c, n=n))
    return st

# ----------------------------------------------------------------------------------------------------- geometry builder
class Mesh:
    def __init__(s): s.V, s.T, s.F = [], [], {}          # F[mat] = list of (tri idx..), category
    def v(s, p, uv): s.V.append(tuple(map(float, p))); s.T.append((float(uv[0]), float(uv[1]))); return len(s.V) - 1
    def tri(s, mat, cat, a, b, c): s.F.setdefault((mat, cat), []).append((a, b, c))
    def quad(s, mat, cat, ids): a, b, c, d = ids; s.tri(mat, cat, a, b, c); s.tri(mat, cat, a, c, d)
    def count(s, cat=None): return sum(len(f) for (m, c), f in s.F.items() if cat in (None, c))

def ticks(a, b, step, must=()):
    t = sorted(set([a, b] + [m for m in must if a < m < b])); out = [t[0]]
    for i in range(len(t) - 1):
        n = max(1, int(round((t[i + 1] - t[i]) / step))); out += list(np.linspace(t[i], t[i + 1], n + 1)[1:])
    return np.array(out)

class Face:
    """planar facade: point(u, v, d) = o + u*right + v*up + d*out; plate px: col = c0 + cs*k*u, row from piecewise bands."""
    def __init__(s, spec, plates):
        s.sp = spec; P = plates[spec["plate"]]; s.mat = P["mat"]; s.L = lum(P["img"]); s.depth = P.get("depth")
        f = spec["frame"]; s.o = np.array(f["o"], float); s.r = np.array(f["right"], float); s.up = np.array(f["up"], float)
        s.out = np.cross(s.r, s.up); s.k = spec["k"]; s.c0 = spec["c0"]; s.cs = spec.get("cs", 1); s.u0, s.u1 = spec["u"]
    def col(s, u): return s.c0 + s.cs * s.k * u
    def ucol(s, c): return (c - s.c0) / (s.cs * s.k)
    def row(s, v, band): (vb, vt), (rb, rt) = band["v"], band["rows"]; return rb + (rt - rb) * (v - vb) / (vt - vb)
    def vrow(s, r, band): (vb, vt), (rb, rt) = band["v"], band["rows"]; return vb + (vt - vb) * (r - rb) / (rt - rb)
    def P(s, u, v, d): return s.o + u * s.r + v * s.up + d * s.out
    def uv(s, c, r): return (c / 1024, r / 1024)          # glTF convention (top-left origin, flipY false in the page)

def build_face(m, F, grid, opts, meta):
    sp = F.sp; SCALE = opts.get("scale", 1.15); lock = sp.get("edge_lock_m", 0.12)
    bands = sp["bands"]; fm = dict(face=sp["name"], features={}); stone_boxes = []; cornice_P = {}
    F0 = F
    for bi, B in enumerate(bands):
        F = F0
        if "map" in B:   # band textured from another plate / column origin (e.g. side cornice from the front cap pixels)
            F = Face(dict(F0.sp, **{k_: B["map"][k_] for k_ in ("plate", "c0", "cs", "k") if k_ in B["map"]}), PLATES[0])
            L = F.L; hpL = nd.gaussian_filter(L, 1.0) - nd.gaussian_filter(L, 5)
        else:
            L = F0.L; hpL = HPL(F0.L)
        Lb = nd.gaussian_filter(L, [3, 1]); colmean = nd.uniform_filter(L, [1, 15])
        vb, vt = B["v"]; rb, rt = B["rows"]; ca, cb = sorted([F.col(F.u0), F.col(F.u1)])
        ca, cb = int(np.ceil(ca)), int(np.floor(cb))
        if B["kind"] == "stone":
            r_lo, r_hi = int(min(rb, rt)), int(max(rb, rt))
            doors = []
            for D in sp.get("doors", []):
                if D.get("band", 0) != bi: continue
                fd = find_door(L, D["search"], min_area_px=D.get("min_area_m2", 0) * F.k * F.k, min_h_px=D.get("min_h_m", 0) * F.k)
                if fd: doors.append(dict(u0=F.ucol(fd["c0"] if F.cs > 0 else fd["c1"]), u1=F.ucol(fd["c1"] if F.cs > 0 else fd["c0"]),
                                         vtop=F.vrow(fd["top"], B), depth=D.get("depth", 1.5), px=fd))
            ck_ = (sp["name"], bi)
            if ck_ not in CACHE:
                edges = column_edges(L, ca, cb, r_lo + 18, r_hi - 10)
                dpx = [(d_["px"]["c0"], d_["px"]["c1"]) for d_ in doors]
                edges = sorted(set([e for e in edges if not any(a_ - 4 <= e <= b_ + 4 for a_, b_ in dpx)] + [x for a_, b_ in dpx for x in (a_, b_)]))
                JR = {j: nd.gaussian_filter1d(np.argmin(np.stack([Lb[:, max(0, j - 5 + q)] for q in range(11)], 1), 1).astype(float) + j - 5, 4) for j in edges[1:-1]}
                CACHE[ck_] = (edges, JR)
            edges, JR = CACHE[ck_]
            tops = {}
            for a, b in zip(edges, edges[1:]):
                mm = Lb[r_lo:min(r_lo + 60, r_hi), a + 2:max(a + 3, b - 2)].mean(1); bv = mm[:6].mean()
                tops[a] = r_lo + int(np.argmax(mm > bv + 0.6 * (mm.max() - bv))) if mm.max() > bv + 0.02 else r_lo
            def raw(r, c):
                J = [edges[0]] + [JR[j][int(r)] for j in edges[1:-1]] + [edges[-1]]
                for i in range(len(J) - 1):
                    a, b = J[i], J[i + 1]
                    if a <= c <= b:
                        t = (c - a) / max(1, b - a); z = np.sqrt(max(0.0, 1 - (2 * t - 1) ** 2))
                        z *= np.clip((r - tops[edges[i]] + 4) / 8, 0, 1)
                        if min(c - a, b - c) < 6: z -= 0.35 * float(np.clip((colmean[int(r), int(c)] - L[int(r), int(c)]) * 8, 0, 1))
                        return z + 0.25 * float(np.clip(hpL[int(r), int(c)] * 6, -1, 1))
                return 0.0
            # depth scale from MoGe-2 read of the plain-stone pixels (doors excluded)
            sbox = [ca + 10, r_lo + 18, cb - 10, r_hi - 10]
            if doors:   # widest door-free span of plain stone
                cuts = sorted([ca + 10] + [x for d_ in doors for x in (d_["px"]["c0"] - 14, d_["px"]["c1"] + 14)] + [cb - 10])
                spans = [(cuts[i], cuts[i + 1]) for i in range(0, len(cuts) - 1, 2)]
                a_, b_ = max(spans, key=lambda t: t[1] - t[0]); sbox = [a_, r_lo + 18, b_, r_hi - 10]
            if F.depth: app, _ = moge_reads(F.depth, L, sbox)
            else: app = opts.get("stone_default_m", 0.05)
            fb = None
            if app >= 0.2 - 1e-6 and opts.get("stone_fallback_m"):   # MoGe read hit its 0.2 m cap = noise, not a reading
                fb = app; app = opts["stone_fallback_m"]
            if ("K",) + ck_ not in CACHE:
                sample = [raw(r, c) for r in range(sbox[1], sbox[3], 3) for c in range(sbox[0], sbox[2], 2)]
                CACHE[("K",) + ck_] = SCALE * app / max(1e-6, np.percentile(sample, 95) - np.percentile(sample, 5))
            K = CACHE[("K",) + ck_]
            du, dv = grid["stone"]
            umust = [F.ucol(e) for e in edges] + [x for d in doors for x in (d["u0"], d["u1"])]
            us = ticks(F.u0, F.u1, du, umust); vs = ticks(vb, vt, dv, [d["vtop"] for d in doors] + list(B.get("vmust", [])))
            CR = opts.get("corner_rule", True)   # corner rule: relief is NOT locked at the u edges; corner strips close the gap
            WLOCK = (lambda u, v: np.clip(min(v - vb, vt - v) / lock, 0, 1)) if CR else (lambda u, v: np.clip(min(u - F.u0, F.u1 - u, v - vb, vt - v) / lock, 0, 1))
            idx = {}
            for i, u in enumerate(us):
                for j, v in enumerate(vs):
                    c, r = F.col(u), F.row(v, B)
                    w = WLOCK(u, v)
                    d = K * raw(r, c) * w; idx[i, j] = m.v(F.P(u, v, d), F.uv(c, r))
            inside = lambda u, v: any(D["u0"] < u < D["u1"] and v < D["vtop"] for D in doors)
            for i in range(len(us) - 1):
                for j in range(len(vs) - 1):
                    if inside((us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2): continue
                    m.quad(F.mat, "stone", (idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
            dz = lambda u, v: K * raw(F.row(v, B), F.col(u)) * WLOCK(u, v)
            EDGE[(sp["name"], bi)] = (F, B, dz, vs)
            for D in doors: door_recess(m, F, B, D, us, vs, dz, cb if F.cs > 0 else ca, fm)
            stone_boxes.append(sbox)
            fm["features"].setdefault("stone", []).append(dict(box=sbox, apparent_m=round(app, 3), built_p95p5_m=round(SCALE * app, 3), edges=edges,
                                                               moge_capped_read_m=fb, fallback_m=(app if fb else None)))
            B["_dz"] = dz; B["_sbox"] = sbox
        else:   # cornice + snow cap
            r_lo, r_hi = int(min(rb, rt)), int(max(rb, rt))
            below = bands[bi - 1] if bi > 0 else None
            app = None
            if F.depth and below:
                wbox = below.get("_sbox") if below.get("_sbox") and F is F0 else [ca + 4, int(min(below["rows"])) + 6, cb - 4, int(max(below["rows"])) - 4]
                _, app = moge_reads(F.depth, L, wbox, [ca + 4, r_lo + 4, cb - 4, r_hi - 4])
            app = app or opts.get("cornice_default_m", 0.43)
            if sp.get("cornice_override_m"): app = sp["cornice_override_m"]
            if sp.get("cornice_from") in PAPP: app = PAPP[sp["cornice_from"]]   # shared slab depth -> mitred corners meet
            PAPP[sp["name"]] = app
            prof = lambda v: app * (0.85 + 0.25 * np.sin(np.pi * np.clip(0.15 + 0.8 * (vt - v) / (vt - vb), 0, 1)) ** 0.5)
            du, dv = grid["cornice"]; vs = ticks(vb, vt, dv); n = max(2, int(round((F.u1 - F.u0) / du)))
            ext = sp.get("cornice_ext", [1, 1])
            idx = {}
            for j, v in enumerate(vs):
                p = prof(v); ua, ub = F.u0 - ext[0] * p, F.u1 + ext[1] * p
                for i, t in enumerate(np.linspace(0, 1, n + 1)):
                    u = ua + (ub - ua) * t; c = np.clip(F.col(np.clip(u, F.u0, F.u1)), 0, 1023); r = F.row(v, B)
                    w = np.clip(min(t, 1 - t) * (ub - ua) / lock, 0, 1)
                    d = p + w * float(np.clip(hpL[int(r), int(c)] * 0.4, -0.02, 0.02)); idx[i, j] = m.v(F.P(u, v, d), F.uv(c, r))
            for i in range(n):
                for j in range(len(vs) - 1): m.quad(F.mat, "cornice", (idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
            # underside: wall (below band top edge) -> lip, own pixels = the shadow rows right under the cap (translation)
            p0 = prof(vb); wdz = below["_dz"] if below and "_dz" in below else (lambda u, v: 0.0)
            ush = ticks(F.u0, F.u1, du * 2); depth_px = max(2, p0 * F.k)
            for ua, ub in zip(ush, ush[1:]):
                ca_, cb_ = F.col(ua), F.col(ub); r0 = max(rb, rt) if below else rb
                fa = lambda u: F.u0 - ext[0] * p0 + (u - F.u0) * (F.u1 - F.u0 + (ext[0] + ext[1]) * p0) / (F.u1 - F.u0)
                ids = (m.v(F.P(ua, vb, wdz(ua, vb)), F.uv(ca_, r_hi + depth_px)), m.v(F.P(ub, vb, wdz(ub, vb)), F.uv(cb_, r_hi + depth_px)),
                       m.v(F.P(fa(ub), vb, p0), F.uv(cb_, r_hi)), m.v(F.P(fa(ua), vb, p0), F.uv(ca_, r_hi)))
                m.quad(F.mat, "cornice", ids)
            cornice_P[bi] = prof
            fm["features"].setdefault("cornice", []).append(dict(box=[ca + 4, r_lo + 4, cb - 4, r_hi - 4], apparent_m=round(app, 3)))
            if opts.get("icicles", True) and sp.get("icicles", True):
                for st in drip_streaks(L, max(0, ca), min(1023, cb), r_hi):
                    if st["c1"] - st["c0"] > 40: continue          # a snow sheet, not a drip
                    cc = (st["c0"] + st["c1"]) / 2; u = F.ucol(cc); Lm = st["n"] / F.k; rad = float(np.clip((st["c1"] - st["c0"] + 1) / F.k / 2, 0.03, 0.12))
                    cone(m, F, u, vb, p0 * 0.7, Lm, rad, st, r_hi); fm["features"].setdefault("icicles", []).append(dict(u=round(u, 3), len_m=round(Lm, 3)))
    meta["faces"].append(fm)
    return cornice_P

def door_recess(m, F, B, D, us, vs, dz, c_far, fm):
    u0, u1, vt, dep = D["u0"], D["u1"], D["vtop"], D["depth"]; vb = B["v"][0]; k = F.k
    # jamb / lintel pixels: real stone right of the door (or left if it does not fit), pure translation, same px/m
    src = D["px"]["c1"] + 4 if D["px"]["c1"] + 4 + dep * k < 1023 else D["px"]["c0"] - 4 - dep * k
    jv = [v for v in vs if vb - 1e-9 <= v <= vt + 1e-9]
    for side, u in (("L", u0), ("R", u1)):
        for va, vc in zip(jv, jv[1:]):
            ra, rc = F.row(va, B), F.row(vc, B)
            ids = [m.v(F.P(u, va, dz(u, va)), F.uv(src, ra)), m.v(F.P(u, vc, dz(u, vc)), F.uv(src, rc)),
                   m.v(F.P(u, vc, -dep), F.uv(src + dep * k, rc)), m.v(F.P(u, va, -dep), F.uv(src + dep * k, ra))]
            m.quad(F.mat, "door", ids if side == "R" else ids[::-1])
    lu = [u for u in us if u0 - 1e-9 <= u <= u1 + 1e-9]; rtop = F.row(vt, B)
    for ua, ub in zip(lu, lu[1:]):
        ca, cb = src + (ua - u0) * k * 0.0 + abs(F.col(ua) - F.col(u0)), src + abs(F.col(ub) - F.col(u0))
        ids = [m.v(F.P(ua, vt, dz(ua, vt)), F.uv(ca, rtop + 12)), m.v(F.P(ua, vt, -dep), F.uv(ca, rtop + 12 + dep * k)),
               m.v(F.P(ub, vt, -dep), F.uv(cb, rtop + 12 + dep * k)), m.v(F.P(ub, vt, dz(ub, vt)), F.uv(cb, rtop + 12))]
        m.quad(F.mat, "door", ids if F.cs > 0 else ids[::-1])
    cA, cB = F.col(u0), F.col(u1); rb = F.row(vb, B)
    G = {}
    for i, t in enumerate(np.linspace(0, 1, 5)):
        for j, q in enumerate(np.linspace(0, 1, 7)):
            u, v = u0 + (u1 - u0) * t, vb + (vt - vb) * q; G[i, j] = m.v(F.P(u, v, -dep), F.uv(F.col(u), F.row(v, B)))
    for i in range(4):
        for j in range(6): m.quad(F.mat, "door", (G[i, j], G[i + 1, j], G[i + 1, j + 1], G[i, j + 1]) if F.cs > 0 else (G[i, j], G[i, j + 1], G[i + 1, j + 1], G[i + 1, j]))
    fm["features"].setdefault("door", []).append(dict(box=[int(min(cA, cB)) + 10, int(rtop) + 14, int(max(cA, cB)) - 10, int(rb)], apparent_m=dep, u=[round(u0, 3), round(u1, 3)], vtop=round(vt, 3)))

def cone(m, F, u, v, d, Lm, rad, st, r_lip, seg=8):
    rings = [(0.0, rad), (0.35 * Lm, rad * 0.55), (0.75 * Lm, rad * 0.22)]; tip = Lm; c0, c1 = st["c0"], st["c1"] + 1
    ids = []
    for h, rr in rings:
        ring = []
        for i in range(seg + 1):
            a = 2 * np.pi * i / seg; off = rr * (np.cos(a) * F.r + np.sin(a) * F.out)
            p = F.P(u, v - h, d) + off; cc = c0 + (c1 - c0) * (0.5 + 0.5 * np.cos(a)); ring.append(m.v(p, F.uv(cc, r_lip + h * F.k)))
        ids.append(ring)
    for A, Bq in zip(ids, ids[1:]):
        for i in range(seg): m.quad(F.mat, "icicle", (A[i], Bq[i], Bq[i + 1], A[i + 1]))
    t = m.v(F.P(u, v - tip, d), F.uv((c0 + c1) / 2, r_lip + tip * F.k))
    for i in range(seg): m.tri(F.mat, "icicle", ids[-1][i], t, ids[-1][i + 1])

def build_flat(m, spec, plates):
    """flat planar face (tops, back), linear uv: col = c0 + a.(p-o), row = r0 + b.(p-o); holes = rects in (u,v)."""
    o = np.array(spec["o"], float); U = np.array(spec["U"], float); Vv = np.array(spec["V"], float); mat = plates[spec["plate"]]["mat"]
    nu, nv = spec.get("n", [8, 8]); us = ticks(0, 1, 1 / nu, spec.get("umust", [])); vs = ticks(0, 1, 1 / nv, spec.get("vmust", []))
    idx = {}
    for i, a in enumerate(us):
        for j, b in enumerate(vs):
            p = o + a * U + b * Vv; c = spec["c0"] + np.dot(spec["cu"], p - o); r = spec["r0"] + np.dot(spec["cr"], p - o)
            idx[i, j] = m.v(p, (c / 1024, r / 1024))
    for i in range(len(us) - 1):
        for j in range(len(vs) - 1):
            a, b = (us[i] + us[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2
            if any(h[0] < a < h[2] and h[1] < b < h[3] for h in spec.get("holes", [])): continue
            m.quad(mat, spec.get("cat", "reserve"), (idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))

def build_corner(m, cr):
    """corner strip between the u-edge of face a (stone band) and the u-edge of face b: both keep their relief at the
    corner, the strip joins the two relief edges (chamfer) so the outline keeps the stone depth. Texture: face a's own edge
    pixels, translated by the strip width (isotropic)."""
    if (cr["a"], cr.get("band", 0)) not in EDGE or (cr["b"], cr.get("band", 0)) not in EDGE: return
    Fa, Ba, dza, vsa = EDGE[(cr["a"], cr.get("band", 0))]; Fb, Bb, dzb, vsb = EDGE[(cr["b"], cr.get("band", 0))]
    ua = Fa.u1 if cr["a_end"] == "u1" else Fa.u0; ub = Fb.u1 if cr["b_end"] == "u1" else Fb.u0
    vs = sorted(set(np.round(list(vsa) + list(vsb), 6))); sgn = 1 if cr["a_end"] == "u1" else -1
    for v0, v1 in zip(vs, vs[1:]):
        pa0, pa1 = Fa.P(ua, v0, dza(ua, v0)), Fa.P(ua, v1, dza(ua, v1)); pb0, pb1 = Fb.P(ub, v0, dzb(ub, v0)), Fb.P(ub, v1, dzb(ub, v1))
        c = Fa.col(ua); w0 = np.linalg.norm(pa0 - pb0) * Fa.k; w1 = np.linalg.norm(pa1 - pb1) * Fa.k
        r0, r1 = Fa.row(v0, Ba), Fa.row(v1, Ba); cs = -Fa.cs * sgn
        ids = [m.v(pa0, Fa.uv(c, r0)), m.v(pb0, Fa.uv(c + cs * w0, r0)), m.v(pb1, Fa.uv(c + cs * w1, r1)), m.v(pa1, Fa.uv(c, r1))]
        q = [np.array(m.V[i]) for i in ids]; nrm = np.cross(q[1] - q[0], q[2] - q[0]) + np.cross(q[2] - q[0], q[3] - q[0])
        m.quad(Fa.mat, "stone", ids if nrm @ (Fa.out + Fb.out) > 0 else ids[::-1])

def build_ledge(m, lg, plates):
    """snow ledge / roof on top of a tier: outer rect = footprint + the cornice top protrusion (PAPP x 1.02, same as the
    lip edge), minus the next tier's footprint. top.jpg at spm px/m, isotropic: front strip rows by depth from the lip,
    side strips rotated (cols along z, rows from the outer edge), roof rows by depth."""
    p = PAPP[lg["front"]] * 1.0 * (0.85 + 0.25 * np.sin(np.pi * 0.15) ** 0.5); hw, zf, zb, y = lg["hw"], lg["z"] + p, lg["back"], lg["y"]
    mat = plates[lg["plate"]]["mat"]; spm = lg.get("spm", 48); r0 = lg["r0"]; cx = lg.get("cx", 525); g = lg.get("cell", 0.35)
    X0, X1 = -hw - p, hw + p
    def rect(xa, xb, za, zb_, uvf):
        xs = ticks(xa, xb, g); zs = ticks(zb_, za, g); idx = {}
        for i, x in enumerate(xs):
            for j, z in enumerate(zs): idx[i, j] = m.v((x, y, z), uvf(x, z))
        for i in range(len(xs) - 1):
            for j in range(len(zs) - 1): m.quad(mat, "reserve", (idx[i, j], idx[i, j + 1], idx[i + 1, j + 1], idx[i + 1, j]))
    nx = lg.get("next")
    if not nx: rect(X0, X1, zf, zb, lambda x, z: ((cx + x * spm) / 1024, (r0 + (zf - z) * spm) / 1024)); return
    rect(X0, X1, zf, nx["z"], lambda x, z: ((cx + x * spm) / 1024, (r0 + (zf - z) * spm) / 1024))
    zm = (nx["z"] + zb) / 2
    rect(X0, -nx["hw"], nx["z"], zb, lambda x, z: ((cx + (z - zm) * spm) / 1024, (r0 + (x - X0) * spm) / 1024))
    rect(nx["hw"], X1, nx["z"], zb, lambda x, z: ((cx + (z - zm) * spm) / 1024, (r0 + (X1 - x) * spm) / 1024))

def build(scene, lod_budget):
    """grid sizes from the budget: stone/cornice cells sized so the category lands under its share (no decimation)."""
    plates = scene["plates"]; PLATES[0] = plates; B = lod_budget; meta = dict(faces=[], budget=B)
    def make(gs, gc):
        m = Mesh(); md = dict(faces=[])
        for fs in scene["faces"]:
            w = fs.get("weight", 1.0); g = dict(stone=(gs[0] / np.sqrt(w), gs[1] / np.sqrt(w)), cornice=(gc[0] / np.sqrt(w), gc[1] / np.sqrt(w)))
            build_face(m, Face(json.loads(json.dumps(fs)), plates), g, scene.get("opts", {}), md)
        for fl in scene.get("flats", []): build_flat(m, fl, plates)
        for cr in scene.get("corners", []): build_corner(m, cr)
        for lg in scene.get("ledges", []): build_ledge(m, dict(lg, cell=B.get("ledge_cell", lg.get("cell", 0.35))), plates)
        return m, md
    gs, gc = [0.06, 0.15], [0.10, 0.20]
    for it in range(8):
        m, md = make(gs, gc); ns, nc = m.count("stone"), m.count("cornice")
        fs_, fc_ = np.sqrt(ns / B["stone"]), np.sqrt(nc / B["cornice"])
        if fs_ <= 1.0 and fc_ <= 1.0 and (fs_ > 0.85 or it > 4): break
        gs = [x * max(fs_, 0.9) * 1.03 for x in gs]; gc = [x * max(fc_, 0.9) * 1.03 for x in gc]
    meta.update(md); meta["grid"] = dict(stone=gs, cornice=gc)
    meta["tris"] = {c: m.count(c) for c in ("stone", "cornice", "icicle", "door", "reserve")}; meta["tris"]["total"] = m.count()
    return m, meta

def write_obj(m, path):
    mats = sorted(set(k[0] for k in m.F))
    with open(path, "w") as f:
        f.write("mtllib none.mtl\n")
        for p in m.V: f.write("v %.4f %.4f %.4f\n" % p)
        for t in m.T: f.write("vt %.5f %.5f\n" % (t[0], 1 - t[1]))
        for mat in mats:
            f.write(f"usemtl {mat}\n")
            for (mm, cat), tris in m.F.items():
                if mm != mat: continue
                for a, b, c in tris: f.write(f"f {a+1}/{a+1} {b+1}/{b+1} {c+1}/{c+1}\n")
    return mats

BL_STAGE = r'''
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]; SEAL = a[2] == "1"; THICK = float(a[3]); OFFS = float(a[4]) if len(a) > 4 else 0.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=a[0], forward_axis="NEGATIVE_Z", up_axis="Y")
ob = bpy.context.selected_objects[0]; bpy.context.view_layer.objects.active = ob
if SEAL:
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.separate(type="MATERIAL"); bpy.ops.object.mode_set(mode="OBJECT")
for ob in list(bpy.context.scene.objects):
    if ob.type != "MESH": continue
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    if SEAL:
        bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=0.00002)
        bpy.ops.mesh.dissolve_degenerate(threshold=0.0005); bpy.ops.mesh.delete_loose(); bpy.ops.object.mode_set(mode="OBJECT")
        so = ob.modifiers.new("seal", "SOLIDIFY"); so.thickness = THICK; so.offset = OFFS; so.use_rim = True; so.use_even_offset = False
        bpy.ops.object.modifier_apply(modifier="seal")
        bpy.ops.object.modifier_add(type="TRIANGULATE"); bpy.ops.object.modifier_apply(modifier="Triangulate")
    bpy.ops.object.shade_smooth_by_angle(angle=1.05)
bpy.ops.object.select_all(action="SELECT")
for mt in bpy.data.materials: mt.name = mt.name.split(".")[0]
bpy.ops.export_scene.gltf(filepath=a[1], export_format="GLB", export_yup=True, export_normals=True, export_texcoords=True, export_materials="EXPORT", export_image_format="NONE")
'''

def export_glb(m, out_glb, seal=True, thick=0.03, offs=0.0):
    obj = out_glb[:-4] + ".obj"; write_obj(m, obj)
    st = os.path.join(os.path.dirname(out_glb), "_bl_stage.py"); open(st, "w").write(BL_STAGE)
    subprocess.run([BLENDER, "-b", "-P", st, "--", obj, out_glb, "1" if seal else "0", str(thick), str(offs)], check=True, capture_output=True)
    os.remove(obj); return out_glb

GLTFPACK = os.environ.get("GLTFPACK", "/tmp/gp/node_modules/gltfpack/cli.js")
def pack_glb(glb):
    """gltfpack with float UVs (-vtf) AND -kv: the materials carry no image (the page supplies the plates), so without -kv
    gltfpack drops TEXCOORD_0 as 'unused' (the v3.x untextured-wall bug). Verifies UV per material against the unpacked file."""
    out = glb[:-4] + ".pack.glb"
    subprocess.run(["node", GLTFPACK, "-i", glb, "-o", out, "-vtf", "-kv", "-kn", "-km"], check=True, capture_output=True)
    a, b = read_glb(glb), read_glb(out); rep = {}
    for mat in sorted(set(a[3])):
        ua = a[1][a[2][a[3] == mat].ravel()]; ub = b[1][b[2][b[3] == mat].ravel()]
        err = float(max(np.abs(ua.min(0) - ub.min(0)).max(), np.abs(ua.max(0) - ub.max(0)).max()) * 1024)
        rep[mat] = dict(uv_range_err_px=round(err, 3), ok=err < 0.5)
        if err >= 0.5: raise SystemExit(f"gltfpack changed the UV range of {mat} by {err:.2f} px")
    return rep

# ----------------------------------------------------------------------------------------------------- glb reader + check
def read_glb(path):
    b = open(path, "rb").read(); n = struct.unpack("<I", b[12:16])[0]; J = json.loads(b[20:20 + n]); off = 20 + n
    bin_ = b[off + 8:] if len(b) > off else b""
    def acc(i):
        A = J["accessors"][i]; bv = J["bufferViews"][A["bufferView"]]; ct = {5126: "f4", 5125: "u4", 5123: "u2", 5121: "u1", 5122: "i2", 5120: "i1"}[A["componentType"]]
        nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[A["type"]]; st = bv.get("byteStride", 0); o = bv.get("byteOffset", 0) + A.get("byteOffset", 0)
        if st and st != nc * np.dtype(ct).itemsize:
            raw = np.frombuffer(bin_, np.uint8, count=st * A["count"], offset=o).reshape(-1, st)[:, :nc * np.dtype(ct).itemsize]
            a = np.frombuffer(raw.tobytes(), ct).reshape(A["count"], nc)
        else: a = np.frombuffer(bin_, ct, count=A["count"] * nc, offset=o).reshape(A["count"], nc)
        a = a.astype(np.float64)
        if A.get("normalized"): a = a / {"u1": 255, "u2": 65535, "i1": 127, "i2": 32767}[ct]
        return a
    def node_mats(): # world matrix per mesh node
        out = []
        def walk(ni, M):
            nd_ = J["nodes"][ni]; L = np.eye(4)
            if "matrix" in nd_: L = np.array(nd_["matrix"]).reshape(4, 4).T
            else:
                T = np.eye(4); T[:3, 3] = nd_.get("translation", [0, 0, 0]); x, y, z, w = nd_.get("rotation", [0, 0, 0, 1])
                R = np.eye(4); R[:3, :3] = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
                S = np.diag(nd_.get("scale", [1, 1, 1]) + [1]); L = T @ R @ S
            W = M @ L
            if "mesh" in nd_: out.append((nd_["mesh"], W, nd_))
            for c in nd_.get("children", []): walk(c, W)
        for sc in J["scenes"][J.get("scene", 0)]["nodes"]: walk(sc, np.eye(4))
        return out
    P, UV, F, MAT = [], [], [], []; base = 0
    for mi, W, nd_ in node_mats():
        for pr in J["meshes"][mi]["primitives"]:
            p = acc(pr["attributes"]["POSITION"]); p = (np.c_[p, np.ones(len(p))] @ W.T)[:, :3]
            uv = acc(pr["attributes"]["TEXCOORD_0"]) if "TEXCOORD_0" in pr["attributes"] else np.zeros((len(p), 2))
            ext = (J["materials"][pr["material"]].get("pbrMetallicRoughness", {}).get("baseColorTexture", {}).get("extensions", {}).get("KHR_texture_transform")) if "material" in pr else None
            if ext:
                o = np.array(ext.get("offset", [0, 0])); s = np.array(ext.get("scale", [1, 1])); uv = uv * s + o
            idx = acc(pr["indices"]).astype(int).reshape(-1, 3) if "indices" in pr else np.arange(len(p)).reshape(-1, 3)
            name = J["materials"][pr["material"]]["name"] if "material" in pr else ""
            P.append(p); UV.append(uv); F.append(idx + base); MAT += [name] * len(idx); base += len(p)
    return np.vstack(P), np.vstack(UV), np.vstack(F), np.array(MAT), J

def sealed(glb):
    """object-gate 'mesh sealed' rule (lib/probe.js): per glTF primitive, vertices welded at 1 mm, every edge used by
    exactly 2 triangles (open = 1, non-manifold > 2)."""
    P, UV, F, MAT, J = read_glb(glb); out = {}
    for mat in sorted(set(MAT)):
        T = F[MAT == mat]; key = np.round(P * 1e3).astype(np.int64); _, vid = np.unique(key, axis=0, return_inverse=True); vid = vid.ravel()
        t = vid[T]; t = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]
        e = np.sort(np.vstack([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]), 1); _, cnt = np.unique(e, axis=0, return_counts=True)
        out[mat] = dict(tris=int(len(T)), open=int((cnt == 1).sum()), nonManifold=int((cnt > 2).sum()))
    return dict(per_material=out, pass_=all(v["open"] == 0 and v["nonManifold"] == 0 for v in out.values()))

def check(glb, ck):
    """ck: {plate, depth(moge), k (px/m), material, stone_box, cornice_box?, door_box?, wall_box} (plate px).
    real depth from the mesh vertices whose uv falls in each box, vs the wall plane fitted under wall_box (facing ck.facing)."""
    P, UV, F, MAT, _ = read_glb(glb); L = lum(ck["plate"]); px = UV * 1024
    mat_ok = np.ones(len(F), bool) if not ck.get("material") else (MAT == ck["material"])
    tri = F[mat_ok]; tp = P[tri]; n = np.cross(tp[:, 1] - tp[:, 0], tp[:, 2] - tp[:, 0]); area = np.linalg.norm(n, axis=1) / 2
    nn = n / np.maximum(1e-12, 2 * area[:, None]); cpx = px[tri].mean(1); cen = tp.mean(1)
    inbox = lambda b: (cpx[:, 0] >= b[0]) & (cpx[:, 0] < b[2]) & (cpx[:, 1] >= b[1]) & (cpx[:, 1] < b[3])
    facing = np.array(ck.get("facing", [0, 0, 1]), float)
    mid = (P.min(0) + P.max(0)) / 2; outer = (cen - mid) @ facing > 0   # sealed shells: the inner skin of the OPPOSITE face also faces this way
    nn = np.where(outer[:, None], nn, 0.0)
    w = inbox(ck["wall_box"]) & (nn @ facing > 0.3)
    if w.sum() < 6: return dict(pass_=False, error="no wall triangles under wall_box")
    c = np.average(cen[w], 0, area[w]); _, _, vt = np.linalg.svd((cen[w] - c) * np.sqrt(area[w])[:, None], full_matrices=False); nrm = vt[2]
    if nrm @ facing < 0: nrm = -nrm
    z = (cen - c) @ nrm
    stone_app, cap_app = moge_reads(ck["depth"], L, ck["stone_box"], ck.get("cornice_box"))
    if stone_app >= 0.2 - 1e-6 and ck.get("stone_fallback_m"): stone_app = ck["stone_fallback_m"]

    res = dict(features={})
    def feat(name, sel, kind, app):
        if sel.sum() < 6: res["features"][name] = None; return
        zz, aa = z[sel], area[sel]
        if kind == "texture":
            o = np.argsort(zz); cw = np.cumsum(aa[o]) / aa.sum(); real = float(zz[o][np.searchsorted(cw, 0.95)] - zz[o][np.searchsorted(cw, 0.05)])
        elif kind == "protrusion": real = float(np.percentile(zz, 50))
        else: real = float(-np.percentile(zz, 50))
        r = real / app; res["features"][name] = dict(real_m=round(real, 3), apparent_m=round(app, 3), ratio=round(r, 2),
                                                     pass_=bool(RATIO_MIN <= r <= (RATIO_MAX if kind == "texture" else 1.6)))
    fw = nn @ facing > 0.3   # outer skin only (sealed builds carry an inner shell facing the other way)
    feat("stone", inbox(ck["stone_box"]) & fw, "texture", stone_app)
    if ck.get("cornice_box"): feat("cornice", inbox(ck["cornice_box"]) & (nn @ facing > 0.2), "protrusion", cap_app)
    if ck.get("door_box"): feat("door", inbox(ck["door_box"]) & (nn @ facing > 0.7), "recess", ck.get("door_apparent_m", 1.5))
    if ck.get("edge_cols") and res["features"].get("stone"):   # corner rule: relief survives within 6 px of the face edges
        sb = ck["stone_box"]; rows = (cpx[:, 1] >= sb[1]) & (cpx[:, 1] < sb[3]) & (nn @ facing > 0.3)
        near = rows & np.any([np.abs(cpx[:, 0] - e) < 6 for e in ck["edge_cols"]], 0)
        if near.sum() >= 6:
            zz = z[near]; er = float(np.percentile(zz, 95) - np.percentile(zz, 5)); ir = res["features"]["stone"]["real_m"]
            res["corner"] = dict(edge_p95p5_m=round(er, 3), interior_m=ir, ratio=round(er / max(ir, 1e-6), 2), pass_=er >= 0.5 * ir)
        else: res["corner"] = dict(error="no edge triangles", pass_=False)
    # texel stretch: plate px per metre along each triangle's two principal directions vs the plate's own px/m
    e1, e2 = tp[:, 1] - tp[:, 0], tp[:, 2] - tp[:, 0]; t1, t2 = px[tri][:, 1] - px[tri][:, 0], px[tri][:, 2] - px[tri][:, 0]
    Mg = np.stack([np.stack([np.einsum("ij,ij->i", e1, e1), np.einsum("ij,ij->i", e1, e2)], 1), np.stack([np.einsum("ij,ij->i", e1, e2), np.einsum("ij,ij->i", e2, e2)], 1)], 1)
    Mt = np.stack([np.stack([np.einsum("ij,ij->i", t1, t1), np.einsum("ij,ij->i", t1, t2)], 1), np.stack([np.einsum("ij,ij->i", t1, t2), np.einsum("ij,ij->i", t2, t2)], 1)], 1)
    ok = area > 1e-7
    ev = np.full((len(tri), 2), np.nan)
    try:
        A = np.linalg.solve(Mg[ok], Mt[ok]); ev[ok] = np.sort(np.sqrt(np.abs(np.linalg.eigvals(A).real)), 1)   # px per m along principal axes
    except np.linalg.LinAlgError: pass
    kk = ck.get("k_by_mat", {}); k = np.array([kk.get(x, ck["k"]) for x in MAT[mat_ok]]); aniso = ev[:, 1] / np.maximum(ev[:, 0], 1e-6); bad = ok & ((aniso > STRETCH_MAX) | (ev[:, 1] > k * STRETCH_MAX) | (ev[:, 0] < k / STRETCH_MAX))
    vis = ok & ~inbox(ck.get("ignore_box", [0, 0, 0, 0]))
    sfrac = float(area[bad & vis].sum() / max(1e-9, area[vis].sum()))
    res["stretch"] = dict(bad_area_frac=round(sfrac, 3), pass_=sfrac <= ck.get("stretch_frac_max", 0.05))
    # facets: share of stone-box area in big flat triangles (> 0.01 m2) = decimation facets at 3 m
    sb = inbox(ck["stone_box"]) & fw; ff = float(area[sb & (area > 0.01)].sum() / max(1e-9, area[sb].sum()))
    res["facets"] = dict(big_tri_area_frac=round(ff, 3), pass_=ff <= 0.2)
    res["tris"] = int(len(F))
    res["pass_"] = bool(all(v is None or v["pass_"] for v in res["features"].values()) and res["stretch"]["pass_"] and res["facets"]["pass_"]
                        and res.get("corner", {}).get("pass_", True)
                        and res["features"].get("stone") is not None)
    return res

def selftest():
    """fixtures: wall-proof-1013 pieces (same window of plate-front-v35: cols 320..600 / 455..596, rows 560..871)."""
    W = os.environ.get("WALL_FIXTURES", "/workspace/wall-proof-1013")
    base = dict(plate=f"{W}/v4/plate-front-v35.jpg", depth=f"{W}/v4/plate-front-depth.npy", k=1 / 0.0215, material="front",
                wall_box=[330, 712, 455, 860], stone_box=[330, 712, 455, 860], cornice_box=[330, 600, 596, 694], door_box=[482, 725, 561, 871])
    GOOD = f"{W}/tool/v4piece-lod0.glb"
    sc = os.path.join(HERE, "../../steps/zone-d/01-terrace/wall/v4piece.wall.json")
    m, meta = build(json.load(open(sc)), dict(stone=11000, cornice=3000)); os.makedirs(os.path.dirname(GOOD), exist_ok=True); export_glb(m, GOOD)
    narrow = dict(base, wall_box=[455, 712, 466, 860], stone_box=[455, 712, 466, 860], cornice_box=[455, 600, 596, 694], door_box=[482, 725, 561, 871])
    cases = [("flat box + pasted plate (terrace v3.5 piece)", f"{W}/v2/before-v35.glb", dict(base, material=None), False),
             ("stretched front pixels on jambs/undersides (proof v1)", f"{W}/after-blender.glb", narrow, False),
             ("over-deep relief 4x MoGe + decimation facets (proof v2)", f"{W}/v2/after-blender.glb", base, False),
             ("v4 hand piece: stretched cornice top + short underside (real defect found by this check)", f"{W}/v4/after-blender.glb", base, False),
             ("v4 method rebuilt by blender_wall.py (good)", GOOD, base, True)]
    ok = True; rep = []
    for name, glb, ck, want in cases:
        r = check(glb, ck); got = r["pass_"]; ok &= (got == want)
        rep.append(dict(case=name, want="PASS" if want else "FAIL", got="PASS" if got else "FAIL", detail=r))
        print(("ok  " if got == want else "BAD ") + f"{name}: want {'PASS' if want else 'FAIL'} got {'PASS' if got else 'FAIL'} | "
              + json.dumps({k: v for k, v in r.items() if k != 'tris'}))
    # ---- 0-credit fix cases (each fix: a FAIL case and its PASS case), on a small terrace build of the real scene
    TS = os.path.join(HERE, "../../steps/zone-d/01-terrace/wall/terrace.wall.json"); out = f"{W}/tool/selftest"; os.makedirs(out, exist_ok=True)
    small = dict(stone=6000, cornice=4000, ledge_cell=1.0)
    def tb(tag, mut):
        sc = json.load(open(TS)); mut(sc); CACHE.clear(); PAPP.clear(); EDGE.clear(); m, meta = build(sc, small)
        g = f"{out}/{tag}.glb"; export_glb(m, g); return g, meta
    def fface(meta, name): return [f for f in meta["faces"] if f["face"] == name][0]
    def ckface(meta, name, plate, depth, facing, fb=None, door=True):
        f = fface(meta, name); st = f["features"]["stone"][0]
        c = dict(plate=plate, depth=depth, k=1 / 0.0215, material=("side" if "side" in plate else "front"), wall_box=st["box"], stone_box=st["box"], facing=facing, stone_fallback_m=fb, stretch_frac_max=1.0)
        if door and f["features"].get("door"): c["door_box"] = f["features"]["door"][0]["box"]
        return c
    sc0 = json.load(open(TS)); FP = sc0["plates"]["front"]; SPl = sc0["plates"]["side"]
    good, gmeta = tb("good", lambda s_: None)
    cases2 = []
    # corner rule
    g0, _ = tb("corner-locked", lambda s_: s_["opts"].update(corner_rule=False))
    cf = lambda meta: dict(ckface(meta, "t1-front", FP["img"], FP["depth"], [0, 0, 1], door=False), edge_cols=[166], stone_box=[166, 770, 450, 860], wall_box=[180, 770, 450, 860])
    cases2 += [("corner relief locked to 0 at face edges", g0, cf(gmeta), False), ("corner rule (relief kept at edges)", good, cf(gmeta), True)]
    # fallback when MoGe hits the 0.2 m cap
    g1, m1 = tb("no-fallback", lambda s_: s_["opts"].update(stone_fallback_m=None))
    cases2 += [("side stone built from the capped 0.2 m MoGe read", g1, ckface(gmeta, "t3-left", SPl["img"], SPl["depth"], [-1, 0, 0], fb=0.096, door=False), False),
               ("side stone built from the 0.096 m fallback", good, ckface(gmeta, "t3-left", SPl["img"], SPl["depth"], [-1, 0, 0], fb=0.096, door=False), True)]
    # per-tier cornice slab depth
    def shallow(s_):
        for f in s_["faces"]:
            if f["name"].startswith("t2"): f["cornice_override_m"] = 0.2
    g2, _ = tb("t2-shallow-slab", shallow)
    cc = lambda meta: dict(ckface(meta, "t2-front", FP["img"], FP["depth"], [0, 0, 1], fb=0.096, door=False), cornice_box=fface(meta, "t2-front")["features"]["cornice"][0]["box"])
    cases2 += [("t2 cornice slab 0.2 m (shallower than its pixels)", g2, cc(gmeta), False), ("t2 cornice slab from its own MoGe read", good, cc(gmeta), True)]
    # side doorway: painted vs real recess
    def nodoor(s_):
        for f in s_["faces"]:
            if f["name"] in ("t1-left", "t1-right"): f["doors"] = []
    g3, _ = tb("side-door-painted", nodoor)
    sd = lambda: dict(ckface(gmeta, "t1-left", SPl["img"], SPl["depth"], [-1, 0, 0], fb=0.096), material="side")
    cases2 += [("t1 left doorway painted on a flat wall", g3, sd(), False), ("t1 left doorway as a real 1.5 m recess", good, sd(), True)]
    for name, glb, ck, want in cases2:
        r = check(glb, ck); got = r["pass_"]
        if name.startswith("corner"): got = r.get("corner", {}).get("pass_", False)
        elif "slab" in name: got = bool(r["features"].get("cornice") and r["features"]["cornice"]["pass_"])
        elif "doorway" in name: got = bool(r["features"].get("door") and r["features"]["door"]["pass_"])
        else: got = bool(r["features"].get("stone") and r["features"]["stone"]["pass_"])
        ok &= (got == want); print(("ok  " if got == want else "BAD ") + f"{name}: want {'PASS' if want else 'FAIL'} got {'PASS' if got else 'FAIL'} | "
                                   + json.dumps({k: v for k, v in r.items() if k in ("features", "corner")}))
    # door-aimed views: every door in the build must have a door spec
    specs = door_specs(gmeta, sc0)
    miss = door_specs_missing(gmeta, specs[:-1]); ok &= bool(miss); print(("ok  " if miss else "BAD ") + f"door spec set missing one door: want FAIL got {'FAIL' if miss else 'PASS'} ({miss})")
    miss = door_specs_missing(gmeta, specs); ok &= not miss; print(("ok  " if not miss else "BAD ") + f"door spec for every door: want PASS got {'PASS' if not miss else 'FAIL'}")
    # sealed (object-gate rule): the unsealed v1 terrace must FAIL. The sealed build is REPORTED, not asserted (known open).
    old = f"{W}/terrace/glb/terrace-lod0.glb"
    if os.path.exists(old):
        r = sealed(old); ok &= not r["pass_"]; print(("ok  " if not r["pass_"] else "BAD ") + f"unsealed v1 terrace: want FAIL got {'PASS' if r['pass_'] else 'FAIL'} {json.dumps(r['per_material'])}")
    r = sealed(good); print(f"INFO sealed build (known open, not asserted): {'PASS' if r['pass_'] else 'FAIL'} {json.dumps(r['per_material'])}")
    print("SELFTEST", "PASS" if ok else "FAIL"); return ok, rep

def door_specs(meta, scene):
    """one depthmeasure spec per door: wall plane on the stone strip beside the door, views aimed at the door."""
    out = []; faces = {f["name"]: f for f in scene["faces"]}
    for f in meta["faces"]:
        sf = faces[f["face"]]; P = scene["plates"][sf["plate"]]
        for i, d in enumerate(f["features"].get("door", [])):
            x0, y0, x1, y1 = d["box"]; w = 40
            wb = [max(0, x0 - 10 - w - 14), y0, x0 - 24, y1 - 6] if x0 - 10 - w - 14 > 0 else [x1 + 24, y0, min(1023, x1 + 24 + w), y1 - 6]
            n = np.cross(sf["frame"]["right"], sf["frame"]["up"]).round().astype(int).tolist()
            out.append(dict(face=f["face"], door=i, plate=P["img"], plates={P["mat"]: P["img"]}, material=P["mat"], moge_depth=P.get("depth"),
                            wall_box=wb, facing=n, auto_frame=True, outline_break_m=0.3,
                            reliefs=[dict(name="door", kind="recess", box=d["box"], luma_below=30, cap_m=1.5)],
                            views=[dict(name="door-60-8m", dist=8, angle=60, grazing=False), dict(name="door-75-5m", dist=5, angle=75, grazing=False)]))
    return out

def door_specs_missing(meta, specs):
    have = {(s_["face"], s_["door"]) for s_ in specs}
    return [(f["face"], i) for f in meta["faces"] for i, _ in enumerate(f["features"].get("door", [])) if (f["face"], i) not in have]

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "selftest": sys.exit(0 if selftest()[0] else 1)
    if cmd == "check": print(json.dumps(check(sys.argv[2], json.load(open(sys.argv[3]))), indent=1))
    if cmd == "build":
        scene = json.load(open(sys.argv[2])); out = sys.argv[sys.argv.index("--out") + 1]; os.makedirs(out, exist_ok=True)
        lods = [int(x) for x in (sys.argv[sys.argv.index("--lods") + 1] if "--lods" in sys.argv else "0,1,2").split(",")]
        for l in lods:
            m, meta = build(scene, scene["budgets"][l]); g = export_glb(m, f"{out}/{scene['name']}-lod{l}.glb")
            if "--pack" in sys.argv: meta["pack"] = pack_glb(g)
            json.dump(meta, open(f"{out}/{scene['name']}-lod{l}.json", "w"), indent=1, default=float); print("LOD", l, meta["tris"])
