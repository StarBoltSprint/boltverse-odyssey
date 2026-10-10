"""Building profile of the depth-relief module: quantised DA-V2 insets -> a welded hard-surface tower.

Same shell at LOD0 and LOD1. Variant B flips the shear and the hole. Relief is INTO the live outer box
(slabs and ribs are the outer plane; bays and the field step back) so the gate ratios stay put.
Planes are planar. Steps are vertical (before the mild taper). Chrome is a vertex colour on the step
walls. Cell borders stay a single edge (mitered frames) so neighbours weld. The through-hole is an
axis-aligned chrome tunnel on those same edges, plus a lintel beam whose ends are a mitered hole in
the jamb so the beam is not a floating box.

python3 hard_surface.py --relief DIR --out DIR [--modules m2,m3,m4,m6]
"""
import argparse, json, os, struct, zlib
import numpy as np

GRAPHITE = (0.22, 0.22, 0.24)
CHROME = (1.0, 0.92, 0.84)
INTERIOR = (0.16, 0.17, 1.0)   # B > 0.5 -> hole jamb (with a bevel normal)
LIVE = os.environ.get("ZB_LIVE_OBJECTS", "/workspace/zb-preview-1008/objects1")
TEX = os.path.join(LIVE, "tex")
# Pool order matches facade-sections-t7.mjs (ground, new ground, upper, new upper). Plates 1, 11, 14 stay out.
POOL = (
    ["sec/9.jpg", "sec/10.jpg", "sec/12.jpg", "sec/13.jpg"]
    + ["sec5/g1.jpg", "sec5/g2.jpg", "sec5/g3.jpg"]
    + [f"sec/{n}.jpg" for n in [2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]]
    + ["sec5/u4.jpg", "sec5/u5.jpg", "sec5/u6.jpg", "sec5/u7.jpg"]
)
SEC_LOW, SEC = 7.2, 12.0
LOW_BAND = 14.4
TAPER = 0.16
SHEAR = 0.22          # drop / height, high corner stays at full height
FIELD = 0.36          # field recess so the outer ribs/slabs read ~0.36 m proud
SLAB_H = 0.46
RIB_W = 0.34
BAY_MIN = 0.45


