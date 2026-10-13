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
