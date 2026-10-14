"""tools/scenebuild/ops.py - geometry core for type recipes (v2).
Soft + most shapes are SDFs built from Inigo Quilez primitives / ops (rounded box, ellipsoid, cone, smooth-min,
repetition, domain warp), sampled on a bounded grid in NumPy and meshed with DUAL CONTOURING (sharp stone edges) or
MARCHING CUBES (soft snow / ice, skimage). Hard booleans (recess, chips) run in manifold3d on the meshed result.
Blocks/joints come from a small split grammar (split_wall: wall -> courses -> blocks, key-seeded jitter); no
third-party grammar code.

LOCAL frame: x right, y up, z out (toward camera); origin = element anchor.
A recipe = {"ops": [...]} executed top to bottom over a state {sdf, mesh}. Each op declares the metric it controls
(METRIC) and is unit-tested watertight + metric within 5 % from the key camera (test_ops.py).
Every node result is cached by hash(op, evaluated params, upstream hash) -> re-running a recipe after a late
param change rebuilds only downstream nodes (node graph cache, see run())."""
import ast, hashlib, json, math, operator
import numpy as np

# ---------------- IQ SDF primitives / ops (P: (N,3)) ----------------

def sd_round_box(P, c, b, r):
    q = np.abs(P - c) - (np.asarray(b) - r)
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - r


def sd_ellipsoid(P, c, r):
    r = np.asarray(r); q = (P - c) / r; k0 = np.linalg.norm(q, axis=1); k1 = np.linalg.norm(q / r, axis=1)
    return k0 * (k0 - 1) / np.maximum(k1, 1e-9)


def sd_cone_down(P, top, L, rad):
    """capped cone hanging from `top` down by L, base radius rad (round cone approximation)."""
    q = P - top; y = np.clip(-q[:, 1] / L, 0, 1); rr = rad * (1 - 0.85 * y)       # blunt tip (15 % radius)
    lat = (np.hypot(q[:, 0], q[:, 2]) - rr) * L / math.hypot(L, 0.85 * rad)
    return np.maximum(lat, np.maximum(q[:, 1], -q[:, 1] - L))


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)


def warp(P, amp, freq, seed):
    """IQ domain warp: smooth pseudo-noise offset of the sample point."""
    if amp <= 0:
        return P
    rng = np.random.default_rng(seed); K = rng.normal(0, freq, (3, 3, 3)); ph = rng.uniform(0, 6.3, (3, 3))
    off = np.stack([sum(np.sin(P @ K[a, i] + ph[a, i]) for i in range(3)) / 3 for a in range(3)], 1)
    return P + amp * off

# ---------------- state ----------------

class St:
    def __init__(self):
        self.sdf = None; self.parts = []; self.bounds = None; self.mesh = None; self.feat = 1e9; self.thin = 1e9; self.inst = []

    def add(self, f, lo, hi, k=0.0):
        self.parts.append(float(np.min((np.asarray(hi, float) - np.asarray(lo, float))[:2])))   # x/y size of each primitive
        self.feat = min(float(np.median(self.parts)), self.thin)   # typical part size (slivers from the grammar do not refine the grid)
        g = self.sdf
        self.sdf = f if g is None else (lambda P, g=g, f=f, k=k: smin(g(P), f(P), k))
        lo, hi = np.asarray(lo, float), np.asarray(hi, float)
        self.bounds = (lo, hi) if self.bounds is None else (np.minimum(self.bounds[0], lo), np.maximum(self.bounds[1], hi))
        return self

# ---------------- ops ----------------
METRIC = {}


def op(metric):
    def d(fn):
        METRIC[fn.__name__[3:]] = metric; return fn
    return d


@op("bbox w,h,d")
def op_rbox(s, rng, w, h, d, r=0.0, x=0.0, y=0.0, z=0.0, k=0.0):
    """IQ rounded box (bevel radius r), centre (x, y, z)."""
    c = np.array([x, y, z]); b = np.array([w, h, d]) / 2; r = float(min(r, b.min() * 0.9))
    return s.add(lambda P: sd_round_box(P, c, b, r), c - b, c + b, k)


