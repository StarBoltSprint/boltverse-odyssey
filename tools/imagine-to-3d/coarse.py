"""Stage 'coarse' (q16 #4 coarse-to-fine): a cheap metric scaffold of the object from the KEY CROP (+ Depth Anything
V2-Small when the model is on the box), then reference renders from the planned Imagine cameras.

The scaffold is NOT the final geometry (hull.py / fuse.py / strata.py / Blender build that). It exists to:
  1. give views.py an expected silhouette per camera (IoU gate >= 0.87 for every Imagine view),
  2. be fed to Imagine as a 3rd reference ("same object, this exact silhouette") = coarse-to-fine conditioning,
  3. give views.py the visible metres per camera, hence the plate/section plan at the target px/m.

Strategies (profile geometry.coarse): superellipse-lathe (rock, ice), extrude (building: front silhouette x
constant depth, q15 "extrude, not a hull"), extrude-depth (wreck: thickness from depth), lathe (vegetation),
lathe-ellipsoid (creature), none (effect).
Coordinates: metres, x right, y up, z toward the key camera (yaw 0). Base at y = 0.

  python3 coarse.py <crop.png> --type rock --height-m 45 --out DIR [--mask m.npy] [--cameras plan.json] [--no-depth]
Outputs: DIR/coarse.npz (occupancy, voxel size, origin), DIR/coarse.obj, DIR/coarse-report.json,
         DIR/render/<cam>-{shade,mask}.png (reference renders at the Imagine native size of that view).
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C

DAV2 = os.environ.get("I23D_DAV2", "/workspace/models/depth/dav2-small.onnx")


def depth_dav2(img):
    """Relative inverse depth (larger = nearer) of an analysis copy, normalised to 0..1 inside the image.
    Read-only use of the shared ONNX model; None when unavailable."""
    if not os.path.exists(DAV2): return None
    import onnxruntime as ort
    sess = ort.InferenceSession(DAV2, providers=["CPUExecutionProvider"])
    H, W = img.shape[:2]; s = 518 / max(H, W)
    h, w = max(14, int(round(H * s / 14)) * 14), max(14, int(round(W * s / 14)) * 14)
    x = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    y = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    y = np.asarray(Image.fromarray(y.astype(np.float32)).resize((W, H), Image.BILINEAR))
    lo, hi = np.percentile(y, 2), np.percentile(y, 98)
    return np.clip((y - lo) / max(1e-6, hi - lo), 0, 1).astype(np.float32)


def build(crop, obj_type, height_m, mask=None, use_depth=True, vox_per_height=160):
    prof = C.load_profile(obj_type); G = prof["geometry"]; strat = G["coarse"]
    C.assert_not_video_frame(crop)
    img = C.load_rgb(crop)
    m = C.load_mask(mask, (img.shape[1], img.shape[0])) if mask else C.object_mask(img)
    bb = C.bbox(m); x0, y0, x1, y1 = bb; m = m[y0:y1, x0:x1]; im = img[y0:y1, x0:x1]
    if strat == "none":
        return dict(type=obj_type, strategy="none", note="effects have no solid scaffold"), None
    D = depth_dav2(im) if use_depth else None
    hpx = m.shape[0]; pxm = hpx / height_m
    vox = height_m / vox_per_height
    # resample the front silhouette (and depth) onto the voxel grid (analysis copies only)
    ny = vox_per_height; nx = max(4, int(round(m.shape[1] / pxm / vox)))
    ms = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).resize((nx, ny), Image.NEAREST)) > 127
    ms = ms[::-1]                                   # row 0 = base (y up)
    Ds = None
    if D is not None:
        Ds = np.asarray(Image.fromarray(D).resize((nx, ny), Image.BILINEAR))[::-1]
        Ds = ndi.gaussian_filter(Ds, 1.0)
    width_m = nx * vox
    rows_w = ms.sum(1) * vox
    med_w = float(np.median(rows_w[rows_w > 0])) if (rows_w > 0).any() else width_m
    depth_m = G["depthRatio"] * (med_w if strat in ("extrude", "extrude-depth") else max(rows_w.max(), vox))
    nz = max(4, int(np.ceil(depth_m * (1.25 if strat != "extrude" else 1.0) / vox)) + 4)
    zc = (np.arange(nz) - (nz - 1) / 2) * vox        # z of each voxel layer
    occ = np.zeros((ny, nx, nz), bool)
    xs = (np.arange(nx) + 0.5) * vox
    p = float(G.get("superellipseP", 2.0 if strat in ("lathe", "lathe-ellipsoid") else 3.4))
    for j in range(ny):
        cols = np.nonzero(ms[j])[0]
        if not len(cols): continue
        if strat == "extrude":
            occ[j, cols] = (np.abs(zc) <= depth_m / 2)[None, :]
            continue
        if strat == "extrude-depth":
            t = depth_m * (0.35 + 0.65 * (Ds[j, cols] if Ds is not None else 0.5))
            occ[j, cols] = np.abs(zc)[None, :] <= t[:, None] / 2
            continue
        # lathe family: per contiguous run, superellipse cross-section; depth extent from the row span (x depthRatio)
        lab, n = ndi.label(ms[j])
        for r in range(1, n + 1):
            c = np.nonzero(lab == r)[0]; xl, xr = xs[c[0]] - vox / 2, xs[c[-1]] + vox / 2
            hw = max(vox, (xr - xl) / 2); xm = (xl + xr) / 2
            dz = G["depthRatio"] * hw if strat != "lathe-ellipsoid" else 0.6 * hw
            u = np.abs((xs[c] - xm) / hw).clip(0, 1)
            zext = dz * (1 - u ** p) ** (1 / p)
            if Ds is not None and strat == "superellipse-lathe":
                zext = zext * (0.85 + 0.3 * Ds[j, c])     # depth only modulates the front bulge (q15: never rebuild from depth)
            occ[j, c] = np.abs(zc)[None, :] <= zext[:, None]
    occ = ndi.binary_closing(occ, iterations=1)
    origin = np.array([-(width_m / 2), 0.0, zc[0]])   # x centred, base at y = 0
    return dict(type=obj_type, strategy=strat, heightM=height_m, widthM=round(width_m, 2), depthM=round(depth_m, 2), voxelM=vox,
                grid=list(occ.shape), occupied=int(occ.sum()), depthUsed=D is not None, cropBBox=list(bb), keyPxPerM=round(pxm, 3)), \
           dict(occ=occ, vox=vox, origin=origin)


# ---------------------------------------------------------------- mesh + render
def surface_points(V):
    occ, vox, org = V["occ"], V["vox"], V["origin"]
    er = ndi.binary_erosion(occ, border_value=0)
    surf = occ & ~er
    j, i, k = np.nonzero(surf)
    P = np.stack([org[0] + (i + 0.5) * vox, org[1] + (j + 0.5) * vox, org[2] + (k + 0.5) * vox], 1)
    f = ndi.gaussian_filter(occ.astype(np.float32), 1.2)
    gy, gx, gz = np.gradient(f)
    N = -np.stack([gx[j, i, k], gy[j, i, k], gz[j, i, k]], 1)
    N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-9
    return P, N

def write_obj(V, path):
    occ, vox, org = V["occ"], V["vox"], V["origin"]
    try:
        from skimage.measure import marching_cubes
        f = ndi.gaussian_filter(np.pad(occ, 1).astype(np.float32), 0.7)
        verts, faces, _, _ = marching_cubes(f, 0.5)
        verts = verts - 1
        P = np.stack([org[0] + (verts[:, 1] + 0.5) * vox, org[1] + (verts[:, 0] + 0.5) * vox, org[2] + (verts[:, 2] + 0.5) * vox], 1)
        with open(path, "w") as fh:
            fh.write("# imagine-to-3d coarse scaffold (marching cubes)\n")
            fh.writelines(f"v {a:.3f} {b:.3f} {c:.3f}\n" for a, b, c in P)
            fh.writelines(f"f {a + 1} {c + 1} {b + 1}\n" for a, b, c in faces)
        return dict(verts=len(P), tris=len(faces), method="marching_cubes")
    except ImportError:
        P, _ = surface_points(V)
        with open(path, "w") as fh:
            fh.write("# coarse scaffold surface points (scikit-image missing: no marching cubes)\n")
            fh.writelines(f"v {a:.3f} {b:.3f} {c:.3f}\n" for a, b, c in P)
        return dict(verts=len(P), tris=0, method="points")

def camera(yaw, elev, dist, target):
    """Camera on an orbit around target; yaw 0 = key camera (on +z), yaw 90 = right side (+x)."""
    a, e = np.radians(yaw), np.radians(elev)
    d = np.array([np.sin(a) * np.cos(e), np.sin(e), np.cos(a) * np.cos(e)])
    eye = target + d * dist
    fwd = -d
    up = np.array([0, 1.0, 0]) if abs(elev) < 89 else np.array([0, 0, -1.0])
    right = np.cross(fwd, up); right /= np.linalg.norm(right); upv = np.cross(right, fwd)
    return eye, fwd, right, upv

def render(V, P, N, cam, size, vfov_deg=None):
    """Z-buffered splat render of the scaffold: neutral clay shade (0..1) + silhouette mask, size=(W,H)."""
    W, H = size; yaw, elev, dist = cam["yaw"], cam["elev"], cam["distM"]
    vfov_deg = vfov_deg or cam.get("vfov", 40.0)
    target = np.array(cam.get("target", [0, V["heightM"] / 2, 0]), float)
    eye, fwd, right, upv = camera(yaw, elev, dist, target)
    f = (H / 2) / np.tan(np.radians(vfov_deg) / 2)
    Q = P - eye; z = Q @ fwd
    ok = z > 0.1
    u = (W / 2 + f * (Q @ right) / np.maximum(z, 1e-3)); v = (H / 2 - f * (Q @ upv) / np.maximum(z, 1e-3))
    L = -0.55 * fwd + 0.6 * upv - 0.35 * right; L /= np.linalg.norm(L)   # camera-relative key light: every view readable
    shade = 0.18 + 0.82 * np.clip(N @ L, 0, 1)
    rad = np.maximum(1, np.ceil(0.75 * f * V["vox"] / np.maximum(z, 1e-3))).astype(int)
    zb = np.full(H * W, np.inf, np.float32); cb = np.zeros(H * W, np.float32)
    order = np.argsort(-z)
    for r in np.unique(rad[ok]):
        sel = order[(rad[order] == r) & ok[order]]
        for dy in range(-r + 1, r):
            for dx in range(-r + 1, r):
                x = np.round(u[sel]).astype(int) + dx; y = np.round(v[sel]).astype(int) + dy
                g = (x >= 0) & (x < W) & (y >= 0) & (y < H)
                idx = y[g] * W + x[g]; zz = z[sel][g]; ss = shade[sel][g]
                o = np.lexsort((zz, idx)); idx, zz, ss = idx[o], zz[o], ss[o]
                first = np.r_[True, idx[1:] != idx[:-1]]; idx, zz, ss = idx[first], zz[first], ss[first]
                better = zz < zb[idx]; zb[idx[better]] = zz[better]; cb[idx[better]] = ss[better]
    mask = np.isfinite(zb).reshape(H, W)
    mask = ndi.binary_closing(mask, iterations=2); mask = ndi.binary_fill_holes(mask)
    img = cb.reshape(H, W)
    img = np.where(mask, ndi.grey_closing(img, size=3), 0.0)
    return img, mask

def project_points(P, cam, size):
    """Pixel coords (u, v) and depth z of points P in camera `cam` (same math as render)."""
    W, H = size; target = np.array(cam.get("target", [0, cam.get("heightM", 0) / 2, 0]), float)
    eye, fwd, right, upv = camera(cam["yaw"], cam["elev"], cam["distM"], target)
    f = (H / 2) / np.tan(np.radians(cam.get("vfov", 40.0)) / 2); Q = P - eye; z = Q @ fwd
    return W / 2 + f * (Q @ right) / np.maximum(z, 1e-3), H / 2 - f * (Q @ upv) / np.maximum(z, 1e-3), z


def fit_distance(info, vfov_deg=40.0, fill=0.8):
    """Distance at which the object's largest extent fills `fill` of the frame height (Imagine views are framed so)."""
    ext = max(info["heightM"], info["widthM"], info["depthM"])
    return ext / fill / (2 * np.tan(np.radians(vfov_deg) / 2)) + ext / 2


