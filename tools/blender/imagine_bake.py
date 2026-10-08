"""imagine_bake.py - turn Imagine orthographic cutouts into ONE baked, unlit, phone GLB.

Usage (headless, CPU only):
  blender --background --factory-startup --python imagine_bake.py -- \
      --front butte-0.png --side butte-0-side.png --back butte-0-back.png \
      [--left left.png] [--right right.png] [--top butte-0-top.png] \
      --out outdir [--height 30] [--tris 4000] [--tex 2048] [--vox 0.18] [--jpeg 90] \
      [--talus 2.5] [--hull front,side] [--bury 0.8]
  This test (Ember Mesa butte-0, ~29 s on CPU):
  /home/box/.local/bin/blender --background --factory-startup --python imagine_bake.py -- --front in/butte-0.png \
      --side in/butte-0-side.png --back in/butte-0-back.png --top in/butte-0-top.png --out out \
      --height 30 --vox 0.18 --bury 0.8 --hull front,side
  --height = metres from the tip to the ground incl. talus (30 ~ game scale for card h:40).

Views are straight-alpha RGBA PNGs of ONE object, same light, orthographic-ish, ground at the bottom.
  front = seen from -Y (game +Z), back = from +Y, right/side = from +X, left = from -X (default: side reused).
  top   = seen from above, image-up = back (+Y). Optional.
Pipeline: silhouettes -> visual hull (voxels) -> voxel remesh + smooth + decimate -> smart UV ->
Cycles EMIT bakes of position + normal -> per-texel projection of the views, weighted by
dot(normal, view)^P x visibility (ortho depth from hull) x eroded alpha -> edge bleed -> GLB (KHR_materials_unlit).
Every texel colour is a bilinear sample of the input Imagine pixels (blend of them). No procedural colour.
Writes: out/mesa.glb, out/mesa_albedo.png, out/stats.json
"""
import bpy, bmesh, sys, os, json, time, math, argparse
import numpy as np

T0 = time.time()
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--front", required=True); ap.add_argument("--back"); ap.add_argument("--side")
ap.add_argument("--left"); ap.add_argument("--right"); ap.add_argument("--top")
ap.add_argument("--out", required=True)
ap.add_argument("--height", type=float, default=40.0)
ap.add_argument("--tris", type=int, default=4000)
ap.add_argument("--tex", type=int, default=2048)
ap.add_argument("--vox", type=float, default=0.25)
ap.add_argument("--power", type=float, default=3.0)
ap.add_argument("--jpeg", type=int, default=90)
ap.add_argument("--bury", type=float, default=1.0)
ap.add_argument("--talus", type=float, default=2.5, help="metres of Imagine rubble kept as a flared apron (0 = cut at flare)")
ap.add_argument("--hull", default="front,back,side", help="views whose silhouettes carve the hull (texture always uses all)")
A = ap.parse_args(argv)
os.makedirs(A.out, exist_ok=True)
stats = {}
def lap(k, t):
    stats[k] = round(time.time() - t, 2); print(f"[imagine_bake] {k}: {stats[k]}s", flush=True)

# ---------- image helpers ----------
def load_rgba(path):
    im = bpy.data.images.load(os.path.abspath(path))
    w, h = im.size
    px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px)
    return px.reshape(h, w, 4)[::-1].copy()  # top-down rows, raw sRGB values 0..1, straight alpha

def shift(a, dy, dx):
    return np.roll(np.roll(a, dy, 0), dx, 1)

