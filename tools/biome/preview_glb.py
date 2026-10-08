"""preview_glb.py - unlit turntable contact sheet of a baked GLB (LOD0..2), for QC and PR proofs.

  blender --background --factory-startup --python tools/biome/preview_glb.py -- in.glb out.jpg [--size 384] [--el 12]

Workbench, FLAT lighting, TEXTURE colour = exactly the baked Imagine texels (no light added). Row 1: LOD0 at
azimuth 0/90/180/270 + 45. Row 2: LOD1 and LOD2 at 0 and 135.
"""
import bpy, sys, math, os
import numpy as np
argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
size = int(argv[argv.index("--size") + 1]) if "--size" in argv else 384
el = float(argv[argv.index("--el") + 1]) if "--el" in argv else 12.0
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "FLAT"; sc.display.shading.color_type = "TEXTURE"
sc.render.resolution_x = sc.render.resolution_y = size; sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w"); sc.world.color = (0.18, 0.2, 0.24)
meshes = sorted([o for o in sc.objects if o.type == "MESH"], key=lambda o: o.name)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = "ORTHO"
tiles = []
def shot(ob, az):
    for o in meshes: o.hide_render = o is not ob
    import mathutils
    bb = [ob.matrix_world @ mathutils.Vector(c) for c in ob.bound_box]
    lo = mathutils.Vector([min(v[i] for v in bb) for i in range(3)]); hi = mathutils.Vector([max(v[i] for v in bb) for i in range(3)])
    ctr = (lo + hi) / 2; rad = (hi - lo).length / 2
    cam.data.ortho_scale = rad * 2.1
    a, e = math.radians(az), math.radians(el)
    d = mathutils.Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))  # glTF import: Y-up -> Z-up
    cam.location = ctr + d * rad * 4
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = rad * 10
    p = f"/tmp/_pv_{ob.name}_{az}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(p); px = np.empty(size * size * 4, np.float32); im.pixels.foreach_get(px)
    os.remove(p)
    return px.reshape(size, size, 4)[::-1, :, :3]
row1 = [shot(meshes[0], az) for az in (0, 45, 90, 180, 270)]
row2 = []
for ob in meshes[1:3]:
    row2 += [shot(ob, 0), shot(ob, 135)]
while len(row2) < 5: row2.append(np.zeros_like(row1[0]) + 0.1)
sheet = np.concatenate([np.concatenate(row1, 1), np.concatenate(row2[:5], 1)], 0)
out = bpy.data.images.new("sheet", sheet.shape[1], sheet.shape[0])
out.pixels.foreach_set(np.concatenate([sheet[::-1], np.ones(sheet.shape[:2] + (1,), np.float32)], 2).ravel())
out.filepath_raw = dst; out.file_format = "JPEG"; sc.render.image_settings.quality = 85; out.save()
print("[preview] ->", dst, [o.name for o in meshes])
