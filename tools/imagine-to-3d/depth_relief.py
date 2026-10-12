"""Stage 'depth_relief': monocular depth (MoGe-2, the default in tools/common/vision_models.py)
on each Imagine plate -> per-plate RELIEF map in metres used ONLY to displace the shell in/out
(cracks, ledges, overhang depth, holes, panel lines). The volume is never rebuilt from depth (Grok q15).
Depth Anything V2 Large is an explicit internal comparison only (kind 'dav2-large').
  relief = high-pass(disparity) normalised per plate (robust p99) * amplitude(type), gradient-limited so the plate's
  texture stretch on the displaced surface stays <= 1.3, clamped to +-amplitude.

Building (hard-surface, profiles/building.yaml relief.mode): the SAME band-pass + per-plate p99, then QUANTISE
into a few flat planes (facade / field / bay). Step boundaries snap to the plate's dominant horizontal and
vertical lines (projection of the depth gradient and the luma edges). Planes are piecewise constant — the
smooth gradient limiter is NOT applied; a crisp step is a vertical wall in the mesh, and planar faces keep
stretch 1. Dark windows (low luma AND not a near depth) become recessed bays.

python3 depth_relief.py <type mesa|tower|rock|building> <pxPerM> <outdir> <plate.jpg> [...]
  -> <outdir>/<name>-relief.npy (+ .png, report json)
  building also writes <name>-inset.npy (metres, positive = into the wall, row 0 = bottom / +Y)
"""
import sys, os, json, urllib.request, numpy as np
from PIL import Image
from scipy import ndimage as ndi
MODELS = "/workspace/models/depth"
DA_URL = "https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx?download=true"
MIDAS_URL = "https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx"
# band-pass (fineM..sigmaM): finer detail stays in the Imagine albedo, coarser shape stays the hull's
# mesa / tower / rock numbers are the sealed displacement profile — do not retune them for buildings.
PROFILE = {"mesa": dict(amp=1.5, sigmaM=4.0, fineM=0.25, maxGrad=0.7), "tower": dict(amp=0.3, sigmaM=1.0, fineM=0.06, maxGrad=0.5), "rock": dict(amp=0.6, sigmaM=1.5, fineM=0.1, maxGrad=0.83)}
# Hard-surface quantise. amp is the bay depth the p99 maps toward; sigmaM keeps 2–4 m windows.
HARD = dict(amp=1.2, sigmaM=3.5, fineM=0.15, minFeatureM=0.40, snapTolPx=8, maxPlanes=6,
            bayMin=0.35, bayMax=1.15, fieldMin=0.28, fieldMax=0.42)

def session():
    """MoGe-2, loaded once. Returns (model, kind). Large is not the default."""
    tools = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if tools not in sys.path:
        sys.path.insert(0, tools)
    from common.vision_models import load_default_depth
    return load_default_depth()

