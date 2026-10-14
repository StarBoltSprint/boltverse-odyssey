#!/usr/bin/env python3
"""tools/scenebuild/build.py - build a whole scene from an AUTO key sheet, fully automatic, any key.
usage: python3 tools/scenebuild/build.py SHEETDIR OUTDIR [--opt opt.json]
camera = auto key camera (camera.json, MoGe-2 intrinsics) at the origin; every element is typed (types.py) and
built by its type's parametric generator (gens.py) at its back-projected MoGe position with measured size.
One merged mesh per type (vertex colours) -> <= 12 draw calls; icicles are a single mesh.
Writes scene.glb + scene.json (camera, light, per-element params actually used)."""
import argparse, hashlib, json, math, struct, sys
from pathlib import Path
import numpy as np, cv2
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(ROOT / "tools/keysheet"))
import eltypes as ET  # noqa: E402
import gens as G  # noqa: E402
import ops as O  # noqa: E402
from auto_check import l2masks  # noqa: E402


def load(sd):
    sd = Path(sd); sh = json.loads((sd / "sheet.json").read_text()); cam = json.loads((sd / "camera.json").read_text())
    Z = np.load(sd / "depth.npy").astype(np.float32); W = sh["frame_px"]
    if Z.shape != (W, W):
        Z = cv2.resize(Z, (W, W))
    u, v = np.meshgrid(np.arange(W), np.arange(W))
    X = (u - cam["cx"]) / cam["fx"] * Z; Y = (v - cam["cy"]) / cam["fy"] * Z
    Pcv = np.stack([X, Y, Z], -1)                                     # OpenCV camera frame
    P3 = Pcv * np.array([1, -1, -1], np.float32)                      # three.js frame
    L1 = cv2.imread(str(sd / "L1.png"), 0); M2 = l2masks(sd)
    els1 = [e for e in sh["elements"] if e["level"] == 1]; els2 = [e for e in sh["elements"] if e["level"] == 2]
    return sh, cam, Z, Pcv, P3, [L1 == i for i in range(1, len(els1) + 1)], els1, M2, els2


def normal_of(Pcv, m):
    pts = Pcv[m]; pts = pts[np.isfinite(pts).all(1)]
    if len(pts) < 10:
        return None
    pts = pts[np.random.default_rng(0).choice(len(pts), min(len(pts), 400), replace=False)]
    c = pts - pts.mean(0); _, _, vt = np.linalg.svd(c, full_matrices=False); n = vt[2]
    return n if n[2] < 0 else -n                                      # facing the camera


def frame_axes(n3):
    """axes (right, up, out) in three frame for a surface with outward normal n3."""
    o = n3 / (np.linalg.norm(n3) + 1e-9); up0 = np.array([0, 1.0, 0])
    if abs(o @ up0) > 0.9:
        up0 = np.array([0, 0, -1.0])
    r = np.cross(up0, o); r /= np.linalg.norm(r); u = np.cross(o, r); return r, u, o


