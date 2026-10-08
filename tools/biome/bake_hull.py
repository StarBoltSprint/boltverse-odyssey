"""bake_hull.py - Imagine views of ONE object -> carved hull + projected colour -> displaced -> LOD0/1/2 unlit GLB.

Upgrade of tools/blender/imagine_bake.py (PR #188, butte-0 test). Runs in headless Blender (CPU only):

  blender --background --factory-startup --python tools/biome/bake_hull.py -- \\
      --front f.png [--right r.png] [--back b.png] [--left l.png] [--top t.png] \\
      [--q045 a.png] [--q135 b.png] [--q225 c.png] [--q315 d.png] [--q-elev 15] \\
      --out DIR [--name obj] [--height 30] [--lods 4000,800,180] [--tex 2048] [--displace 0.25] \\
      [--hull front,right,top] [--vox 0.18] [--hires 60000] [--talus 0] [--bury 0.8] [--jpeg 90]
  or: ... -- --biome ember-mesa --object rock-0 --slots tools/biome/out/ember-mesa/slots --out DIR
      (views = slots obj-<id>-front/right/back/left/top/q045..., height / lods / tex / displace from the bible)

Recipe (Grok chat answer 3/8, 2026-10-08):
 1. 4 orthographic silhouettes (front, right, back, top) carve a voxel visual hull. In an orthographic view the
    opposite side's silhouette is the mirror image, so carving never needs an invented view.
 2. Up to 4 three-quarter colour plates (q045 ... q315) are projected onto the flanks/corners. A missing view is
    NOT replaced by a mirrored flank: those texels take the nearest real views (fallback, counted in stats).
 3. Per texel: colour = sum over views of Imagine pixel x dot(normal, view)^P x visibility (depth from the hull)
    x eroded alpha. Every texel colour is a blend of Imagine pixels. No procedural colour, no lights.
 4. Displacement from the texture itself (high-pass luminance, +-displace metres) on the dense mesh.
 5. Decimate AFTER the bake: LOD0 ~4k, LOD1 ~800, LOD2 ~180 tris, all sharing the one baked texture (UVs kept).
 6. One GLB: <name>_LOD0/1/2 nodes, KHR_materials_unlit, texture JPEG; stats.json.
"""
import bpy, bmesh, sys, os, json, time, math, argparse
import numpy as np

T0 = time.time()
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
for v in ("front", "right", "back", "left", "top", "q045", "q135", "q225", "q315"):
    ap.add_argument("--" + v)
ap.add_argument("--biome"); ap.add_argument("--object"); ap.add_argument("--slots")
ap.add_argument("--out", required=True); ap.add_argument("--name", default=None)
ap.add_argument("--height", type=float); ap.add_argument("--lods"); ap.add_argument("--tex", type=int)
ap.add_argument("--displace", type=float); ap.add_argument("--hull", default=None)
ap.add_argument("--vox", type=float, default=0.0, help="voxel size in metres (0 = height/160)")
ap.add_argument("--hires", type=int, default=60000, help="dense mesh tris before the bake")
ap.add_argument("--power", type=float, default=3.0); ap.add_argument("--qw", type=float, default=1.0)
ap.add_argument("--q-elev", type=float, default=15.0); ap.add_argument("--talus", type=float, default=0.0)
ap.add_argument("--bury", type=float, default=-1.0); ap.add_argument("--jpeg", type=int, default=90)
A = ap.parse_args(argv)

# ---------- bible / slots
if A.biome:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import biome_lib as bl
    B, _ = bl.load_biome(A.biome)
    O = next(o for o in B["objects"] if o["id"] == A.object)
    sd = A.slots or os.path.join(bl.HERE, "out", B["id"], "slots")
    def slotf(v):
        for e in (".png", ".jpg", ".jpeg", ".webp"):
            p = os.path.join(sd, f"obj-{O['id']}-{v}{e}")
            if os.path.exists(p): return p
        return None
    for v in ("front", "right", "back", "left", "top", "q045", "q135", "q225", "q315"):
        if getattr(A, v) is None: setattr(A, v, slotf(v))
    A.height = A.height or O["heightM"]; A.lods = A.lods or ",".join(map(str, O["lods"]))
    A.tex = A.tex or O["tex"]; A.displace = O.get("displaceM", 0.2) if A.displace is None else A.displace
    A.name = A.name or O["id"]
