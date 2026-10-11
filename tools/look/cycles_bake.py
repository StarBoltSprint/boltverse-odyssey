"""Cycles bake onto UV channel uv2, saved as a lightMap image.

  blender -b -P tools/look/cycles_bake.py -- --albedo PLATE.png --bounce bounce.json --out lightmap.png

bounce.json is the sampled colour object from bake.py (an image mean, not a typed tint).
This file types no colour. The albedo multiply in bake.py is the path the page loads;
this script is the uv2 / lightMap path for a mesh that already has that channel.
"""
import json, sys


def _args(argv):
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    out = {}
    i = 0
    while i < len(argv):
        if argv[i].startswith("--") and i + 1 < len(argv):
            out[argv[i][2:]] = argv[i + 1]
            i += 2
        else:
            i += 1
    return out


def main(argv):
    a = _args(argv)
    if not a.get("albedo") or not a.get("bounce") or not a.get("out"):
        raise SystemExit("cycles_bake: need --albedo --bounce --out")
    try:
        import bpy
    except ImportError:
        raise SystemExit("cycles_bake: run inside Blender")
    bounce = json.load(open(a["bounce"]))["linear"]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 8
    bpy.ops.mesh.primitive_plane_add()
    mesh = bpy.context.active_object
    mesh.data.uv_layers.new(name="uv2")
    img = bpy.data.images.load(a["albedo"])
    bake = bpy.data.images.new("lightMap", width=img.size[0], height=img.size[1])
    mat = bpy.data.materials.new("bake")
    mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bake
    mat.node_tree.nodes.active = tex
    mesh.data.materials.append(mat)
    lamp_data = bpy.data.lights.new("sun", "SUN")
    lamp = bpy.data.objects.new("sun", lamp_data)
    bpy.context.scene.collection.objects.link(lamp)
    lamp.data.color = bounce
    lamp.rotation_euler = (0.9, 0.0, 0.4)
    bpy.context.scene.cycles.bake_type = "DIFFUSE"
    bpy.ops.object.bake(type="DIFFUSE")
    bake.filepath_raw = a["out"]
    bake.file_format = "PNG"
    bake.save()
    print("cycles_bake", a["out"])


if __name__ == "__main__":
    main(sys.argv)