def bleed(rgb, valid, iters):
    """Push opaque colours outward so bilinear taps near the edge never pick up black/green matte."""
    rgb = rgb.copy(); v = valid.astype(np.float32)
    for _ in range(iters):
        acc = np.zeros_like(rgb); cnt = np.zeros(v.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sv = shift(v, dy, dx); acc += shift(rgb, dy, dx) * sv[..., None]; cnt += sv
        grow = (v == 0) & (cnt > 0)
        rgb[grow] = acc[grow] / cnt[grow][:, None]; v[grow] = 1
    return rgb

def erode(m, r):
    m = m.copy()
    for _ in range(r):
        m = m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
    return m

def blur(a, r):
    for _ in range(r):
        a = (a + shift(a, 1, 0) + shift(a, -1, 0) + shift(a, 0, 1) + shift(a, 0, -1)) / 5.0
    return a

def bilinear(img, col, row):
    h, w = img.shape[:2]
    col = np.clip(col, 0, w - 1.001); row = np.clip(row, 0, h - 1.001)
    c0 = np.floor(col).astype(np.int32); r0 = np.floor(row).astype(np.int32)
    fc = (col - c0)[:, None]; fr = (row - r0)[:, None]
    if img.ndim == 2: img = img[..., None]
    a = img[r0, c0] * (1 - fc) + img[r0, c0 + 1] * fc
    b = img[r0 + 1, c0] * (1 - fc) + img[r0 + 1, c0 + 1] * fc
    return a * (1 - fr) + b * fr

class View:
    """A side view: silhouette rows normalised so the tip is at z=H and the talus flare is ground (z=0)."""
    def __init__(self, path, mirror=False):
        px = load_rgba(path)
        if mirror: px = px[:, ::-1].copy()
        self.h, self.w = px.shape[:2]
        a = px[..., 3]; m = a > 0.5
        rows = np.where(m.any(1))[0]; top, bot = rows[0], rows[-1]
        wid = np.array([np.ptp(np.where(m[r])[0]) if m[r].any() else 0 for r in range(self.h)])
        span = bot - top
        mid = wid[top + int(span * .3): top + int(span * .8)]
        medw = np.median(mid)
        flare = bot
        for r in range(top + int(span * .6), bot + 1):  # rubble flare starts here
            if wid[r] > 1.35 * medw or (m[r, 0] and m[r, -1]): flare = r; break
        g = flare
        if A.talus > 0 and flare < bot:
            # keep the Imagine rubble as a talus apron, clipped to a cone so frame-cut rubble never becomes a slab
            cols0 = np.where(m[flare - 1])[0] if m[flare - 1].any() else np.array([0, self.w - 1])
            lo, hi = cols0[0], cols0[-1]
            g = min(bot, flare + int(A.talus / (A.height / float(flare - top))))
            for r in range(flare, self.h):
                grow = int((r - flare) * 1.2)
                m[r, :max(0, lo - grow)] = False; m[r, hi + grow + 1:] = False
                if r > g: m[r] = False
        self.top, self.ground = top, g
        self.mpp = A.height / float(g - top)  # tip -> ground (incl. talus) = --height           # metres per pixel
        lr = [(np.where(m[r])[0][[0, -1]]) for r in range(top + int(span * .3), top + int(span * .8)) if m[r].any()]
        self.cx = float(np.mean([(l + r) * .5 for l, r in lr]))
        self.mask = m
        self.rgb = bleed(px[..., :3], erode(m, 1), 24)
        self.wa = blur(erode(m, 3).astype(np.float32), 3)  # soft weight: fades over ~6 px inside the silhouette
        print(f"[imagine_bake] {os.path.basename(path)}: {self.w}x{self.h} tip row {top} ground row {g} mpp {self.mpp:.4f} cx {self.cx:.1f}")
    def inside(self, u_m, z_m):  # u in metres along image-right, z metres above ground
        col = np.round(self.cx + u_m / self.mpp).astype(int); row = np.round(self.ground - z_m / self.mpp).astype(int)
        ok = (col >= 0) & (col < self.w) & (row >= 0) & (row < self.h)
        out = np.zeros(col.shape, bool); out[ok] = self.mask[row[ok], col[ok]]
        return out
    def sample(self, u_m, z_m):
        col = self.cx + u_m / self.mpp; row = self.ground - z_m / self.mpp
        return bilinear(self.rgb, col, row), bilinear(self.wa, col, row)[:, 0]

t = time.time()
front = View(A.front)
back = View(A.back) if A.back else View(A.front, mirror=True)
right = View(A.right or A.side or A.front)
left = View(A.left) if A.left else right  # one side still reused: left sees it mirrored (consistent silhouette)
stats["left_view"] = "real" if A.left else "side reused"
stats["back_view"] = "real" if A.back else "front mirrored"
lap("load_views_s", t)

# ---------- visual hull ----------
t = time.time()
H, vx = A.height, A.vox
def half_extent(v):
    cols = np.where(v.mask[v.top:v.ground + 1].any(0))[0]
    return max(abs(cols[0] - v.cx), abs(cols[-1] - v.cx)) * v.mpp
X = max(half_extent(front), half_extent(back)) + 1; Y = max(half_extent(right), half_extent(left)) + 1
xs = np.arange(-X, X, vx) + vx / 2; ys = np.arange(-Y, Y, vx) + vx / 2
zs = np.arange(-A.bury, H, vx) + vx / 2
GX, GZ = np.meshgrid(xs, np.maximum(zs, 0.0), indexing="ij")
GY, GZ2 = np.meshgrid(ys, np.maximum(zs, 0.0), indexing="ij")
HV = A.hull.split(",")
f_ok = front.inside(GX, GZ) & (back.inside(-GX, GZ) if "back" in HV else True)   # (nx, nz)
s_ok = right.inside(GY, GZ2) & left.inside(GY, GZ2)        # (ny, nz)  (left = mirrored still -> same mapping)
stats["hull_views"] = A.hull
occ = f_ok[:, None, :] & s_ok[None, :, :]
nx, ny, nz = occ.shape
stats["voxels"] = [nx, ny, nz]; stats["occupied"] = int(occ.sum())
# ortho depth maps for visibility (from the hull itself)
def first(a, axis, rev=False):
    a2 = np.flip(a, axis) if rev else a
    idx = np.argmax(a2, axis=axis).astype(np.float32); has = a2.any(axis)
    if rev: idx = a.shape[axis] - 1 - idx
    idx[~has] = np.nan
    return idx
dep = {"front": first(occ, 1), "back": first(occ, 1, True), "right": first(occ, 0, True),
       "left": first(occ, 0), "top": first(occ, 2, True)}
# top-region box (cap) for the top still
zt = dep["top"]; capz = np.where(np.isnan(zt), -1, zt) * vx - A.bury
capm = capz > 0.8 * H
ci, cj = np.where(capm)
cap_box = (xs[ci.min()], xs[ci.max()], ys[cj.min()], ys[cj.max()]) if len(ci) else (-X, X, -Y, Y)

# boundary quads -> mesh
o = np.pad(occ, 1)
verts_key = {}
quads = []
def add_faces(axis):
    d = np.diff(o.astype(np.int8), axis=axis)  # +1: out->in, -1: in->out
    idx = np.argwhere(d != 0)
    sgn = d[d != 0]
    return idx, sgn
allq = []
for axis in range(3):
    idx, sgn = add_faces(axis)
    i, j, k = idx[:, 0], idx[:, 1], idx[:, 2]
    # corners in padded-corner coords (corner c of cell n sits between padded cells n and n+1)
    if axis == 0:
        c = np.stack([np.stack([i + 1, j, k], 1), np.stack([i + 1, j + 1, k], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i + 1, j, k + 1], 1)], 1)
    elif axis == 1:
        c = np.stack([np.stack([i, j + 1, k], 1), np.stack([i, j + 1, k + 1], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i + 1, j + 1, k], 1)], 1)
    else:
        c = np.stack([np.stack([i, j, k + 1], 1), np.stack([i + 1, j, k + 1], 1), np.stack([i + 1, j + 1, k + 1], 1), np.stack([i, j + 1, k + 1], 1)], 1)
    flip = sgn > 0  # inside is the higher cell -> normal must point to lower: reverse
    c[flip] = c[flip][:, ::-1]
    allq.append(c)