A.height = A.height or 30.0; A.lods = [int(x) for x in (A.lods or "4000,800,180").split(",")]
A.tex = A.tex or 2048; A.displace = 0.2 if A.displace is None else A.displace
A.name = A.name or "object"; A.vox = A.vox or A.height / 160.0
A.bury = A.height * 0.03 if A.bury < 0 else A.bury
if not A.front:
    raise SystemExit("[bake_hull] --front is required")
ORTHO = [v for v in ("front", "right", "back", "left") if getattr(A, v)]
HULL = (A.hull or ",".join(ORTHO + (["top"] if A.top else []))).split(",")
os.makedirs(A.out, exist_ok=True)
stats = {"name": A.name, "views_ortho": ORTHO + (["top"] if A.top else []), "views_threeQuarter": [q for q in ("q045", "q135", "q225", "q315") if getattr(A, q)],
         "hull_views": HULL, "mirrored_flanks": 0}
def lap(k, t):
    stats[k] = round(time.time() - t, 2); print(f"[bake_hull] {k}: {stats[k]}s", flush=True)

# ---------- image helpers (same as imagine_bake.py)
def load_rgba(path):
    im = bpy.data.images.load(os.path.abspath(path)); w, h = im.size
    px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px)
    a = px.reshape(h, w, 4)[::-1].copy()
    if a[..., 3].min() > 0.99:  # no alpha: key out the flat background (border median colour)
        border = np.concatenate([a[:4, :, :3].reshape(-1, 3), a[-4:, :, :3].reshape(-1, 3), a[:, :4, :3].reshape(-1, 3), a[:, -4:, :3].reshape(-1, 3)])
        bg = np.median(border, 0); d = np.linalg.norm(a[..., :3] - bg, axis=2)
        a[..., 3] = (d > 0.08).astype(np.float32)
    return a
