"""Projection set shared by the Blender relief stage, the QC and the runtime shader (three.js LOCAL coords:
x right, y up, z toward the front camera; hull z3 = -z).  18 directions: 8 horizontal (every 45 deg), 4 oblique-up
(45 deg), 4 oblique-down (-45 deg), straight up, straight down. Each direction d is a plate camera looking along -d:
  col = c0 + (p.t) * k,   row = r0 - (p.v) * k      (t = right, v = up of that camera; k = plate px per metre)
Wall plates: row is mirror-wrapped into the rock rows, col into that row's rock span (spans from the plate's own mask),
so a sample never lands on sky. Worst-case projection stretch 1/max(n.d) <= 1.23 for any normal with n.y > -0.3."""
import json, sys, numpy as np
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from masks import load, rock_mask
from hull import clean_profile
UP = np.array([0.0, 1.0, 0.0])
def directions():
    D = []
    for k in range(8):
        a = np.deg2rad(45 * k); D.append(("h", a, 0.0))
    for k in range(4):
        a = np.deg2rad(90 * k); D.append(("o", a, np.deg2rad(45))); 
    for k in range(4):
        a = np.deg2rad(90 * k); D.append(("o", a, np.deg2rad(-45)))
    D.append(("top", 0.0, np.pi / 2)); D.append(("bot", 0.0, -np.pi / 2))
    return D
def plate_for(az_deg):
    a = az_deg % 360
    if a in (0, 45, 315): return "front"
    if a in (135, 180, 225): return "back"
    return "side"
def build(meta, plates):
    out = []
    spans = {}
    for k in ("front", "side", "back"):
        m, _ = clean_profile(rock_mask(load(plates[k])))
        H = m.shape[0]; sp = np.zeros((H, 2), np.float32); last = None
        rows = np.nonzero(m.any(1))[0]; top = rows.min()
        for r in range(H):
            rr = max(r, top)
            cols = np.nonzero(m[min(rr, H - 1)])[0]
            if len(cols): last = (cols.min(), cols.max())
            sp[r] = last if last else (0, m.shape[1] - 1)
        spans[k] = sp
    for kind, a, e in directions():
        n = np.array([np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)])
        if kind in ("top", "bot"):
            t = np.array([1.0, 0, 0]); v = np.array([0, 0, 1.0]) if kind == "top" else np.array([0, 0, -1.0])
            out.append(dict(n=n.tolist(), t=t.tolist(), v=v.tolist(), plate="top", c0=meta["top_c"][0], r0=meta["top_c"][1], k=meta["tpx"], wrap=0))
            continue
        h = np.array([np.sin(a), 0, np.cos(a)])
        t = np.cross(UP, h); t /= np.linalg.norm(t)
        v = np.cross(n, t); v /= np.linalg.norm(v)
        p = plate_for(round(np.rad2deg(a)))
        out.append(dict(n=n.tolist(), t=t.tolist(), v=v.tolist(), plate=p, c0=meta["plate_cx"][p], r0=float(meta["base_row"]), k=meta["pxm"], wrap=1))
    return out, spans
def mirror(x, a, b):
    L = max(b - a, 1.0); t = np.mod(x - a, 2 * L); return a + np.where(t < L, t, 2 * L - t)
def sample_cols_rows(d, p, meta, spans):
    """p: (N,3) local points -> (col,row) arrays, same math as the shader."""
    col = d["c0"] + p @ np.array(d["t"]) * d["k"]; row = d["r0"] - p @ np.array(d["v"]) * d["k"]
    if d["wrap"]:
        row = mirror(row, meta["top_row"], meta["base_row"])
        sp = spans[d["plate"]][np.clip(row.astype(int), 0, len(spans[d["plate"]]) - 1)]
        col = mirror(col, sp[:, 0], sp[:, 1])
    return col, row
if __name__ == "__main__":
    meta = json.load(open(sys.argv[1])); plates = json.load(open(sys.argv[2]))
    D, spans = build(meta, plates)
    json.dump(dict(dirs=D, spans={k: v.tolist() for k, v in spans.items()}), open(sys.argv[3], "w"))
    print(len(D), "dirs")
