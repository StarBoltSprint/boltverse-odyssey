"""Build the watertight tower in Blender from slab.json and export GLB + dump.

  blender --background --python tools/grok-native/tower_blender.py -- slab.json out_dir key.jpg
"""
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import slab_mesh  # noqa: E402


def argv_after_dd():
    if "--" not in sys.argv:
        raise SystemExit("usage: blender --background --python tower_blender.py -- slab.json out_dir key.jpg")
    return sys.argv[sys.argv.index("--") + 1 :]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main():
    slab_path, out_dir, key_path = argv_after_dd()
    os.makedirs(out_dir, exist_ok=True)
    spec = json.load(open(slab_path))
    grid = spec["grid"]
    rows, cols = len(grid), len(grid[0])
    positions, uvs = slab_mesh.build_positions(
        grid, spec["fx"], spec["fy"], spec["cx"], spec["cy"], spec["Z0"], spec["depth_m"]
    )
    faces = slab_mesh.build_faces(rows, cols)
    stats = slab_mesh.edge_stats(faces)
    clear_scene()
    mesh = bpy.data.meshes.new("tower-hero")
    mesh.from_pydata(positions, [], [tuple(f) for f in faces])
    mesh.update()
    if mesh.validate(verbose=False):
        stats["blender_validate_changed"] = True
    else:
        stats["blender_validate_changed"] = False
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv_layer.data[li].uv = uvs[vi]
    obj = bpy.data.objects.new("tower-hero", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mat = bpy.data.materials.new("key-project")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(key_path)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if mesh.materials:
        mesh.materials[0] = mat
    else:
        mesh.materials.append(mat)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.edges.ensure_lookup_table()
    stats["blender_boundary_edges"] = sum(1 for e in bm.edges if e.is_boundary)
    stats["blender_nonmanifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold)
    stats["verts"] = len(mesh.vertices)
    stats["faces"] = len(faces)
    stats["checksum"] = slab_mesh.checksum(positions)
    bm.free()
    glb = os.path.join(out_dir, "tower.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True)
    dump = {
        "positions": positions,
        "uvs": uvs,
        "faces": faces,
        "stats": stats,
    }
    json.dump(dump, open(os.path.join(out_dir, "mesh_dump.json"), "w"))
    json.dump(stats, open(os.path.join(out_dir, "mesh_stats.json"), "w"), indent=1)
    print("MESH", json.dumps(stats))


if __name__ == "__main__":
    main()