def shift(a, dy, dx): return np.roll(np.roll(a, dy, 0), dx, 1)
def bleed(rgb, valid, iters):
    rgb = rgb.copy(); v = valid.astype(np.float32)
    for _ in range(iters):
        acc = np.zeros_like(rgb); cnt = np.zeros(v.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sv = shift(v, dy, dx); acc += shift(rgb, dy, dx) * sv[..., None]; cnt += sv
        grow = (v == 0) & (cnt > 0); rgb[grow] = acc[grow] / cnt[grow][:, None]; v[grow] = 1
    return rgb
def erode(m, r):
    m = m.copy()
    for _ in range(r): m = m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
    return m
def blur(a, r):
    for _ in range(r): a = (a + shift(a, 1, 0) + shift(a, -1, 0) + shift(a, 0, 1) + shift(a, 0, -1)) / 5.0
    return a
def bilinear(img, col, row):
    h, w = img.shape[:2]
    col = np.clip(col, 0, w - 1.001); row = np.clip(row, 0, h - 1.001)
    c0 = np.floor(col).astype(np.int32); r0 = np.floor(row).astype(np.int32)
    fc = (col - c0)[:, None]; fr = (row - r0)[:, None]
    if img.ndim == 2: img = img[..., None]
    a = img[r0, c0] * (1 - fc) + img[r0, c0 + 1] * fc; b = img[r0 + 1, c0] * (1 - fc) + img[r0 + 1, c0 + 1] * fc
    return a * (1 - fr) + b * fr

class Plate:
    """One Imagine view. Ortho side views: tip row -> z = H, ground row -> z = 0 (metres per pixel from --height)."""
    def __init__(self, path, name):
        px = load_rgba(path); self.name = name; self.path = path
        self.h, self.w = px.shape[:2]
        m = px[..., 3] > 0.5
        rows = np.where(m.any(1))[0]; cols = np.where(m.any(0))[0]
        self.top, self.bot = int(rows[0]), int(rows[-1]); self.c0, self.c1 = int(cols[0]), int(cols[-1])
        g = self.bot
        if A.talus > 0 and name in ORTHO:  # optional rubble apron cut (mesas), as imagine_bake.py
            wid = np.array([np.ptp(np.where(m[r])[0]) if m[r].any() else 0 for r in range(self.h)])
            span = self.bot - self.top; medw = np.median(wid[self.top + int(span * .3): self.top + int(span * .8)])
            for r in range(self.top + int(span * .6), self.bot + 1):
                if wid[r] > 1.35 * medw: g = min(self.bot, r + int(A.talus / (A.height / max(1, r - self.top)))); break
            m[g + 1:] = False
        self.ground = g; self.mask = m
        self.mpp = A.height / float(max(1, g - self.top))
        lr = [np.where(m[r])[0][[0, -1]] for r in range(self.top + int((g - self.top) * .3), self.top + int((g - self.top) * .8)) if m[r].any()]
        self.cx = float(np.mean([(l + r) * .5 for l, r in lr])) if lr else (self.c0 + self.c1) / 2
        self.rgb = bleed(px[..., :3], erode(m, 1), 24)
        self.wa = blur(erode(m, 3).astype(np.float32), 3)
    def inside(self, u_m, z_m):
        col = np.round(self.cx + u_m / self.mpp).astype(int); row = np.round(self.ground - z_m / self.mpp).astype(int)
        ok = (col >= 0) & (col < self.w) & (row >= 0) & (row < self.h)
        out = np.zeros(col.shape, bool); out[ok] = self.mask[row[ok], col[ok]]; return out
    def sample_side(self, u_m, z_m):
        col = self.cx + u_m / self.mpp; row = self.ground - z_m / self.mpp
        return bilinear(self.rgb, col, row), bilinear(self.wa, col, row)[:, 0]

t = time.time()
P = {v: Plate(getattr(A, v), v) for v in ORTHO}
TOP = Plate(A.top, "top") if A.top else None
Q = {q: Plate(getattr(A, q), q) for q in ("q045", "q135", "q225", "q315") if getattr(A, q)}
lap("load_views_s", t)

# ---------- visual hull
t = time.time()
H, vx = A.height, A.vox
def half(p):
    cols = np.where(p.mask[p.top:p.ground + 1].any(0))[0]
    return max(abs(cols[0] - p.cx), abs(cols[-1] - p.cx)) * p.mpp
fx = [half(P[v]) for v in ("front", "back") if v in P]
fy = [half(P[v]) for v in ("right", "left") if v in P]
X = max(fx) + vx * 4
Y = (max(fy) if fy else X) + vx * 4
xs = np.arange(-X, X, vx) + vx / 2; ys = np.arange(-Y, Y, vx) + vx / 2; zs = np.arange(-A.bury, H + vx, vx) + vx / 2
nx, ny, nz = len(xs), len(ys), len(zs)
GXz = np.meshgrid(xs, np.maximum(zs, 0.0), indexing="ij"); GYz = np.meshgrid(ys, np.maximum(zs, 0.0), indexing="ij")
f_ok = np.ones((nx, nz), bool); s_ok = np.ones((ny, nz), bool)
# camera frames: front from -Y (image-right +X), back from +Y (image-right -X), right from +X (image-right +Y), left from -X (image-right -Y)
if "front" in P and "front" in HULL: f_ok &= P["front"].inside(GXz[0], GXz[1])
if "back" in P and "back" in HULL: f_ok &= P["back"].inside(-GXz[0], GXz[1])
if "right" in P and "right" in HULL: s_ok &= P["right"].inside(GYz[0], GYz[1])
if "left" in P and "left" in HULL: s_ok &= P["left"].inside(-GYz[0], GYz[1])
occ = f_ok[:, None, :] & s_ok[None, :, :]
if TOP is not None and "top" in HULL:
    # footprint: top silhouette bbox fitted to the hull's own x/y extent (image-up = +Y = back, image-right = +X)
    fp = occ.any(2); ii, jj = np.where(fp)
    bx0, bx1, by0, by1 = xs[ii.min()], xs[ii.max()], ys[jj.min()], ys[jj.max()]
    GX, GY = np.meshgrid(xs, ys, indexing="ij")
    col = TOP.c0 + (GX - bx0) / max(1e-3, bx1 - bx0) * (TOP.c1 - TOP.c0)
    row = TOP.top + (by1 - GY) / max(1e-3, by1 - by0) * (TOP.bot - TOP.top)
    ci = np.clip(np.round(col).astype(int), 0, TOP.w - 1); ri = np.clip(np.round(row).astype(int), 0, TOP.h - 1)
    tm = TOP.mask[ri, ci]
    occ &= tm[:, :, None]
    stats["top_box_m"] = [round(float(v), 2) for v in (bx0, bx1, by0, by1)]
stats["voxels"] = [nx, ny, nz]; stats["occupied"] = int(occ.sum())
if occ.sum() < 50:
    raise SystemExit("[bake_hull] hull is empty: views do not agree (check view names / handedness)")
o = np.pad(occ, 1); allq = []
for axis in range(3):
    d = np.diff(o.astype(np.int8), axis=axis); idx = np.argwhere(d != 0); sgn = d[d != 0]
    i, j, k = idx[:, 0], idx[:, 1], idx[:, 2]
    if axis == 0: c = np.stack([np.stack([i + 1, j, k], 1), np.stack([i + 1, j + 1, k], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i + 1, j, k + 1], 1)], 1)
    elif axis == 1: c = np.stack([np.stack([i, j + 1, k], 1), np.stack([i, j + 1, k + 1], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i + 1, j + 1, k], 1)], 1)
    else: c = np.stack([np.stack([i, j, k + 1], 1), np.stack([i + 1, j, k + 1], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i, j + 1, k + 1], 1)], 1)
    flip = sgn > 0; c[flip] = c[flip][:, ::-1]; allq.append(c)