allq = np.concatenate(allq, 0)
flat = allq.reshape(-1, 3)
key = (flat[:, 0] * (ny + 3) + flat[:, 1]) * (nz + 3) + flat[:, 2]
uk, inv = np.unique(key, return_inverse=True)
cz_ = uk % (nz + 3); cy_ = (uk // (nz + 3)) % (ny + 3); cx_ = uk // ((nz + 3) * (ny + 3))
V = np.stack([(cx_ - 1) * vx - X, (cy_ - 1) * vx - Y, (cz_ - 1) * vx - A.bury], 1).astype(np.float32)
F = inv.reshape(-1, 4)
me = bpy.data.meshes.new("hull"); me.from_pydata(V.tolist(), [], F.tolist()); me.update()
for ob in list(bpy.data.objects): bpy.data.objects.remove(ob)
obj = bpy.data.objects.new("mesa", me); bpy.context.scene.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj; obj.select_set(True)
lap("hull_s", t)

t = time.time()
m = obj.modifiers.new("remesh", "REMESH"); m.mode = "VOXEL"; m.voxel_size = vx * 1.4; m.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier="remesh")
m = obj.modifiers.new("smooth", "LAPLACIANSMOOTH"); m.iterations = 12; m.lambda_factor = 1.2; m.use_volume_preserve = True
bpy.ops.object.modifier_apply(modifier="smooth")
nt = sum(len(p.vertices) - 2 for p in obj.data.polygons)
m = obj.modifiers.new("dec", "DECIMATE"); m.ratio = min(1.0, A.tris / max(1, nt)); m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="dec")
m = obj.modifiers.new("tri", "TRIANGULATE"); bpy.ops.object.modifier_apply(modifier="tri")
bpy.ops.object.shade_smooth()
# drop the buried floor: never visible, would waste texture space
bm = bmesh.new(); bm.from_mesh(obj.data)
kill = [f for f in bm.faces if f.calc_center_median().z < -0.3 * A.bury and f.normal.z < -0.5]
bmesh.ops.delete(bm, geom=kill, context="FACES"); bm.to_mesh(obj.data); bm.free()
stats["tris"] = len(obj.data.polygons); stats["verts"] = len(obj.data.vertices)
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
lap("mesh_uv_s", t)

