"""tools/keysheet/props.py - the FIXED generic property set measured for EVERY auto-detected element of ANY key
(and, with the same code, for the same element region of a render). No per-zone or per-class special cases.

props(ctx, mask) -> flat dict of numbers, grouped by prefix:
  outline.*   area_px, w_px, h_px, aspect, extent (area/bbox), radial signature (16 bins, scale-free)
  size.*      w_m, h_m (pixel footprint at the element's depth; NA without depth)
  depth.*     z_m (median), protrusion_m (ring depth - element depth, + = stands proud), thick_px, thick_m
  parts.*     sub-parts from joints (black-hat joint map): n, w_px, h_px (median), joint_w_px, joint_frac,
              bond (median offset of joints between adjacent rows, 0 = stacked, 0.5 = running bond),
              part_protrusion_m (joint depth - part depth)
  edge.*      rough (excess perimeter over hull), straight (share of outline in long straight runs),
              orient_H (gradient-orientation entropy, low = regular/too clean)
  col.*       L, a, b (mean), L_std
  tex.*       hp_std, fft_peak
  wear.*      snow_frac, dark_frac (relative to the KEY's own value percentiles, passed in ctx)
  rel.*       on_top (share of the element's bottom border resting on a non-sky region), rooted (share of its
              top border attached to snow/ice), nb_dx, nb_dy (offset to nearest same-class neighbour, element sizes)
ctx = Ctx(img_bgr, depth or None, focal_px, ref) where ref holds the key's percentiles so key and render use the
same thresholds."""
import math
import numpy as np, cv2
from skimage.color import rgb2lab