@op("bbox w,h,t")
def op_blob(s, rng, w, h, t, lump=0.1, k=0.0, y=0.0):
    """snow lump: half ellipsoid on y=0 (w x h x t), domain-warped by lump."""
    c = np.array([0, y, 0.0]); r = np.array([w / 2, h, t / 2]); sd = int(rng.integers(1 << 30)); a = lump * min(w, h, t) * 0.5
    f = lambda P: np.maximum(sd_ellipsoid(warp(P, a, 3.0 / max(min(w, t), 1e-3), sd), c, r), -(P[:, 1] - y))
    return s.add(f, c - r * [1, 0, 1] - a, c + r + a, k)


@op("spike length L")
def op_spike(s, rng, L, rad, x=0.0, y=0.0, z=0.0, k=0.0):
    top = np.array([x, y, z]); s.thin = min(s.thin, 2 * rad)          # icicles always resolved (>= 3-4 cells across)
    return s.add(lambda P: sd_cone_down(P, top, L, rad), top - [rad, L, rad], top + [rad, 0, rad], k)


@op("cap thickness t over current top")
def op_drape(s, rng, t, over=0.1, lump=0.15, k=0.02):
    """snow cap: flattened ellipsoid resting on the top of the current bounds, overhang `over` x width."""
    lo, hi = s.bounds; c = np.array([(lo[0] + hi[0]) / 2, hi[1], (lo[2] + hi[2]) / 2]); hw = (hi - lo) / 2 * (1 + over)
    r = np.array([hw[0], t, hw[2]]); sd = int(rng.integers(1 << 30)); a = lump * t
    f = lambda P: np.maximum(sd_ellipsoid(warp(P, a, 4.0 / max(t, 1e-3), sd), c, r), -(P[:, 1] - hi[1] + 0.3 * t))
    return s.add(f, c - r - a, c + r + a, k)


@op("icicle count n, length L below current bottom")
def op_drip(s, rng, n, L, rad, k=0.01, jit=0.5):
    lo, hi = s.bounds if s.bounds is not None else (np.zeros(3), np.zeros(3))
    for i in range(max(0, int(round(n)))):
        x = rng.uniform(lo[0], hi[0]); Li = L * (1 + rng.uniform(-jit, jit) * 0.5); ri = rad * (0.6 + 0.8 * rng.random())
        op_spike(s, rng, Li, ri, x, lo[1] + 0.3 * rad, hi[2] - 1.5 * ri, k)
    return s


@op("block count / size variance (split grammar)")
def op_split_wall(s, rng, w, h, d, ch, bw, joint, r=0.0, cv=0.2, jit=0.1, relief=0.0):
    """blocks are INSTANCES (meshed once per quantised size in op_mesh, then translated: exact joints, few tris).
    CGA-style split grammar: wall(w x h) -> courses of height ~ch (variance cv) -> blocks of width ~bw (variance
    cv, running bond) separated by `joint`; each block a rounded box standing out by up to `relief`, key-seeded."""
    w, h, d, ch, bw, joint, relief = abs(w), abs(h), abs(d), max(abs(ch), 1e-3), max(abs(bw), 1e-3), abs(joint), max(relief, 0.0)
    nr = max(1, int(round(h / max(ch, 1e-3)))); hs = np.maximum(rng.normal(1, cv * 0.5, nr), 0.5); hs *= h / hs.sum(); y0 = -h / 2
    for i in range(nr):
        x0 = -w / 2 - (rng.uniform(0.3, 0.7) * bw if i % 2 else rng.uniform(0, 0.2) * bw)
        while x0 < w / 2 - 1e-3:
            bwi = max(0.3 * bw, bw * rng.normal(1, cv)); a, b = max(x0, -w / 2), min(x0 + bwi, w / 2)
            if b - a > 0.25 * bw or b >= w / 2:
                bh = hs[i] - joint; dz = rng.uniform(0, relief) + rng.normal(0, jit * joint)
                s.inst.append((b - a - joint, bh * (1 + rng.normal(0, jit * 0.1)), d, r, ((a + b) / 2, y0 + hs[i] / 2, dz)))
            x0 += bwi
        y0 += hs[i]
    return s


_BLOCK = {}


def chamfer_box(w, h, d, r):
    import manifold3d as m3
    b = np.array([w, h, d]) / 2; r = float(min(max(r, 0.0), b.min() * 0.9))
    if r <= 1e-4:
        return from_manifold(m3.Manifold.cube([w, h, d], True))
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                c = np.array([sx, sy, sz]) * b
                for ax in range(3):
                    p = c.copy(); p[ax] -= np.sign(c[ax]) * r; pts.append(p)
    return from_manifold(m3.Manifold.hull_points(np.array(pts)))