def load(coarse_dir):
    z = np.load(os.path.join(coarse_dir, "coarse.npz")); info = json.load(open(os.path.join(coarse_dir, "coarse-report.json")))
    return info, dict(occ=z["occ"], vox=float(z["vox"]), origin=z["origin"], heightM=info["heightM"])


def refit(coarse_dir, view_mask, cam, out_dir, cameras):
    """Coarse-to-fine: carve the scaffold with an ACCEPTED axis-defining Imagine view (side: depth profile per height,
    top: footprint), q15 'thickness from the side view'. Orthographic approximation; re-renders every planned camera."""
    info, V = load(coarse_dir); occ, vox, org = V["occ"], V["vox"], V["origin"]
    ny, nx, nz = occ.shape
    m = view_mask; x0, y0, x1, y1 = C.bbox(m); m = m[y0:y1, x0:x1]
    if abs(cam["elev"]) >= 80:     # top: image right = +x, image down = +z (camera up = -z)
        W_m = nx * vox; s = m.shape[1] / W_m           # px per metre from the footprint width = scaffold width
        zs = org[2] + (np.arange(nz) + 0.5) * vox; xs = org[0] + (np.arange(nx) + 0.5) * vox
        zc = (zs - zs.mean()) * s + m.shape[0] / 2; xc = (xs - xs.mean()) * s + m.shape[1] / 2
        ok = (zc[None, :] >= 0) & (zc[None, :] < m.shape[0]) & (xc[:, None] >= 0) & (xc[:, None] < m.shape[1])
        fp = np.zeros((nx, nz), bool)
        ii, kk = np.nonzero(ok); fp[ii, kk] = m[zc[kk].astype(int), xc[ii].astype(int)]
        occ = occ & fp[None, :, :]
    else:                          # side (yaw +-90): per height row, the z extent from the side silhouette
        s = m.shape[0] / info["heightM"]
        sgn = -1.0 if cam["yaw"] % 360 < 180 else 1.0      # camera at +x: image right = -z
        need = int(np.ceil(m.shape[1] / s / vox)) + 6        # grow the grid if the side view is deeper than the guess
        if need > nz:
            p0 = (need - nz) // 2; p1 = need - nz - p0
            occ = np.pad(occ, ((0, 0), (0, 0), (p0, p1))); org = org.copy(); org[2] -= p0 * vox; nz = need
        zs = org[2] + (np.arange(nz) + 0.5) * vox
        new = np.zeros_like(occ)
        cols_c = m.shape[1] / 2
        for j in range(ny):
            r = m.shape[0] - 1 - int((j + 0.5) * vox * s)
            if r < 0 or r >= m.shape[0]: continue
            col = (sgn * zs) * s + cols_c
            okc = (col >= 0) & (col < m.shape[1])
            zin = np.zeros(nz, bool); zin[okc] = m[r, col[okc].astype(int)]
            # re-extrude: the side profile REPLACES the guessed depth (within the front silhouette)
            front = occ[j].any(1)
            new[j] = front[:, None] & zin[None, :]
        occ = new
    occ = ndi.binary_closing(occ, iterations=1)
    V["occ"] = occ; V["origin"] = org
    info = dict(info, refitFrom=os.path.abspath(coarse_dir), refitBy=cam["name"], occupied=int(occ.sum()))
    zz = np.nonzero(occ.any((0, 1)))[0]; info["depthM"] = round(float((zz.max() - zz.min() + 1) * vox), 2) if len(zz) else 0
    return save_and_render(info, V, out_dir, cameras)


