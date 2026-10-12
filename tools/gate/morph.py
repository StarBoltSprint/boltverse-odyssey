"""Approach-morph control.

Same jump rule as steps/zone-d/01-terrace/work/morph_control.py:
a frame fails when IoU < 0.8 or it drops more than 0.05 under the median of its
±2 neighbours. Those two numbers are not loosened.

The terrace script still replays the 300 m → 10 m path on the LOD0 OBJ.
The self-test uses a handful of triangles, not that mesh.
"""
import json
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

MIN_IOU = 0.8
MAX_DROP = 0.05
STEP = 0.95


def load_obj(path):
    V, F = [], []
    for l in open(path):
        if l.startswith("v "):
            V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("f "):
            F.append([int(t.split("/")[0]) - 1 for t in l.split()[1:4]])
    return np.array(V, float), np.array(F, int)


def box_of(lo, hi):
    v = np.array([[x, y, z] for x in (lo[0], hi[0]) for y in (lo[1], hi[1]) for z in (lo[2], hi[2])], float)
    f = np.array([[0, 1, 3], [0, 3, 2], [4, 6, 7], [4, 7, 5], [0, 4, 5], [0, 5, 1], [2, 3, 7], [2, 7, 6], [0, 2, 6], [0, 6, 4], [1, 5, 7], [1, 7, 3]], int)
    return v, f


def raster(V, F, eye, tgt, W, H, fov):
    f = np.array(tgt, float) - eye
    f = f / np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0])
    r = r / np.linalg.norm(r)
    u = np.cross(r, f)
    P = V - eye
    x, y, z = P @ r, P @ u, P @ f
    k = H / 2 / math.tan(math.radians(fov / 2))
    X = W / 2 + k * x / np.maximum(z, 1e-6)
    Y = H / 2 - k * y / np.maximum(z, 1e-6)
    im = Image.new("1", (W, H))
    d = ImageDraw.Draw(im)
    for t in F:
        d.polygon([(X[i], Y[i]) for i in t], fill=1)
    return np.array(im)


def jump_list(ious, min_iou=MIN_IOU, max_drop=MAX_DROP):
    v = [i[1] for i in ious]
    bad = []
    for i, (dd, io, px) in enumerate(ious):
        nb = sorted([v[j] for j in (i - 2, i - 1, i + 1, i + 2) if 0 <= j < len(v)])
        med = nb[len(nb) >> 1] if nb else io
        if io < min_iou or med - io > max_drop:
            bad.append((dd, round(io, 3), px))
    return bad


def approach(V, F, d0=300.0, d1=10.0, W=135, H=240, fov=58, step=STEP):
    lo, hi = V.min(0), V.max(0)
    C = (lo + hi) / 2
    sp = (-d0 * 0.7071, d0 * 0.7071)
    dx, dz = sp[0] - C[0], sp[1] - C[2]
    L = math.hypot(dx, dz)
    dx /= L
    dz /= L
    r0 = max((hi[0] - lo[0]) / 2, (hi[2] - lo[2]) / 2)
    h = hi[1] - lo[1]
    prev = None
    ious = []
    d = float(d0)
    while d >= d1 - 1e-9:
        x, z = C[0] + dx * (r0 + d), C[2] + dz * (r0 + d)
        eye = np.array([x, 2.0, z])
        ty = lo[1] + min(h * 0.5, 40, d * 0.35 + 8)
        m = raster(V, F, eye, [C[0], ty, C[2]], W, H, fov).astype(bool)
        if prev is not None:
            ious.append((round(d, 1), float((m & prev).sum() / max(1, (m | prev).sum())), int(m.sum())))
        prev = m
        d *= step
    bad = jump_list(ious)
    v = [i[1] for i in ious]
    return {
        "minIoU": round(min(v), 3) if v else None,
        "frames": len(ious),
        "jumps": bad,
        "pass": len(bad) == 0 and len(ious) > 0,
        "minIouThreshold": MIN_IOU,
        "maxDrop": MAX_DROP,
    }


def control(obj_path):
    """Terrace mesh against a rigid box of the same AABB. Same camera both times."""
    V, F = load_obj(obj_path)
    lo, hi = V.min(0), V.max(0)
    bx, BF = box_of(lo, hi)
    return {"terrace": approach(V, F), "rigidBox": approach(bx, BF)}


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if not a:
        print("usage: morph <obj> [--out j]   or   morph --box   or   morph --control <obj>", file=sys.stderr)
        return 2
    if a[0] == "--control":
        r = control(a[1])
        flat = {k: {"minIoU": r[k]["minIoU"], "pass": r[k]["pass"], "jumps": r[k]["jumps"]} for k in r}
        print(json.dumps(flat))
        if "--out" in a:
            json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
        return 0 if all(r[k]["pass"] for k in r) else 1
    if a[0] == "--box":
        V, F = box_of(np.array([-8.0, 0.0, -16.0]), np.array([8.0, 14.0, 1.0]))
    else:
        V, F = load_obj(a[0])
    r = approach(V, F)
    text = json.dumps({k: r[k] for k in ("minIoU", "frames", "pass", "jumps")})
    print(text)
    if "--out" in a:
        json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