@op("mesh: watertight, bbox preserved")
def op_mesh(s, rng, method="dc", res=8, simplify=0.3):
    if s.inst:                                   # split-grammar instances: mesh each quantised block size once
        Vs, Fs, o = [], [], 0
        for (bw, bh, bd, r, c) in s.inst:
            q = tuple(round(float(x), 2) for x in (bw, bh, bd, r)) + (method, int(min(res, 3)))   # blocks: coarse grid + DC keeps them sharp
            if q not in _BLOCK:   # hard block = manifold3d hull of the chamfered corners (exact bevel, ~44 tris)
                _BLOCK[q] = chamfer_box(max(q[0], 0.01), max(q[1], 0.01), max(q[2], 0.01), q[3])
            V, F = _BLOCK[q]; Vs.append(V + np.asarray(c)); Fs.append(F + o); o += len(V)
        if s.sdf is not None:
            _mesh_sdf(s, rng, method, res, simplify); Vs.append(s.mesh[0]); Fs.append(s.mesh[1] + o)
        s.mesh = (np.vstack(Vs), np.vstack(Fs)); return s
    return _mesh_sdf(s, rng, method, res, simplify)


def _mesh_sdf(s, rng, method, res, simplify):
    """sample the SDF on a grid (cells ~ min extent / res) and mesh it: 'dc' dual contouring, 'mc' marching cubes."""
    lo, hi = s.bounds; ext = hi - lo; pad = ext.max() * 0.08 + 1e-3; lo, hi = lo - pad, hi + pad
    # thin parts (icicles) keep >= 3 cells, but never more than 12*res cells along the longest axis (screen-size LOD)
    exy = ext[:2][ext[:2] > 1e-6]; step = max(min((exy.min() if len(exy) else ext.max()) / res, s.feat / 4), ext.max() / (12 * res), (hi - lo).max() / 96)
    n = np.maximum(np.ceil((hi - lo) / step).astype(int) + 1, 3)
    ax = [np.linspace(lo[i], hi[i], n[i]) for i in range(3)]
    G = np.stack(np.meshgrid(*ax, indexing="ij"), -1).reshape(-1, 3); D = s.sdf(G).reshape(n)
    D[0], D[-1], D[:, 0], D[:, -1], D[:, :, 0], D[:, :, -1] = [np.abs(x) + step for x in (D[0], D[-1], D[:, 0], D[:, -1], D[:, :, 0], D[:, :, -1])]
    sp = (hi - lo) / (n - 1)
    if str(method) == "mc":
        from skimage.measure import marching_cubes
        if D.min() >= 0:
            s.mesh = (np.zeros((0, 3)), np.zeros((0, 3), int)); return s
        V, F, _, _ = marching_cubes(D, 0.0, spacing=tuple(sp)); V = V + lo; F = F[:, ::-1]
    else:
        if D.min() >= 0:
            s.mesh = (np.zeros((0, 3)), np.zeros((0, 3), int)); return s
        V, F = dual_contour(D, lo, sp, s.sdf)
    s.mesh = (V.astype(float), F.astype(int))
    if simplify > 0:                                # manifold3d simplify: flat DC faces collapse -> phone tri budget
        try:
            M = to_manifold(*s.mesh).simplify(float(simplify) * min(float(sp.min()), s.feat / 6))
            if M.num_tri() > 0:
                s.mesh = from_manifold(M)
        except Exception:
            pass
    return s


@op("recess volume (w-2i)(h-i)depth")
def op_recess(s, rng, inset, depth):
    """manifold3d boolean: cut a recess into the front face (door / niche)."""
    import manifold3d as m3
    if len(s.mesh[1]) == 0:
        return s
    V, F = s.mesh; lo, hi = V.min(0), V.max(0); M = to_manifold(V, F)
    cw, chh = (hi[0] - lo[0]) - 2 * inset, (hi[1] - lo[1]) - inset
    cut = m3.Manifold.cube([cw, chh, depth + 1e-3]).translate([lo[0] + inset, lo[1] - 1e-3, hi[2] - depth])
    s.mesh = from_manifold(M - cut); return s