# ---------- bake position + normal (Cycles EMIT, CPU) ----------
t = time.time()
S = A.tex
sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 1
sc.render.bake.margin = 0; sc.render.bake.use_clear = True
mat = bpy.data.materials.new("bakemat"); mat.use_nodes = True; obj.data.materials.append(mat)
N = mat.node_tree.nodes; L = mat.node_tree.links; N.clear()
out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission"); geo = N.new("ShaderNodeNewGeometry")
L.new(em.outputs[0], out.inputs[0])
bmin = np.array(obj.bound_box[0]); bmax = np.array(obj.bound_box[6])
def enc_node(src, lo, hi):
    mp = N.new("ShaderNodeVectorMath"); mp.operation = "MULTIPLY_ADD"
    sc_ = 0.8 / (hi - lo); mp.inputs[1].default_value = tuple(sc_); mp.inputs[2].default_value = tuple(0.1 - lo * sc_)
    L.new(src, mp.inputs[0]); return mp.outputs[0]
def bake_to(name, sock):
    im = bpy.data.images.new(name, S, S, alpha=True, float_buffer=True); im.colorspace_settings.name = "Non-Color"
    tn = N.new("ShaderNodeTexImage"); tn.image = im; N.active = tn
    l = L.new(sock, em.inputs[0])
    bpy.ops.object.bake(type="EMIT", margin=0, use_clear=True)
    px = np.empty(S * S * 4, np.float32); im.pixels.foreach_get(px)
    return px.reshape(S, S, 4)[..., :3]
P = bake_to("pos", enc_node(geo.outputs["Position"], bmin, bmax))
Nn = bake_to("nrm", enc_node(geo.outputs["Normal"], np.array([-1., -1, -1]), np.array([1., 1, 1])))
lap("bake_geom_s", t)

# ---------- project the Imagine views per texel ----------
t = time.time()
mask = P.min(2) > 0.05
pos = (P[mask] - 0.1) / 0.8 * (bmax - bmin) + bmin
nrm = (Nn[mask] - 0.1) / 0.8 * 2 - 1; nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-8
px_, py_, pz_ = pos[:, 0], pos[:, 1], np.maximum(pos[:, 2], 0)
ii = np.clip(((px_ + X) / vx).astype(int), 0, nx - 1); jj = np.clip(((py_ + Y) / vx).astype(int), 0, ny - 1)
kk = np.clip(((pos[:, 2] + A.bury) / vx).astype(int), 0, nz - 1)
tol = 5.0  # voxels
def vis(name):
    if name == "front": d = dep[name][ii, kk]; v = jj <= d + tol
    elif name == "back": d = dep[name][ii, kk]; v = jj >= d - tol
    elif name == "right": d = dep[name][jj, kk]; v = ii >= d - tol
    elif name == "left": d = dep[name][jj, kk]; v = ii <= d + tol
    else: d = dep[name][ii, jj]; v = kk >= d - tol
    return v | np.isnan(d)
Pw = A.power
views = [("front", front, px_, np.array([0, -1, 0.])), ("back", back, -px_, np.array([0, 1, 0.])),
         ("right", right, py_, np.array([1, 0, 0.])), ("left", left, py_, np.array([-1, 0, 0.]))]
