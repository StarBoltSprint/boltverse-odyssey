"""LOD outline.

Two measures live here:

- Binary silhouette XOR (`xor_paths`). Same hard raster for both meshes.
  Identical triangles produce 0 differing pixels. A non-zero xor is a FAIL for
  that raster. The 28 m yaw-35 raster is not an Engine switch: sealed terrace
  LODs still differ there by a few dozen pixels.

- Ray outline at the Engine switches (`ray_pair`). Same test as
  tools/object-gate/py/lod_gate.py: XOR of the hit masks, plus an interior
  depth jump above max(0.1 m, 1%). Cameras are the 15 m and 40 m switches
  (Blender Z-up after OBJ import, vertical FOV 60, 720×1280). Acceptance for
  a terrace rebuild is xorPx == 0 at both distances.
"""
import json
import math
import sys
import numpy as np
from PIL import Image, ImageDraw

from tools.gate.morph import load_obj

# Engine LOD switches. Blender world (Z up) after OBJ import forward -Z, up Y.
# 15 m: eye (-10.65, -10.65, 1.7) → target (0, 0, 5). 40 m: eye (-28.4, -28.4, 1.7).
SWITCHES = (
    ("switch15m", (-10.65, -10.65, 1.7), (0.0, 0.0, 5.0)),
    ("switch40m", (-28.4, -28.4, 1.7), (0.0, 0.0, 5.0)),
)


def _raster(V, F, eye, tgt, W, H, fov):
    f = np.asarray(tgt, float) - eye
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
        d.polygon([(float(X[i]), float(Y[i])) for i in t], fill=1)
    return np.array(im, bool)


def silhouette(path, W=180, H=320, fov=50, yaw_deg=35, dist=28):
    V, F = load_obj(path)
    C = (V.min(0) + V.max(0)) / 2
    yaw = math.radians(yaw_deg)
    eye = C + np.array([math.sin(yaw) * dist, dist * 0.15, math.cos(yaw) * dist])
    return _raster(V, F, eye, C, W, H, fov)


def ray_pair(path_a, path_b, view=None):
    """Hit-mask XOR plus interior depth pop. Thresholds match lod_gate.py and are not loosened."""
    from scipy import ndimage as ndi
    A = np.load(path_a)
    B = np.load(path_b)
    ha, hb = ~np.isnan(A["depth"]), ~np.isnan(B["depth"])
    dd = np.abs(np.nan_to_num(A["depth"]) - np.nan_to_num(B["depth"]))
    x = (ha ^ hb) | (ha & hb & (dd > np.maximum(0.1, 0.01 * np.nan_to_num(A["depth"]))))
    D = np.where(ha, A["depth"], 0)
    j = np.zeros_like(D)
    for ax in (0, 1):
        j = np.maximum(j, np.abs(D - np.roll(D, 1, ax)))
    edge = (j > 0.15) | (ha ^ ndi.binary_erosion(ha))
    focus = ndi.binary_dilation(edge, iterations=3)
    lab, n = ndi.label(x)
    blob = int(np.bincount(lab.ravel())[1:].max()) if n else 0
    r = dict(
        view=view,
        hitPx=int(ha.sum()),
        xorPx=int(x.sum()),
        xorFrac=round(float(x.sum() / max(1, ha.sum())), 6),
        focusPx=int(focus.sum()),
        focusXorPx=int((x & focus).sum()),
        focusXorFrac=round(float((x & focus).sum() / max(1, focus.sum())), 6),
        maxBlobPx=blob,
    )
    r["pass"] = r["xorFrac"] <= 0.0005 and r["focusXorFrac"] <= 0.001 and blob <= 4
    return r


def xor_paths(a, b, **kw):
    A = silhouette(a, **kw)
    B = silhouette(b, **kw)
    x = np.logical_xor(A, B)
    hit = int(A.sum())
    xor_px = int(x.sum())
    return {
        "xorPx": xor_px,
        "hitPx": hit,
        "xorFrac": round(xor_px / max(1, hit), 6),
        "pass": xor_px == 0 and hit > 0,
        "width": int(A.shape[1]),
        "height": int(A.shape[0]),
    }


def main(argv=None):
    a = list(sys.argv[1:] if argv is None else argv)
    if len(a) >= 3 and a[0] == "--ray":
        view = a[a.index("--view") + 1] if "--view" in a else None
        r = ray_pair(a[1], a[2], view=view)
        print(json.dumps(r))
        if "--out" in a:
            json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
        return 0 if r["xorPx"] == 0 else 1
    if len(a) < 2:
        print("usage: outline <lodA.obj> <lodB.obj> [--out j] | outline --ray <a.npz> <b.npz> [--view name] [--out j]", file=sys.stderr)
        return 2
    r = xor_paths(a[0], a[1])
    print(json.dumps(r))
    if "--out" in a:
        json.dump(r, open(a[a.index("--out") + 1], "w"), indent=1)
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
