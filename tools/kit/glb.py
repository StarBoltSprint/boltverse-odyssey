"""Write a self-contained GLB (positions, normals, uv, indices) — no external deps."""
from __future__ import annotations

import json
import struct

import numpy as np

from geom import vertex_normals


def write_glb(path, meshes, extras=None):
    bin_parts, views, accs, gl_meshes, nodes, mats, mat_idx = [], [], [], [], [], [], {}
    off = 0

    def add(arr, target, comp, typ, minmax=False):
        nonlocal off
        b = arr.tobytes()
        pad = (-len(b)) % 4
        bin_parts.append(b + b"\0" * pad)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b), "target": target})
        acc = {"bufferView": len(views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"], acc["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accs.append(acc)
        off += len(b) + pad
        return len(accs) - 1

    for m in meshes:
        if m.material not in mat_idx:
            mat_idx[m.material] = len(mats)
            mats.append({"name": m.material, "extras": {"shader": "hex-triplanar"}})
        # glTF is Y-up: (x, y, z)_kit -> (x, z, -y)
        V = np.stack([m.V[:, 0], m.V[:, 2], -m.V[:, 1]], 1).astype(np.float32)
        N = vertex_normals(m)
        N = np.stack([N[:, 0], N[:, 2], -N[:, 1]], 1).astype(np.float32)
        UV = np.stack([m.V[:, 0], m.V[:, 2]], 1).astype(np.float32)  # world-metre UV; shader is triplanar anyway
        I = m.F.astype(np.uint32).reshape(-1)
        prim = {"attributes": {"POSITION": add(V, 34962, 5126, "VEC3", True), "NORMAL": add(N, 34962, 5126, "VEC3"),
                               "TEXCOORD_0": add(UV, 34962, 5126, "VEC2")},
                "indices": add(I, 34963, 5125, "SCALAR"), "material": mat_idx[m.material]}
        gl_meshes.append({"name": m.name, "primitives": [prim]})
        nodes.append({"name": m.name, "mesh": len(gl_meshes) - 1})
    doc = {"asset": {"version": "2.0", "generator": "boltverse tools/kit"}, "scene": 0,
           "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": gl_meshes,
           "materials": mats, "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": off}],
           "extras": extras or {}}
    js = json.dumps(doc).encode()
    js += b" " * ((-len(js)) % 4)
    binb = b"".join(bin_parts)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(binb), 0x004E4942) + binb)