allq = np.concatenate(allq, 0); flat = allq.reshape(-1, 3)
key = (flat[:, 0] * (ny + 3) + flat[:, 1]) * (nz + 3) + flat[:, 2]
uk, inv = np.unique(key, return_inverse=True)
cz_ = uk % (nz + 3); cy_ = (uk // (nz + 3)) % (ny + 3); cx_ = uk // ((nz + 3) * (ny + 3))
V = np.stack([(cx_ - 1) * vx - X, (cy_ - 1) * vx - Y, (cz_ - 1) * vx - A.bury], 1).astype(np.float32)
F = inv.reshape(-1, 4)
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob)
me = bpy.data.meshes.new("hull"); me.from_pydata(V.tolist(), [], F.tolist()); me.update()
obj = bpy.data.objects.new(A.name, me); bpy.context.scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
lap("hull_s", t)

def apply_mod(o_, kind, **kw):
    m = o_.modifiers.new(kind.lower(), kind)
    for k_, v_ in kw.items(): setattr(m, k_, v_)
    bpy.context.view_layer.objects.active = o_
    bpy.ops.object.modifier_apply(modifier=m.name)
def ntris(o_): return sum(len(p.vertices) - 2 for p in o_.data.polygons)

t = time.time()
apply_mod(obj, "REMESH", mode="VOXEL", voxel_size=vx * 1.5, use_smooth_shade=True)
apply_mod(obj, "LAPLACIANSMOOTH", iterations=10, lambda_factor=1.0, use_volume_preserve=True)
nt = ntris(obj)
if nt > A.hires: apply_mod(obj, "DECIMATE", ratio=A.hires / nt, use_collapse_triangulate=True)
apply_mod(obj, "TRIANGULATE")
bm = bmesh.new(); bm.from_mesh(obj.data)
kill = [f for f in bm.faces if f.calc_center_median().z < -0.5 * A.bury and f.normal.z < -0.5]
bmesh.ops.delete(bm, geom=kill, context="FACES"); bm.to_mesh(obj.data); bm.free()
bpy.ops.object.shade_smooth()
stats["hires_tris"] = ntris(obj)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
lap("mesh_uv_s", t)