class Ctx:
    def __init__(self, bgr, depth=None, focal=None, ref=None):
        self.bgr = bgr; self.H, self.W = bgr.shape[:2]
        self.lab = rgb2lab(bgr[:, :, ::-1] / 255.0).astype(np.float32); L = self.lab[..., 0]
        self.ref = ref or {"Lp85": float(np.percentile(L, 85)), "Lp55": float(np.percentile(L, 55)), "Lp10": float(np.percentile(L, 10)),
                           "Ap10": float(np.percentile(self.lab[..., 1], 10)), "Lp99": float(np.percentile(L, 99))}
        self.depth = depth; self.f = focal or (self.W / 2) / math.tan(math.radians(60) / 2)
        self.gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
        top = L - cv2.GaussianBlur(L, (0, 0), 12)
        self.snow = (L > self.ref["Lp85"]) | ((top > 7) & (L > self.ref["Lp55"]))
        self.ice = (self.lab[..., 1] < self.ref["Ap10"]) & (L > 25) & ~self.snow
        self.dark = L < self.ref["Lp10"]
        self.joint = cv2.morphologyEx(L, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 6
        self.hp = self.gray - cv2.GaussianBlur(self.gray, (0, 0), 3)
        gx, gy = cv2.Sobel(self.gray, cv2.CV_32F, 1, 0), cv2.Sobel(self.gray, cv2.CV_32F, 0, 1)
        self.ang, self.mag = np.arctan2(gy, gx) % np.pi, np.hypot(gx, gy)


def _outline(M):
    cs, _ = cv2.findContours(M.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cs:
        return 0.0, 0.0, np.zeros(16)
    c = max(cs, key=cv2.contourArea); per = cv2.arcLength(c, True); hull = cv2.arcLength(cv2.convexHull(c), True)
    ap = cv2.approxPolyDP(c, 1.5, True); seg = np.linalg.norm(np.diff(np.r_[ap[:, 0], ap[:1, 0]], axis=0), axis=1)
    p = c[:, 0].astype(float); ctr = p.mean(0); d = p - ctr; ang = np.arctan2(d[:, 1], d[:, 0]); r = np.hypot(*d.T)
    sig = np.array([r[(ang >= a) & (ang < a + math.pi / 8)].max() if ((ang >= a) & (ang < a + math.pi / 8)).any() else 0
                    for a in np.linspace(-math.pi, math.pi, 17)[:-1]])
    sig = sig / (sig.max() + 1e-6)
    return float(per / max(hull, 1) - 1), float(seg[seg > 25].sum() / max(per, 1)), sig


def _runs(M):
    xs = np.nonzero(M.any(0))[0]; runs = []
    for x in xs[:: max(1, len(xs) // 40)]:
        dd = np.diff(np.r_[0, M[:, x].astype(np.int8), 0]); runs += list(np.nonzero(dd == -1)[0] - np.nonzero(dd == 1)[0])
    return float(np.median(runs)) if runs else 0.0


def _period(sig, lo=4):
    """dominant repeat length (px) of a 1-D edge-energy signal: first autocorrelation peak after `lo`."""
    s = sig - sig.mean()
    if len(s) < 3 * lo or not s.any():
        return 0.0
    ac = np.correlate(s, s, "full")[len(s) - 1:]; ac /= ac[0] + 1e-9
    for t in range(lo, len(ac) // 2):
        if ac[t] > ac[t - 1] and ac[t] >= ac[t + 1] and ac[t] > 0.05:
            return float(t)
    return 0.0


def _med(a):
    a = a[np.isfinite(a)]; return float(np.median(a)) if len(a) else float("nan")


def props(ctx, M, cls_maps=None):
    ys, xs = np.nonzero(M)
    if len(xs) < 6:
        return None
    p = 6; x0, y0, x1, y1 = max(xs.min() - p, 0), max(ys.min() - p, 0), min(xs.max() + p + 1, ctx.W), min(ys.max() + p + 1, ctx.H)
    m = M[y0:y1, x0:x1]; sl = (slice(y0, y1), slice(x0, x1)); o = {}
    area = int(m.sum()); w, h = int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)
    rough, straight, sig = _outline(m)
    o["_cx"], o["_cy"] = float(xs.mean()), float(ys.mean())
    o.update({"outline.area_px": area, "outline.w_px": w, "outline.h_px": h, "outline.aspect": w / h, "outline.extent": area / (w * h)})
    for i, v in enumerate(sig):
        o[f"outline.sig{i:02d}"] = float(v)
    th = _runs(m); o["depth.thick_px"] = th
    if ctx.depth is not None:
        Z = ctx.depth[sl]; z = _med(Z[m]); ring = cv2.dilate(m.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & ~m
        o["depth.z_m"] = z; o["depth.protrusion_m"] = _med(Z[ring]) - z if ring.any() else 0.0
        pxm = z / ctx.f; o["size.w_m"], o["size.h_m"], o["depth.thick_m"] = w * pxm, h * pxm, th * pxm
    # sub-parts (blocks / segments) separated by joints
    J = ctx.joint[sl] & m; part = (m & ~J).astype(np.uint8)
    part = cv2.erode(part, np.ones((2, 2), np.uint8))
    n, cc, st, cen = cv2.connectedComponentsWithStats(part)
    keep = [i for i in range(1, n) if st[i][4] >= 20]
    o["parts.n"] = len(keep); o["parts.joint_frac"] = float(J.sum() / max(area, 1))
    o["parts.joint_w_px"] = float(2 * J.sum() / max(np.count_nonzero(cv2.Canny(J.astype(np.uint8) * 255, 1, 2)), 1)) if J.any() else 0.0   # area / half outline
    if keep:
        W_ = np.array([st[i][2] for i in keep]); H_ = np.array([st[i][3] for i in keep])
        o["parts.w_px"], o["parts.h_px"] = float(np.median(W_)), float(np.median(H_))
        # bond: cluster parts into rows by centre y, compare left edges of adjacent rows
        cy = np.array([cen[i][1] for i in keep]); lx = np.array([st[i][0] for i in keep]); hm = max(np.median(H_), 2)
        order = np.argsort(cy); rows, cur = [], [order[0]]
        for a, b in zip(order[:-1], order[1:]):
            (cur.append(b) if cy[b] - cy[a] < hm / 2 else (rows.append(cur), cur := [b]))
        rows.append(cur); offs = []
        wm = max(np.median(W_), 2)
        for r1, r2 in zip(rows[:-1], rows[1:]):
            for i in r2:
                d = np.min(np.abs(lx[r1] - lx[i])) / wm; offs.append(min(d, 0.5))
        o["parts.bond"] = float(np.median(offs)) if offs else 0.0
        if ctx.depth is not None and J.any():
            Z = ctx.depth[sl]; o["parts.part_protrusion_m"] = _med(Z[J]) - _med(Z[part.astype(bool)])
    else:
        o["parts.w_px"] = o["parts.h_px"] = 0.0; o["parts.bond"] = 0.0
    # sub-part repeat (block width / course height) from edge-energy periodicity: robust where joints are unclear
    gxa = np.abs(cv2.Sobel(ctx.gray[sl], cv2.CV_32F, 1, 0)) * m; gya = np.abs(cv2.Sobel(ctx.gray[sl], cv2.CV_32F, 0, 1)) * m
    o["parts.period_x_px"] = _period(gxa.sum(0) / np.maximum(m.sum(0), 1)); o["parts.period_y_px"] = _period(gya.sum(1) / np.maximum(m.sum(1), 1))
    o["edge.rough"], o["edge.straight"] = rough, straight
    h_ = np.histogram(ctx.ang[sl][m], 12, (0, np.pi), weights=ctx.mag[sl][m])[0] + 1e-6; h_ /= h_.sum()
    o["edge.orient_H"] = float(-(h_ * np.log(h_)).sum() / np.log(12))
    lab = ctx.lab[sl][m]; o["col.L"], o["col.a"], o["col.b"] = (float(v) for v in lab.mean(0)); o["col.L_std"] = float(lab[:, 0].std())
    o["tex.hp_std"] = float(ctx.hp[sl][m].std())
    g = ctx.gray[sl] * m; F = np.abs(np.fft.fft2(g - g[m].mean() * m)); F[0, 0] = 0; o["tex.fft_peak"] = float(F.max() / (F.mean() + 1e-6))
    # appearance / lighting set
    Lm = lab[:, 0]; hi = Lm >= np.percentile(Lm, 40)
    o["albedo.L"], o["albedo.a"], o["albedo.b"] = (float(v) for v in lab[hi].mean(0))          # lit-part colour ~ albedo
    p10, p90 = np.percentile(Lm, [10, 90]); o["light.lit_shadow"] = float((p90 + 5) / (p10 + 5))
    yy, xx = np.nonzero(m); w8 = ctx.lab[sl][..., 0][m] - Lm.mean()
    vx, vy = float((w8 * (xx - xx.mean())).sum()), float((w8 * (yy - yy.mean())).sum())
    o["light.dir_x"], o["light.dir_y"] = (vx / (math.hypot(vx, vy) + 1e-6), vy / (math.hypot(vx, vy) + 1e-6)) if math.hypot(vx, vy) > 1e-3 * len(w8) else (0.0, 0.0)
    below = np.zeros_like(m)
    for x in colsx_ if (colsx_ := np.nonzero(m.any(0))[0]).size else []:
        yb = np.nonzero(m[:, x])[0].max(); below[yb + 1: min(yb + 1 + max(3, h // 3), m.shape[0]), x] = True
    below &= ~m
    o["shadow.cast_frac"] = float(ctx.dark[sl][below].mean()) if below.any() else 0.0
    o["shadow.cast_L"] = float(ctx.lab[sl][..., 0][below].mean()) if below.any() else o["col.L"]
    C = np.hypot(lab[:, 1], lab[:, 2]); o["gloss.spec_frac"] = float(((Lm > ctx.ref["Lp99"]) & (C < 8)).mean())
    cr = cv2.dilate(cv2.Canny(ctx.gray[sl].astype(np.uint8), 40, 110), np.ones((3, 3), np.uint8)).astype(bool) & m
    o["ao.crease_ratio"] = float((ctx.lab[sl][..., 0][cr].mean() + 5) / (Lm.mean() + 5)) if cr.any() else 1.0
    o["haze.black_L"] = float(np.percentile(Lm, 5)); o["haze.chroma"] = float(C.mean())
    fr = np.abs(np.fft.fft2(g - g[m].mean() * m)); fr[0, 0] = 0
    fy_, fx_ = np.meshgrid(np.fft.fftfreq(g.shape[0]), np.fft.fftfreq(g.shape[1]), indexing="ij"); rad = np.hypot(fy_, fx_)
    o["tex.grain_freq"] = float((fr * rad).sum() / (fr.sum() + 1e-6))
    o["wear.snow_frac"] = float(ctx.snow[sl][m].mean()); o["wear.dark_frac"] = float(ctx.dark[sl][m].mean())
    # relations (from the image itself, so render and key are measured the same way)
    bot = np.zeros_like(m); top = np.zeros_like(m)
    colsx = np.nonzero(m.any(0))[0]
    for x in colsx:
        yy = np.nonzero(m[:, x])[0]; bot[min(yy.max() + 2, m.shape[0] - 1), x] = 1; top[max(yy.min() - 2, 0), x] = 1
    o["rel.on_top"] = float((~ctx.snow[sl] & ~ctx.ice[sl])[bot.astype(bool)].mean()) if bot.any() else 0.0   # resting on non-snow (stone/ground)
    o["rel.rooted"] = float((ctx.snow[sl] | ctx.ice[sl])[top.astype(bool)].mean()) if top.any() else 0.0
    return o


def ring_mean(ctx, M, p=6):
    ring = cv2.dilate(M.astype(np.uint8), np.ones((2 * p + 1, 2 * p + 1), np.uint8)).astype(bool) & ~M
    return ctx.lab[ring].mean(0).tolist() if ring.any() else ctx.lab.reshape(-1, 3).mean(0).tolist()


def region(ctx, M, el_lab, ring_lab, p=6):
    """the element as it appears in THIS image: inside the key mask grown by p px, pixels nearer the key element's
    colour than its key surround, keeping components that touch the key mask. Run on key and render alike."""
    ys, xs = np.nonzero(M)
    x0, y0, x1, y1 = max(xs.min() - p, 0), max(ys.min() - p, 0), min(xs.max() + p + 1, ctx.W), min(ys.max() + p + 1, ctx.H)
    m = M[y0:y1, x0:x1]; g = cv2.dilate(m.astype(np.uint8), np.ones((2 * p + 1, 2 * p + 1), np.uint8)).astype(bool)
    lab = ctx.lab[y0:y1, x0:x1]
    S = g & (((lab - el_lab) ** 2).sum(-1) < ((lab - ring_lab) ** 2).sum(-1))
    n, cc = cv2.connectedComponents(S.astype(np.uint8))
    hit = np.unique(cc[S & m]); out = np.zeros_like(M)
    out[y0:y1, x0:x1] = np.isin(cc, hit[hit > 0])
    return out


def relations(els, P, classes):
    """rel.nb_dx / rel.nb_dy: offset to the nearest same-class neighbour in units of the element's own size,
    from the region centroids measured in THIS image (key or render), same rule for every element."""
    C = [(p["_cx"], p["_cy"]) if p else None for p in P]
    for i, p in enumerate(P):
        if not p:
            continue
        best = None
        for j, q in enumerate(C):
            if j == i or q is None or classes[j] != classes[i]:
                continue
            d = math.dist(C[i], q)
            if best is None or d < best[0]:
                best = (d, q)
        if best:
            p["rel.nb_dx"] = min(abs(best[1][0] - C[i][0]) / max(p["outline.w_px"], 1), 5.0)
            p["rel.nb_dy"] = min(abs(best[1][1] - C[i][1]) / max(p["outline.h_px"], 1), 5.0)


# ---- comparison: one rule per property family, the same for every element of every key
def _lin(v, good, bad):
    return float(np.clip(100 * (v - bad) / (good - bad), 0, 100)) if good != bad else 100.0


def compare(k, r):
    """per-property 0..100 scores for render props r vs key props k (both from props()). Missing render = 0."""
    if r is None:
        return {"present": 0.0}
    s = {}
    lr = lambda a, b, lo=1e-3: abs(math.log((abs(a) + lo) / (abs(b) + lo)))
    for key, kv in k.items():
        if key not in r or kv is None or (isinstance(kv, float) and math.isnan(kv)):
            continue
        rv = r[key]
        if isinstance(rv, float) and math.isnan(rv):
            s[key] = 0.0; continue
        fam = key.split(".")[0]
        if key.startswith("outline.sig") or key.startswith("_") or key in s:
            continue
        if key in ("col.L", "col.a", "col.b") or key.startswith(("albedo.", "light.dir")):
            continue
        if key in ("parts.period_x_px", "parts.period_y_px"):
            s[key] = 100.0 if kv == 0 else _lin(lr(rv, kv, 1.0), math.log(1.3), math.log(2.5))
        elif fam in ("outline", "size") or key in ("depth.thick_px", "depth.thick_m", "parts.w_px", "parts.h_px", "parts.joint_w_px", "tex.hp_std", "col.L_std"):
            s[key] = _lin(lr(rv, kv, 1.0 if key.endswith("px") else 0.02), math.log(1.3), math.log(2.5))
        elif key in ("depth.z_m",):
            s[key] = _lin(lr(rv, kv), math.log(1.15), math.log(1.6))
        elif key in ("depth.protrusion_m", "parts.part_protrusion_m"):
            s[key] = _lin(abs(rv - kv), 0.05 + 0.25 * abs(kv), 0.25 + 0.75 * abs(kv))
        elif key == "parts.n":
            s[key] = _lin(abs(math.log((rv + 1) / (kv + 1))), math.log(1.5), math.log(3))
        elif key == "edge.rough":
            s[key] = 100.0 if kv < 0.02 else _lin(rv / kv, 0.6, 0.2) if rv < kv else _lin(rv / kv, 1.67, 5)
        elif key in ("light.lit_shadow", "ao.crease_ratio", "tex.grain_freq"):
            s[key] = _lin(lr(rv, kv), math.log(1.2), math.log(2.0))
        elif key in ("shadow.cast_L", "haze.black_L", "haze.chroma"):
            s[key] = _lin(abs(rv - kv), 6, 20)
        elif key in ("shadow.cast_frac", "gloss.spec_frac"):
            s[key] = _lin(abs(rv - kv), 0.1, 0.4)
        elif key in ("rel.nb_dx", "rel.nb_dy"):
            s[key] = _lin(abs(rv - kv), 0.3, 1.2)
        elif key in ("edge.straight", "edge.orient_H", "parts.bond", "parts.joint_frac") or fam in ("wear", "rel"):
            s[key] = _lin(abs(rv - kv), 0.1, 0.4)
        elif key == "tex.fft_peak":
            s[key] = _lin(lr(rv, kv), math.log(1.5), math.log(3))
    # colour as one dE, outline signature as one correlation
    s["albedo.dE"] = _lin(math.dist([k["albedo.L"], k["albedo.a"], k["albedo.b"]], [r["albedo.L"], r["albedo.a"], r["albedo.b"]]), 10, 30)
    if abs(k["light.dir_x"]) + abs(k["light.dir_y"]) > 0:
        s["light.dir"] = _lin(math.degrees(math.acos(np.clip(k["light.dir_x"] * r["light.dir_x"] + k["light.dir_y"] * r["light.dir_y"], -1, 1))), 30, 90)
    s["col.dE"] = _lin(math.dist([k["col.L"], k["col.a"], k["col.b"]], [r["col.L"], r["col.a"], r["col.b"]]), 10, 30)
    ks = np.array([k[f"outline.sig{i:02d}"] for i in range(16)]); rs = np.array([r[f"outline.sig{i:02d}"] for i in range(16)])
    s["outline.sig"] = _lin(float(np.abs(ks - rs).mean()), 0.1, 0.35)
    return s