def disparity(sess, kind, img):
    a = np.asarray(img.convert("RGB"), np.float32) / 255.0; H, W = a.shape[:2]
    if kind == "moge-2":
        import torch
        im = img.convert("RGB")
        im.thumbnail((518, 518))
        rgb = np.asarray(im, np.float32) / 255.0
        tensor = torch.from_numpy(rgb.transpose(2, 0, 1).copy())
        with torch.inference_mode():
            out = sess.infer(tensor, resolution_level=0, use_fp16=False, force_projection=False, apply_mask=False)
        depth = out["depth"]
        if depth.ndim == 3:
            depth = depth[0]
        depth = depth.detach().cpu().numpy().astype(np.float32)
        # metres, larger = farther. Relief wants inverse depth: larger = nearer.
        inv = 1.0 / np.clip(depth, 1e-3, None)
        if inv.shape != (H, W):
            inv = np.asarray(Image.fromarray(inv).resize((W, H), Image.BILINEAR), np.float32)
        return inv
    if kind == "dav2-large":
        import torch
        tools = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if tools not in sys.path:
            sys.path.insert(0, tools)
        rgb = np.asarray(img.convert("RGB"))
        if sess is None:  # internal comparison via the cached helper (HEAD callers pass None)
            from common.vision_models import depth_dav2_rgb
            d = depth_dav2_rgb(rgb, 518)
            d = d[0] if isinstance(d, tuple) else d
            if d.shape != (H, W):
                d = np.asarray(Image.fromarray(np.asarray(d, np.float32), mode="F").resize((W, H), Image.BILINEAR))
            return np.asarray(d, np.float32)
        from common.vision_models import _prep_dav2
        tensor, (h0, w0) = _prep_dav2(rgb, 518)
        with torch.inference_mode():
            pred = sess(tensor)
        pred = torch.nn.functional.interpolate(pred[:, None], (h0, w0), mode="bilinear", align_corners=True)[0, 0]
        return pred.cpu().numpy().astype(np.float32)  # inverse depth: larger = nearer = outward
    if kind == "dav2":
        h, w = (H // 14) * 14, (W // 14) * 14          # native resolution (multiple of the ViT patch)
    else:
        h, w = 256, 256
    x = np.asarray(img.convert("RGB").resize((w, h), Image.BICUBIC), np.float32) / 255.0 if (h, w) != (H, W) else a
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    y = sess.run(None, {sess.get_inputs()[0].name: x})[0][0]
    if y.shape != (H, W): y = np.asarray(Image.fromarray(y.astype(np.float32)).resize((W, H), Image.BILINEAR))
    return y.astype(np.float32)        # relative inverse depth: larger = nearer = outward

def relief(disp, pxm, prof):
    sig = prof["sigmaM"] * pxm
    hp = ndi.gaussian_filter(disp, prof["fineM"] * pxm) - ndi.gaussian_filter(disp, sig)   # band-pass; plate tilt/perspective removed: shell = hull
    s = np.percentile(np.abs(hp), 99) + 1e-6
    r = np.clip(hp / s, -1, 1) * prof["amp"]
    # gradient limit (metres per metre) -> displaced-surface texture stretch <= sqrt(1 + g^2) <= 1.3
    for _ in range(150):
        gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
        if np.percentile(g, 99.9) <= prof["maxGrad"]: break
        r = r * 0.97
    gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
    r = r * min(1.0, prof["maxGrad"] / max(g.max(), 1e-6)) ** 0.5   # last spikes
    r = ndi.median_filter(r, 5)                               # isolated spikes (single-pixel depth outliers)
    return np.clip(r, -prof["amp"], prof["amp"]).astype(np.float32)

def check(r, pxm, prof):
    gy, gx = np.gradient(r); g = np.hypot(gx, gy) * pxm
    # spike = a point standing out of its 5x5 neighbourhood median by > 7 % of the amplitude (ledges/creases are not spikes)
    spikes = float((np.abs(r - ndi.median_filter(r, 5)) > 0.07 * prof["amp"]).mean())
    return dict(stdM=round(float(r.std()), 3), p99M=round(float(np.percentile(np.abs(r), 99)), 3), maxGrad=round(float(g.max()), 3),
                p999Grad=round(float(np.percentile(g, 99.9)), 3), spikeFrac=round(spikes, 5),
                ok=bool(r.std() > 0.08 * prof["amp"] and spikes < 0.001 and np.percentile(g, 99.9) <= prof["maxGrad"] * 1.05))


def _peaks(score, min_dist):
    s = ndi.gaussian_filter1d(np.asarray(score, np.float64), 2.0)
    thr = float(np.percentile(s, 72))
    idx = []
    for i in range(2, len(s) - 2):
        if s[i] < thr or s[i] < s[i - 1] or s[i] < s[i + 1]: continue
        if not idx or i - idx[-1] >= min_dist: idx.append(i)
        elif s[i] > s[idx[-1]]: idx[-1] = i
    return idx


def _merge_lines(lines, lim, last):
    out = [lines[0]]
    for v in lines[1:]:
        if v - out[-1] < lim:
            if v == last: out[-1] = v
            continue
        out.append(v)
    if out[-1] != last: out.append(last)
    return out


def quantise_hard(disp, luma, pxm, hs=None):
    """Piecewise-constant inset (metres, + into the wall). Same band-pass and p99 as relief(), no slope limit.
    luma is 0..1, same HxW, row 0 = top of the image (flipped to y-up in the returned map)."""
    hs = dict(HARD, **(hs or {}))
    H, W = disp.shape[:2]
    sig = min(max(1.0, hs["sigmaM"] * pxm), min(H, W) * 0.42)
    fine = min(max(0.6, hs["fineM"] * pxm), sig * 0.5)
    hp = ndi.gaussian_filter(disp, fine) - ndi.gaussian_filter(disp, sig)
    scale = float(np.percentile(np.abs(hp), 99) + 1e-6)
    r = np.clip(hp / scale, -1, 1)   # + nearer (proud), - farther (recess). Steps stay; do not slope-limit.
    lm = np.asarray(luma, np.float32)
    if lm.shape[:2] != (H, W):
        lm = np.asarray(Image.fromarray((np.clip(lm, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR), np.float32) / 255.0
    elif lm.max() > 1.5:
        lm = lm / 255.0
    gy, gx = np.gradient(r)
    ly, lx = np.gradient(lm)
    min_px = max(4, int(round(hs["minFeatureM"] * pxm)))
    xs = _merge_lines([0] + _peaks(np.abs(gx).mean(0) + 0.35 * np.abs(lx).mean(0), min_px) + [W], max(2, int(hs["snapTolPx"])), W)
    ys = _merge_lines([0] + _peaks(np.abs(gy).mean(1) + 0.35 * np.abs(ly).mean(1), min_px) + [H], max(2, int(hs["snapTolPx"])), H)
    inset = np.zeros((H, W), np.float32)
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            sl = r[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            ll = lm[ys[j]:ys[j + 1], xs[i]:xs[i + 1]]
            if sl.size == 0: continue
            med = float(np.median(sl)); lmed = float(np.median(ll))
            ph, pw = sl.shape
            thin = (ph < min_px * 0.7 and pw > ph * 1.8) or (pw < min_px * 0.7 and ph > pw * 1.8)
            if thin or med > 0.22:
                val = 0.0
            elif med < -0.10 or (lmed < 0.38 and med < 0.18):
                t = min(1.0, max(0.0, (-med - 0.10) / 0.90))
                if lmed < 0.38: t = max(t, min(1.0, (0.38 - lmed) / 0.38) * 0.85)
                raw = hs["bayMin"] + t * (min(hs["amp"], hs["bayMax"]) - hs["bayMin"])
                # one shared depth per bay class — a continuous per-cell depth is a blobby stack of planes
                levels = hs.get("bayLevels") or (0.55, 0.80, 1.05)
                val = float(min(levels, key=lambda L: abs(L - raw)))
            else:
                val = float(hs.get("fieldLevel", 0.36))
            inset[ys[j]:ys[j + 1], xs[i]:xs[i + 1]] = val
    # row 0 = bottom so the mesh can sample y-up without a flip at every cell
    inset = np.ascontiguousarray(inset[::-1])
    rep = check_hard(inset, hs)
    rep.update(linesX=len(xs), linesY=len(ys), scale=round(scale, 5))
    return inset, rep


def scale_facade_metres(depth, mask, height_m):
    """MoGe-2 metres on a facade. Positive residual = nearer than the wall median.

    A centimetre high-pass (p99 under 0.45 m) is scaled so p99 reaches
    max(0.80 m, 0.004·H). An already-metric map is not inflated. Ratios stay
    MoGe's. Callers clip to a class floor / face cap; this function does not
    invent a second relief. PROFILE amp for mesa/tower/rock is untouched.
    """
    d = np.asarray(depth, np.float32)
    m = np.asarray(mask, bool)
    if d.shape[:2] != m.shape[:2]:
        raise ValueError(f"depth {d.shape} != mask {m.shape}")
    if not m.any():
        return np.zeros_like(d), {"p99_m": 0.0, "scale": 1.0, "wall_m": 0.0}
    wall = float(np.median(d[m]))
    res = wall - d
    res = res.astype(np.float32)
    res[~m] = 0.0
    p99 = float(np.percentile(np.abs(res[m]), 99))
    target = max(0.80, 0.004 * float(height_m))
    if p99 < 0.45:
        scale = float(np.clip(target / max(p99, 1e-4), 0.25, 80.0))
    else:
        scale = 1.0
    return res * scale, {"p99_m": round(p99, 4), "scale": round(scale, 4), "wall_m": round(wall, 4), "target_m": round(target, 4)}


def check_hard(inset, hs=None):
    """Flat (one plane, or p99 < 0.3 m) and blobby (too many planes, energy off the steps) both FAIL."""
    hs = dict(HARD, **(hs or {}))
    p99 = float(np.percentile(inset, 99))
    cov = float((inset >= hs["bayMin"] - 1e-3).mean())
    vals, counts = np.unique(np.round(inset, 3), return_counts=True)
    frac = counts / max(1, counts.sum())
    nplanes = int((frac >= 0.015).sum())
    gy, gx = np.gradient(inset.astype(np.float64))
    g = np.hypot(gx, gy)
    energy = float(g.sum()) + 1e-9
    # snap support = pixels whose quantised gradient is nonzero (the step itself) dilated 2 px
    on = g > 1e-6
    on = ndi.binary_dilation(on, iterations=2) if on.any() else on
    crisp = float(g[on].sum() / energy) if on.any() else 0.0
    # piecewise-constant => crisp is ~1. A noisy map fails. A single plane has no energy: crisp 0, FAIL.
    ok = bool(p99 >= 0.30 and cov >= 0.05 and 2 <= nplanes <= int(hs["maxPlanes"]) and crisp >= 0.80)
    return dict(mode="hard-surface", p99M=round(p99, 3), coverage=round(cov, 3), planes=nplanes,
                crisp=round(crisp, 3), maxM=round(float(inset.max()), 3),
                stdM=round(float(inset.std()), 3), ok=ok)


if __name__ == "__main__":
    typ, pxm, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]; plates = sys.argv[4:]
    os.makedirs(out, exist_ok=True)
    sess, kind = session(); rep = {"model": kind, "type": typ, "plates": {}}
    if typ == "building":
        prof = dict(HARD); rep["profile"] = prof; rep["mode"] = "hard-surface"
    else:
        prof = PROFILE[typ]; rep["profile"] = prof
    for p in plates:
        name = os.path.splitext(os.path.basename(p))[0]
        img = Image.open(p); d = disparity(sess, kind, img)
        if typ == "building":
            luma = np.asarray(img.convert("L"), np.float32) / 255.0
            r, chk = quantise_hard(d, luma, pxm, prof)
            np.save(f"{out}/{name}-inset.npy", r)
            np.save(f"{out}/{name}-relief.npy", r)
            Image.fromarray(np.clip(r / max(prof["bayMax"], 1e-6) * 255, 0, 255).astype(np.uint8)).save(f"{out}/{name}-relief.png")
        else:
            r = relief(d, pxm, prof); chk = check(r, pxm, prof)
            np.save(f"{out}/{name}-relief.npy", r)
            v = ((r / prof["amp"]) * 0.5 + 0.5) * 255
            Image.fromarray(np.clip(v, 0, 255).astype(np.uint8)).save(f"{out}/{name}-relief.png")
        rep["plates"][name] = dict(size=list(img.size), **chk); print(name, rep["plates"][name], flush=True)
    if typ == "building":
        oks = [v["ok"] for v in rep["plates"].values()]
        rep["ok"] = bool(oks) and sum(oks) >= max(1, len(oks) // 5)
        rep["passPlates"] = int(sum(oks)); rep["platesN"] = len(oks)
    json.dump(rep, open(f"{out}/depth-report.json", "w"), indent=1)
    if typ == "building" and not rep["ok"]:
        sys.exit(2)