def save_and_render(info, V, out_dir, cameras):
    os.makedirs(out_dir, exist_ok=True)
    np.savez_compressed(os.path.join(out_dir, "coarse.npz"), occ=V["occ"], vox=V["vox"], origin=V["origin"])
    P, N = surface_points(V); info = dict(info, renders={})
    for c in cameras:
        size = C.IMAGINE_NATIVE[c.get("aspect", "9:16")]
        sh, mk = render(V, P, N, c, size)
        p1 = C.save_rgb(np.repeat(sh[..., None], 3, 2), f"{out_dir}/render/{c['name']}-shade.png")
        Image.fromarray(mk.astype(np.uint8) * 255).save(f"{out_dir}/render/{c['name']}-mask.png")
        info["renders"][c["name"]] = dict(shade=p1, mask=f"{out_dir}/render/{c['name']}-mask.png", coverage=round(float(mk.mean()), 4))
    info["mesh"] = write_obj(V, f"{out_dir}/coarse.obj")
    C.dump(info, f"{out_dir}/coarse-report.json")
    return info


def rerender(coarse_dir, out_dir, cameras):
    """Reference renders of an existing scaffold for a new camera set (views.plan uses its own cameras/lens)."""
    info, V = load(coarse_dir)
    return save_and_render(dict(info, renderedFrom=os.path.abspath(coarse_dir)), V, out_dir, cameras)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("crop"); ap.add_argument("--type", required=True)
    ap.add_argument("--height-m", type=float, required=True); ap.add_argument("--out", required=True); ap.add_argument("--mask")
    ap.add_argument("--cameras", help="views.py plan json (cameras with yaw/elev/distM/aspect); default = profile cameras")
    ap.add_argument("--no-depth", action="store_true")
    a = ap.parse_args()
    info, V = build(a.crop, a.type, a.height_m, a.mask, not a.no_depth)
    os.makedirs(a.out, exist_ok=True)
    if V is None: C.dump(info, f"{a.out}/coarse-report.json"); print(json.dumps(info)); return
    np.savez_compressed(f"{a.out}/coarse.npz", occ=V["occ"], vox=V["vox"], origin=V["origin"])
    info["mesh"] = write_obj(V, f"{a.out}/coarse.obj")
    V["heightM"] = info["heightM"]; P, N = surface_points(V)
    cams = json.load(open(a.cameras))["views"] if a.cameras else [dict(c, distM=fit_distance(info), aspect="9:16") for c in C.load_profile(a.type)["views"]["cameras"]]
    info["renders"] = {}
    for c in cams:
        size = C.IMAGINE_NATIVE[c.get("aspect", "9:16")]
        sh, mk = render(V, P, N, c, size)
        p1 = C.save_rgb(np.repeat(sh[..., None], 3, 2), f"{a.out}/render/{c['name']}-shade.png")
        Image.fromarray(mk.astype(np.uint8) * 255).save(f"{a.out}/render/{c['name']}-mask.png")
        info["renders"][c["name"]] = dict(shade=p1, mask=f"{a.out}/render/{c['name']}-mask.png", coverage=round(float(mk.mean()), 4))
    C.dump(info, f"{a.out}/coarse-report.json"); print(json.dumps({k: info[k] for k in ("type", "strategy", "heightM", "widthM", "depthM", "grid", "depthUsed")}))


if __name__ == "__main__":
    main()