# ---------- bake position + normal of the dense mesh (Cycles EMIT, CPU)
t = time.time()
S = A.tex
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
sc.render.bake.margin = 0; sc.render.bake.use_clear = True
mat = bpy.data.materials.new(A.name + "_unlit"); mat.use_nodes = True; obj.data.materials.append(mat)
N = mat.node_tree.nodes; L = mat.node_tree.links; N.clear()
out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission"); geo = N.new("ShaderNodeNewGeometry")
L.new(em.outputs[0], out.inputs[0])
bmin = np.array(obj.bound_box[0]); bmax = np.array(obj.bound_box[6])
def enc_node(src, lo, hi):
    mp = N.new("ShaderNodeVectorMath"); mp.operation = "MULTIPLY_ADD"
    s_ = 0.8 / np.maximum(hi - lo, 1e-6); mp.inputs[1].default_value = tuple(s_); mp.inputs[2].default_value = tuple(0.1 - lo * s_)
    L.new(src, mp.inputs[0]); return mp.outputs[0]
def bake_to(name, sock):
    im = bpy.data.images.new(name, S, S, alpha=True, float_buffer=True); im.colorspace_settings.name = "Non-Color"
    tn = N.new("ShaderNodeTexImage"); tn.image = im; N.active = tn
    L.new(sock, em.inputs[0]); bpy.ops.object.bake(type="EMIT", margin=0, use_clear=True)
    px = np.empty(S * S * 4, np.float32); im.pixels.foreach_get(px); return px.reshape(S, S, 4)[..., :3]
Pp = bake_to("pos", enc_node(geo.outputs["Position"], bmin, bmax))
Nn = bake_to("nrm", enc_node(geo.outputs["Normal"], np.array([-1., -1, -1]), np.array([1., 1, 1])))
lap("bake_geom_s", t)

# ---------- per-texel projection of every real view
t = time.time()
mask = Pp.min(2) > 0.05
pos = (Pp[mask] - 0.1) / 0.8 * (bmax - bmin) + bmin
nrm = (Nn[mask] - 0.1) / 0.8 * 2 - 1; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-8
surf = np.argwhere(occ & ~(np.pad(occ, 1)[2:, 1:-1, 1:-1] & np.pad(occ, 1)[:-2, 1:-1, 1:-1] & np.pad(occ, 1)[1:-1, 2:, 1:-1]
                          & np.pad(occ, 1)[1:-1, :-2, 1:-1] & np.pad(occ, 1)[1:-1, 1:-1, 2:] & np.pad(occ, 1)[1:-1, 1:-1, :-2]))
SV = np.stack([xs[surf[:, 0]], ys[surf[:, 1]], zs[surf[:, 2]]], 1)  # surface voxel centres (for depth maps / registration)

def frame(az, el):
    c = np.array([math.sin(math.radians(az)) * math.cos(math.radians(el)), -math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))])
    f = -c; r = np.cross(f, [0, 0, 1.0]); r /= np.linalg.norm(r); u = np.cross(r, f)
    return c, r, u

