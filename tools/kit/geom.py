"""Minimal triangle-mesh helpers (numpy only). World: Z up, metres."""
from __future__ import annotations

import numpy as np


class Mesh:
    def __init__(self, V=None, F=None, name="mesh", material="stone"):
        self.V = np.zeros((0, 3)) if V is None else np.asarray(V, float)
        self.F = np.zeros((0, 3), int) if F is None else np.asarray(F, int)
        self.name, self.material = name, material
        self.attrs: dict[str, np.ndarray] = {}  # per-vertex float attributes (e.g. _SNOW, _ICE)

    def tris(self) -> int:
        return int(len(self.F))


def merge(meshes, name="merged", material=None):
    V, F, off = [], [], 0
    for m in meshes:
        V.append(m.V)
        F.append(m.F + off)
        off += len(m.V)
    out = Mesh(np.vstack(V) if V else None, np.vstack(F) if F else None, name, material or meshes[0].material)
    keys = set().union(*[m.attrs.keys() for m in meshes]) if meshes else set()
    for k in keys:
        out.attrs[k] = np.concatenate([m.attrs.get(k, np.zeros(len(m.V))) for m in meshes])
    return out


def weld(m: Mesh, eps=1e-5) -> Mesh:
    key = np.round(m.V / eps).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    F = inv.reshape(-1)[m.F]
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    out = Mesh(m.V[idx], F, m.name, m.material)
    out.attrs = {k: v[idx] for k, v in m.attrs.items()}
    return out


def grid_quad(p0, eu, ev, nu, nv):
    """Quad p0 + s*eu + t*ev, subdivided nu x nv, CCW seen from eu x ev."""
    s, t = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1))
    V = p0 + s.reshape(-1, 1) * eu + t.reshape(-1, 1) * ev
    F = []
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            b, c, d = a + 1, a + nu + 2, a + nu + 1
            F += [(a, b, c), (a, c, d)]
    return V, np.array(F, int)


def box(lo, hi, res=0.0, name="box", material="stone") -> Mesh:
    """Closed axis-aligned box; res>0 subdivides faces to ~res metres (for displacement)."""
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    d = hi - lo
    n = lambda L: max(1, int(np.ceil(L / res))) if res > 0 else 1
    faces = [  # p0, eu, ev  (outward = eu x ev)
        (lo, [0, d[1], 0], [d[0], 0, 0]),                      # -Z
        (lo + [0, 0, d[2]], [d[0], 0, 0], [0, d[1], 0]),        # +Z
        (lo, [d[0], 0, 0], [0, 0, d[2]]),                      # -Y
        (lo + [0, d[1], 0], [0, 0, d[2]], [d[0], 0, 0]),        # +Y
        (lo, [0, 0, d[2]], [0, d[1], 0]),                      # -X
        (lo + [d[0], 0, 0], [0, d[1], 0], [0, 0, d[2]]),        # +X
    ]
    parts = []
    for p0, eu, ev in faces:
        eu, ev = np.array(eu, float), np.array(ev, float)
        V, F = grid_quad(p0, eu, ev, n(np.linalg.norm(eu)), n(np.linalg.norm(ev)))
        parts.append(Mesh(V, F))
    return weld(merge(parts, name, material))


def cone(top, tip, r, seg=8, name="cone", material="ice") -> Mesh:
    top, tip = np.asarray(top, float), np.asarray(tip, float)
    ax = tip - top
    ax /= np.linalg.norm(ax)
    u = np.cross(ax, [1, 0, 0] if abs(ax[0]) < 0.9 else [0, 1, 0])
    u /= np.linalg.norm(u)
    w = np.cross(ax, u)
    ring = [top + r * (np.cos(a) * u + np.sin(a) * w) for a in np.linspace(0, 2 * np.pi, seg, endpoint=False)]
    V = np.vstack([ring, [tip], [top]])
    F = []
    for i in range(seg):
        j = (i + 1) % seg
        F += [(i, j, seg), (j, i, seg + 1)]
    return Mesh(V, np.array(F), name, material)


def vertex_normals(m: Mesh) -> np.ndarray:
    a, b, c = (m.V[m.F[:, k]] for k in range(3))
    fn = np.cross(b - a, c - a)
    N = np.zeros_like(m.V)
    for k in range(3):
        np.add.at(N, m.F[:, k], fn)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)


def _edge_counts(m: Mesh) -> np.ndarray:
    e = np.sort(np.vstack([m.F[:, [0, 1]], m.F[:, [1, 2]], m.F[:, [2, 0]]]), axis=1)
    return np.unique(e, axis=0, return_counts=True)[1]


def open_edges(m: Mesh) -> int:
    """Boundary edges (used by an odd number of faces): a hole. Must be 0."""
    return int((_edge_counts(m) % 2 == 1).sum())


def nonmanifold_edges(m: Mesh) -> int:
    """Edges shared by 4+ faces (two cells touching along one edge). Closed, but reported."""
    return int((_edge_counts(m) > 2).sum())


