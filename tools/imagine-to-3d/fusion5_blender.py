"""Watertight fusion5 slab. Camera frame: X right, Y up, Z toward the camera (negative).

  blender --background --python tools/imagine-to-3d/fusion5_blender.py -- slab.json out_dir atlas.jpg
"""
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
GN = os.path.abspath(os.path.join(HERE, "..", "grok-native"))
if GN not in sys.path:
    sys.path.insert(0, GN)
import slab_mesh  # noqa: E402


def argv_after_dd():
    if "--" not in sys.argv:
        raise SystemExit("usage: blender --python fusion5_blender.py -- slab.json out_dir atlas.jpg")
    return sys.argv[sys.argv.index("--") + 1 :]


def tri_kind(ti, rows, cols):
    """Quad order matches slab_mesh.build_faces. Each quad is two triangles."""
    q = ti // 2
    n_front = (rows - 1) * (cols - 1)
    if q < n_front:
        return "front", q
    q -= n_front
    if q < n_front:
        return "back", q
    q -= n_front
    n_side = (rows - 1) * 2
    if q < n_side:
        return ("left" if q % 2 == 0 else "right"), q // 2
    q -= n_side
    return ("top" if q % 2 == 0 else "bottom"), q // 2


def loop_uv(kind, index, vi, rows, cols):
    """Per-loop UV. Blender v=1 is the top of the image.

    Atlas (u, v), matching make_atlas:
      front  u 0.00-0.50  v 0-1     key
      back   u 0.50-0.75  v 0.50-1  top-left of the right half
      left   u 0.50-0.75  v 0.00-0.50
      right  u 0.75-1.00  v 0.50-1
      top    u 0.75-1.00  v 0.25-0.50
      bottom u 0.75-1.00  v 0.00-0.25
    """
    n_front = rows * cols
    vloc = vi if vi < n_front else vi - n_front
    r, c = divmod(vloc, cols)
    front = vi < n_front
    ru = c / max(1, cols - 1)
    rv = 1.0 - r / max(1, rows - 1)
    if kind == "front":
        return ru * 0.5, rv
    if kind == "back":
        return 0.50 + ru * 0.25, 0.50 + rv * 0.50
    if kind == "left":
        return 0.50 + (0.0 if front else 0.25), rv * 0.50
    if kind == "right":
        return 0.75 + (0.0 if front else 0.25), 0.50 + rv * 0.50
    if kind == "top":
        return 0.75 + ru * 0.25, 0.25 + (0.0 if front else 0.25)
    return 0.75 + ru * 0.25, 0.0 + (0.0 if front else 0.25)


def main():
    slab_path, out_dir, atlas_path = argv_after_dd()
    os.makedirs(out_dir, exist_ok=True)
    spec = json.load(open(slab_path))
    grid = spec["grid"]
    rows, cols = len(grid), len(grid[0])
    positions, _uv = slab_mesh.build_positions(
        grid, spec["fx"], spec["fy"], spec["cx"], spec["cy"], spec["Z0"], spec["depth_m"]
    )
    # Three.js camera looks down -Z. OpenCV +Z (away) becomes -Z (in front of the camera).
    three = [(p[0], p[1], -p[2]) for p in positions]
    # Blender's glTF exporter converts Z-up to Y-up: (x, y, z) -> (x, z, -y).
    # Feed the inverse so the loaded mesh is the three.js frame, not a tower on its side.
    positions = [(p[0], -p[2], p[1]) for p in three]
    faces = slab_mesh.build_faces(rows, cols)
    faces = [(c, b, a) for a, b, c in faces]
    stats = slab_mesh.edge_stats(faces)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    mesh = bpy.data.meshes.new("tower-hero")
    mesh.from_pydata(positions, [], [tuple(f) for f in faces])
    mesh.update()
    stats["blender_validate_changed"] = bool(mesh.validate(verbose=False))
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        kind, idx = tri_kind(poly.index, rows, cols)
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv_layer.data[li].uv = loop_uv(kind, idx, vi, rows, cols)
    obj = bpy.data.objects.new("tower-hero", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mat = bpy.data.materials.new("fusion5-atlas")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(atlas_path)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    mesh.materials.append(mat)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    stats["blender_boundary_edges"] = sum(1 for e in bm.edges if e.is_boundary)
    stats["blender_nonmanifold_edges"] = sum(1 for e in bm.edges if not e.is_manifold)
    stats["verts"] = len(mesh.vertices)
    stats["faces"] = len(faces)
    stats["watertight"] = stats["blender_boundary_edges"] == 0 and stats["blender_nonmanifold_edges"] == 0
    bm.free()
    glb = os.path.join(out_dir, "tower.glb")
    bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True)
    json.dump({"positions": three, "faces": faces, "stats": stats}, open(os.path.join(out_dir, "mesh_dump.json"), "w"))
    json.dump(stats, open(os.path.join(out_dir, "mesh_stats.json"), "w"), indent=1)
    print("MESH", json.dumps({k: stats[k] for k in ("verts", "faces", "watertight", "blender_boundary_edges")}))


if __name__ == "__main__":
    main()
