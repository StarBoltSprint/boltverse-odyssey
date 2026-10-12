"""Blender: weld the builder OBJ (merge by distance + split edges at T-junctions), keep winding, triangulate, export GLB.
blender -b -P weld_export.py -- in.obj out.glb report.json"""
import bpy, bmesh, sys, json
from mathutils import kdtree
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=a[0], forward_axis='NEGATIVE_Z', up_axis='Y')
ob = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bm = bmesh.new(); bm.from_mesh(ob.data)
def counts():
    bm.edges.ensure_lookup_table()
    return sum(1 for e in bm.edges if len(e.link_faces) == 1), sum(1 for e in bm.edges if len(e.link_faces) > 2)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
o0 = counts(); splits = 0
for it in range(6):
    bm.verts.ensure_lookup_table(); kd = kdtree.KDTree(len(bm.verts))
    for v in bm.verts: kd.insert(v.co, v.index)
    kd.balance(); todo = []
    for e in [e for e in bm.edges if len(e.link_faces) == 1]:
        p, q = e.verts[0].co, e.verts[1].co; L = (q - p).length
        if L < 1e-6: continue
        mid = (p + q) / 2; hits = []
        for co, idx, d in kd.find_range(mid, L / 2 + 1e-4):
            v = bm.verts[idx]
            if v in e.verts: continue
            t = (co - p).dot(q - p) / (L * L)
            if 1e-4 < t < 1 - 1e-4 and ((p + (q - p) * t) - co).length < 2e-4: hits.append((t, v))
        if hits: todo.append((e, sorted(hits, key=lambda h: h[0])))
    if not todo: break
    for e, hits in todo:
        if not e.is_valid: continue
        cur = e; p0 = e.verts[0]; prev_t = 0.0
        for t, v in hits:
            tt = (t - prev_t) / (1 - prev_t); ne, nv = bmesh.utils.edge_split(cur, p0, tt); nv.co = v.co.copy(); splits += 1
            cur = [x for x in nv.link_edges if x is not ne and (p0 not in x.verts)][0] if len(nv.link_edges) > 1 else ne; p0 = nv; prev_t = t
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-4)
bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='BEAUTY')
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-6)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
o1 = counts()
bm.to_mesh(ob.data); bm.free()
# v3.2: plates are single unique images -> sampler CLAMP_TO_EDGE (v3.1 GLBs had no wrap = glTF default REPEAT)
for m in ob.data.materials:
    if m and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE': n.extension = 'EXTEND'
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB')
json.dump(dict(openBefore=o0[0], openAfter=o1[0], nonManifoldAfter=o1[1], tjunctionSplits=splits, tris=len(ob.data.polygons)), open(a[2], 'w'))
print('WELD', o0, o1, splits)