@op("chipped volume fraction")
def op_chip(s, rng, vol, n=4):
    """manifold3d boolean: break n random edges/corners with axis-aligned cubes totalling `vol` x mesh volume."""
    import manifold3d as m3
    if len(s.mesh[1]) == 0 or vol <= 0:
        return s
    V, F = s.mesh; M0 = to_manifold(V, F); lo, hi = V.min(0), V.max(0); tgt = vol * M0.volume()
    if not tgt > 0:
        return s
    a = float((tgt / max(int(n), 1)) ** (1 / 3))
    corners = [(i, j) for i in (0, 1) for j in (0, 1)]; pick = rng.permutation(4)[: min(int(n), 4)]   # distinct front corners
    for _ in range(4):                       # rescale the cube size until the removed volume hits the target (+-2 %)
        M = M0
        for ci in pick:
            cx = [lo[0] if corners[ci][0] == 0 else hi[0] - a, lo[1] if corners[ci][1] == 0 else hi[1] - a, hi[2] - a]
            M = M - m3.Manifold.cube([a, a, a]).translate(cx)
        rem = M0.volume() - M.volume()
        if tgt <= 0 or abs(rem - tgt) < 0.02 * tgt:
            break
        a = float(np.clip(a * (tgt / max(rem, 1e-12)) ** (1 / 3), 1e-4, 0.5 * (hi - lo).min()))
    s.mesh = from_manifold(M); return s

# ---------------- dual contouring (own port: QEF per cell, quads per sign-changing edge) ----------------

def dual_contour(D, lo, sp, sdf):
    n = np.array(D.shape); inside = D < 0
    # cells with a sign change
    c8 = [inside[i:n[0] - 1 + i, j:n[1] - 1 + j, k:n[2] - 1 + k] for i in (0, 1) for j in (0, 1) for k in (0, 1)]
    anyin = np.any(c8, 0); allin = np.all(c8, 0); act = anyin & ~allin
    idx = -np.ones(n - 1, int); cells = np.argwhere(act); idx[tuple(cells.T)] = np.arange(len(cells))
    # QEF vertex per active cell from edge crossings + FD normals
    E = []
    for di in range(3):
        for a in (0, 1):
            for b in (0, 1):
                o0 = np.zeros(3, int); o1 = np.zeros(3, int); oth = [x for x in range(3) if x != di]
                o0[oth[0]] = o1[oth[0]] = a; o0[oth[1]] = o1[oth[1]] = b; o1[di] = 1; E.append((o0, o1))
    acc_p = np.zeros((len(cells), 3)); cnt = np.zeros(len(cells))
    ATA = np.zeros((len(cells), 3, 3)); ATb = np.zeros((len(cells), 3))
    for o0, o1 in E:
        d0 = D[tuple((cells + o0).T)]; d1 = D[tuple((cells + o1).T)]; m = (d0 < 0) != (d1 < 0)
        if not m.any():
            continue
        t = d0[m] / (d0[m] - d1[m]); p = lo + (cells[m] + o0 + (o1 - o0) * t[:, None]) * sp
        h = sp.min() * 0.5; g = np.stack([(sdf(p + e) - sdf(p - e)) for e in np.eye(3) * h], 1); g /= np.maximum(np.linalg.norm(g, axis=1, keepdims=True), 1e-9)
        ci = np.nonzero(m)[0]; acc_p[ci] += p; cnt[ci] += 1
        ATA[ci] += g[:, :, None] * g[:, None, :]; ATb[ci] += g * (g * p).sum(1, keepdims=True)
    mass = acc_p / np.maximum(cnt, 1)[:, None]
    A = ATA + 0.05 * np.eye(3)[None]; b = ATb - np.einsum("nij,nj->ni", ATA, mass)   # batched QEF, mass-point reg.
    x = mass + np.linalg.solve(A, b[..., None])[..., 0]; clo = lo + cells * sp; pts = np.clip(x, clo, clo + sp)
    # quads around every sign-changing grid edge (vectorised)
    F = []
    for di in range(3):
        oth = [x_ for x_ in range(3) if x_ != di]
        sl0 = [slice(1, n[x_] - 1) if x_ != di else slice(0, n[x_] - 1) for x_ in range(3)]
        sl1 = [s_ if x_ != di else slice(1, n[x_]) for x_, s_ in enumerate(sl0)]
        a0 = inside[tuple(sl0)]; a1 = inside[tuple(sl1)]; ch = np.argwhere(a0 != a1)
        if not len(ch):
            continue
        g = ch.copy(); g[:, oth[0]] += 1; g[:, oth[1]] += 1
        cs = []
        for da, db in ((-1, -1), (0, -1), (0, 0), (-1, 0)):
            c = g.copy(); c[:, oth[0]] += da; c[:, oth[1]] += db; cs.append(idx[tuple(c.T)])
        cs = np.stack(cs, 1); ok = cs.min(1) >= 0; cs = cs[ok]
        flip = a0[tuple(ch[ok].T)] == (di == 1); cs[flip] = cs[flip][:, ::-1]
        F.append(np.concatenate([cs[:, [0, 1, 2]], cs[:, [0, 2, 3]]]))
    F = np.concatenate(F) if F else np.zeros((0, 3), int)
    return pts, np.array(F, int).reshape(-1, 3)

