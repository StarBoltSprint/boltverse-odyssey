"""Continuous-strata mesa geometry (v10, SmiR 06:38: "looks like a lot of small pieces gathered together").
v2 (strata.py) built every bed x 5-8 m face as its own flat box pushed in/out independently, one plate window per box:
staggered joints (masonry), hard texture seams, dark connector/underside strips at every box edge.
v10: per section (tier, or tier part under a broken-skyline drop) ONE continuous wall surface on a (column x row) grid
around the hull outline, displaced radially by a smooth profile field dr(theta, y):
  * bed profiles: hard caprock beds jut out with a rounded lip (real overhang + shadow below), soft beds recess;
    the amplitude of every bed varies smoothly along the face (ledges come and go, never equal boxes);
  * a buttress/alcove field shared through all tiers (vertical ribs, not per-box jitter);
  * V-shaped vertical joints running through the beds (depth varying with height).
Plate windows = joint-to-joint spans x bed groups. UV = true surface arc length (row arc for u, column arc for v), so
inside a window the Imagine pixels are continuous over every ledge (bed lines run on). Texture seams sit only in the
joints and are blended there: every vertex carries a 2nd plate slot + blend weight (shader height-blend), and the
depth relief is blended the same way (continuous across joints). Horizontal window seams sit on bed boundaries.
Same shell for every LOD (LOD0 = LOD1 base grid refined to 1 m, carrying the relief displacement attribute).
Attrs per vertex (13): plate, px, py, tone rgb, disp xyz, plate2, px2, py2, blend -> stride 16.
python3 strata2.py <hullPrefix> <front> <top> <out> [scale] [seed] [reliefDir|-]"""
import json, os, sys, zlib, numpy as np
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import strata as S
from masks import load, rock_mask

EXCLUDE = {"w6"}     # v10 review: w6 is a regular brick grid (reads as masonry) -> never sampled
def _plate_groups():
    """near-duplicate Imagine plates (edit variants, corr > 0.9 at 320x180) count as the SAME plate for repetition."""
    from PIL import Image
    A = [np.asarray(Image.open(S._PJ["imagine"][w]).convert("L").resize((320, 180)), float).ravel() for w in S.WALLS]
    g = list(range(S.NW))
    for i in range(S.NW):
        for j in range(i):
            if np.corrcoef(A[i], A[j])[0, 1] > 0.9: g[i] = g[j]; break
    return g
try: GROUP = _plate_groups()
except Exception: GROUP = list(range(S.NW))
GROUP = GROUP + [S.NW + 1 + k for k in range(4)]
ALLOWED = [p for p in range(S.NW) if S.WALLS[p] not in EXCLUDE]
def window_score(c, W):
    s = 0; gc = GROUP[c["p"]]
    for w in W:
        if GROUP[w["p"]] != gc: continue
        d = float(np.linalg.norm(w["c"] - c["c"]))
        if d < S.ADJ_R and S.overlap(w, c) > 0.0: s += 1
        elif d < S.REPEAT_R and w["fl"] == c["fl"] and S.overlap(w, c) > 0.5: s += 1
    return s
RELAMP = 0.7         # depth relief scale (the continuous strata geometry now carries the big ledges)
GRID0 = 1.0          # LOD0 relief grid (m)
FADE_M = 0.6         # relief fades to 0 within this distance of a horizontal window seam (bed boundary)
JSP = (4.5, 7.5)     # joint spacing along the face (m) = window span
ROW_MAXV = 7.6       # window row height (surface arc, m) <= plate 9 m minus margin
COLW = 2.6           # max column spacing of the base shell (m)
CAPNY = 0.45         # |normal.y| above this: ledge top / underside -> cap plates

def pnoise(rng, Ptot, waves, amps):
    """periodic smooth noise of theta: integer harmonics chosen per section radius Rs so the physical wavelengths
    stay ~waves (m) on every tier; f(theta, Rs)."""
    ph = rng.uniform(0, 2 * np.pi, len(waves)); tot = float(sum(amps))
    return lambda th_, Rs: sum(A * np.sin(max(1, round(2 * np.pi * Rs / w)) * np.asarray(th_) + p) for A, w, p in zip(amps, waves, ph)) / tot

