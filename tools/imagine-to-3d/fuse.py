"""Stage 'depth_fuse' (q16): Depth Anything V2-Small on EVERY accepted view (front/side/back/top, native res) ->
each view's relative disparity aligned to the visual hull seen from that camera (robust affine fit, sign/side
auto-checked) -> TSDF fusion on a voxel grid with silhouette carving -> fused height field (the hull carved/pushed
by the fused depth, bounded by +-maxDev) + cross-view depth consistency report.
python3 fuse.py <hullPrefix> <plates.json> <outPrefix> [voxel_m=0.8] [maxDev=6]"""
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from masks import load, rock_mask
from depth_relief import session, disparity

def main():
    pre, plates_json, out = sys.argv[1:4]
    vox = float(sys.argv[4]) if len(sys.argv) > 4 else 0.8; maxdev = float(sys.argv[5]) if len(sys.argv) > 5 else 6.0
    H = np.load(pre + "-H.npy"); meta = json.load(open(pre + "-meta.json")); plates = json.load(open(plates_json))
    n = H.shape[0]; g = meta["grid_m"]; ax = (np.arange(n) - (n - 1) / 2) * g
    pxm, base = meta["pxm"], meta["base_row"]; tcx, tcy = meta["top_c"]; tpx = meta["tpx"]
    hmax = float(H.max())
    # voxel grid (x, y, z3)
    step = max(1, int(round(vox / g))); xs = ax[::step]; Hs = H[::step, ::step]
    ys = np.arange(0, hmax + 2 * vox, vox)
    X, Y, Z = np.meshgrid(xs, ys, xs, indexing="ij")     # X[i,j,k]=xs[i], Z = xs[k] (z3)
    occ_hull = Y <= Hs.T[:, None, :]                     # Hs rows = z, cols = x -> Hs.T[x, z]
    sess, kind = session()
    T = 3.0 * vox
    tsdf = np.zeros(X.shape, np.float32); wsum = np.zeros(X.shape, np.float32); carve = np.zeros(X.shape, bool)
    per_view_sdf = []; report = {"model": kind, "views": {}}
    for view in ("front", "side", "back", "top"):
        img = Image.open(plates[view]); d = disparity(sess, kind, img); m = rock_mask(load(plates[view]))
        best = None
        for sgn in (1.0, -1.0):                          # camera on the + or - side of the axis: pick the consistent one
            if view == "top":
                col = tcx + X * tpx; row = tcy + Z * tpx; hull_depth = -Hs.T                      # top: depth = -height
                cam_d = -Y                                                                        # voxel depth along the ray
                u_c, u_r = col, row
            else:
                if view == "front": u = X * (1 if sgn > 0 else 1); along = Z * sgn
                elif view == "back": u = -X; along = -Z * sgn
                else: u = Z; along = X * sgn
                u_c = meta["plate_cx"][view] + u * pxm; u_r = base - Y * pxm
                cam_d = -along                                                                    # larger along = nearer camera
            ci = np.clip(np.round(u_c).astype(int), 0, d.shape[1] - 1); ri = np.clip(np.round(u_r).astype(int), 0, d.shape[0] - 1)
            inimg = (u_c >= 0) & (u_c < d.shape[1]) & (u_r >= 0) & (u_r < d.shape[0])
            # hull surface depth per pixel ray = min cam_d over occupied hull voxels on that ray
            key = ri * d.shape[1] + ci
            sel = occ_hull & inimg
            hd = np.full(d.size, np.inf, np.float32); np.minimum.at(hd, key[sel], cam_d[sel])
            ok = np.isfinite(hd) & m.ravel()
            disp = d.ravel()[ok]; tgt = hd[ok]
            A = np.stack([disp, np.ones_like(disp)], 1)
            coef = np.linalg.lstsq(A, tgt, rcond=None)[0]
            for _ in range(3):                           # robust: drop worst 10 %
                r = np.abs(A @ coef - tgt); keep = r <= np.percentile(r, 90); coef = np.linalg.lstsq(A[keep], tgt[keep], rcond=None)[0]
            corr = float(np.corrcoef(disp, tgt)[0, 1])
            cand = dict(sgn=sgn, coef=coef, corr=corr, key=key, inimg=inimg, cam_d=cam_d, ok=ok)
            if best is None or corr < best["corr"]: best = cand      # most negative = disparity grows toward the camera
            if view == "top": break
        # nearer = larger disparity = smaller cam depth -> the right side has a NEGATIVE disparity/depth correlation
        b = best; est = np.full(d.size, np.nan, np.float32); est[b["ok"]] = (np.stack([d.ravel(), np.ones(d.size)], 1) @ b["coef"])[b["ok"]]
        # bound the fused surface to the hull +- maxdev along the ray
        hd_all = np.full(d.size, np.inf, np.float32); sel = occ_hull & b["inimg"]; np.minimum.at(hd_all, b["key"][sel], b["cam_d"][sel])
        est = np.where(np.isfinite(hd_all), np.clip(est, hd_all - maxdev, hd_all + maxdev), np.nan)
        surf = est[b["key"]]
        sdf = surf - b["cam_d"]                          # >0 in front of the surface (free), <0 behind (inside)
        valid = b["inimg"] & np.isfinite(sdf) & (sdf > -T)
        s = np.clip(sdf, -T, T) / T
        tsdf[valid] += s[valid]; wsum[valid] += 1
        # silhouette carving: rays that miss the rock mask in this view are empty
        miss = b["inimg"] & ~m.ravel()[b["key"]]
        carve |= miss
        per_view_sdf.append(np.where(valid, sdf, np.nan).astype(np.float32))
        report["views"][view] = dict(cameraSign=b["sgn"], depthVsDispCorr=round(b["corr"], 3), affine=[float(c) for c in b["coef"]])
        print(view, report["views"][view], flush=True)
    F = np.where(wsum > 0, tsdf / np.maximum(wsum, 1), 1.0)
    inside = ((F < 0) | ((wsum == 0) & occ_hull)) & ~carve
    # cross-view consistency near the fused surface: |sdf_i - sdf_j| relative to the object extent
    S = np.stack(per_view_sdf); near = np.abs(F) < 0.5
    cnt = np.isfinite(S).sum(0); both = near & (cnt >= 2)
    spread = np.nanmax(S, 0) - np.nanmin(S, 0)
    ext = max(np.ptp(xs), hmax)
    rel = spread[both] / ext
    report["consistency"] = dict(voxelsSeen2plus=int(both.sum()), medianPct=round(float(np.median(rel) * 100), 2), p90Pct=round(float(np.percentile(rel, 90) * 100), 2),
                                 ok=bool(np.median(rel) * 100 < 8.0 and np.percentile(rel, 90) * 100 < 12.0))
    # fused height field (top of the inside column), smoothed lightly, upsampled to the hull grid
    top = np.where(inside.any(1), (inside * (Y + vox / 2)).max(1), -1.0)        # [x, z]
    Hf_s = top.T
    Hf = ndi.zoom(Hf_s, step, order=1)[:n, :n]
    Hf = np.where(H > 0.05, np.clip(Hf, H - maxdev, H + maxdev), H)
    Hf = np.where((Hf > 0.05) & (H > 0.05), ndi.gaussian_filter(Hf, 0.8), H)
    report["fusedVsHull"] = dict(meanAbsM=round(float(np.abs(Hf - H)[H > 0.05].mean()), 3), maxAbsM=round(float(np.abs(Hf - H)[H > 0.05].max()), 3))
    np.save(out + "-H.npy", Hf.astype(np.float32)); m2 = dict(meta); m2["fused"] = report; json.dump(m2, open(out + "-meta.json", "w"), indent=1)
    json.dump(report, open(out + "-fuse-report.json", "w"), indent=1)
    v = (np.clip(np.concatenate([H, Hf], 1), 0, None) / max(H.max(), Hf.max()) * 255).astype(np.uint8); Image.fromarray(v).save(out + "-H-vs-fused.png")
    print(json.dumps(report["consistency"]), json.dumps(report["fusedVsHull"]))
main()