acc = np.zeros((len(pos), 3), np.float32); wsum = np.zeros(len(pos), np.float32)
cols, alphas, dots = [], [], []
for name, v, u, d in views:
    c, a = v.sample(u, pz_)
    dt = np.clip(nrm @ d, 0, 1)
    w = (dt ** Pw) * a * vis(name)
    acc += c * w[:, None]; wsum += w
    cols.append(c); alphas.append(a)
    nh = nrm.copy(); nh[:, 2] = 0; nh /= np.linalg.norm(nh, axis=1, keepdims=True) + 1e-8
    dots.append(np.clip(nh @ d, 0, 1))
top_used = 0
if A.top:
    tp = load_rgba(A.top); tm = tp[..., 3] > 0.5; r_, c_ = np.where(tm)
    inset = 0.06
    ty0, ty1, tx0, tx1 = r_.min(), r_.max(), c_.min(), c_.max()
    dy, dx = (ty1 - ty0) * inset, (tx1 - tx0) * inset
    ty0, ty1, tx0, tx1 = ty0 + dy, ty1 - dy, tx0 + dx, tx1 - dx
    trgb = bleed(tp[..., :3], erode(tm, 2), 24)
    bx0, bx1, by0, by1 = cap_box
    col = tx0 + (px_ - bx0) / max(1e-3, bx1 - bx0) * (tx1 - tx0)
    row = ty0 + (by1 - py_) / max(1e-3, by1 - by0) * (ty1 - ty0)
    inbox = (px_ >= bx0) & (px_ <= bx1) & (py_ >= by0) & (py_ <= by1)
    gate = np.clip((pz_ - 0.75 * H) / (0.08 * H), 0, 1)
    w = np.clip(nrm[:, 2], 0, 1) ** Pw * inbox * gate * vis("top") * 1.5
    acc += bilinear(trgb, col, row) * w[:, None]; wsum += w
    top_used = int((w > 0.25).sum())
stats["texels_top_dominant"] = top_used
# fallback: undersides / occluded texels -> nearest horizontal views (no visibility), still Imagine pixels
low = wsum < 1e-3
if low.any():
    for c, a, dh in zip(cols, alphas, dots):
        w = (dh[low] ** Pw + 1e-4) * np.maximum(a[low], 1e-3)
        acc[low] += c[low] * w[:, None]; wsum[low] += w
stats["texels_fallback"] = int(low.sum()); stats["texels_total"] = int(mask.sum())
rgb = acc / wsum[:, None]
TEX = np.zeros((S, S, 3), np.float32); TEX[mask] = rgb
TEX = bleed(TEX, mask, 16)  # gutter padding so mips never sample black
far = TEX.max(2) == 0
TEX[far] = rgb.mean(0)  # beyond the 16 px gutter: flat mean of the baked Imagine texels (never seen, only mips)
lap("project_s", t)

# ---------- write texture + unlit material + GLB ----------
t = time.time()
img = bpy.data.images.new("mesa_albedo", S, S, alpha=False)
rgba = np.concatenate([TEX, np.ones((S, S, 1), np.float32)], 2).ravel()  # TEX is already bottom-up like the bake buffers
img.pixels.foreach_set(rgba); img.filepath_raw = os.path.join(A.out, "mesa_albedo.png"); img.file_format = "PNG"; img.save()
img.pack()
N.clear()
out = N.new("ShaderNodeOutputMaterial"); bg = N.new("ShaderNodeBackground"); tn = N.new("ShaderNodeTexImage"); tn.image = img
L.new(tn.outputs[0], bg.inputs[0]); L.new(bg.outputs[0], out.inputs[0])
mat.name = "mesa_unlit"
glb = os.path.join(A.out, "mesa.glb")
kw = dict(filepath=glb, export_format="GLB", use_selection=True, export_apply=True)
if A.jpeg: kw.update(export_image_format="JPEG", export_jpeg_quality=A.jpeg)
bpy.ops.export_scene.gltf(**kw)
lap("export_s", t)
stats.update(tex=S, glb_bytes=os.path.getsize(glb), total_s=round(time.time() - T0, 1),
             bbox_m=[round(float(x), 2) for x in (bmax - bmin)], cap_box=[round(float(c), 2) for c in cap_box])
json.dump(stats, open(os.path.join(A.out, "stats.json"), "w"), indent=1)
print("[imagine_bake] DONE", json.dumps(stats))
