"""QC of a built GLB (stretch = 1/max(n.d) over the 18 runtime projection directions, proj.py): per-LOD triangles, manifold-ish checks, projection stretch (the runtime shader's dominant plate).
stretch of a triangle = 1 / |n . axis| of the plate that wins its blend (front/back +-Z, side +-X, top +Y).
Faces pointing down (n.y < -0.5, undercuts) use the wall plates as well."""
import json, struct, sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
def read_glb(p):
    b = open(p, "rb").read(); jl = struct.unpack_from("<I", b, 12)[0]; js = json.loads(b[20:20 + jl]); off = 20 + jl
    bl = struct.unpack_from("<I", b, off)[0]; bin_ = b[off + 8: off + 8 + bl]; out = {}
    def acc(i):
        a = js["accessors"][i]; bv = js["bufferViews"][a["bufferView"]]; st = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        nc = {"SCALAR": 1, "VEC3": 3, "VEC2": 2}[a["type"]]; dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a["componentType"]]
        return np.frombuffer(bin_, dt, a["count"] * nc, st).reshape(-1, nc) if nc > 1 else np.frombuffer(bin_, dt, a["count"], st)
    for n in js["nodes"]:
        if "mesh" not in n: continue
        pr = js["meshes"][n["mesh"]]["primitives"][0]
        out[n["name"]] = (acc(pr["attributes"]["POSITION"]).astype(np.float64), acc(pr["indices"]).astype(np.int64).reshape(-1, 3))
    return out
def stretch(P, I):
    a, b, c = P[I[:, 0]], P[I[:, 1]], P[I[:, 2]]
    n = np.cross(b - a, c - a); area = np.linalg.norm(n, axis=1) / 2; n = n / np.maximum(area[:, None] * 2, 1e-12)
    import proj
    Nd = np.array([[np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)] for _, a, e in proj.directions()])
    best = (n @ Nd.T).max(1)
    s = 1 / np.maximum(best, 1e-3)
    vis = area > 0
    order = np.argsort(s); cum = np.cumsum(area[order]) / area.sum()
    p99 = float(s[order][np.searchsorted(cum, 0.99)]); p95 = float(s[order][np.searchsorted(cum, 0.95)])
    return dict(p95=round(p95, 3), p99=round(p99, 3), max=round(float(s.max()), 3), fracOver1_3=round(float(area[s > 1.3].sum() / area.sum()), 4))
def manifold(I, P=None):
    if P is not None:   # weld split-normal duplicates by position first (glTF splits verts at sharp edges)
        _, inv = np.unique(np.round(P, 4), axis=0, return_inverse=True); I = inv.reshape(-1)[I]
    e = np.sort(np.concatenate([I[:, [0, 1]], I[:, [1, 2]], I[:, [2, 0]]]), 1)
    _, cnt = np.unique(e, axis=0, return_counts=True)
    return dict(boundaryEdges=int((cnt == 1).sum()), nonManifoldEdges=int((cnt > 2).sum()))
if __name__ == "__main__":
    m = read_glb(sys.argv[1]); out = {}
    for k, (P, I) in sorted(m.items()):
        out[k] = dict(tris=len(I), bbox=[[round(float(x), 2) for x in P.min(0)], [round(float(x), 2) for x in P.max(0)]], stretch=stretch(P, I), **manifold(I, P))
    print(json.dumps(out, indent=1))
    if len(sys.argv) > 2: json.dump(out, open(sys.argv[2], "w"), indent=1)
