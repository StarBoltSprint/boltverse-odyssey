"""Headless Blender: sealed mesh from a vision npz. Driven only by that file.

blender -b -P vision_mesh.py -- in.npz out.glb report.json

The npz holds V (Nx3 float), F (Mx3 int), and optional hole (xa,ya,xb,yb,depth_m)
in the same local frame (front at z=0, up +Y). A damage box is boolean-cut, then
the mesh is made manifold-or-reported. UVs are planar from the local axes.
"""
import json, sys
import bpy
import bmesh
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst, rep_path = argv


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mesh_from(V, F, name):
    me = bpy.data.meshes.new(name)
    me.from_pydata(V.tolist(), [], F.tolist())
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def counts(ob, weld=True):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    if weld:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
        bm.to_mesh(ob.data)
    bm.free()
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.edges.ensure_lookup_table()
    open_e = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    nm = sum(1 for e in bm.edges if len(e.link_faces) > 2)
    tris = len(bm.faces)
    bm.free()
    return open_e, nm, tris


def assign_uv(ob, xspan, yspan, depth, span=None):
    """Front and back stay on the projection UV (1 unit = tower height).

    Every other face uses an orthonormal frame in the polygon, also in metres
    per tower-height. The old side map stored only -z, so the tapered wedge
    stretched in X (gate p95 1.312 on +x).

    Blender's glTF exporter writes glTF v = 1 - blender v. Blender v = 0 at the
    foot therefore becomes glTF v = 1, and glTF v = 0 is the top of the facade.
    The runtime must load the atlas with flipY false. span is the facade
    (x0, y0, y1), not the sand AABB.
    """
    import mathutils
    me = ob.data
    if span is not None:
        x0, y0, y1 = [float(v) for v in span]
    else:
        x0, x1 = xspan
        y0, y1 = yspan
    h = max(1e-6, y1 - y0)
    if not me.uv_layers:
        me.uv_layers.new(name="UV")
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        n = poly.normal
        if abs(n.z) >= abs(n.x) and abs(n.z) >= abs(n.y):
            for li in poly.loop_indices:
                p = me.vertices[me.loops[li].vertex_index].co
                uv[li].uv = ((p.x - x0) / h, (p.y - y0) / h)
            continue
        up = mathutils.Vector((0.0, 1.0, 0.0))
        if abs(n.y) > 0.85:
            up = mathutils.Vector((1.0, 0.0, 0.0))
        t = up.cross(n)
        if t.length < 1e-8:
            t = mathutils.Vector((1.0, 0.0, 0.0))
        t.normalize()
        b = n.cross(t)
        b.normalize()
        coords = []
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            coords.append((t.dot(p), b.dot(p)))
        s0 = min(c[0] for c in coords)
        t0 = min(c[1] for c in coords)
        for li, (s, tt) in zip(poly.loop_indices, coords):
            uv[li].uv = (0.42 + (s - s0) / h, (tt - t0) / h)


def main():
    z = np.load(src)
    V = np.asarray(z["V"], np.float64)
    F = np.asarray(z["F"], np.int32)
    hole = z["hole"] if "hole" in z.files else None
    span = z["span"] if "span" in z.files else None
    clear()
    ob = mesh_from(V, F, "tower-hero")
    cut = False
    note = ""
    if "cutterV" in z.files and len(z["cutterV"]):
        c = mesh_from(np.asarray(z["cutterV"], np.float64), np.asarray(z["cutterF"], np.int32), "cutter")
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        mod = ob.modifiers.new("damage", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = c
        mod.solver = "FLOAT"
        try:
            bpy.ops.object.modifier_apply(modifier="damage")
            cut = True
        except Exception as e:
            note = f"segment cutter failed: {e}"
            ob.modifiers.remove(mod)
        bpy.data.objects.remove(c, do_unlink=True)
    elif hole is not None and len(hole) == 5 and float(hole[4]) > 0:
        xa, ya, xb, yb, depth = [float(v) for v in hole]
        # cutter enters through the front skin and stops inside the volume
        c = mesh_from(
            np.array([
                [xa, ya, -depth], [xb, ya, -depth], [xb, yb, -depth], [xa, yb, -depth],
                [xa, ya, 0.4], [xb, ya, 0.4], [xb, yb, 0.4], [xa, yb, 0.4],
            ], np.float64),
            np.array([
                [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
                [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
                [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
            ], np.int32),
            "cutter",
        )
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        mod = ob.modifiers.new("damage", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = c
        mod.solver = "FLOAT"
        try:
            bpy.ops.object.modifier_apply(modifier="damage")
            cut = True
        except Exception as e:
            note = f"boolean failed: {e}"
            ob.modifiers.remove(mod)
        bpy.data.objects.remove(c, do_unlink=True)
    for p in ob.data.polygons:
        p.use_smooth = False
    x0, x1 = float(V[:, 0].min()), float(V[:, 0].max())
    y0, y1 = float(V[:, 1].min()), float(V[:, 1].max())
    depth = float(-V[:, 2].min()) or 1.0
    open_e, nm, tris = counts(ob, weld="UV" not in z.files)
    if "UV" in z.files:
        uv_in = np.asarray(z["UV"], np.float64)
        me = ob.data
        if not me.uv_layers:
            me.uv_layers.new(name="UV")
        uv = me.uv_layers.active.data
        if len(me.polygons) != len(uv_in):
            raise RuntimeError(f"UV faces {len(uv_in)} != mesh faces {len(me.polygons)}")
        for pi, poly in enumerate(me.polygons):
            for k, li in enumerate(poly.loop_indices):
                # Baked v is glTF v (0 at the top of the png, flipY false).
                # The exporter writes glTF v = 1 - Blender v, so store the complement.
                uv[li].uv = (float(uv_in[pi, k, 0]), 1.0 - float(uv_in[pi, k, 1]))
    else:
        assign_uv(ob, (x0, x1), (y0, y1), depth, span=span)
    # UVs are already written in the numpy frame (Y up, +Z toward). Blender is Z-up
    # and the glTF exporter maps (x, y, z) -> (x, z, -y). Rewrite the coordinates
    # so the file the runtime loads is still (width, up, toward). A missing rewrite
    # lays the tower on its side (world height becomes the 24 m depth).
    me = ob.data
    for v in me.vertices:
        x, y, z = v.co
        v.co = (x, -z, y)
    me.update()
    co = np.array([tuple(v.co) for v in me.vertices], np.float64)
    # exporter: glTF (x, y, z) = blender (x, z, -y) = numpy (x, y, z)
    g = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)
    gmin, gmax = g.min(0), g.max(0)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True, export_apply=True)
    rep = dict(open=open_e, nonManifold=nm, tris=tris, cut=cut, note=note, glb=dst,
               gltfSize=[round(float(v), 3) for v in (gmax - gmin)])
    json.dump(rep, open(rep_path, "w"), indent=1)
    print("VISION_MESH", json.dumps(rep))
    if open_e or nm:
        sys.exit(2)


# blender -P loads this file as a module, so __name__ is not __main__.
if __name__ == "__main__" or "--" in sys.argv:
    main()