# ---------------- mesh <-> manifold ----------------

def to_manifold(V, F):
    import manifold3d as m3
    return m3.Manifold(m3.Mesh(vert_properties=np.asarray(V, np.float32), tri_verts=np.asarray(F, np.uint32)))


def from_manifold(M):
    mm = M.to_mesh(); return np.asarray(mm.vert_properties)[:, :3].astype(float), np.asarray(mm.tri_verts).astype(int)


def watertight(V, F):
    """every undirected edge shared by exactly two faces, consistently oriented (each directed edge once)."""
    if len(F) == 0:
        return False
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]); u, c = np.unique(e, axis=0, return_counts=True)
    if (c != 1).any():
        return False
    s = np.sort(e, 1); _, c2 = np.unique(s, axis=0, return_counts=True); return bool((c2 == 2).all())

OPS = {k[3:]: v for k, v in list(globals().items()) if k.startswith("op_")}

# ---------------- safe expressions + cached node graph ----------------
_BIN = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.Pow: operator.pow}
_FN = {"min": min, "max": max, "abs": abs, "sqrt": math.sqrt, "clip": lambda x, a, b: max(a, min(b, x)), "round": round}


def ev(x, env):
    if not isinstance(x, str) or x in ("dc", "mc"):
        return x
    def f(n):
        if isinstance(n, ast.Expression): return f(n.body)
        if isinstance(n, ast.Constant): return n.value
        if isinstance(n, ast.Name): return env[n.id]
        if isinstance(n, ast.BinOp): return _BIN[type(n.op)](f(n.left), f(n.right))
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub): return -f(n.operand)
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FN: return _FN[n.func.id](*[f(a) for a in n.args])
        raise ValueError(f"recipe expression not allowed: {x}")
    return float(f(ast.parse(x, mode="eval")))


CACHE = {}; STATS = {"hit": 0, "miss": 0}


def run(recipe, env, seed):
    """execute the recipe op chain; node key = sha(upstream key, op, evaluated params, seed). SDF closures are cheap,
    so the cache stores the state after every 'mesh' and later node: a late-param change re-runs only from the
    first changed node, and mesh/boolean nodes upstream of it are reused."""
    import copy
    key = hashlib.sha1(f"{recipe.get('version', 1)}|{seed}".encode()).hexdigest(); s = St(); rng = np.random.default_rng(seed)
    meshed = False
    for i, step in enumerate(recipe["ops"]):
        kw = {k: ev(v, env) for k, v in step.items() if k != "op"}
        key = hashlib.sha1((key + json.dumps([step["op"], kw], sort_keys=True, default=str)).encode()).hexdigest()
        if meshed and key in CACHE:
            s = CACHE[key]; STATS["hit"] += 1; continue
        if step["op"] == "mesh" and key in CACHE:
            s = CACHE[key]; meshed = True; STATS["hit"] += 1; continue
        s2 = copy.copy(s); OPS[step["op"]](s2, np.random.default_rng([seed, i]), **kw); s = s2; STATS["miss"] += 1
        if step["op"] == "mesh":
            meshed = True
        if meshed:
            CACHE[key] = s
    if len(CACHE) > 20000:
        CACHE.clear()
    if s.mesh is None:
        op_mesh(s, rng)
    return s.mesh
