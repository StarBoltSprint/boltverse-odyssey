"""Minimal GLB reader/writer (no deps beyond numpy): meshes with world-space positions, UVs, node names."""
import json, struct
import numpy as np

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read(path):
    b = open(path, "rb").read()
    assert b[:4] == b"glTF", "not a GLB"
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    off = 20 + n
    binc = b[off + 8: off + 8 + struct.unpack("<I", b[off:off + 4])[0]] if off < len(b) else b""
    return j, binc


def accessor(j, binc, i, dequant=True):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt = np.dtype(CT[a["componentType"]])
    nc = NC[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or dt.itemsize * nc
    raw = np.frombuffer(binc, np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * nc, offset=start)
    arr = np.lib.stride_tricks.as_strided(raw.view(np.uint8), (a["count"], nc * dt.itemsize), (stride, 1)).copy().view(dt).reshape(a["count"], nc)
    if dequant and a.get("normalized"):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr.astype(np.float64) if arr.dtype.kind == "f" or a.get("normalized") else arr


def _mat(node):
    if "matrix" in node:
        return np.array(node["matrix"], float).reshape(4, 4).T
    M = np.eye(4)
    t = node.get("translation", [0, 0, 0]); s = node.get("scale", [1, 1, 1]); q = node.get("rotation", [0, 0, 0, 1])
    x, y, z, w = q
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M[:3, :3] = R * np.array(s)[None, :]
    M[:3, 3] = t
    return M


def meshes(path):
    """-> list of dict(name, node, V (world, glTF Y-up), F, uv or None, material, extras)."""
    j, binc = read(path)
    out = []
    def walk(ni, P):
        nd = j["nodes"][ni]
        M = P @ _mat(nd)
        if "mesh" in nd:
            me = j["meshes"][nd["mesh"]]
            for pr in me["primitives"]:
                V = accessor(j, binc, pr["attributes"]["POSITION"]).astype(float)
                V = (M[:3, :3] @ V.T).T + M[:3, 3]
                F = accessor(j, binc, pr["indices"]).reshape(-1, 3) if "indices" in pr else np.arange(len(V)).reshape(-1, 3)
                uv = accessor(j, binc, pr["attributes"]["TEXCOORD_0"]) if "TEXCOORD_0" in pr["attributes"] else None
                out.append({"name": nd.get("name") or me.get("name", ""), "mesh": me.get("name", ""), "V": V, "F": F, "uv": uv,
                            "material": pr.get("material"), "extras": nd.get("extras", {})})
        for c in nd.get("children", []):
            walk(c, M)
    for sc in j.get("scenes", [{"nodes": list(range(len(j.get("nodes", []))))}]):
        for ni in sc["nodes"]:
            walk(ni, np.eye(4))
    return out, j


def nodes(path):
    j, _ = read(path)
    return j.get("nodes", [])


def write(path, parts, extras=None, ext_used=None):
    """parts: list of dict(name, V (Y-up), F, uv=None, extras=None, mesh=True). Nodes without F are empties (sockets)."""
    bufs, views, accs, meshes_, nodes_ = [], [], [], [], []
    def add(arr, comp, typ, target=None, minmax=False, normalized=False):
        a = np.ascontiguousarray(arr); off = sum(len(x) for x in bufs)
        data = a.tobytes(); pad = (-len(data)) % 4; bufs.append(data + b"\0" * pad)
        bv = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: bv["target"] = target
        views.append(bv)
        ac = {"bufferView": len(views) - 1, "componentType": comp, "count": int(a.shape[0]), "type": typ}
        if normalized: ac["normalized"] = True
        if minmax:
            ac["min"] = [float(v) for v in a.min(0)]; ac["max"] = [float(v) for v in a.max(0)]
        accs.append(ac); return len(accs) - 1
    for p in parts:
        nd = {"name": p["name"]}
        if p.get("extras"): nd["extras"] = p["extras"]
        if p.get("translation") is not None: nd["translation"] = [float(v) for v in p["translation"]]
        if p.get("F") is not None:
            attrs = {"POSITION": add(np.asarray(p["V"], np.float32), 5126, "VEC3", 34962, True)}
            if p.get("uv") is not None:
                uv = np.asarray(p["uv"])
                if p.get("uv_u16"):
                    attrs["TEXCOORD_0"] = add((np.clip(uv, 0, 1) * 65535).astype(np.uint16), 5123, "VEC2", 34962, normalized=True)
                else:
                    attrs["TEXCOORD_0"] = add(uv.astype(np.float32), 5126, "VEC2", 34962)
            if p.get("COLOR_0") is not None:
                attrs["COLOR_0"] = add(np.asarray(p["COLOR_0"], np.float32), 5126, "VEC4", 34962)
            ind = add(np.asarray(p["F"], np.uint32).ravel(), 5125, "SCALAR", 34963)
            meshes_.append({"name": p["name"], "primitives": [{"attributes": attrs, "indices": ind, **({"material": p["material"]} if "material" in p else {})}]})
            nd["mesh"] = len(meshes_) - 1
        nodes_.append(nd)
    binc = b"".join(bufs)
    j = {"asset": {"version": "2.0", "generator": "boltverse tools/gatesuite glbio"}, "scenes": [{"nodes": list(range(len(nodes_)))}], "scene": 0,
         "nodes": nodes_, "meshes": meshes_, "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(binc)}]}
    if extras: j["extras"] = extras
    if ext_used: j["extensionsUsed"] = ext_used
    js = json.dumps(j).encode(); js += b" " * ((-len(js)) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binc)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(binc), 0x004E4942) + binc
    open(path, "wb").write(out)


def box(lo, hi):
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    V = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])])
    F = np.array([[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]])
    return V, F
