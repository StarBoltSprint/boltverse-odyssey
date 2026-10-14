#!/usr/bin/env python3
"""tools/kit/pieces.py: the 10 Zone D hero kit pieces of kit-art-spec, plus the terrace assembly.

Piece frame (kit): x along the wall, y into the wall (front face at y=0 faces -y), z up; pivot = base centre (0,0,0).
GLB frame: glTF Y-up (x, z, -y). Every piece: LOD0/1/2 meshes (kit-engine 3000/1000/300 tris), named socket empties,
an inset collider (2 cm), real bevels >= 2 cm (rounded boxes / rounded profiles), custom _SNOW/_ICE attributes
so the shared hex-triplanar material (stone 1.9 m tile = 539 px/m, snow 1.2 m = 853 px/m) and the matte ice material bind.

    python3 tools/kit/pieces.py pieces --out DIR             # 10 piece GLBs + colliders + pieces.json
    python3 tools/kit/pieces.py terrace --spine S --out DIR  # snap pieces onto the greybox layout, local + world GLB
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from geom import Mesh, merge, weld, vertex_normals  # noqa: E402
from outline import spike, taubin  # noqa: E402

COURSE_H = 0.625     # 4 courses per 2.5 m tier (key courses read 0.55-0.70 m)
BEVEL = 0.04         # >= 2 cm (kit-engine)
LODN = {0: 3, 1: 2, 2: 1}   # rounded-box face subdivisions per LOD (lod0 4 -> 3: tier budget with 3 door canopies)


# ------------------------------------------------------------------ primitives
def rbox(lo, hi, r=BEVEL, n=4, name="block", material="stone"):
    """Closed rounded box: a subdivided cube whose points are pushed onto the rounded shell (radius r)."""
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    c, h = (lo + hi) / 2, (hi - lo) / 2
    r = min(r, *(h * 0.45))
    g = np.linspace(-1, 1, n + 1)
    V, F = [], []
    for ax in range(3):
        for sg in (-1, 1):
            u, v = [a for a in range(3) if a != ax]
            base = len(V)
            for a in g:
                for b in g:
                    p = np.zeros(3); p[ax] = sg; p[u] = a; p[v] = b
                    V.append(p)
            for i in range(n):
                for j in range(n):
                    a0 = base + i * (n + 1) + j
                    q = [a0, a0 + n + 1, a0 + n + 2, a0 + 1]
                    F += [(q[0], q[1], q[2]), (q[0], q[2], q[3])]
    V = np.array(V) * h
    inner = np.clip(V, -(h - r), h - r)
    d = V - inner
    nd = np.linalg.norm(d, axis=1, keepdims=True)
    V = inner + np.where(nd > 1e-9, d / np.maximum(nd, 1e-9) * r, 0) + c
    m = weld(Mesh(V, np.array(F), name, material), 1e-6)
    # convex shell: wind EVERY triangle outward (the six cube sides come out with alternating winding)
    A, B, C = (m.V[m.F[:, k]] for k in range(3))
    inward = (np.cross(B - A, C - A) * ((A + B + C) / 3 - c)).sum(1) < 0
    m.F[inward] = m.F[inward][:, ::-1]
    return m


def orient(m):
    A, B, C = (m.V[m.F[:, k]] for k in range(3))
    n = np.cross(B - A, C - A)
    flip = (((A + B + C) / 3 - m.V.mean(0)) * n).sum(1) < 0
    if flip.mean() > 0.5:
        m.F = m.F[:, ::-1]
    return m


def extrude_profile(prof, x0, x1, segs=1, name="profile", material="stone", wobble=None):
    """Closed extrusion of a star-shaped (y,z) profile along x, fan caps from the profile centroid."""
    prof = np.asarray(prof, float); P = len(prof)
    xs = np.linspace(x0, x1, segs + 1)
    V = []
    for k, x in enumerate(xs):
        s = 1.0 if wobble is None else wobble(x)
        cen = prof.mean(0)
        for y, z in prof:
            V.append([x, cen[0] + (y - cen[0]) * s, cen[1] + (z - cen[1]) * s])
    F = []
    for k in range(segs):
        for i in range(P):
            a, b = k * P + i, k * P + (i + 1) % P
            F += [(a, b, b + P), (a, b + P, a + P)]
    c0 = len(V); V.append([xs[0], *prof.mean(0)]); c1 = len(V); V.append([xs[-1], *prof.mean(0)])
    for i in range(P):
        F += [(c0, (i + 1) % P, i), (c1, segs * P + i, segs * P + (i + 1) % P)]
    return orient(Mesh(np.array(V, float), np.array(F), name, material))


def rounded_profile(pts, r=0.05, k=3):
    """Round every corner of a polygon with k arc points (bevel >= r)."""
    pts = np.asarray(pts, float); out = []
    for i in range(len(pts)):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % len(pts)]
        a = p0 - p1; b = p2 - p1
        la, lb = np.linalg.norm(a), np.linalg.norm(b)
        rr = min(r, la * 0.45, lb * 0.45)
        s, e = p1 + a / la * rr, p1 + b / lb * rr
        for t in np.linspace(0, 1, k):
            q = (1 - t) ** 2 * s + 2 * (1 - t) * t * p1 + t * t * e
            out.append(q)
    return np.array(out)


def tag(m, snow=0.0, ice=0.0):
    m.attrs = {"_SNOW": np.full(len(m.V), float(snow)), "_ICE": np.full(len(m.V), float(ice))}
    return m


def merged(parts, name, material):
    for p in parts:   # every closed part wound outward (positive signed volume) before merging
        A, B, C = (p.V[p.F[:, k]] for k in range(3))
        if np.einsum("ij,ij->i", A, np.cross(B, C)).sum() < 0:
            p.F = p.F[:, ::-1].copy()
    m = merge(parts, name, material)
    m.attrs = {k: np.concatenate([p.attrs.get(k, np.zeros(len(p.V))) for p in parts]) for k in ("_SNOW", "_ICE")}
    return m


# ------------------------------------------------------------------ the 10 pieces
def wall_block_course(lod, seed=1, width=2.0):
    """One course (0.625 m) of 2-3 bevelled blocks over a recessed backing; block faces stand proud
    of the joint backing (v5: 0.08-0.18 m), widths vary per seed (no stripe rhythm)."""
    rng = np.random.default_rng(seed); n = LODN[lod]
    xs = [-width / 2]
    while xs[-1] < width / 2 - 0.5:
        xs.append(min(xs[-1] + rng.uniform(0.6, 1.2), width / 2))
    xs[-1] = width / 2
    # v5: backing sits 6 cm behind the block faces' rear plane and blocks stand 8-18 cm proud -> joints read as thin
    # shaded lines instead of dark rectangles
    parts = [tag(rbox([-width / 2, -0.06, 0.02], [width / 2, 0.45, COURSE_H - 0.02], 0.02, 1, "backing"))]
    for a, b in zip(xs[:-1], xs[1:]):
        rel = rng.uniform(0.08, 0.18)
        parts.append(tag(rbox([a + 0.015, -rel, 0.015], [b - 0.015, 0.2, COURSE_H - 0.015], BEVEL * rng.uniform(1, 2), n)))
    return merged(parts, "wall_block_course", "stone")


def facade_block(lod, w, h, d=0.35, joint=0.03, seed=0):
    """One facade block measured from the key (tools/placer/facade.py): w x h face, standing d proud of the backing,
    joint gap split around it, bevel + chipping (corner/edge vertices pushed in by up to 25 % of the bevel + 1 cm)."""
    rng = np.random.default_rng(seed); n = {0: 2, 1: 1, 2: 1}[lod]
    r = float(np.clip(0.18 * min(w, h), 0.02, 0.08))
    m = rbox([-w / 2 + joint / 2, -d, joint / 2], [w / 2 - joint / 2, 0.2, h - joint / 2], r, n, "facade_block")
    c = np.array([0, (0.2 - d) / 2, h / 2]); u = m.V - c; hw = np.array([w / 2, (0.2 + d) / 2, h / 2])
    edge = (np.abs(u) / hw > 0.8).sum(1) >= 2                      # vertices on edges / corners
    m.V[edge] -= u[edge] / np.linalg.norm(u[edge], axis=1, keepdims=True) * rng.uniform(0, 0.25 * r + 0.01, (edge.sum(), 1))
    return tag(m)


def wall_block_corner(lod, seed=2):
    """Quoin: two bevelled blocks wrapping the +x end of a tier (faces -y and +x), 0.2-0.4 m relief."""
    rng = np.random.default_rng(seed); n = LODN[lod]
    parts = [tag(rbox([-0.5, -rng.uniform(0.25, 0.4), 0.015], [0.45, 0.9, COURSE_H - 0.015], BEVEL * 1.5, n)),
             tag(rbox([-0.3, 0.9, 0.015], [0.45, 1.6, COURSE_H - 0.015], BEVEL * 1.5, n))]
    return merged(parts, "wall_block_corner", "stone")


def corbel(lod, seed=3):
    """Stepped bracket under the cornice overhang: three bevelled steps, 0.4 m wide, 0.6 m drop."""
    n = LODN[lod]
    parts = [tag(rbox([-0.2, -0.55, -0.2], [0.2, 0.3, 0.0], BEVEL, n)),
             tag(rbox([-0.18, -0.38, -0.42], [0.18, 0.3, -0.18], BEVEL, n)),
             tag(rbox([-0.15, -0.2, -0.62], [0.15, 0.3, -0.4], BEVEL, n))]
    m = merged(parts, "corbel", "stone")
    m.V[:, 2] += 0.62           # pivot base centre
    return m


CORNICE_PROF = [(1.0, 0.0), (1.0, 0.32), (-0.45, 0.32), (-0.62, 0.22), (-0.6, 0.1), (-0.42, 0.02), (-0.2, 0.0)]


def cornice_run(lod, length=2.0):
    """Moulded cornice slab: 1 m seat into the wall, 0.62 m rounded overhang (ovolo lip + cove), 0.32 m thick."""
    k = {0: 4, 1: 2, 2: 1}[lod]
    prof = rounded_profile(CORNICE_PROF, 0.06, k + 1)
    return tag(extrude_profile(prof, -length / 2, length / 2, 1, "cornice_run"))


def cornice_end(lod):
    """Free end of the cornice: the profile returns 90 deg into the wall (rounded return), closed."""
    k = {0: 4, 1: 2, 2: 1}[lod]
    prof = rounded_profile(CORNICE_PROF, 0.06, k + 1)
    run = extrude_profile(prof, -0.5, 0.0, 1, "cornice_end")
    steps = {0: 5, 1: 3, 2: 2}[lod]
    rings = []
    for t in np.linspace(0, math.pi / 2, steps + 1):   # sweep about the vertical axis at (x=0, y=1.0)
        R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
        ring = []
        for y, z in prof:
            d = np.array([0.0, y - 1.0])                     # (x, y) offset from the axis
            q = R @ d
            ring.append([q[0], 1.0 + q[1], z])
        rings.append(ring)
    V = [p for r in rings for p in r]; P = len(prof); F = []
    for k2 in range(steps):
        for i in range(P):
            a, b = k2 * P + i, k2 * P + (i + 1) % P
            F += [(a, b, b + P), (a, b + P, a + P)]
    c0 = len(V); V.append(np.mean(rings[0], 0)); c1 = len(V); V.append(np.mean(rings[-1], 0))
    for i in range(P):
        F += [(c0, (i + 1) % P, i), (c1, steps * P + i, steps * P + (i + 1) % P)]
    ret = orient(Mesh(np.array(V, float), np.array(F), "cornice_end", "stone"))
    return merged([tag(run), tag(ret)], "cornice_end", "stone")


def snow_drift_cap(lod, length=2.0, seed=4):
    """Rounded overhanging snow cap, 0.5-0.8 m thick, front lip rolls 0.25 m over the edge; thickness wanders."""
    rng = np.random.default_rng(seed)
    k = {0: 4, 1: 3, 2: 1}[lod]   # 6 -> 4 roll segments: tier lod0 budget (90k) with the v2 icicles
    t = rng.uniform(0.5, 0.8)
    prof = rounded_profile([(0.9, 0.0), (0.9, 0.18), (0.1, t * 0.55), (-0.15, t * 0.5), (-0.28, t * 0.25), (-0.25, -0.12), (-0.1, 0.0)], 0.12, k + 1)
    ph = rng.uniform(0, 6)
    segs = {0: 10, 1: 4, 2: 1}[lod]
    m = extrude_profile(prof, -length / 2, length / 2, segs, "snow_drift_cap",
                        wobble=lambda x: 0.88 + 0.12 * math.sin(x * 2.1 + ph) * math.cos(x * 0.7) + 0.1 * math.sin(x * 5.3 + 2 * ph))  # v3: bulging, irregular lip (no straight edge)
    return tag(m, snow=1.0)


def snow_drift_end(lod, seed=5):
    """Rounded snow mound that closes a cap at a tier end (squashed, noisy ellipsoid quarter-lobe)."""
    rng = np.random.default_rng(seed)
    n = {0: 12, 1: 6, 2: 3}[lod]
    th, ph = np.meshgrid(np.linspace(0, np.pi, n + 1), np.linspace(0, 2 * np.pi, 2 * n, endpoint=False), indexing="ij")
    rad = 1 + 0.08 * np.sin(3 * ph + rng.uniform(0, 6)) * np.sin(th)
    X = 0.55 * rad * np.sin(th) * np.cos(ph); Y = 0.5 * rad * np.sin(th) * np.sin(ph); Z = 0.35 * rad * np.cos(th)
    V = np.stack([X, Y, Z], -1).reshape(-1, 3); F = []
    W = 2 * n
    for i in range(n):
        for j in range(W):
            a, b = i * W + j, i * W + (j + 1) % W
            F += [(a, a + W, b), (b, a + W, b + W)]
    m = orient(weld(Mesh(V, np.array(F), "snow_drift_end", "stone"), 1e-6))
    m.V[:, 2] = np.maximum(m.V[:, 2], -0.05) + 0.05
    return tag(m, snow=1.0)


def snow_pillow(lod, width=4.6, seed=11):
    """Snow-pillow primitive (audit): thick bulging overhanging snow slab over a door bay / ledge. Rounded extrusion
    whose profile swells to `t` (0.55-0.8 m) with a rolled lip overhanging 0.8 m that droops 0.25 m below the seat,
    thickness and droop wandering along x (no straight edge). Icicles are placed as its children under the lip.
    Pivot: seat front-centre (y=0 = ledge front, z=0 = ledge top)."""
    rng = np.random.default_rng(seed)
    t = rng.uniform(0.6, 0.8); k = {0: 4, 1: 2, 2: 1}[lod]
    prof = rounded_profile([(1.2, 0.0), (1.2, 0.2), (0.4, t * 0.95), (-0.3, t), (-0.75, t * 0.7), (-0.85, t * 0.25),
                            (-0.7, -0.25), (-0.45, -0.18), (-0.2, 0.0)], 0.18, k + 1)
    ph = rng.uniform(0, 6)
    segs = {0: 14, 1: 6, 2: 2}[lod]
    m = extrude_profile(prof, -width / 2, width / 2, segs, "snow_pillow",
                        wobble=lambda x: 0.86 + 0.1 * math.sin(x * 1.7 + ph) + 0.06 * math.sin(x * 4.9 + 2 * ph))
    return tag(m, snow=1.0)


PILLOW_LIP = (-0.8, -0.2)   # (y, z) of the drooping lip underside: icicle roots go here


def icicle_cluster(lod, big, seed):
    """1 m run of fused ice drips (v3, after review: NO bar or lip strip). Roots start 0.12 m up inside the
    overhanging snow slab / cap edge they hang from, so they grow out of the snow; thick uneven main drips (r 0.06-0.17 m) with 1-2 thinner
    drips fused onto each, lengths varied (0.3-0.8 m s, 0.8-2.0 m l, skewed short), >= 4 per metre (kit-art).
    All ice (bluish matte material in play.html); drips > 0.5 m keep real geometry in every LOD (kit-engine)."""
    rng = np.random.default_rng(seed)
    cnt = int(rng.integers(4, 6)) if big else int(rng.integers(5, 7))
    rings, seg = {0: (5, 7) if big else (4, 6), 1: (3, 5), 2: (2, 4)}[lod]
    parts = []
    parts = []   # v3: no lip/bar at all; drips root INTO the overhanging snow slab edge they are snapped under
    lo, hi = (0.8, 2.0) if big else (0.3, 0.8)
    for x in np.sort(rng.uniform(-0.45, 0.45, cnt)):
        L = lo + (hi - lo) * rng.beta(1.3, 2.2)                    # skewed: mostly shorter, a few long
        r = float(np.clip(0.05 + 0.07 * L, 0.06, 0.17)) * rng.uniform(0.85, 1.25)
        y = rng.uniform(-0.1, 0.0)
        parts.append(tag(orient(spike([x, y, 0.12], L + 0.12, r, rng, rings=rings, seg=seg)), ice=1.0))
        for _ in range(int(rng.integers(1, 3)) if lod < 2 else 0):   # fused secondary drips
            dx = rng.choice([-1, 1]) * r * rng.uniform(0.5, 0.9)
            l2 = L * rng.uniform(0.35, 0.7)
            parts.append(tag(orient(spike([x + dx, y + rng.uniform(-0.03, 0.03), -0.03], l2, r * rng.uniform(0.5, 0.75), rng, rings=max(2, rings - 1), seg=seg)), ice=1.0))
    m = merged(parts, "icicle_cluster_l" if big else "icicle_cluster_s", "ice")
    m.V[:, 2] += -m.V[:, 2].min()      # pivot at the bottom tip level, hangs upward from base
    return m


def door_recess_frame(lod, w=1.7, h=2.2, depth=1.5):
    """Bevelled jambs + lintel around a 1.7 x 2.2 m opening, 1.5 m deep reveal, back panel at the recess end."""
    n = LODN[lod]
    J = 0.45
    parts = [tag(rbox([-w / 2 - J, -0.35, 0.0], [-w / 2, depth, h], BEVEL * 1.5, n)),
             tag(rbox([w / 2, -0.35, 0.0], [w / 2 + J, depth, h], BEVEL * 1.5, n)),
             tag(rbox([-w / 2 - J - 0.05, -0.4, h], [w / 2 + J + 0.05, depth, h + 0.5], BEVEL * 1.5, n)),
             tag(rbox([-w / 2, depth - 0.2, 0.0], [w / 2, depth, h], 0.02, 1))]
    return merged(parts, "door_recess_frame", "stone")


PIECES = {
    "wall_block_course": (wall_block_course, {"w": 2.0, "h": COURSE_H}),
    "wall_block_corner": (wall_block_corner, {"w": 0.95, "h": COURSE_H}),
    "corbel": (corbel, {"w": 0.4, "h": 0.62}),
    "cornice_run": (cornice_run, {"w": 2.0, "h": 0.32}),
    "cornice_end": (cornice_end, {"w": 0.5, "h": 0.32}),
    "snow_drift_cap": (snow_drift_cap, {"w": 2.0, "h": 0.6}),
    "snow_drift_end": (snow_drift_end, {"w": 1.1, "h": 0.4}),
    "icicle_cluster_s": (lambda lod: icicle_cluster(lod, False, 11), {"w": 1.0, "h": 0.9}),
    "icicle_cluster_l": (lambda lod: icicle_cluster(lod, True, 12), {"w": 1.0, "h": 2.1}),
    "door_recess_frame": (door_recess_frame, {"w": 2.6, "h": 2.7}),
    "snow_pillow": (snow_pillow, {"w": 4.6, "h": 0.8}),
}
SOCKETS = {
    "wall_block_course": {"L": [-1.0, 0, 0], "R": [1.0, 0, 0], "top": [0, 0, COURSE_H]},
    "wall_block_corner": {"wall": [-0.5, 0, 0], "top": [0, 0, COURSE_H]},
    "corbel": {"wall_top": [0, 0.3, 0.62]},
    "cornice_run": {"L": [-1.0, 0, 0], "R": [1.0, 0, 0], "top": [0, 0, 0.32]},
    "cornice_end": {"run": [-0.5, 0, 0]},
    "snow_drift_cap": {"L": [-1.0, 0, 0], "R": [1.0, 0, 0]},
    "snow_drift_end": {"cap": [0, 0, 0]},
    "icicle_cluster_s": {"hang": [0, 0, None]},
    "icicle_cluster_l": {"hang": [0, 0, None]},
    "door_recess_frame": {"sill": [0, 0, 0], "lintel": [0, 0, 2.7]},
    "snow_pillow": {"seat": [0, 0, 0], "lip": [0, PILLOW_LIP[0], PILLOW_LIP[1]]},
}


# ------------------------------------------------------------------ GLB (instancing aware)
def to_gl(V):
    return np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1)


def write_scene(path, meshes, instances, empties=(), extras=None, root=None):
    """meshes: {key: Mesh}; instances: [(node_name, key, (tx,ty,tz)_kit, yaw_deg_about_z)]; empties: [(name, pos_kit)].
    Repeated keys share ONE glTF mesh (instancing). root: optional (translation_gl, yaw_gl_deg) parent node."""
    import struct
    bins, views, accs, gm, nodes, mats, midx = [], [], [], [], [], [], {}
    off = [0]
    def add(arr, target, comp, typ, mm=False):
        b = arr.tobytes(); pad = (-len(b)) % 4; bins.append(b + b"\0" * pad)
        views.append({"buffer": 0, "byteOffset": off[0], "byteLength": len(b), **({"target": target} if target else {})})
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if mm:
            a["min"], a["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accs.append(a); off[0] += len(b) + pad; return len(accs) - 1
    key2mesh = {}
    for key, m in meshes.items():
        if m.material not in midx:
            midx[m.material] = len(mats)
            mats.append({"name": m.material, "extras": {"shader": "hex-triplanar" if m.material == "stone" else "matte-ice"},
                         "pbrMetallicRoughness": {"metallicFactor": 0.0, "roughnessFactor": 0.92 if m.material == "stone" else 0.8}})
        V = to_gl(m.V).astype(np.float32); N = to_gl(vertex_normals(m)).astype(np.float32)
        UV = np.stack([m.V[:, 0], m.V[:, 2]], 1).astype(np.float32)
        at = {"POSITION": add(V, 34962, 5126, "VEC3", True), "NORMAL": add(N, 34962, 5126, "VEC3"), "TEXCOORD_0": add(UV, 34962, 5126, "VEC2")}
        for k in ("_SNOW", "_ICE"):
            if k in m.attrs:
                at[k] = add(np.asarray(m.attrs[k], np.float32), 34962, 5126, "SCALAR")
        gm.append({"name": key, "primitives": [{"attributes": at, "indices": add(m.F.astype(np.uint32).ravel(), 34963, 5125, "SCALAR"), "material": midx[m.material]}]})
        key2mesh[key] = len(gm) - 1
    def yawq(deg):   # rotation about glTF +Y
        h = math.radians(deg) / 2; return [0.0, math.sin(h), 0.0, math.cos(h)]
    child = []
    for inst in instances:
        name, key, t, yaw = inst[:4]
        mirror = len(inst) > 4 and inst[4]
        tg = [float(t[0]), float(t[2]), float(-t[1])]
        nd = {"name": name, "mesh": key2mesh[key], "translation": tg, "rotation": yawq(yaw), "extras": {"piece": key}}
        if mirror:
            nd["scale"] = [-1.0, 1.0, 1.0]
        nodes.append(nd); child.append(len(nodes) - 1)
    for name, p in empties:
        nodes.append({"name": name, "translation": [float(p[0]), float(p[2]), float(-p[1])], "extras": {"socket": True}}); child.append(len(nodes) - 1)
    if root is not None:
        nodes.append({"name": "terrace_root", "children": child, "translation": [float(v) for v in root[0]], "rotation": yawq(root[1])})
        scene_nodes = [len(nodes) - 1]
    else:
        scene_nodes = child
    binc = b"".join(bins)
    doc = {"asset": {"version": "2.0", "generator": "boltverse tools/kit/pieces"}, "scene": 0,
           "scenes": [{"nodes": scene_nodes, "extras": extras or {}}], "nodes": nodes, "meshes": gm, "materials": mats,
           "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(binc)}], "extras": extras or {}}
    js = json.dumps(doc).encode(); js += b" " * ((-len(js)) % 4)
    Path(path).write_bytes(struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(binc)) + struct.pack("<II", len(js), 0x4E4F534A) + js
                           + struct.pack("<II", len(binc), 0x004E4942) + binc)


def tris(m):
    return int(len(m.F))


# ------------------------------------------------------------------ commands
def cmd_pieces(out):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    rep = {}
    for name, (fn, dims) in PIECES.items():
        lods = {l: fn(l) for l in (0, 1, 2)}
        socks = []
        for sn, p in SOCKETS[name].items():
            p = list(p)
            if p[2] is None:
                p[2] = float(lods[0].V[:, 2].max())
            socks.append((f"socket_{name}_{sn}", p))
        for l, m in lods.items():
            write_scene(out / f"{name}-lod{l}.glb", {name: m}, [(name, name, (0, 0, 0), 0)], socks if l == 0 else (), {"piece": name, "lod": l})
        V = lods[0].V
        lo, hi = V.min(0) + 0.02, V.max(0) - 0.02
        col = [{"id": f"col_{name}", "mesh": name, "min": to_gl(np.array([[lo[0], hi[1], lo[2]]]))[0].tolist(), "max": to_gl(np.array([[hi[0], lo[1], hi[2]]]))[0].tolist()}]
        (out / f"{name}-colliders.json").write_text(json.dumps(col))
        rep[name] = {"tris": {f"lod{l}": tris(m) for l, m in lods.items()}, "size_m": (V.max(0) - V.min(0)).round(3).tolist(),
                     "bevel_m": BEVEL, "material": lods[0].material, "sockets": [s[0] for s in socks]}
    (out / "pieces.json").write_text(json.dumps(rep, indent=1))
    return rep


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["pieces", "terrace"])
    ap.add_argument("--fit-mask", dest="fit_mask")
    ap.add_argument("--placer", help="auto key sheet dir: place detail from it (tools/placer)")
    ap.add_argument("--placer-groups", default="facade_snow,snow,drips,rubble")
    ap.add_argument("--placer-scope", help="mask png limiting placement (judge mask)")
    ap.add_argument("--variant", choices=["spec", "key"], default="spec")
    ap.add_argument("--out", required=True)
    ap.add_argument("--spine")
    a = ap.parse_args()
    if a.cmd == "pieces":
        print(json.dumps({k: v["tris"] for k, v in cmd_pieces(a.out).items()}, indent=1))
    else:
        from terrace import cmd_terrace
        print(json.dumps(cmd_terrace(a.spine, a.out, a.variant, a.fit_mask,
                                     placer=(a.placer, [g for g in a.placer_groups.split(",") if g], a.placer_scope) if a.placer else None), indent=1))