def visibility(c, r, u, pts, tol):
    """texel visible from direction c if nothing of the hull is in front of it: max depth map from surface voxels."""
    cell = vx * 1.5
    su, sv_, sd = SV @ r, SV @ u, SV @ c
    u0, v0 = su.min() - cell, sv_.min() - cell
    gw, gh = int((su.max() - u0) / cell) + 3, int((sv_.max() - v0) / cell) + 3
    D = np.full((gw, gh), -1e9, np.float32)
    np.maximum.at(D, (((su - u0) / cell).astype(int), ((sv_ - v0) / cell).astype(int)), sd)
    pu = np.clip(((pts @ r - u0) / cell).astype(int), 0, gw - 1); pv = np.clip(((pts @ u - v0) / cell).astype(int), 0, gh - 1)
    return (pts @ c) >= D[pu, pv] - tol

Pw = A.power
acc = np.zeros((len(pos), 3), np.float32); wsum = np.zeros(len(pos), np.float32)
cols, alphas, dots, dom = [], [], [], {}
side_az = {"front": 0, "right": 90, "back": 180, "left": 270}
for name, p in P.items():
    c, r, u = frame(side_az[name], 0)
    uu = pos @ r
    col, a = p.sample_side(uu, np.maximum(pos[:, 2], 0))
    vis = visibility(c, r, u, pos, vx * 4)
    w = np.clip(nrm @ c, 0, 1) ** Pw * a * vis
    acc += col * w[:, None]; wsum += w; dom[name] = w
    cols.append(col); alphas.append(a); dots.append(np.clip(nrm @ c, 0, 1))
for name, p in Q.items():
    az = int(name[1:]); c, r, u = frame(az, A.q_elev)
    hu, hv = SV @ r, SV @ u                         # hull bbox in this view, plate alpha bbox -> one scale (height-driven)
    s = (hv.max() - hv.min()) / max(1, p.bot - p.top)
    umid = (hu.max() + hu.min()) / 2; cmid = (p.c0 + p.c1) / 2
    colp = cmid + (pos @ r - umid) / s; rowp = p.top + (hv.max() - pos @ u) / s
    col = bilinear(p.rgb, colp, rowp); a = bilinear(p.wa, colp, rowp)[:, 0]
    vis = visibility(c, r, u, pos, vx * 4)
    w = np.clip(nrm @ c, 0, 1) ** Pw * a * vis * A.qw
    acc += col * w[:, None]; wsum += w; dom[name] = w
    cols.append(col); alphas.append(a); dots.append(np.clip(nrm @ c, 0, 1))
if TOP is not None:
    bx0, bx1, by0, by1 = stats.get("top_box_m") or (pos[:, 0].min(), pos[:, 0].max(), pos[:, 1].min(), pos[:, 1].max())
    col_ = TOP.c0 + (pos[:, 0] - bx0) / max(1e-3, bx1 - bx0) * (TOP.c1 - TOP.c0)
    row_ = TOP.top + (by1 - pos[:, 1]) / max(1e-3, by1 - by0) * (TOP.bot - TOP.top)
    c, r, u = np.array([0, 0, 1.0]), np.array([1.0, 0, 0]), np.array([0, 1.0, 0])
    vis = visibility(c, r, u, pos, vx * 4)
    w = np.clip(nrm[:, 2], 0, 1) ** Pw * bilinear(TOP.wa, col_, row_)[:, 0] * vis * 1.2
    acc += bilinear(TOP.rgb, col_, row_) * w[:, None]; wsum += w; dom["top"] = w
low = wsum < 1e-3
if low.any():  # undersides / occluded: nearest real views without visibility (never a mirrored flank)
    for col, a, dh in zip(cols, alphas, dots):
        w = (dh[low] ** Pw + 1e-4) * np.maximum(a[low], 1e-3); acc[low] += col[low] * w[:, None]; wsum[low] += w