def wear_colours(V, F, col, snow, rough, snow_col, t):
    """wear / snow from geometry, not global noise: per-vertex area-weighted normals -> up-facing mask gets snow
    (amount = measured snow fraction), convex edges lighten (wear), concave creases darken (AO). Curvature =
    Laplacian of the vertex positions projected on the normal."""
    V = np.asarray(V, float); F = np.asarray(F, int); n = len(V)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); N = np.zeros_like(V)
    for i in range(3):
        np.add.at(N, F[:, i], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    nb = np.zeros_like(V); cnt = np.zeros(n)
    for a, b in ((0, 1), (1, 2), (2, 0), (1, 0), (2, 1), (0, 2)):
        np.add.at(nb, F[:, a], V[F[:, b]]); np.add.at(cnt, F[:, a], 1)
    lap = nb / np.maximum(cnt, 1)[:, None] - V; scale = np.linalg.norm(V.max(0) - V.min(0)) + 1e-9
    curv = -(lap * N).sum(1) / scale * 40                                  # > 0 convex, < 0 concave
    C = np.tile(np.asarray(col, float), (n, 1))
    C *= (1 + np.clip(curv, 0, 1)[:, None] * 0.25 * (0.5 + rough)) * (1 - np.clip(-curv, 0, 1)[:, None] * 0.35)
    if t not in ("snow_pillow", "snow_patch", "tread_snow", "icicle"):
        up = np.clip((N[:, 1] - 0.45) / 0.35, 0, 1) * min(1.0, 2 * snow)
        C = C * (1 - up[:, None]) + np.asarray(snow_col)[None] * up[:, None]
    return np.clip(C, 0, 1)


_REC = {}
OBS_W = 0.8   # weight of the projected key colour vs the measured albedo/wear colour


def recipe(t):
    if t not in _REC:
        _REC[t] = json.loads((HERE / "recipes" / f"{t}.json").read_text())
    return _REC[t]


def bind(p, k, s, rough, w, h, th, o=None):
    """the names a recipe may use: sizes in metres from MoGe scale (k = m/px at the element depth).
    ch / bw = measured course height / block width (period_y / period_x, else the element size), jv = size/joint
    jitter (optimiser, default 0.2), snow scaled by the optimiser's sn."""
    o = o or {}; px = (p.get("parts.period_x_px") or 0) * k * s; py = (p.get("parts.period_y_px") or 0) * k * s
    lod = float(np.clip(max(p["outline.w_px"], p["outline.h_px"]) * s / 12.0, 2, 8))   # ~12 key px per grid cell
    return {"lod": lod, "ch": py if 0.05 < py < h else h, "bw": px if 0.05 < px < w else w, "jv": o.get("jv", 0.2),
            "w": w, "h": h, "th": th, "d": float(np.clip(abs(p.get("depth.protrusion_m", 0.1)), 0.05, 0.6 * max(w, h))),
            "rough": rough, "snow": float(np.clip(p.get("wear.snow_frac", 0.0) * o.get("sn", 1.0), 0, 1)), "joint": (p.get("parts.joint_w_px") or 0) * k * s,
            "px": px, "nx": float(np.clip(round(w / px), 1, 6)) if px > 0.05 else 1.0, "drips": 0.0}


def build(sd, out, opt=None, rel_step=10):
    sh, cam, Z, Pcv, P3, L1m, els1, M2, els2 = load(sd); opt = opt or {}
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    meshes = {t: G.M() for t in ET.TYPES}; used = {}; rng = np.random.default_rng(5)
    pxm = lambda z: z / cam["fy"]
    sky = None
    sn = [e["props"] for e in els2 if e.get("props") and e.get("class") == "snow"]
    snow_col = G.lab_rgb(tuple(float(np.median([q[f"albedo.{c}"] for q in sn])) for c in "Lab")) if sn else np.array([0.85, 0.88, 0.95])
    for e, m in list(zip(els1, L1m)) + list(zip(els2, M2)):
        p = e.get("props")
        if p is None or not m.any():
            continue
        n = normal_of(Pcv, m); t = ET.classify(e, n); o = opt.get(e["id"], {})
        s, dz, cg, rg = o.get("s", 1.0), o.get("dz", 0.0), o.get("cg", 1.0), o.get("rg", 1.0); sy = o.get("sy", 1.0)
        col = G.lab_rgb((p["albedo.L"], p["albedo.a"], p["albedo.b"]), cg)
        ys, xs = np.nonzero(m); z = float(np.median(Z[m])) * (1 + dz)
        c = np.median(P3[m], 0) * (1 + dz)
        k = pxm(z); w_m, h_m = p["outline.w_px"] * k * s, p["outline.h_px"] * k * s * sy
        th_m = max(p["depth.thick_px"] * k * s, 0.03); rough = min(p["edge.rough"], 0.6) * rg
        n3 = np.array([0, 0, 1.0]) if n is None else n * np.array([1, -1, -1])
        if t not in ("tread_snow", "rubble", "ground"):
            n3 = np.array([0, 0, 1.0])            # vertical elements: camera-facing frame (MoGe normals of small masks are noise)
        ax = frame_axes(n3)
        if t == "sky":
            sky = sky or col.tolist()
            V, F, C = G.relief(P3 * (1 + dz), m, 24, np.tile(col, (1024, 1024, 1)).reshape(1024, 1024, 3), 0, rng)
            meshes[t].add(V, F, col); used[e["id"]] = [t, round(z, 2)]; continue
        big = e["level"] == 1 or (t in ("stone_block", "ice_mass", "wall") and e["area_frac"] > 0.002)
        if big:   # big forms / big masses: depth-fitted relief surface (L2 ones 0.5 % nearer so they sit on the L1 form)
            Ps = P3 * (1 + dz) * (1.0 if e["level"] == 1 else 0.995)
            V, F, _ = G.relief(Ps, m, rel_step if e["level"] == 1 else 6, np.zeros((1024, 1024, 3)), 0.004 * rough, rng)
            meshes[t if t in ("ground", "wall", "ice_mass", "tread_snow") else "wall"].add(V, F, col, 0.04 + p["col.L_std"] / 400, rng)
            used[e["id"]] = [t, round(z, 2)]; continue
        # small elements: the type's text recipe (recipes/<type>.json) composed from ops.py, params bound to the
        # element's measured properties (bind) x optimiser multipliers
        R = recipe(t); env = bind(p, k, s, rough, w_m, h_m, th_m, o)
        if R.get("frame") == "surface":
            ax = (ax[0], ax[2], -ax[1])                                    # local y = surface normal
        anchor = np.median(P3[m][ys <= ys.min() + 1], 0) if R.get("anchor") == "top" else c
        Vl, Fl = O.run(R, env, int(hashlib.sha1(e["id"].encode()).hexdigest()[:8], 16));
        if len(Fl) == 0:
            used[e["id"]] = [t, round(z, 2), "empty"]; continue
        off = np.array([O.ev(x, env) for x in R.get("offset", [0, 0, 0])])   # key-seeded per element
        Vw = anchor + (Vl + off) @ np.stack(ax)
        meshes[t].add(Vw, Fl, wear_colours(Vw, Fl, col, env["snow"], rough, snow_col, t))
        used[e["id"]] = [t, round(z, 2)]
    # light: median image-plane light direction of the elements -> directional light from that side, above
    dx = float(np.median([e["props"]["light.dir_x"] for e in els2 if e.get("props")])); dy = float(np.median([e["props"]["light.dir_y"] for e in els2 if e.get("props")]))
    # lighting calibrated on the key: median lit/shadow ratio r of the elements -> ambient share 1/r, sun share 1-1/r
    # (lit side = amb + sun = 1, shadow side = amb = 1/r), so the render reproduces the key's lit vs shadow contrast
    r = float(np.median([e["props"]["light.lit_shadow"] for e in els1 + els2 if e.get("props") and e["props"].get("light.lit_shadow")] or [1.5]))
    r = float(np.clip(r, 1.05, 4.0)); light = {"dir": [dx, -dy, 0.6], "sky": sky or [0.2, 0.25, 0.4], "lit_shadow": round(r, 3),
                                               "amb": round(1 / r, 3), "sun": round(1 - 1 / r, 3)}
    # colour: project the key's OBSERVED colour onto every generated vertex (key camera), mixed with the measured
    # albedo/wear colour; observed already carries the key's shading, so it is divided by the expected shade
    keyimg = cv2.GaussianBlur(cv2.cvtColor(cv2.imread(str(Path(sd) / "key1024.png")), cv2.COLOR_BGR2RGB).astype(np.float32) / 255, (0, 0), 2)
    Hk, Wk = keyimg.shape[:2]; sx = Wk / cam["W"]; sy_ = Hk / cam["H"]
    for t, mm in meshes.items():
        for i, V in enumerate(mm.V):
            Pc = V * np.array([1, -1, -1]); zc = np.maximum(Pc[:, 2], 1e-3)
            u = np.clip((cam["fx"] * Pc[:, 0] / zc + cam["cx"]) * sx, 0, Wk - 1).astype(int); v = np.clip((cam["fy"] * Pc[:, 1] / zc + cam["cy"]) * sy_, 0, Hk - 1).astype(int)
            obs = keyimg[v, u]; w_obs = 1.0 if t == "sky" else OBS_W
            mm.C[i] = np.clip(w_obs * obs + (1 - w_obs) * mm.C[i], 0, 1)
    write_glb(out / "scene.glb", meshes)
    counts = {}
    for t in used.values():
        counts[t[0]] = counts.get(t[0], 0) + 1
    draws = sum(1 for mm in meshes.values() if mm.V)
    info = {"camera": {"fov_y_deg": cam["fov_y_deg"], "aspect": 1.0}, "light": light, "types": counts, "draws": draws,
            "tris": int(sum(len(np.vstack(mm.F)) for mm in meshes.values() if mm.F)), "elements": used,
            "tris_by_type": {t: int(sum(len(f) for f in mm.F)) for t, mm in meshes.items() if mm.F}}
    (out / "scene.json").write_text(json.dumps(info))
    return info


def write_glb(path, meshes):
    bins, views, accs, gm, nodes = [], [], [], [], []
    off = 0
    def add(arr, target, comp, typ, mm=False):
        nonlocal off
        b = arr.tobytes(); pad = (-len(b)) % 4; bins.append(b + b"\0" * pad)
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b), "target": target})
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if mm:
            a["min"], a["max"] = arr.min(0).tolist(), arr.max(0).tolist()
        accs.append(a); off += len(b) + pad; return len(accs) - 1
    for t, mm in meshes.items():
        A = mm.arrays()
        if A is None:
            continue
        V, F, C = A
        C = np.where(C <= 0.04045, C / 12.92, ((C + 0.055) / 1.055) ** 2.4).astype(np.float32)   # glTF COLOR_0 is linear
        at = {"POSITION": add(V, 34962, 5126, "VEC3", True), "COLOR_0": add(C, 34962, 5126, "VEC3")}
        gm.append({"name": t, "primitives": [{"attributes": at, "indices": add(F.ravel(), 34963, 5125, "SCALAR")}]})
        nodes.append({"name": t, "mesh": len(gm) - 1})
    doc = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": list(range(len(nodes)))}], "nodes": nodes, "meshes": gm,
           "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": off}]}
    js = json.dumps(doc).encode(); js += b" " * ((-len(js)) % 4); bb = b"".join(bins)
    Path(path).write_bytes(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bb)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(bb), 0x004E4942) + bb)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("sheet"); ap.add_argument("out"); ap.add_argument("--opt")
    a = ap.parse_args(); opt = json.loads(Path(a.opt).read_text()) if a.opt else None
    i = build(a.sheet, a.out, opt); print(json.dumps({k: i[k] for k in ("types", "draws", "tris", "camera")}))