def _earclip(P2):
    """ear clipping of a simple CCW polygon (n,2) -> list of index triples, or None on failure."""
    idx = list(range(len(P2))); out = []
    def area(a, b, c):
        return (P2[b][0] - P2[a][0]) * (P2[c][1] - P2[a][1]) - (P2[b][1] - P2[a][1]) * (P2[c][0] - P2[a][0])
    def inside(p, a, b, c):
        d1, d2, d3 = area(a, b, p), area(b, c, p), area(c, a, p)
        return d1 >= -1e-12 and d2 >= -1e-12 and d3 >= -1e-12
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1; n = len(idx); clipped = False
        for k in range(n):
            a, b, c = idx[k - 1], idx[k], idx[(k + 1) % n]
            if area(a, b, c) <= 1e-12:
                continue
            if any(inside(p, a, b, c) for p in idx if p not in (a, b, c) and not (np.allclose(P2[p], P2[a]) or np.allclose(P2[p], P2[b]) or np.allclose(P2[p], P2[c]))):
                continue
            out.append((a, b, c)); idx.pop(k); clipped = True; break
        if not clipped:
            return None
    if len(idx) == 3:
        out.append(tuple(idx))
    return out


def decimate_planar(m, protect_attrs=("_SNOW", "_ICE"), cos_tol=0.99995, d_tol=1e-4):
    """Planar-region decimation: every connected set of coplanar faces is re-triangulated from its boundary loop
    (interior vertices dropped, every boundary vertex kept -> silhouette and neighbour edges unchanged, no T-junctions).
    Faces whose vertices carry snow/ice (organic snow pillows, drips, broken edges) are never touched.
    Regions with holes or failed ear clipping are kept as they are. Returns a new Mesh."""
    V, F = m.V, m.F
    if len(F) < 4:
        return m
    key = np.round(V / 1e-5).astype(np.int64); _, wid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.ravel(); W = inv[F]                                     # welded ids
    A, B, C = (V[F[:, k]] for k in range(3)); N = np.cross(B - A, C - A); ln = np.linalg.norm(N, axis=1)
    N = N / np.where(ln > 0, ln, 1)[:, None]; D = (N * A).sum(1)
    prot = np.zeros(len(F), bool)
    for k in protect_attrs:
        if k in m.attrs:
            prot |= (np.asarray(m.attrs[k])[F] > 0.5).any(1)
    prot |= ln < 1e-12
    edge_f = {}
    for fi, t in enumerate(W):
        for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            edge_f.setdefault((min(e), max(e)), []).append(fi)
    region = -np.ones(len(F), int); r = 0
    for s in range(len(F)):
        if region[s] >= 0 or prot[s]:
            continue
        st = [s]; region[s] = r
        while st:
            f = st.pop(); t = W[f]
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                for g in edge_f[(min(e), max(e))]:
                    if region[g] < 0 and not prot[g] and N[f] @ N[g] > cos_tol and abs(D[g] - D[f]) < d_tol:
                        region[g] = r; st.append(g)
        r += 1
    newF, keep = [], np.ones(len(F), bool)
    for rid in range(r):
        fs = np.nonzero(region == rid)[0]
        if len(fs) < 3:
            continue
        cnt = {}
        for f in fs:
            t = W[f]
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                cnt[e] = cnt.get(e, 0) + 1
        bd = [e for e in cnt if (e[1], e[0]) not in cnt]
        nxt = {}
        ok = True
        for a, b in bd:
            if a in nxt:
                ok = False; break
            nxt[a] = b
        if not ok or not bd:
            continue
        loop = [bd[0][0]]
        while True:
            b = nxt.get(loop[-1])
            if b is None:
                ok = False; break
            if b == loop[0]:
                break
            loop.append(b)
            if len(loop) > len(bd):
                ok = False; break
        if not ok or len(loop) != len(bd) or len(loop) - 2 >= len(fs):
            continue                                             # holes / multiple loops / no gain
        n = N[fs[0]]; u = np.cross(n, [1, 0, 0] if abs(n[0]) < 0.9 else [0, 1, 0]); u /= np.linalg.norm(u); v = np.cross(n, u)
        Pw = V[wid[loop]]; P2 = np.c_[Pw @ u, Pw @ v]
        tris = _earclip(P2)
        if tris is None or len(tris) != len(loop) - 2:
            continue
        keep[fs] = False
        newF += [[wid[loop[a]], wid[loop[b]], wid[loop[c]]] for a, b, c in tris]
    if not newF:
        return m
    F2 = np.vstack([F[keep], np.array(newF, int)])
    used = np.unique(F2); remap = -np.ones(len(V), int); remap[used] = np.arange(len(used))
    out = Mesh(V[used], remap[F2], m.name, m.material)
    for k, a in m.attrs.items():
        out.attrs[k] = np.asarray(a)[used]
    return out
