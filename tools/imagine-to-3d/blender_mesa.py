"""Blender (headless) stage: heightfield -> mesh -> voxel remesh -> displace along normals by the plates' relief
(projected from each plate camera) -> decimate LODs -> GLB.  blender -b -P blender_mesa.py -- <prefix> <outdir>"""
import bpy, bmesh, sys, json, numpy as np
argv = sys.argv[sys.argv.index("--") + 1:]
pre, outdir = argv[0], argv[1]
cfg = json.loads(argv[2]) if len(argv) > 2 else {}
VOXEL = cfg.get("voxel", 0.35); AMP_WALL = cfg.get("ampWall", 0.7); AMP_TOP = cfg.get("ampTop", 0.18)
LODS = cfg.get("lods", [60000, 12000, 2500])
H = np.load(pre + "-H.npy"); meta = json.load(open(pre + "-meta.json"))
n = H.shape[0]; g = meta["grid_m"]; half = (n - 1) / 2 * g
bpy.ops.wm.read_factory_settings(use_empty=True)
# heightfield grid (closed by a sunk skirt so the remesher sees a solid)
xs = np.linspace(-half, half, n)
verts = [(float(xs[j]), float(xs[i]), float(H[i, j])) for i in range(n) for j in range(n)]   # blender z-up: (x, y=z_three, z=up)
faces = [(i * n + j, i * n + j + 1, (i + 1) * n + j + 1, (i + 1) * n + j) for i in range(n - 1) for j in range(n - 1)]
me = bpy.data.meshes.new("hf"); me.from_pydata(verts, [], faces); me.update()
ob = bpy.data.objects.new("mesa", me); bpy.context.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
sol = ob.modifiers.new("solid", "SOLIDIFY"); sol.thickness = 4.0; sol.offset = -1
bpy.ops.object.modifier_apply(modifier="solid")
rm = ob.modifiers.new("remesh", "REMESH"); rm.mode = "VOXEL"; rm.voxel_size = VOXEL; rm.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier="remesh")
# drop everything below the sink line (never seen, saves tris)
bm = bmesh.new(); bm.from_mesh(ob.data)
sink = -meta["sink_m"]
kill = [v for v in bm.verts if v.co.z < sink + 1.0]
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bm.normal_update()
# displacement along normals, sampled with the runtime's own projection set (proj.py; three local coords)
P = json.load(open(pre + "-proj.json")); DIRS = P["dirs"]; SP = {k: np.array(v) for k, v in P["spans"].items()}
R = {k: np.load(f"{pre}-relief-{k}.npy") for k in ("front", "side", "back", "top")}
def mirror(x, a, b):
    L = np.maximum(b - a, 1.0); t = np.mod(x - a, 2 * L); return a + np.where(t < L, t, 2 * L - t)
vs = [v for v in bm.verts]
co = np.array([(v.co.x, v.co.z, -v.co.y) for v in vs]); nr = np.array([(v.normal.x, v.normal.z, -v.normal.y) for v in vs])
Nd = np.array([d["n"] for d in DIRS]); W = np.maximum(nr @ Nd.T, 0) ** 16; W /= W.sum(1, keepdims=True) + 1e-9
rel = np.zeros(len(vs)); wtop = W[:, 16]
for i, d in enumerate(DIRS):
    sel = W[:, i] > 1e-3
    if not sel.any(): continue
    p = co[sel]; img = R[d["plate"]]
    col = d["c0"] + p @ np.array(d["t"]) * d["k"]; row = d["r0"] - p @ np.array(d["v"]) * d["k"]
    if d["wrap"]:
        row = mirror(row, meta["top_row"], meta["base_row"])
        sp = SP[d["plate"]][np.clip(row.astype(int), 0, len(SP[d["plate"]]) - 1)]
        col = mirror(col, sp[:, 0], sp[:, 1])
    ci = np.clip(col.astype(int), 0, img.shape[1] - 1); ri = np.clip(row.astype(int), 0, img.shape[0] - 1)
    rel[sel] += W[sel, i] * img[ri, ci]
# oblique (scree / rounded ledge) faces take half the wall amplitude: full-strength relief there decimates into spikes
wobl = W[:, 8:16].sum(1)
amp = AMP_WALL * (1 - wtop - wobl) + AMP_WALL * 0.5 * wobl + AMP_TOP * wtop
fade = np.clip(co[:, 1] / 2.0, 0, 1)
dsp = rel * amp * fade
# smooth the displacement field over the mesh (2 rings) so a single bright/dark plate pixel cannot raise a spike
bm.verts.ensure_lookup_table()
index = {v.index: k for k, v in enumerate(vs)}
nb = [[index[e.other_vert(v).index] for e in v.link_edges] for v in vs]
for _ in range(cfg.get("dispSmooth", 2)):
    dsp = np.array([0.5 * dsp[k] + 0.5 * (dsp[nb[k]].mean() if nb[k] else dsp[k]) for k in range(len(vs))])
for v, dd in zip(vs, dsp):
    if v.co.z > 0.3: v.co += v.normal * float(dd)
bm.to_mesh(ob.data); bm.free()
ob.data.update()
out = {}
base_tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
src = ob
for li, target in enumerate(LODS):
    bpy.ops.object.select_all(action="DESELECT")
    c = src.copy(); c.data = src.data.copy(); c.name = f"mesa_lod{li}"; bpy.context.collection.objects.link(c)
    bpy.context.view_layer.objects.active = c; c.select_set(True)
    bpy.ops.object.modifier_add(type="TRIANGULATE"); bpy.ops.object.modifier_apply(modifier="Triangulate")
    tris = len(c.data.polygons)
    if tris > target:
        d = c.modifiers.new("dec", "DECIMATE"); d.ratio = target / tris; d.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="dec")
    for p in c.data.polygons: p.use_smooth = True
    try:   # crisp ledges: split normals above SHARP_DEG (strata edges stay hard, rock faces stay smooth)
        bpy.ops.object.shade_smooth_by_angle(angle=np.deg2rad(cfg.get("sharpDeg", 50)))
    except Exception as e:
        print("smooth-by-angle unavailable", e)
    out[f"lod{li}"] = len(c.data.polygons)
bpy.data.objects.remove(src)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=outdir + "/mesa.glb", export_format="GLB", use_selection=True, export_yup=True,
                          export_normals=True, export_texcoords=False, export_materials="NONE", export_apply=True)
out["remeshTris"] = base_tris
json.dump(out, open(outdir + "/mesa-lods.json", "w"), indent=1)
print("LODS", out)
