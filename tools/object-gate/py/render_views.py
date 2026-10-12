"""Blender: render the 5 review views of one object + per-view ray-cast passes (depth, normal, face, coverage).
blender -b -P render_views.py -- <mesh.obj|.glb> <outdir> [--views json] [--masks front.png,side.png] [--samples 16] [--res 720x1280]
Coverage: each hit face's UV centroid samples the material's plate mask (SAM2 object mask); outside mask or no image = uncovered.
"""
import bpy, sys, json, os, math, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]
mesh, out = a[0], a[1]; os.makedirs(out, exist_ok=True)
opt = {a[i]: a[i + 1] for i in range(2, len(a) - 1, 2)}
W, H = map(int, opt.get('--res', '720x1280').split('x'))
views = json.load(open(opt['--views'])) if '--views' in opt else None
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
if mesh.endswith('.obj'): bpy.ops.wm.obj_import(filepath=mesh, forward_axis='NEGATIVE_Z', up_axis='Y')
else: bpy.ops.import_scene.gltf(filepath=mesh)
objs = [o for o in sc.objects if o.type == 'MESH']
for o in objs:
    for m in o.data.materials:
        if not m or not m.use_nodes: continue
        b = m.node_tree.nodes.get('Principled BSDF')
        if b: b.inputs['Roughness'].default_value = 1.0; b.inputs['Metallic'].default_value = 0.0; b.inputs['Specular IOR Level'].default_value = 0.1
        for n in list(m.node_tree.nodes):
            if n.type == 'TEX_IMAGE':
                n.interpolation = 'Cubic'
                if b and '--unlit' in opt:   # Imagine skin keeps its own light; diffuse adds the world-fixed shadow cue
                    nt = m.node_tree; e = nt.nodes.new('ShaderNodeEmission'); e.inputs[1].default_value = float(opt['--unlit'])
                    ad = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(n.outputs[0], e.inputs[0])
                    outn = nt.nodes['Material Output']; nt.links.new(b.outputs[0], ad.inputs[0]); nt.links.new(e.outputs[0], ad.inputs[1])
                    nt.links.new(ad.outputs[0], outn.inputs[0])
# bbox
pts = np.array([o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]); lo, hi = pts.min(0), pts.max(0)
c = (lo + hi) / 2; ext = hi - lo
if views is None:   # generic: block front = +Y in Blender after OBJ import (OBJ +Z -> Blender -Y); left = -X
    r = float(max(ext[0], ext[1], ext[2])) * 1.4; t = [float(c[0]), float(c[1]), float(lo[2] + ext[2] * 0.45)]
    views = {'phone': dict(pos=[c[0] - r * 0.4, lo[1] - r, lo[2] + 4.0], tgt=t), 'oblique45': dict(pos=[c[0] - r * 0.71, c[1] - r * 0.71, lo[2] + 1.7], tgt=t),
             'grazing': dict(pos=[c[0] - r * 1.2, lo[1] - 0.15 * ext[1], lo[2] + 1.7], tgt=[float(c[0]), float(lo[1]), t[2]]),
             'close8m': dict(pos=[c[0] - 3, lo[1] - 8, lo[2] + 1.7], tgt=[float(c[0]), float(lo[1]), lo[2] + 3.5]),
             'close3m': dict(pos=[c[0] - 1.2, lo[1] - 3, lo[2] + 1.7], tgt=[float(c[0]), float(lo[1]), lo[2] + 2.6])}
    views = {k: dict(pos=[float(x) for x in v['pos']], tgt=[float(x) for x in v['tgt']]) for k, v in views.items()}
# world + sun from the left, low (~12 deg), cold
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.11, 0.14, 0.21, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.6
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sc.collection.objects.link(sun)
sun.data.energy = 2.2; sun.data.color = (0.85, 0.9, 1.0); sun.data.angle = math.radians(2)
sun.rotation_euler = (math.radians(78), 0, math.radians(-70))
if '--ground' in opt:
    bpy.ops.mesh.primitive_plane_add(size=400, location=(c[0], c[1], lo[2] - 0.005)); g = bpy.context.object
    gm = bpy.data.materials.new('snow'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs[0].default_value = (0.78, 0.84, 0.9, 1)
    gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1; g.data.materials.append(gm); g.name = 'ground'
sc.render.engine = 'CYCLES'; sc.cycles.samples = int(opt.get('--samples', 16)); sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = W, H; sc.view_settings.view_transform = 'Standard'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.angle = math.radians(60)
masks = {}
for spec in opt.get('--masks', '').split(','):
    if '=' in spec:
        k, p = spec.split('='); im = bpy.data.images.load(p); arr = np.array(im.pixels[:], np.float32).reshape(im.size[1], im.size[0], -1)[..., 0]
        masks[k] = arr
dg = bpy.context.evaluated_depsgraph_get()
def look(pos, tgt):
    cam.location = Vector(pos); d = Vector(tgt) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
meta = {}
for name, v in views.items():
    look(v['pos'], v['tgt']); bpy.context.view_layer.update()
    if '--nocolor' not in opt:
        sc.render.filepath = os.path.join(out, name + '.png'); bpy.ops.render.render(write_still=True)
    # ray-cast passes at 1/4 res
    rw, rh = W // int(opt.get('--raydiv', 4)), H // int(opt.get('--raydiv', 4)); D = np.full((rh, rw), np.nan, np.float32); N = np.zeros((rh, rw, 3), np.float32)
    FID = np.full((rh, rw), -1, np.int32); COV = np.full((rh, rw), -1, np.int8)
    fr = cam.data.view_frame(scene=sc); mw = cam.matrix_world
    tr, tl, bl = [mw @ p for p in (fr[0], fr[3], fr[2])]
    for j in range(rh):
        for i in range(rw):
            p = tl + (tr - tl) * ((i + .5) / rw) + (bl - tl) * ((j + .5) / rh)
            ok, loc, nrm, fi, ob, _ = sc.ray_cast(dg, mw.translation, (p - mw.translation).normalized())
            if not ok or ob.name == 'ground': continue
            D[j, i] = (loc - mw.translation).length; N[j, i] = nrm; FID[j, i] = fi
            cov = 0
            me = ob.data
            if me.uv_layers and masks:
                poly = me.polygons[fi]; uvl = me.uv_layers.active.data
                uv = np.mean([uvl[li].uv[:] for li in poly.loop_indices], 0)
                mat = me.materials[poly.material_index].name if me.materials else ''
                mk = masks.get(mat.split('.')[0])
                if mk is not None and 0 <= uv[0] <= 1 and 0 <= uv[1] <= 1:
                    cov = int(mk[int(uv[1] * (mk.shape[0] - 1)), int(uv[0] * (mk.shape[1] - 1))] > 0.5)
            COV[j, i] = cov
    np.savez_compressed(os.path.join(out, name + '-pass.npz'), depth=D, normal=N, face=FID, cov=COV)
    meta[name] = dict(v, png=name + '.png')
json.dump(dict(views=meta, bbox=[lo.tolist(), hi.tolist()]), open(os.path.join(out, 'views.json'), 'w'), indent=1)