def live_extent(mod):
    """LOD0 outer box of the live GLB (read-only). Centred by the runtime; we match w/h/d."""
    p = os.path.join(LIVE, mod, mod + ".glb")
    b = open(p, "rb").read()
    jlen = struct.unpack_from("<I", b, 12)[0]
    j = json.loads(b[20:20 + jlen])
    for n in j["nodes"]:
        if n.get("name", "").endswith("_LOD0") and n.get("mesh") is not None:
            acc = j["accessors"][j["meshes"][n["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
            mn, mx = acc["min"], acc["max"]
            return dict(w=mx[0] - mn[0], h=mx[1] - mn[1], d=mx[2] - mn[2])
    raise SystemExit(f"no LOD0 in {p}")


def _imul(a, b):
    return (a * b) & 0xFFFFFFFF


def face_seed(mod, face):
    h = 2166136261
    for ch in f"{mod}#{face}":
        h = _imul(h ^ ord(ch), 16777619)
    return h & 0xFFFFFFFF


def permute(seq, seed):
    a = list(seq)
    s = seed or 1
    for i in range(len(a) - 1, 0, -1):
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        j = s % (i + 1)
        a[i], a[j] = a[j], a[i]
    return a


class Mesh:
    def __init__(self):
        self.verts, self.cols, self.tris, self._ix = [], [], [], {}

    def V(self, x, y, z, col):
        k = (round(x, 4), round(y, 4), round(z, 4), tuple(round(c, 3) for c in col))
        i = self._ix.get(k)
        if i is None:
            i = len(self.verts)
            self._ix[k] = i
            self.verts.append([float(x), float(y), float(z)])
            self.cols.append(tuple(col))
        return i

    def quad(self, pts, col, outward):
        a, b, c, d = [tuple(p) for p in pts]
        ax, ay, az = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        bx, by, bz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx, ny, nz = ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx
        if nx * nx + ny * ny + nz * nz < 1e-12:
            return
        if nx * outward[0] + ny * outward[1] + nz * outward[2] < 0:
            a, b, c, d = a, d, c, b
        i0, i1, i2, i3 = (self.V(*p, col) for p in (a, b, c, d))
        if len({i0, i1, i2}) == 3:
            self.tris.append((i0, i1, i2))
        if len({i0, i2, i3}) == 3:
            self.tris.append((i0, i2, i3))

    def taper(self, H, k=TAPER):
        for v in self.verts:
            s = 1.0 - k * (max(0.0, v[1]) / H)
            v[0] *= s
            v[2] *= s

    def stats(self):
        """Open / non-manifold after a 1 mm position weld (same key as the object gate). Colour splits weld."""
        edges, pos, deg = {}, {}, 0

        def wid(i):
            x, y, z = self.verts[i]
            k = (int(round(x * 1000)), int(round(y * 1000)), int(round(z * 1000)))
            if k not in pos:
                pos[k] = len(pos)
            return pos[k]

        for t in self.tris:
            v = [wid(i) for i in t]
            if len(set(v)) < 3:
                deg += 1
                continue
            for a, b in ((v[0], v[1]), (v[1], v[2]), (v[2], v[0])):
                e = (a, b) if a < b else (b, a)
                edges[e] = edges.get(e, 0) + 1
        open_ = sum(1 for n in edges.values() if n == 1)
        nm = sum(1 for n in edges.values() if n > 2)
        V = np.asarray(self.verts, np.float64) if self.verts else np.zeros((0, 3))
        ext = (V.max(0) - V.min(0)).tolist() if len(V) else [0, 0, 0]
        return dict(tris=len(self.tris), verts=len(self.verts), open=open_, nonManifold=nm, degenerate=deg,
                    ext=[round(x, 4) for x in ext], min=[round(x, 4) for x in (V.min(0).tolist() if len(V) else [0, 0, 0])])


def axis_lines(span, origin):
    """Union of the 7.2 m and 12 m section edges across `span`, slivers merged, both ends included."""
    xs = {0.0, span}
    for step in (SEC_LOW, SEC):
        x = 0.0
        while x < span - 1e-4:
            x = min(span, x + step)
            xs.add(round(x, 4))
    xs = sorted(xs)
    out = [xs[0]]
    for v in xs[1:]:
        if v - out[-1] < 0.45 and v < span - 1e-4:
            continue
        if v - out[-1] < 0.45:
            out[-1] = v
        else:
            out.append(v)
    out[0], out[-1] = 0.0, span
    return [origin + v for v in out]


def y_levels(H, y_top):
    """Rectangular bands up to y_top (the low side of the shear). Last level is exactly y_top."""
    ys = [0.0]
    y = 0.0
    while y < y_top - 0.05:
        step = SEC_LOW if y < LOW_BAND - 1e-6 else SEC
        nxt = min(y_top, y + step)
        if nxt - y >= 0.5:
            ys.append(round(nxt, 4))
        y = nxt
    if ys[-1] != round(y_top, 4):
        if y_top - ys[-1] < 0.45 and len(ys) > 1:
            ys[-1] = round(y_top, 4)
        else:
            ys.append(round(y_top, 4))
    return ys


def band_kinds(ys):
    """'slab' on the top SLAB_H of each section band, 'body' below, 'base' on the first 0.3 m."""
    kinds = []
    for j in range(len(ys) - 1):
        y0, y1 = ys[j], ys[j + 1]
        if y0 < 0.30:
            kinds.append("base")
        elif y1 - y0 <= SLAB_H + 0.08:
            kinds.append("slab")
        else:
            kinds.append("body")
    # mark a slab at the top of every tall body by splitting — caller splits instead
    return kinds


def split_slabs(ys):
    """Insert a slab line SLAB_H under each section boundary above the base."""
    out = [ys[0]]
    for y in ys[1:]:
        if y - out[-1] > SLAB_H + 0.9 and y > 0.5:
            cut = round(y - SLAB_H, 4)
            if cut - out[-1] > 0.4:
                out.append(cut)
        out.append(y)
    return out


class Tower:
    def __init__(self, mod, ext, variant="A", plates=None):
        self.mod, self.ext, self.variant = mod, ext, variant
        self.hw, self.hd, self.H = ext["w"] / 2, ext["d"] / 2, ext["h"]
        self.drop = self.H * SHEAR
        self.y_cut = self.H - self.drop
        self.high = 1.0 if variant == "A" else -1.0   # +X is the tall corner for A
        self.plates = plates or {}
        self.mesh = Mesh()
        self.relief = dict(bayMax=0.0, bayMin=9.0, bayN=0, field=FIELD, slab=FIELD)

    def shear_y(self, x):
        # high corner (sign high) stays at H; the other side drops by `drop`
        t = (self.high * self.hw - x) / (2 * self.hw)   # 0 at the high side, 1 at the low side
        t = min(1.0, max(0.0, t))
        return self.H - self.drop * t

    def plate_for(self, face, i, j, n_i, n_j):
        if not self.plates:
            return None
        # POOL order, not listdir order, so the same face seed picks the same Imagine plate the runtime would.
        names = [os.path.splitext(os.path.basename(p))[0] for p in POOL if os.path.splitext(os.path.basename(p))[0] in self.plates]
        if not names:
            names = list(self.plates)
        order = permute(names, face_seed(self.mod, face))
        return self.plates[order[(j * n_i + i) % len(order)]]

    def bay_of(self, img):
        if img is None:
            return (0.18, 0.16, 0.78, 0.80, 0.72)
        m = img >= BAY_MIN - 1e-3
        if m.mean() < 0.04:
            # darkest decile still becomes one bay — a plate with no step must not stay a flat cell
            thr = float(np.quantile(img, 0.82))
            m = img >= max(thr, 0.2)
            if m.mean() < 0.04:
                return None
        ys, xs = np.where(m)
        H, W = img.shape
        u0, u1 = xs.min() / W, (xs.max() + 1) / W
        v0, v1 = ys.min() / H, (ys.max() + 1) / H
        u0, u1 = max(0.14, u0), min(0.86, u1)
        v0, v1 = max(0.12, v0), min(0.88, v1)
        if u1 - u0 < 0.16 or v1 - v0 < 0.12:
            u0, u1, v0, v1 = 0.18, 0.78, 0.16, 0.80
        depth = float(np.clip(np.median(img[m]) if m.any() else 0.7, 0.50, 1.15))
        return (u0, v0, u1, v1, depth)

    def build(self):
        xs = axis_lines(self.ext["w"], -self.hw)
        zs = axis_lines(self.ext["d"], -self.hd)
        ys = split_slabs(y_levels(self.H, self.y_cut))
        self._xs, self._zs, self._ys = xs, zs, ys
        self._hole_ij = self._hole_span(xs, ys)
        self._wall("z", +1, xs, ys, self.hd)
        self._wall("z", -1, xs, ys, self.hd)
        self._wall("x", +1, zs, ys, self.hw)
        self._wall("x", -1, zs, ys, self.hw)
        self._shear_strips(xs, zs)
        self._caps(xs, zs)
        self._bottom(xs, zs)
        self._hole_tunnel()
        self.mesh.taper(self.H)
        return self.mesh

    def _frame_inset(self, kind):
        if kind in ("slab", "base"):
            return 0.0
        return 0.0   # section boundary strip is the proud rib; the field/bay sit inside emit

    def _kind(self, y0, y1):
        if y0 < 0.28:
            return "base"
        # a band that is only the slab cap
        if y1 - y0 <= SLAB_H + 0.05:
            return "slab"
        return "body"

    def _wall(self, axis, sign, us, ys, outer):
        """axis 'z' => front/back (u = x). axis 'x' => flanks (u = z). sign +1 is the +axis side."""
        face = {("z", 1): "front", ("z", -1): "back", ("x", 1): "right", ("x", -1): "left"}[(axis, sign)]
        nu, ny = len(us) - 1, len(ys) - 1
        cells = []
        for j in range(ny):
            row = []
            for i in range(nu):
                y0, y1 = ys[j], ys[j + 1]
                u0, u1 = us[i], us[i + 1]
                kind = self._kind(y0, y1)
                hole = self._in_hole(i, j, axis)
                if hole:
                    row.append(dict(u0=u0, u1=u1, y0=y0, y1=y1, hole=True, frame=0.0, bay=None, kind="hole"))
                    continue
                bay = None
                frame = 0.0
                if kind == "body" and (u1 - u0) > 0.9 and (y1 - y0) > 0.9:
                    img = self.plate_for(face, i, j, nu, ny)
                    bay = self.bay_of(img)
                    if bay:
                        self.relief["bayN"] += 1
                        self.relief["bayMax"] = max(self.relief["bayMax"], bay[4])
                        self.relief["bayMin"] = min(self.relief["bayMin"], bay[4])
                row.append(dict(u0=u0, u1=u1, y0=y0, y1=y1, hole=False, frame=frame, bay=bay, kind=kind))
            cells.append(row)
        for j in range(ny):
            for i in range(nu):
                self._emit_cell(axis, sign, outer, cells[j][i])
        # steps on shared edges where the boundary inset differs (hole vs solid handled by _hole)
        for j in range(ny):
            for i in range(nu - 1):
                a, b = cells[j][i], cells[j][i + 1]
                if a["hole"] or b["hole"]:
                    continue
                self._step_u(axis, sign, outer, a, b)
        for j in range(ny - 1):
            for i in range(nu):
                a, b = cells[j][i], cells[j + 1][i]
                if a["hole"] or b["hole"]:
                    continue
                self._step_v(axis, sign, outer, a, b)

    def _hole_rect_raw(self):
        # low-middle, kept off the shear and the corners. Snapped to whole cells in _hole_span.
        w, h = self.ext["w"], self.H
        ww, hh = 0.22 * w, 0.16 * h
        cx = (-0.06 if self.variant == "A" else 0.10) * w
        cy = 0.36 * h
        return cx - ww / 2, cx + ww / 2, cy - hh / 2, cy + hh / 2

    def _hole_span(self, us, ys):
        """Inclusive cell index rectangle whose centres sit in the raw hole. None if it would eat a corner."""
        hx0, hx1, hy0, hy1 = self._hole_rect_raw()
        ii, jj = [], []
        for j in range(len(ys) - 1):
            cy = (ys[j] + ys[j + 1]) / 2
            if not (hy0 <= cy <= hy1):
                continue
            for i in range(len(us) - 1):
                cx = (us[i] + us[i + 1]) / 2
                if hx0 <= cx <= hx1:
                    ii.append(i)
                    jj.append(j)
        if not ii:
            return None
        i0, i1 = min(ii), max(ii)
        j0, j1 = min(jj), max(jj)
        i0 = max(i0, 1)
        i1 = min(i1, len(us) - 3)
        if i1 < i0 or j1 < j0:
            return None
        return (i0, i1, j0, j1)

    def _in_hole(self, i, j, axis):
        if axis != "z" or not self._hole_ij:
            return False
        i0, i1, j0, j1 = self._hole_ij
        return i0 <= i <= i1 and j0 <= j <= j1

    def _pos(self, axis, sign, outer, u, y, inset):
        if axis == "z":
            return (u, y, sign * (outer - inset))
        return (sign * (outer - inset), y, u)

    def _out_face(self, axis, sign):
        return (0, 0, sign) if axis == "z" else (sign, 0, 0)

    def _panel(self, axis, sign, outer, u0, u1, y0, y1, inset, col):
        self.mesh.quad([
            self._pos(axis, sign, outer, u0, y0, inset), self._pos(axis, sign, outer, u1, y0, inset),
            self._pos(axis, sign, outer, u1, y1, inset), self._pos(axis, sign, outer, u0, y1, inset),
        ], col, self._out_face(axis, sign))

    def _miter(self, axis, sign, outer, u0, u1, y0, y1, iu0, iu1, iy0, iy1, inset, col):
        """Four quads. The outer loop is the four cell corners (one edge each) so the neighbour welds."""
        o = inset
        P = lambda u, y: self._pos(axis, sign, outer, u, y, o)
        f = self._out_face(axis, sign)
        self.mesh.quad([P(u0, y0), P(u1, y0), P(iu1, iy0), P(iu0, iy0)], col, f)
        self.mesh.quad([P(iu0, iy1), P(iu1, iy1), P(u1, y1), P(u0, y1)], col, f)
        self.mesh.quad([P(u0, y0), P(iu0, iy0), P(iu0, iy1), P(u0, y1)], col, f)
        self.mesh.quad([P(iu1, iy0), P(u1, y0), P(u1, y1), P(iu1, iy1)], col, f)

    def _well(self, axis, sign, outer, u0, u1, y0, y1, i0, i1):
        """Vertical chrome jambs, graphite sill (sand), chrome soffit, from inset i0 to i1."""
        self._step_span(axis, sign, outer, u0, u0, y0, y1, i0, i1, self._u_out(axis, +1), CHROME)
        self._step_span(axis, sign, outer, u1, u1, y0, y1, i0, i1, self._u_out(axis, -1), CHROME)
        self._step_span_h(axis, sign, outer, u0, u1, y0, i0, i1, (0, 1, 0), GRAPHITE)
        self._step_span_h(axis, sign, outer, u0, u1, y1, i0, i1, (0, -1, 0), CHROME)

    def _emit_cell(self, axis, sign, outer, c):
        if c["hole"]:
            return
        u0, u1, y0, y1 = c["u0"], c["u1"], c["y0"], c["y1"]
        bay = c["bay"]
        if not bay or c["kind"] != "body" or (u1 - u0) < 1.3 or (y1 - y0) < 1.3:
            self._panel(axis, sign, outer, u0, u1, y0, y1, 0.0, GRAPHITE)
            return
        rib = min(RIB_W, (u1 - u0) * 0.22, (y1 - y0) * 0.18)
        iu0, iu1 = u0 + rib, u1 - rib
        iy0, iy1 = y0 + rib, y1 - rib
        if iu1 - iu0 < 0.5 or iy1 - iy0 < 0.5:
            self._panel(axis, sign, outer, u0, u1, y0, y1, 0.0, GRAPHITE)
            return
        # proud rib (inset 0) around a field recess, then the bay deeper still. Borders stay one edge.
        self._miter(axis, sign, outer, u0, u1, y0, y1, iu0, iu1, iy0, iy1, 0.0, GRAPHITE)
        self._well(axis, sign, outer, iu0, iu1, iy0, iy1, 0.0, FIELD)
        bu0, bv0, bu1, bv1, depth = bay
        depth = max(depth, FIELD + 0.20)
        xA = iu0 + (iu1 - iu0) * bu0
        xB = iu0 + (iu1 - iu0) * bu1
        yA = iy0 + (iy1 - iy0) * bv0
        yB = iy0 + (iy1 - iy0) * bv1
        if xB - xA < 0.35 or yB - yA < 0.35:
            self._panel(axis, sign, outer, iu0, iu1, iy0, iy1, FIELD, GRAPHITE)
            return
        self._miter(axis, sign, outer, iu0, iu1, iy0, iy1, xA, xB, yA, yB, FIELD, GRAPHITE)
        self._well(axis, sign, outer, xA, xB, yA, yB, FIELD, depth)
        self._panel(axis, sign, outer, xA, xB, yA, yB, depth, GRAPHITE)

    def _u_out(self, axis, su):
        """Outward of a step that faces +u (su=+1) or -u. u is x on a z-wall and z on an x-wall."""
        if axis == "z":
            return (su, 0, 0)
        return (0, 0, su)

    def _step_span(self, axis, sign, outer, u, u2, y0, y1, i0, i1, outward, col):
        # vertical step at u (u2 == u), from inset i0 to i1, across y
        self.mesh.quad([
            self._pos(axis, sign, outer, u, y0, i0), self._pos(axis, sign, outer, u, y0, i1),
            self._pos(axis, sign, outer, u, y1, i1), self._pos(axis, sign, outer, u, y1, i0),
        ], col, outward)

    def _step_span_h(self, axis, sign, outer, u0, u1, y, i0, i1, outward, col):
        self.mesh.quad([
            self._pos(axis, sign, outer, u0, y, i0), self._pos(axis, sign, outer, u1, y, i0),
            self._pos(axis, sign, outer, u1, y, i1), self._pos(axis, sign, outer, u0, y, i1),
        ], col, outward)

    def _boundary_inset(self, c):
        if c["hole"]:
            return None
        return 0.0   # every cell's outer edge is the proud plane (bays are interior)

    def _step_u(self, axis, sign, outer, a, b):
        return  # boundary insets match (both 0); bay steps are inside the cell

    def _step_v(self, axis, sign, outer, a, b):
        return

    def _shear_strips(self, xs, zs):
        for sign, outer in ((+1, self.hd), (-1, self.hd)):
            for i in range(len(xs) - 1):
                x0, x1 = xs[i], xs[i + 1]
                y0, y1 = self.shear_y(x0), self.shear_y(x1)
                if max(y0, y1) - self.y_cut < 0.05:
                    continue
                self.mesh.quad([
                    self._pos("z", sign, outer, x0, self.y_cut, 0.0), self._pos("z", sign, outer, x1, self.y_cut, 0.0),
                    self._pos("z", sign, outer, x1, y1, 0.0), self._pos("z", sign, outer, x0, y0, 0.0),
                ], GRAPHITE, (0, 0, sign))
        for sign, outer in ((+1, self.hw), (-1, self.hw)):
            top = self.shear_y(sign * self.hw)
            if top - self.y_cut < 0.05:
                continue
            for i in range(len(zs) - 1):
                z0, z1 = zs[i], zs[i + 1]
                self.mesh.quad([
                    self._pos("x", sign, outer, z0, self.y_cut, 0.0), self._pos("x", sign, outer, z1, self.y_cut, 0.0),
                    self._pos("x", sign, outer, z1, top, 0.0), self._pos("x", sign, outer, z0, top, 0.0),
                ], GRAPHITE, (sign, 0, 0))

    def _caps(self, xs, zs):
        """Roof grid on the same x and z lines as the walls, so every top edge welds."""
        for i in range(len(xs) - 1):
            x0, x1 = xs[i], xs[i + 1]
            y0, y1 = self.shear_y(x0), self.shear_y(x1)
            for k in range(len(zs) - 1):
                z0, z1 = zs[k], zs[k + 1]
                self.mesh.quad([
                    (x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1),
                ], GRAPHITE, (0, 1, 0))

    def _bottom(self, xs, zs):
        for i in range(len(xs) - 1):
            x0, x1 = xs[i], xs[i + 1]
            for k in range(len(zs) - 1):
                z0, z1 = zs[k], zs[k + 1]
                self.mesh.quad([(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], GRAPHITE, (0, -1, 0))

    def _side_miter(self, x, y0, y1, z0, z1, iy0, iy1, iz0, iz1, outward):
        """Mitered frame in the plane x=const. Outer loop is the cell side (one edge each)."""
        self.mesh.quad([(x, y0, z0), (x, y0, z1), (x, iy0, iz1), (x, iy0, iz0)], CHROME, outward)
        self.mesh.quad([(x, iy1, iz0), (x, iy1, iz1), (x, y1, z1), (x, y1, z0)], CHROME, outward)
        self.mesh.quad([(x, y0, z0), (x, iy0, iz0), (x, iy1, iz0), (x, y1, z0)], CHROME, outward)
        self.mesh.quad([(x, iy0, iz1), (x, y0, z1), (x, y1, z1), (x, iy1, iz1)], CHROME, outward)

    def _hole_tunnel(self):
        """Chrome tunnel on the exact skipped-cell edges, plus a lintel beam open into the jambs."""
        if not self._hole_ij:
            return
        i0, i1, j0, j1 = self._hole_ij
        xs, ys = self._xs, self._ys
        xL, xR = xs[i0], xs[i1 + 1]
        yB, yT = ys[j0], ys[j1 + 1]
        hd = self.hd
        for i in range(i0, i1 + 1):
            xa, xb = xs[i], xs[i + 1]
            self.mesh.quad([(xa, yB, hd), (xb, yB, hd), (xb, yB, -hd), (xa, yB, -hd)], GRAPHITE, (0, 1, 0))
            self.mesh.quad([(xb, yT, hd), (xa, yT, hd), (xa, yT, -hd), (xb, yT, -hd)], CHROME, (0, -1, 0))
        # beam cross-section sits inside one side-cell, near the front, so the elevation still has a hole
        bj = j0 + (j1 - j0) // 2
        by0, by1 = ys[bj], ys[bj + 1]
        margin = 0.18
        if by1 - by0 < 0.7:
            # too thin to frame a beam; plain jambs
            beam = None
        else:
            beam = (by0 + margin, by1 - margin, hd - 0.20, hd - 0.85)
        for j in range(j0, j1 + 1):
            ya, yb = ys[j], ys[j + 1]
            if beam and j == bj:
                iy0, iy1, iz0, iz1 = beam
                self._side_miter(xL, ya, yb, hd, -hd, iy0, iy1, iz0, iz1, (-1, 0, 0))
                self._side_miter(xR, ya, yb, -hd, hd, iy0, iy1, iz1, iz0, (1, 0, 0))
            else:
                self.mesh.quad([(xL, ya, hd), (xL, yb, hd), (xL, yb, -hd), (xL, ya, -hd)], CHROME, (-1, 0, 0))
                self.mesh.quad([(xR, yb, hd), (xR, ya, hd), (xR, ya, -hd), (xR, yb, -hd)], CHROME, (1, 0, 0))
        if not beam:
            return
        iy0, iy1, iz0, iz1 = beam
        # tube along x. No end caps: the miter inner loop is the opening.
        self.mesh.quad([(xL, iy0, iz0), (xR, iy0, iz0), (xR, iy0, iz1), (xL, iy0, iz1)], CHROME, (0, -1, 0))
        self.mesh.quad([(xL, iy1, iz1), (xR, iy1, iz1), (xR, iy1, iz0), (xL, iy1, iz0)], CHROME, (0, 1, 0))
        self.mesh.quad([(xL, iy0, iz0), (xL, iy1, iz0), (xR, iy1, iz0), (xR, iy0, iz0)], CHROME, (0, 0, 1))
        self.mesh.quad([(xL, iy1, iz1), (xL, iy0, iz1), (xR, iy0, iz1), (xR, iy1, iz1)], CHROME, (0, 0, -1))


def load_insets(relief_dir):
    out = {}
    if not relief_dir or not os.path.isdir(relief_dir):
        return out
    for name in os.listdir(relief_dir):
        if name.endswith("-inset.npy"):
            out[name[:-10]] = np.load(os.path.join(relief_dir, name))
    return out


def write_glb(path, meshes):
    """meshes: list of (node_name, Mesh). LOD0 and LOD1 may share one Mesh object."""
    # pack unique mesh blobs
    blobs, views = [], []
    blob = bytearray()

    def pad(buf, n=4):
        while len(buf) % n:
            buf.append(0)

    def add_arr(arr, typ):
        raw = np.asarray(arr, typ).tobytes()
        pad(blob)
        off = len(blob)
        blob.extend(raw)
        return off, len(raw)

    accessors, buffer_views, gl_meshes, nodes = [], [], [], []
    mesh_index = {}
    for node_name, mesh in meshes:
        key = id(mesh)
        if key not in mesh_index:
            V = np.asarray(mesh.verts, np.float32)
            C = np.asarray(mesh.cols, np.float32)
            I = np.asarray(mesh.tris, np.uint32).reshape(-1)
            oV, lV = add_arr(V, np.float32)
            oC, lC = add_arr(C, np.float32)
            oI, lI = add_arr(I, np.uint32)
            bv = len(buffer_views)
            buffer_views += [
                {"buffer": 0, "byteOffset": oV, "byteLength": lV, "target": 34962},
                {"buffer": 0, "byteOffset": oC, "byteLength": lC, "target": 34962},
                {"buffer": 0, "byteOffset": oI, "byteLength": lI, "target": 34963},
            ]
            mn, mx = V.min(0).tolist(), V.max(0).tolist()
            aP, aC, aI = len(accessors), len(accessors) + 1, len(accessors) + 2
            accessors += [
                {"bufferView": bv, "componentType": 5126, "count": len(V), "type": "VEC3", "min": mn, "max": mx},
                {"bufferView": bv + 1, "componentType": 5126, "count": len(C), "type": "VEC3"},
                {"bufferView": bv + 2, "componentType": 5125, "count": int(I.size), "type": "SCALAR"},
            ]
            gl_meshes.append({"name": node_name + "_mesh", "primitives": [{
                "attributes": {"POSITION": aP, "COLOR_0": aC}, "indices": aI, "mode": 4,
            }]})
            mesh_index[key] = len(gl_meshes) - 1
        nodes.append({"name": node_name, "mesh": mesh_index[key]})
    gltf = {
        "asset": {"version": "2.0", "generator": "imagine-to-3d hard-surface-v1"},
        "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes, "meshes": gl_meshes, "accessors": accessors, "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(blob)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    pad(blob)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack("<I4s", len(js), b"JSON") + js
    out += struct.pack("<I4s", len(blob), b"BIN\x00") + blob
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(out)
    return len(out)


def silhouette(mesh, gw=180):
    """Front elevation enclosed-pixel count and top-band flatness (preview-gate silhouetteOf)."""
    V = np.asarray(mesh.verts, np.float64)
    T = np.asarray(mesh.tris, np.int32)
    x0, y0 = V[:, 0].min(), V[:, 1].min()
    w = max(V[:, 0].max() - x0, 1e-4)
    h = max(V[:, 1].max() - y0, 1e-4)
    gh = max(8, int(round(gw * h / w)))
    pix = np.zeros((gh, gw), np.uint8)
    def plot(x, y):
        ix = int(np.clip((x - x0) / w * (gw - 1), 0, gw - 1))
        iy = int(np.clip((y - y0) / h * (gh - 1), 0, gh - 1))
        return ix, iy
    for i0, i1, i2 in T:
        ax, ay = plot(V[i0, 0], V[i0, 1])
        bx, by = plot(V[i1, 0], V[i1, 1])
        cx, cy = plot(V[i2, 0], V[i2, 1])
        minx, maxx = min(ax, bx, cx), max(ax, bx, cx)
        miny, maxy = min(ay, by, cy), max(ay, by, cy)
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-8:
            continue
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                wa = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den
                wb = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den
                wc = 1 - wa - wb
                if wa >= -0.01 and wb >= -0.01 and wc >= -0.01:
                    pix[y, x] = 1
    seen = np.zeros_like(pix)
    stack = [(x, 0) for x in range(gw)] + [(x, gh - 1) for x in range(gw)] + [(0, y) for y in range(gh)] + [(gw - 1, y) for y in range(gh)]
    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= gw or y >= gh or seen[y, x] or pix[y, x]:
            continue
        seen[y, x] = 1
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    enclosed = int(((pix == 0) & (seen == 0)).sum())
    rows = []
    for y in range(int(gh * 0.9), gh):
        xs = np.where(pix[y] > 0)[0]
        if len(xs):
            rows.append(int(xs[-1] - xs[0] + 1))
    flat = len(rows) < 3 or (max(rows) - min(rows)) <= max(2, 0.08 * max(rows))
    return dict(enclosed=enclosed, flat=bool(flat), rows=rows[-6:])


def build_module(mod, relief_dir, variant="A"):
    ext = live_extent(mod)
    plates = load_insets(relief_dir)
    # map plate name -> array; missing dir => synthetic bays (bay_of(None))
    tw = Tower(mod, ext, variant, plates)
    mesh = tw.build()
    return tw, mesh


def geo_doc(mod, mesh, relief, glb_bytes, variant_note):
    st = mesh.stats()
    px = 1024 / 12.0
    stretch = dict(minPxPerM=round(px, 2), p01PxPerM=round(1024 / 7.2, 2), maxStretch=1.0, blendMaxStretch=1.0,
                   relief=True, nonManifoldEdges=st["nonManifold"] + st["open"], sameShell=True)
    bay = relief["bayMax"] if relief["bayN"] else 0.0
    crisp = 1.0 if st["nonManifold"] == 0 else 0.0
    cov = 1.0 if relief["bayN"] >= 4 else relief["bayN"] / 4
    doc = {
        "id": mod, "method": "hard-surface-v1", "generator": "hard_surface.py",
        "lodMode": "same-shell", "variantNote": variant_note,
        "reliefDepthM": round(bay, 3), "relief": relief, "coverage": cov, "crispness": crisp,
        "openEdges": st["open"], "nonManifold": st["nonManifold"],
        "lods": [
            {"lod": 0, "tris": st["tris"], "indexCount": st["tris"] * 3, "bytes": glb_bytes, "gzBytes": glb_bytes,
             "stretch": stretch, "sameShell": True, "relief": True},
            {"lod": 1, "tris": st["tris"], "indexCount": st["tris"] * 3, "bytes": glb_bytes, "gzBytes": glb_bytes,
             "stretch": stretch, "sameShell": True, "relief": True},
        ],
    }
    return doc, st


def build_all(relief_dir, out_dir, modules):
    os.makedirs(out_dir, exist_ok=True)
    report = {}
    for mod in modules:
        a = build_module(mod, relief_dir, "A")
        b = build_module(mod, relief_dir, "B")
        # LOD0 and LOD1 share A's mesh (same shell). B0 is the other damage cut, same outer box.
        path = os.path.join(out_dir, mod, mod + ".glb")
        n = write_glb(path, [(f"{mod}_LOD0", a[1]), (f"{mod}_LOD1", a[1]), (f"{mod}_B0", b[1])])
        doc, st = geo_doc(mod, a[1], a[0].relief, n, "LOD0=LOD1 shared shell; B0 flips shear + hole")
        sil = silhouette(a[1])
        doc["silhouette"] = sil
        doc["stats"] = st
        json.dump(doc, open(os.path.join(out_dir, f"{mod}-geo.json"), "w"), indent=1)
        report[mod] = dict(stats=st, silhouette=sil, bayMax=a[0].relief["bayMax"], bayN=a[0].relief["bayN"], bytes=n)
        print(mod, report[mod], flush=True)
    json.dump(report, open(os.path.join(out_dir, "hard-surface-report.json"), "w"), indent=1)
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--relief", default="")
    ap.add_argument("--out", required=True)
    ap.add_argument("--modules", default="m2,m3,m4,m6")
    a = ap.parse_args()
    build_all(a.relief, a.out, a.modules.split(","))


if __name__ == "__main__":
    main()