def build(prefix, front_img, top_img, lod, rng_seed=1008, windows=None, scale=1.0):
    rlod = lod; glod = 0
    rng = np.random.default_rng(rng_seed)
    H = np.load(prefix + "-H.npy"); meta = json.load(open(prefix + "-meta.json"))
    H = H * scale * S.HSCALE; meta = dict(meta); meta["pxm"] = meta["pxm"] / scale; meta["sink_m"] = meta["sink_m"] * scale; meta["tpx"] = meta["tpx"] / scale
    n = H.shape[0]; ax = (np.arange(n) - (n - 1) / 2) * meta["grid_m"] * scale
    hmax = float(H.max())
    ys0 = S.strata_heights(front_img, meta, hmax / S.HSCALE, np.random.default_rng(rng_seed))
    ys = [0.0]
    for y in [v * S.HSCALE for v in ys0[1:]]:
        while y - ys[-1] > 5.5: ys.append(ys[-1] + (y - ys[-1]) / np.ceil((y - ys[-1]) / 4.5))
        ys.append(y)
    ys[-1] = hmax
    iz, ix = np.nonzero(H > 0.5); cx, cz = ax[ix].mean(), ax[iz].mean(); cc = np.array([cx, cz])
    rays = 160; th = 2 * np.pi * np.arange(rays) / rays
    windows = windows if windows is not None else []
    # ---- per-bed outline (same tier/notch/skyline logic as v2) -> sections = runs of beds with the same outline
    rcache = {}; beds = []
    for li in range(len(ys) - 1):
        y0, y1 = ys[li], ys[li + 1]; ym = 0.5 * (y0 + y1); tier = int(sum(ym >= t * hmax for t in S.TIERS))
        if tier not in rcache:
            Rt = S.radial(S.clean_mask(H >= S.TIER_LVL[tier] * hmax), ax, cx, cz, rays)
            if tier > 0:
                R0 = S.radial(S.clean_mask(H >= S.TIER_LVL[0] * hmax), ax, cx, cz, rays)
                thb = np.random.default_rng(rng_seed + 99).uniform(0, 2 * np.pi)
                w = 0.3 + 0.7 * (1 + np.cos(th - thb)) / 2
                Rt = np.minimum(R0, R0 + (Rt - R0) * w) if Rt.max() > 1 else Rt
            rcache[tier] = Rt
        R = ndi.median_filter(rcache[tier].copy(), 9, mode="wrap") * S.shape_factor(th, tier, y1, hmax, rng_seed)
        R = ndi.gaussian_filter1d(R, 1.3, mode="wrap")   # rounded massif corners (no box corners; keeps ledge arcs isometric)
        if R.max() < 1.0: break
        beds.append(dict(y0=y0, y1=y1, R=R, hard=(li % 3 == 2) or li == len(ys) - 2, tier=tier))
    sink = meta["sink_m"]
    ug = [dict(y0=-sink + sink * k / 2, y1=-sink + sink * (k + 1) / 2, R=beds[0]["R"], hard=False, tier=0) for k in range(2)]
    beds = ug + beds
    sections = []
    for b in beds:
        if sections and np.allclose(sections[-1]["R"], b["R"]): sections[-1]["beds"].append(b)
        else: sections.append(dict(R=b["R"], beds=[b]))
    # ---- global smooth fields (theta-anchored: identical outlines give identical walls)
    Rm = float(np.median(sections[0]["R"])); Pg = 2 * np.pi * Rm
    frng = np.random.default_rng(rng_seed + 31)
    butt = pnoise(frng, Pg, (52.0, 33.0, 21.0), (1.0, 0.7, 0.45))           # buttress / alcove field (through the tiers)
    bedp = []
    for k, b in enumerate(beds):
        nxt_hard = k + 1 < len(beds) and beds[k + 1]["hard"]
        if b["hard"]: base = frng.uniform(0.55, 1.0)
        elif nxt_hard: base = -frng.uniform(0.25, 0.5)                        # undercut below a caprock bed
        else: base = -frng.uniform(0.05, 0.35)
        bedp.append(dict(base=base, A=pnoise(frng, Pg, (41.0, 23.0, 13.0), (1.0, 0.6, 0.35)), W=pnoise(frng, Pg, (17.0, 9.0), (1.0, 0.5)),
                         elo=frng.uniform(0.22, 0.4), ehi=frng.uniform(0.25, 0.45)))
    def off(k, a, Rs):   # bed k radial offset at polar angle a on a section of median radius Rs
        p = bedp[k]; A = np.clip(0.62 + 0.55 * p["A"](a, Rs), 0.08, 1.25)
        return p["base"] * A + 0.28 * p["W"](a, Rs)
    # joint candidates (theta-anchored, random priority)
    jc_th = []; t_ = 0.0
    while t_ < 2 * np.pi: jc_th.append(t_); t_ += frng.uniform(0.9, 1.6) / Rm
    jc_th = np.array(jc_th); jc_pr = frng.random(len(jc_th))
    M_P, M_A = [], []
    def tri(p, a):
        M_P.extend(p); M_A.extend(a)
    ring_out = []
    sec_geo = []
    for si, sec in enumerate(sections):
        sb = sec["beds"]; kb0 = beds.index(sb[0])
        ybot = sb[0]["y0"] - (0.0 if si == 0 else 0.02); ytop = sb[-1]["y1"]
        R = sec["R"]
        pts = np.stack([cx + np.cos(th) * R, cz + np.sin(th) * R], 1)
        seg = np.linalg.norm(np.roll(pts, -1, 0) - pts, axis=1); arc = np.concatenate([[0], np.cumsum(seg)]); Ptot = float(arc[-1])
        en = np.stack([np.roll(pts, -1, 0)[:, 1] - pts[:, 1], -(np.roll(pts, -1, 0)[:, 0] - pts[:, 0])], 1)
        en /= np.linalg.norm(en, axis=1, keepdims=True) + 1e-9
        vn = en + np.roll(en, 1, 0)
        for _ in range(3): vn = vn + 0.5 * (np.roll(vn, 1, 0) + np.roll(vn, -1, 0))
        vn /= np.linalg.norm(vn, axis=1, keepdims=True) + 1e-9
        if np.mean(np.sum(vn * (pts - cc), 1)) < 0: vn = -vn
        def at(a):   # arc -> point, normal, theta-arc (Rm units) on the reference outline
            a = np.mod(a, Ptot); i = np.clip(np.searchsorted(arc, a, side="right") - 1, 0, rays - 1); t = (a - arc[i]) / np.maximum(seg[i], 1e-9)
            j = (i + 1) % rays
            p = pts[i] + (pts[j] - pts[i]) * t[..., None]; nn = vn[i] + (vn[j] - vn[i]) * t[..., None]; nn /= np.linalg.norm(nn, axis=-1, keepdims=True) + 1e-9
            d = p - cc; return p, nn, np.mod(np.arctan2(d[..., 1], d[..., 0]), 2 * np.pi)
        # joints: greedy on theta-anchored candidates, spacing JSP
        cand_a = np.sort(np.array([arc[min(int(t * rays / (2 * np.pi)), rays - 1)] + seg[min(int(t * rays / (2 * np.pi)), rays - 1)] * ((t * rays / (2 * np.pi)) % 1) for t in jc_th]))
        order = np.argsort([arc[min(int(t * rays / (2 * np.pi)), rays - 1)] + seg[min(int(t * rays / (2 * np.pi)), rays - 1)] * ((t * rays / (2 * np.pi)) % 1) for t in jc_th])
        cpr = jc_pr[order]
        a0 = float(cand_a[int(np.argmax(cpr[:max(1, len(cpr) // 20)]))]) if len(cand_a) else 0.0
        J = [0.0]
        while True:
            lo, hi = J[-1] + JSP[0], J[-1] + JSP[1]
            if Ptot - J[-1] <= JSP[1] + 0.5: break
            ca = np.mod(cand_a - a0, Ptot); sel = np.nonzero((ca >= lo) & (ca <= hi))[0]
            J.append(float(ca[sel[np.argmax(cpr[sel])]]) if len(sel) else J[-1] + 0.5 * (JSP[0] + JSP[1]))
        if len(J) > 1 and Ptot - J[-1] < JSP[0] - 0.5: J.pop()                      # closing span <= 7.5 + 4 m
        if Ptot - J[-1] > JSP[1] + 0.5: J.append(0.5 * (J[-1] + Ptot))
        Jc = [J[0]]
        for v in J[1:]:
            if v - Jc[-1] >= 4.4 and Ptot - v >= 4.4: Jc.append(v)                    # joint strips (<= 2 x 1.9 m) never overlap
        J = Jc
        nJ = len(J); Jn = J + [Ptot]
        jw = [frng.uniform(1.3, 1.9) for _ in range(nJ)]; jd = [frng.uniform(0.3, 0.85) for _ in range(nJ)]
        jy = [pnoise(np.random.default_rng(rng_seed * 7 + si * 131 + q), 60.0, (14.0, 7.0), (1.0, 0.5)) for q in range(nJ)]
        jb = list(jw)   # blend strip = the joint notch itself (texture seams hide in the joint)
        # columns (arc' = arc - a0): joint columns + outline vertices + fill <= COLW
        cols = set()
        for q, Jq in enumerate(J):
            for f in (-jw[q], 0.0, jw[q]): cols.add(round(float(np.mod(Jq + f, Ptot)), 4))
        cols = sorted(cols)
        filled = []
        for k, c in enumerate(cols):
            nx = cols[k + 1] if k + 1 < len(cols) else cols[0] + Ptot
            filled.append(c); g = nx - c; m = int(np.ceil(g / COLW))
            for q in range(1, m): filled.append(c + g * q / m)
        A_ = np.array(filled); A_ = A_[A_ < Ptot - 1e-6]
        if A_[0] > 1e-6: A_ = np.concatenate([[0.0], A_])
        nc = len(A_); Aw = np.concatenate([A_, [Ptot]])                     # unrolled, last = first (closing)
        P0, N0, TA = at(Aw + a0)
        # offset direction = true perpendicular of the column line (offsets never slide along the row -> no shear)
        tg = np.roll(P0[:-1], -1, 0) - np.roll(P0[:-1], 1, 0); tg = np.concatenate([tg, tg[:1]])
        Np = np.stack([tg[:, 1], -tg[:, 0]], 1); Np /= np.linalg.norm(Np, axis=1, keepdims=True) + 1e-9
        N0 = np.where((np.sum(Np * N0, 1) < 0)[:, None], -Np, Np)
        # curvature guard: tight bends of the outline (skyline-drop corners) get a smaller profile amplitude (no folds)
        Pc = P0[:-1]; a_ = np.roll(Pc, 1, 0); c_ = np.roll(Pc, -1, 0)
        la, lb, lc = np.linalg.norm(Pc - a_, axis=1), np.linalg.norm(c_ - Pc, axis=1), np.linalg.norm(c_ - a_, axis=1)
        cr = np.abs((Pc - a_)[:, 0] * (c_ - a_)[:, 1] - (Pc - a_)[:, 1] * (c_ - a_)[:, 0])
        Rc = la * lb * lc / (2 * cr + 1e-9)
        fc = np.clip(Rc / 18.0, 0.1, 1.0)
        fc = ndi.minimum_filter1d(fc, 5, mode="wrap"); fc = ndi.gaussian_filter1d(fc, 2.5, mode="wrap")
        fc = np.concatenate([fc, fc[:1]])
        # joint mask per column (0..1): ledges are eroded inside the joints (the bed profile fades out there)
        gj = np.zeros(len(Aw))
        for q, Jq in enumerate(J):
            dd = np.minimum.reduce([np.abs(Aw - Jq), np.abs(Aw - Jq - Ptot), np.abs(Aw - Jq + Ptot)]) / jw[q]
            gj = np.maximum(gj, np.where(dd < 1, (1 - np.minimum(dd, 1) ** 2) ** 2, 0.0))
        # rows: bed boundaries + transition rows + mid rows; top lip rows
        rowy = [ybot]; rowkind = ["b"]; bedof = []
        for q, b in enumerate(sb):
            k = kb0 + q; T = b["y1"] - b["y0"]; y0_ = max(b["y0"], ybot)
            ehi = min(bedp[k]["ehi"], T / 3) if q > 0 or si > 0 else 0.0
            elo = min(bedp[k + 1]["elo"] if k + 1 < len(beds) else 0.3, T / 3)
            inner = [y0_ + ehi] if ehi > 0 else []
            if T > 4.2: inner.append(0.5 * (y0_ + ehi + b["y1"] - elo))
            if q == len(sb) - 1: inner += [b["y1"] - 0.32]
            else: inner.append(b["y1"] - elo)
            for y_ in inner:
                if y_ > rowy[-1] + 0.05: rowy.append(y_); rowkind.append("i")
            rowy.append(b["y1"]); rowkind.append("b")
        rowy = np.array(rowy); nr = len(rowy)
        bed_at = lambda y: kb0 + min(len(sb) - 1, max(0, int(np.searchsorted([b["y1"] for b in sb], y - 1e-6))))
        # upper section outline (for the top lip chamfer only where a real bench exists)
        Rup = sections[si + 1]["R"] if si + 1 < len(sections) else None
        thc = np.mod(np.arctan2(P0[:, 1] - cz, P0[:, 0] - cx), 2 * np.pi)
        Rhere = np.interp(thc, np.append(th, 2 * np.pi), np.append(R, R[0]))
        bench = np.ones(len(Aw), bool) if Rup is None else (np.interp(thc, np.append(th, 2 * np.pi), np.append(Rup, Rup[0])) < Rhere - 1.0)
        DR = np.zeros((nr, len(Aw)))
        Rs = float(np.median(R)); Bt = butt(TA, Rs)
        for i, y in enumerate(rowy):
            if rowkind[i] == "b" and 0 < i < nr - 1:
                k1 = bed_at(y - 0.01); k2 = bed_at(y + 0.01); o1, o2 = off(k1, TA, Rs), off(k2, TA, Rs)
                v = np.maximum(o1, o2) - 0.12 * np.abs(o1 - o2)
            else:
                v = off(bed_at(y + (0.01 if i == 0 else -0.01)), TA, Rs)
            DR[i] = (v + Bt) * fc
        DR[-1] = np.where(bench, DR[-2] - 0.42, DR[-2])
        # joints: V notch, depth varying with height
        for q, Jq in enumerate(J):
            for jj, a in enumerate(Aw):
                dd = min(abs(a - Jq), abs(a - Jq - Ptot), abs(a - Jq + Ptot)) / jw[q]
                if dd < 1: DR[:, jj] -= fc[jj] * jd[q] * (1 - dd * dd) ** 2
        X = P0[None, :, :] + N0[None, :, :] * DR[..., None]                 # (nr, nc+1, 2)
        Nn = np.broadcast_to(N0[None], X.shape)
        # surface arc lengths: U along rows, V along columns
        # u = arc along the row-mean line (same for every row: no shear across ledges), v = true column arc
        Xm = X.mean(0); Ur = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(Xm, axis=0), axis=1))])
        U = np.broadcast_to(Ur[None, :], (nr, len(Aw)))
        dv = np.sqrt(np.diff(rowy)[:, None] ** 2 + np.linalg.norm(np.diff(X, axis=0), axis=2) ** 2)
        V = np.concatenate([np.zeros((1, len(Aw))), np.cumsum(dv, 0)], 0)
        # window rows: greedy over bed-boundary rows, surface height <= ROW_MAXV
        bidx = [i for i in range(nr) if rowkind[i] == "b"]
        wr = [0]
        for q in range(1, len(bidx)):
            if (V[bidx[q]] - V[wr[-1]]).max() > ROW_MAXV and bidx[q - 1] != wr[-1]: wr.append(bidx[q - 1])
        if wr[-1] != nr - 1: wr.append(nr - 1)
        # split rows still too tall at an inner row
        k = 0
        while k < len(wr) - 1:
            if (V[wr[k + 1]] - V[wr[k]]).max() > 8.6:
                mids = [i for i in range(wr[k] + 1, wr[k + 1]) if (V[i] - V[wr[k]]).max() <= ROW_MAXV]
                wr.insert(k + 1, mids[-1] if mids else wr[k] + 1)
            else: k += 1
        # u per window row: arc along the mean line of THAT row group's rows (closest reference -> least stretch)
        UW = []
        for k in range(len(wr) - 1):
            Xk = X[wr[k]:wr[k + 1] + 1].mean(0); UW.append(np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(Xk, axis=0), axis=1))]))
        if os.environ.get("S2DBG"):
            tgt = np.array([14.93, -31.98]); dd_ = np.linalg.norm(X - tgt, axis=2).min(0); jj = int(np.argmin(dd_))
            if dd_[jj] < 0.3 and rowy[0] < 71 < rowy[-1]:
                for j2 in (jj - 1, jj, jj + 1):
                    print("COL", si, j2, Aw[j2].round(2), "DR", DR[:, j2].round(2).tolist(), file=sys.stderr)
                print("rowy", rowy.round(2).tolist(), "wr", wr, file=sys.stderr)
                for k in range(len(wr) - 1): print("UW", k, [round(UW[k][j2 + 1] - UW[k][j2], 3) for j2 in (jj - 1, jj)], file=sys.stderr)
                print("rowdist", [[round(float(np.linalg.norm(X[i, j2 + 1] - X[i, j2])), 3) for j2 in (jj - 1, jj)] for i in range(nr)], file=sys.stderr)
        rowwin = np.zeros(nr - 1, int)
        for k in range(len(wr) - 1): rowwin[wr[k]:wr[k + 1]] = k
        # column spans: span index per column interval + blend slots
        span_of = lambda a: int(np.searchsorted(Jn, a, side="right") - 1)
        ext = []
        for q in range(nJ):
            s0 = np.mod(J[q] - jb[q], Ptot); s1 = np.mod(Jn[q + 1] + jb[(q + 1) % nJ], Ptot)
            ext.append((int(np.argmin(np.abs(Aw[:-1] - s0))), int(np.argmin(np.abs(Aw[:-1] - s1)))))
        WIN = {}
        def win(r, q):
            if (r, q) in WIN: return WIN[(r, q)]
            ia, ic = wr[r], wr[r + 1]; c0, c1 = ext[q]
            cl = list(range(c0, nc)) + list(range(0, c1 + 1)) if c1 < c0 else list(range(c0, c1 + 1))
            if c1 < c0: cl = list(range(c0, nc + 1)) + list(range(1, c1 + 1))
            Uk = UW[r]; lu = np.mod(Uk[cl] - Uk[c0], Uk[-1])
            if c1 < c0: lu[cl.index(nc)] = Uk[nc] - Uk[c0]
            L = float(lu.max()); h = float((V[ic, cl] - V[ia, cl]).max())
            if os.environ.get("S2DBG") and (L > 16 or h > 9): print("WINBIG", si, r, q, round(L, 2), round(h, 2), len(cl), file=sys.stderr)
            mid = cl[len(cl) // 2]; cen = np.array([X[(ia + ic) // 2, mid, 0], X[(ia + ic) // 2, mid, 1], 0.5 * (rowy[ia] + rowy[ic])])
            pl, u0, v0, fl, tn = window(min(L, 16.0), min(h, 9.0), cen, ("s", si, r, q))
            WIN[(r, q)] = (pl, u0, v0, fl, tn, c0, ia, min(L, 16.0), r); return WIN[(r, q)]
        def window(face_len, h, centre, key, strict=False):
            wr_ = np.random.default_rng(zlib.crc32(repr((rng_seed,) + ((S.WSALT,) if S.WSALT else ()) + key).encode()))
            best = None; bscore = 1e9
            near = [w for w in windows if np.linalg.norm(w["c"] - centre) < S.REPEAT_R]
            for _ in range(900):
                p = ALLOWED[int(wr_.integers(0, len(ALLOWED)))]; vlo = S.VLO.get(p, 0.0)
                if 9.0 - h < vlo - 1e-6: continue
                u0 = wr_.uniform(0, max(0.0, 16.0 - face_len)); v0 = wr_.uniform(vlo, max(vlo, 9.0 - h)); fl = int(wr_.integers(0, 2))
                cand = dict(p=p, u0=u0, v0=v0, fl=fl, L=face_len, h=h, c=np.array(centre), key=key)
                sc_ = window_score(cand, near)
                if sc_ < bscore: best, bscore = cand, sc_
                if sc_ == 0: break
            if strict and (best is None or bscore > 0): return None
            if best is None: best = dict(p=0, u0=0.0, v0=max(0.0, 9.0 - h), fl=0, L=face_len, h=h, c=np.array(centre), key=key)
            best["tone"] = S.window_tone(best["p"], best["u0"], best["v0"], best["L"], best["h"])
            windows.append(best); return best["p"], best["u0"], best["v0"], best["fl"], best["tone"]
        sec_geo.append(dict(window=window))
        def uv(wn, i, j):
            pl, u0, v0, fl, tn, c0, ia, L, r_ = wn; Uk = UW[r_]
            lu = (Uk[j] - Uk[c0]) % Uk[-1] if j != c0 else 0.0
            if j == nc and c0 > 0: lu = Uk[nc] - Uk[c0]
            lu = min(lu, L)
            lv = V[i, j] - V[ia, j]
            return pl, (u0 + ((L - lu) if fl else lu)) * S.PXM, (9.0 - (v0 + lv)) * S.PXM, tn
        # per column interval: (span left, span right, blend weights at both columns)
        cslots = []
        for j in range(nc):
            a, b_ = Aw[j], Aw[j + 1]; mid = 0.5 * (a + b_); q = span_of(mid); qn = (q + 1) % nJ
            if mid < J[q] + jb[q]:
                lo = J[q] - jb[q]; cslots.append(((q - 1) % nJ, q, (a - lo) / (2 * jb[q]), (b_ - lo) / (2 * jb[q])))
            elif mid > Jn[q + 1] - jb[qn]:
                lo = Jn[q + 1] - jb[qn]; cslots.append((q, qn, (a - lo) / (2 * jb[qn]), (b_ - lo) / (2 * jb[qn])))
            else: cslots.append((q, q, 0.0, 0.0))
        def vattr(r, j, i, cs, wv):
            w1 = win(r, cs[0]); w2 = win(r, cs[1])
            p1, x1, y1, t1 = uv(w1, i, j); p2, x2, y2, t2 = uv(w2, i, j); wv = float(np.clip(wv, 0, 1))
            tn = [t1[c] * (1 - wv) + t2[c] * wv for c in range(3)]
            return [p1, x1, y1] + tn + [0.0, 0.0, 0.0, p2, x2, y2, wv]
        CA = [S.CAP, 0, 0, 1, 1, 1, 0, 0, 0, S.CAP, 0, 0, 0]
        G = GRID0 if (rlod == 0 and S.RELIEF is not None) else 0.0
        # cap classification per base triangle (T1 = p10,p00,p01 ; T2 = p10,p01,p11) + relief-free vertex mask
        P3 = np.stack([X[..., 0], np.broadcast_to(rowy[:, None], X.shape[:2]), X[..., 1]], -1)
        def _nyv(a_, b_, c_):
            nn_ = np.cross(b_ - a_, c_ - a_); return np.abs(nn_[..., 1]) / (np.linalg.norm(nn_, axis=-1) + 1e-12)
        C1 = _nyv(P3[:-1, 1:], P3[:-1, :-1], P3[1:, :-1]) > CAPNY
        C2 = _nyv(P3[:-1, 1:], P3[1:, :-1], P3[1:, 1:]) > CAPNY
        for j in range(nc):
            if cslots[j][0] != cslots[j][1]:
                thin = (np.diff(rowy) < 0.5); C1[thin, j] = True; C2[thin, j] = True   # ledge lip inside a joint
        anyc = C1 | C2; Z = np.zeros((nr, len(Aw)), bool)
        Z[:-1, :-1] |= anyc; Z[:-1, 1:] |= anyc; Z[1:, :-1] |= anyc; Z[1:, 1:] |= anyc
        NVROW = [max(1, int(np.ceil(max(np.hypot(rowy[i + 1] - rowy[i], np.linalg.norm(X[i + 1, jj] - X[i, jj])) for jj in range(X.shape[1])) / G))) if G > 0 else 1 for i in range(nr - 1)]
        for i in range(nr - 1):
            r = rowwin[i]; ya, yc = rowy[wr[r]], rowy[wr[r + 1]]
            for j in range(nc):
                cs = cslots[j]
                a00 = vattr(r, j, i, cs, cs[2]); a10 = vattr(r, j + 1, i, cs, cs[3]); a01 = vattr(r, j, i + 1, cs, cs[2]); a11 = vattr(r, j + 1, i + 1, cs, cs[3])
                p00 = [X[i, j, 0], rowy[i], X[i, j, 1]]; p10 = [X[i, j + 1, 0], rowy[i], X[i, j + 1, 1]]
                p01 = [X[i + 1, j, 0], rowy[i + 1], X[i + 1, j, 1]]; p11 = [X[i + 1, j + 1, 0], rowy[i + 1], X[i + 1, j + 1, 1]]
                c1, c2 = bool(C1[i, j]), bool(C2[i, j])   # near-horizontal triangle: world-projected cap plates
                if G <= 0:
                    tri([p10, p00, p01], [CA] * 3 if c1 else [a10, a00, a01]); tri([p10, p01, p11], [CA] * 3 if c2 else [a10, a01, a11])
                    continue
                zq = np.array([Z[i, j], Z[i, j + 1], Z[i + 1, j], Z[i + 1, j + 1]], float)
                nu = max(1, int(np.ceil(np.linalg.norm(P0[j + 1] - P0[j]) / G)))
                nv = NVROW[i]   # same split for the whole row -> no T-junctions on vertical edges
                Pq = np.array([p00, p10, p01, p11], float); Aq = np.array([a00, a10, a01, a11], float)
                Nq = np.array([[Nn[i, j, 0], 0, Nn[i, j, 1]], [Nn[i, j + 1, 0], 0, Nn[i, j + 1, 1]], [Nn[i + 1, j, 0], 0, Nn[i + 1, j, 1]], [Nn[i + 1, j + 1, 0], 0, Nn[i + 1, j + 1, 1]]])
                def interp(Q, s, t):
                    if t == 0: return Q[0] + s * (Q[1] - Q[0])
                    if s == 0: return Q[0] + t * (Q[2] - Q[0])
                    if t == 1: return Q[3] + (1 - s) * (Q[2] - Q[3])
                    if s == 1: return Q[3] + (1 - t) * (Q[1] - Q[3])
                    if s + t <= 1: return Q[0] + s * (Q[1] - Q[0]) + t * (Q[2] - Q[0])
                    return Q[3] + (1 - s) * (Q[2] - Q[3]) + (1 - t) * (Q[1] - Q[3])
                grid = {}
                for l in range(nv + 1):
                    for k in range(nu + 1):
                        s, t = k / nu, l / nv
                        p = interp(Pq, s, t); a = interp(Aq, s, t); nn = interp(Nq, s, t); nn = nn / (np.linalg.norm(nn) + 1e-9)
                        a = list(a); a[0] = a00[0]; a[9] = a00[9]
                        zf = 1.0 - float(interp(zq, s, t))   # relief 0 at vertices touching a cap triangle (watertight)
                        d1 = float(S.sample(S.RELIEF_L[rlod][int(a[0])], np.array(a[1]), np.array(a[2])))
                        d2 = float(S.sample(S.RELIEF_L[rlod][int(a[9])], np.array(a[10]), np.array(a[11]))) if a[12] > 0 else d1
                        d = RELAMP * (d1 * (1 - a[12]) + d2 * a[12])
                        e = min(p[1] - ya, yc - p[1]); tt = np.clip(e / FADE_M, 0, 1); d *= tt * tt * (3 - 2 * tt) * max(zf, 0.0)
                        a[6], a[7], a[8] = nn[0] * d, 0.0, nn[2] * d
                        grid[(k, l)] = (list(p), a)
                for l in range(nv):
                    for k in range(nu):
                        q00, q10, q01, q11 = grid[(k, l)], grid[(k + 1, l)], grid[(k, l + 1)], grid[(k + 1, l + 1)]
                        sA, tA = (k + 2 / 3) / nu, (l + 1 / 3) / nv; sB, tB = (k + 2 / 3) / nu, (l + 2 / 3) / nv   # sub-tri centroids
                        capA = c1 if sA + tA <= 1 else c2; capB = c1 if sB + tB <= 1 else c2
                        tri([q10[0], q00[0], q01[0]], [CA] * 3 if capA else [q10[1], q00[1], q01[1]]); tri([q10[0], q01[0], q11[0]], [CA] * 3 if capB else [q10[1], q01[1], q11[1]])
        # caps: top fan (bench / summit), underside fan for upper sections
        CA = [S.CAP, 0, 0, 1, 1, 1, 0, 0, 0, S.CAP, 0, 0, 0]
        top = [[X[-1, j, 0], ytop, X[-1, j, 1]] for j in range(nc)]
        cy_ = [cx, ytop, cz]
        for j in range(nc):
            tri([cy_, top[(j + 1) % nc], top[j]], [CA] * 3)
        if si > 0:
            bot = [[X[0, j, 0], ybot, X[0, j, 1]] for j in range(nc)]
            for j in range(nc): tri([[cx, ybot, cz], bot[j], bot[(j + 1) % nc]], [CA] * 3)
        rmax = np.linalg.norm(X[:, :nc] - cc, axis=2)
        if si == 0:
            sel = (rowy >= -1.0) & (rowy <= 6.0); kk = np.argmax(np.where(sel[:, None], rmax, -1), 0)
            foot = X[kk, np.arange(nc)]
            sec["foot"] = foot
        kk = np.argmax(rmax, 0); ring_out.append(dict(y0=float(ybot), y1=float(ytop), ring=[[float(p[0]), float(p[1])] for p in X[kk, np.arange(nc)]]))
        if si == 0: ring_out[-1]["ring"] = [[float(p[0]), float(p[1])] for p in sections[0]["foot"]]
    # ---- fallen blocks (as v2) around the foot
    block_start = len(M_P)
    tm = rock_mask(load(top_img)); tcx, tcy = meta["top_c"]; tpx = meta["tpx"]
    base_pts = sections[0]["foot"]; window = sec_geo[0]["window"]
    nblk = {0: 420, 1: 120, 2: 30}[glod]
    brng = np.random.default_rng(rng_seed + 99)
    placed = 0; tries = 0; placed_id = 0
    while placed < nblk and tries < nblk * 30:
        tries += 1
        k = brng.integers(0, len(base_pts)); p = base_pts[k]; dirv = (p - cc) / (np.linalg.norm(p - cc) + 1e-9)
        out = brng.uniform(-0.5, 14.0)
        q = p + dirv * out + brng.normal(0, 2.0, 2)
        col = int(tcx + q[0] * tpx); row = int(tcy - (-q[1]) * tpx)
        if 0 <= row < tm.shape[0] and 0 <= col < tm.shape[1] and not tm[row, col] and brng.random() < 0.8: continue
        big = brng.random() < 0.15
        s = brng.uniform(1.2, 4.0) if big else brng.uniform(0.25, 0.9)
        sx, sy, sz = s * brng.uniform(0.7, 1.4), s * brng.uniform(0.45, 0.9), s * brng.uniform(0.7, 1.4)
        yaw = brng.uniform(0, np.pi); tilt = brng.normal(0, 0.18, 2)
        y = -0.35 * sy
        corners = np.array([[x_, y_, z_] for y_ in (0, 1) for z_ in (-0.5, 0.5) for x_ in (-0.5, 0.5)], float)
        corners *= [sx, sy, sz]; corners += brng.uniform(-0.14, 0.14, corners.shape) * s   # v10: rougher, less crate-like
        cy, sy_ = np.cos(yaw), np.sin(yaw)
        Rm_ = np.array([[cy, 0, sy_], [0, 1, 0], [-sy_, 0, cy]])
        Rt = np.array([[1, 0, 0], [0, np.cos(tilt[0]), -np.sin(tilt[0])], [0, np.sin(tilt[0]), np.cos(tilt[0])]])
        W_ = (corners @ Rt.T) @ Rm_.T + [q[0], y, q[1]]
        faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
        quads = []; nwin0 = len(windows); skip = False
        for f in faces:
            a_, b_, c_, d_ = [W_[i] for i in f]
            ex = b_ - a_; ex /= np.linalg.norm(ex); nq = np.cross(b_ - a_, d_ - a_); ey = np.cross(nq, ex); ey /= np.linalg.norm(ey)
            uvq = [(float(np.dot(p_ - a_, ex)), float(np.dot(p_ - a_, ey))) for p_ in (a_, b_, c_, d_)]
            umin = min(u for u, _ in uvq); vmin = min(v for _, v in uvq); uvq = [(u - umin, v - vmin) for u, v in uvq]
            ul = max(u for u, _ in uvq); vl = max(v for _, v in uvq)
            if s >= 1.2:
                wv = window(min(ul, 16), min(vl, 9), np.append(q, 0.0), ("b", placed_id, tuple(f)), strict=True)
                if wv is None: skip = True; break
                pl, u0, v0, _fl, tn = wv
                A = (lambda pl, u0, v0, tn: (lambda u, v: [pl, (u0 + u) * S.PXM, (9.0 - (v0 + v)) * S.PXM] + list(tn) + [0, 0, 0, pl, (u0 + u) * S.PXM, (9.0 - (v0 + v)) * S.PXM, 0]))(pl, u0, v0, tn)
            else:
                # v10: each face gets a randomly ROTATED crop (strata lines no longer all horizontal = no plank/crate read)
                rr = 0.5 * np.hypot(ul, vl); th = brng.uniform(0, 2 * np.pi); ct, st_ = np.cos(th), np.sin(th)
                cu = brng.uniform(min(rr, 2.0), max(min(rr, 2.0), 4.0 - rr)); cv = brng.uniform(min(0.75 + rr, 1.5), max(min(0.75 + rr, 1.5), 2.25 - rr))
                tnb = list(brng.uniform(0.85, 1.05) * np.array([1.0, 0.97, 0.95]))
                A = (lambda cu, cv, ct, st_, tnb, ul, vl: (lambda u, v: (lambda U, V: [S.BLOCK_ID, U * S.BLOCK_PXM, (2.25 - V) * S.BLOCK_PXM] + tnb + [0, 0, 0, S.BLOCK_ID, U * S.BLOCK_PXM, (2.25 - V) * S.BLOCK_PXM, 0])(
                    cu + ct * (u - ul / 2) - st_ * (v - vl / 2), cv + st_ * (u - ul / 2) + ct * (v - vl / 2))))(cu, cv, ct, st_, tnb, ul, vl)
            quads.append((list(a_), list(b_), list(c_), list(d_), [A(u, v) for u, v in uvq]))
        if skip:
            del windows[nwin0:]; placed_id += 1; continue
        for a_, b_, c_, d_, aa in quads:
            tri([a_, b_, c_], [aa[0], aa[1], aa[2]]); tri([a_, c_, d_], [aa[0], aa[2], aa[3]])
        placed += 1; placed_id += 1
    P = np.array(M_P, np.float32); At = np.array(M_A, np.float32)
    t3 = P.reshape(-1, 3, 3); ar = 0.5 * np.linalg.norm(np.cross(t3[:, 1] - t3[:, 0], t3[:, 2] - t3[:, 0]), axis=1)
    qq = np.round(t3 / 1e-3).astype(np.int64)
    coll = (qq[:, 0] == qq[:, 1]).all(1) | (qq[:, 1] == qq[:, 2]).all(1) | (qq[:, 0] == qq[:, 2]).all(1)
    keep = (ar > 1e-5) & ~coll; nb_ = block_start // 3; keep[nb_:] = True
    block_start = int(keep[:nb_].sum()) * 3
    P = t3[keep].reshape(-1, 3); At = At.reshape(-1, 3, At.shape[-1])[keep].reshape(-1, At.shape[-1])
    P[:, 2] *= -1; At[:, 8] *= -1
    P = P.reshape(-1, 3, 3)[:, [0, 2, 1]].reshape(-1, 3)
    At = At.reshape(-1, 3, At.shape[-1])[:, [0, 2, 1]].reshape(-1, At.shape[-1])
    ring_out.sort(key=lambda r: r["y1"])
    return P, At, dict(blockStart=block_start, strata=ys, layers=len(sections), blocks=placed, rings=ring_out), windows

if __name__ == "__main__":
    prefix, front_img, top_img, out = sys.argv[1:5]
    scale = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0; seed = int(sys.argv[6]) if len(sys.argv) > 6 else 1008
    if len(sys.argv) > 7 and sys.argv[7] != "-":
        S.load_relief(sys.argv[7], S.WALLS)
    blobs = []; info = {"lods": [], "scale": scale, "seed": seed, "stride": 16, "walls": S.WALLS, "lodMode": "same-shell+relief-attr", "method": "continuous-strata-v10"}; off = 0
    for lod in (0, 1):
        P, At, meta, windows = build(prefix, front_img, top_img, lod, rng_seed=seed, windows=[], scale=scale)
        info.setdefault("windows", []).append([[w["p"], round(w["u0"], 2), round(w["v0"], 2), round(float(w["c"][0]), 1), round(float(w["c"][1]), 1)] for w in windows])
        Pd = P + At[:, 6:9]
        st = S.stretch_px(Pd, At); st.update(S.winding(Pd, At, meta["blockStart"])); st.update(S.topo(Pd))
        bl = At.reshape(-1, 3, 13)[:, :, 12].max(1) > 0; idx = np.repeat(bl, 3)
        if idx.any():
            A2 = At[idx][:, [9, 10, 11]]; st2 = S.stretch_px(Pd[idx], A2)
            st["blendMinPxPerM"] = st2["minPxPerM"]; st["blendMaxStretch"] = st2["maxStretch"]
            st["minPxPerM"] = min(st["minPxPerM"], st2["minPxPerM"]); st["maxStretch"] = max(st["maxStretch"], st2["maxStretch"])
        st["sameShell"] = True
        st["relief"] = S.RELIEF is not None and lod == 0
        info["lods"].append(dict(lod=lod, tris=len(P) // 3, offset=off, verts=len(P), stretch=st, **{k: meta[k] for k in ("layers", "blocks", "blockStart")}))
        if lod == 0:
            W_ = windows; clash = 0; adj = 0
            C = np.array([w["c"] for w in W_])
            for i_ in range(len(W_)):
                dd = np.linalg.norm(C[i_ + 1:] - C[i_], axis=1)
                for j_ in np.nonzero(dd < S.REPEAT_R)[0] + i_ + 1:
                    a_, b_ = W_[i_], W_[j_]
                    if GROUP[int(a_["p"])] != GROUP[int(b_["p"])]: continue
                    if dd[j_ - i_ - 1] < S.ADJ_R and S.overlap(a_, b_) > 0.0: adj += 1
                    elif a_["fl"] == b_["fl"] and S.overlap(a_, b_) > 0.5: clash += 1
            # honest count (near-duplicate plates = same image) next to the per-plate-id count the gate used for v57
            clg = 0; adg = 0
            for i_ in range(len(W_)):
                dd = np.linalg.norm(C[i_ + 1:] - C[i_], axis=1)
                for j_ in np.nonzero(dd < S.REPEAT_R)[0] + i_ + 1:
                    a_, b_ = W_[i_], W_[j_]
                    if a_["p"] != b_["p"]: continue
                    if dd[j_ - i_ - 1] < S.ADJ_R and S.overlap(a_, b_) > 0.0: adg += 1
                    elif a_["fl"] == b_["fl"] and S.overlap(a_, b_) > 0.5: clg += 1
            info["repeatClashGroups"] = clash; info["adjSameGroup"] = adj
            clash, adj = clg, adg
            info["adjSamePlate"] = adj; info["repeatClash"] = clash; info["windowsN"] = len(W_); info["plateGroups"] = {S.WALLS[i]: S.WALLS[GROUP[i]] for i in range(S.NW)}; info["excluded"] = sorted(EXCLUDE)
            info["strata"] = meta["strata"]; info["rings"] = meta["rings"]
        blobs.append(np.concatenate([P, At], 1).astype(np.float32).ravel()); off += len(P)
    # LOD2 slot kept for format compatibility (= LOD1)
    info["lods"].append(dict(info["lods"][1], lod=2, offset=info["lods"][0]["verts"])); 
    np.concatenate(blobs).tofile(out + ".bin")
    json.dump(info, open(out + "-geo.json", "w"))
    print(json.dumps({k: v for k, v in info.items() if k not in ("rings", "windows")}, indent=1))