names = list(dom); W_ = np.stack([dom[k] for k in names], 1)
best = np.argmax(W_, 1); has = W_.max(1) > 1e-3
stats["texels_dominant_view"] = {k: int(((best == i) & has).sum()) for i, k in enumerate(names)}
stats["texels_fallback"] = int(low.sum()); stats["texels_total"] = int(mask.sum())
stats["fallback_pct"] = round(100.0 * low.sum() / max(1, mask.sum()), 2)
rgb = acc / wsum[:, None]
TEX = np.zeros((S, S, 3), np.float32); TEX[mask] = rgb
TEX = bleed(TEX, mask, 16); far = TEX.max(2) == 0; TEX[far] = rgb.mean(0)
lap("project_s", t)

# ---------- texture -> image; displacement from the same texture on the dense mesh
t = time.time()
img = bpy.data.images.new(A.name + "_albedo", S, S, alpha=False)
img.pixels.foreach_set(np.concatenate([TEX, np.ones((S, S, 1), np.float32)], 2).ravel())
img.filepath_raw = os.path.join(A.out, A.name + "_albedo.png"); img.file_format = "PNG"; img.save(); img.pack()
if A.displace > 0:
    lum = TEX @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    lo_ = blur(lum, 24)                      # remove the broad light gradient: only local relief displaces
    hp = lum - lo_
    hp = np.clip(hp / (np.percentile(np.abs(hp[mask]), 98) + 1e-4), -1, 1) * 0.5 + 0.5
    hp[~mask] = 0.5
    him = bpy.data.images.new(A.name + "_height", S, S, alpha=False, float_buffer=True); him.colorspace_settings.name = "Non-Color"
    him.pixels.foreach_set(np.concatenate([np.repeat(hp[..., None], 3, 2), np.ones((S, S, 1), np.float32)], 2).ravel())
    tx = bpy.data.textures.new(A.name + "_hgt", type="IMAGE"); tx.image = him; tx.extension = "EXTEND"
    m = obj.modifiers.new("disp", "DISPLACE"); m.texture = tx; m.texture_coords = "UV"; m.strength = A.displace * 2; m.mid_level = 0.5
    bpy.ops.object.modifier_apply(modifier=m.name)
    stats["displace_m"] = A.displace
lap("displace_s", t)

# ---------- LODs: decimate AFTER the bake (UVs + the one texture kept)
t = time.time()
N.clear()
out = N.new("ShaderNodeOutputMaterial"); bg = N.new("ShaderNodeBackground"); tn = N.new("ShaderNodeTexImage"); tn.image = img
L.new(tn.outputs[0], bg.inputs[0]); L.new(bg.outputs[0], out.inputs[0])
lods = []
for k, target in enumerate(A.lods):
    ob = obj.copy(); ob.data = obj.data.copy(); ob.name = f"{A.name}_LOD{k}"; bpy.context.scene.collection.objects.link(ob)
    nt = ntris(ob)
    if nt > target: apply_mod(ob, "DECIMATE", ratio=target / nt, use_collapse_triangulate=True)
    apply_mod(ob, "TRIANGULATE")
    lods.append(ob)
stats["lod_tris"] = [ntris(o_) for o_ in lods]
bpy.data.objects.remove(obj)
for ob in bpy.data.objects: ob.select_set(ob in lods)
lap("lod_s", t)
t = time.time()
glb = os.path.join(A.out, A.name + ".glb")
kw = dict(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)
if A.jpeg: kw.update(export_image_format="JPEG", export_jpeg_quality=A.jpeg)
bpy.ops.export_scene.gltf(**kw)
lap("export_s", t)
stats.update(tex=S, height_m=A.height, vox_m=round(vx, 4), glb_bytes=os.path.getsize(glb), total_s=round(time.time() - T0, 1),
             bbox_m=[round(float(x), 2) for x in (bmax - bmin)], lods_target=A.lods)
json.dump(stats, open(os.path.join(A.out, A.name + "_stats.json"), "w"), indent=1)
print("[bake_hull] DONE", json.dumps(stats))
