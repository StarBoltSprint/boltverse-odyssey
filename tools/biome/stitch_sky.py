#!/usr/bin/env python3
"""stitch_sky.py - n level horizon plates + zenith + nadir -> one seamless 2:1 equirectangular sky.

  python3 tools/biome/stitch_sky.py --biome ember-mesa [--slots DIR] [--size 4096x2048]
        [--band 8192x1024 --band-lat=-15,30] [--hfov 75] [--heading0 <sun az>] [--write-back] [--out-dir DIR]
  explicit files instead of slots: --h a.jpg,b.jpg,... --zenith z.jpg --nadir n.jpg

Plate i is a level pinhole camera at heading heading0 + i*360/n (H0 is centred on the sun, as prompts.py asks), with
horizontal FOV --hfov (bible sky.plateHFovDeg). Each output texel looks up every plate that sees its direction:
bilinear sample, smoothstep feather toward the plate edges, per-plate exposure gains solved from the overlaps (seam
blend, H0 fixed). The zenith / nadir plates are pinhole cameras straight up / down (bible sky.capFovDeg). Latitudes
no plate covers are bridged from the nearest covered rows, blurred around the ring with a radius that grows into the
gap (no column streaks; Imagine pixels only, nothing painted). Write negative band latitudes with '=' (argparse).
No planet in the sky: the planet is a separate rotating sphere (runtime).

Equirect convention: column u -> heading u*360 deg (u = 0 = run direction, clockwise), row v -> latitude 90 - v*180.
Left edge == right edge by construction. Size is free (2048x1024 ... 8192x4096); --band renders a second, sharper
horizon strip over a latitude window (e.g. 8192 px wide for magnification <= 1 near the horizon).

Writes out/<id>/sky/: sky-equirect.jpg, [sky-band.jpg], sky-preview.jpg (plus a half-turn wrap check),
sky-stitch.json (coverage, gains, wrap dE, sampled horizon / fog colours, measured sun heading).
--write-back puts the sampled horizon + the 3 fog band colours into <id>.local.json
(fog colour is sampled from the sky, never typed - METHOD rule).
"""
import argparse, glob, json, math, os, sys

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biome_lib as bl  # noqa: E402


def load_rgb(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) / 255.0


class Cam:
    def __init__(self, img, fwd, up, hfov_deg, name):
        self.img = img; self.name = name
        self.h, self.w = img.shape[:2]
        self.f = np.array(fwd, float); self.up = np.array(up, float)
        self.r = np.cross(self.f, self.up)
        self.tx = math.tan(math.radians(hfov_deg) / 2); self.ty = self.tx * self.h / self.w
        self.gain = np.ones(3, np.float32)

    def project(self, d):
        z = d @ self.f
        ok = z > 1e-3
        zs = np.where(ok, z, 1.0)
        px = (d @ self.r) / zs / self.tx; py = (d @ self.up) / zs / self.ty
        ok &= (np.abs(px) < 1) & (np.abs(py) < 1)
        return px, py, ok

    def sample(self, px, py):
        col = (px + 1) * 0.5 * (self.w - 1); row = (1 - py) * 0.5 * (self.h - 1)
        out = np.stack([ndimage.map_coordinates(self.img[..., c], [row, col], order=1, mode="nearest") for c in range(3)], -1)
        return out * self.gain


def level_cam(img, heading_deg, hfov, name, vshift=0.0):
    h = math.radians(heading_deg)
    fwd = np.array([math.sin(h), math.cos(h), 0.0]); up = np.array([0, 0, 1.0])
    if vshift:  # plate horizon not at mid-height: tilt the camera so the detected horizon lands on latitude 0
        t = vshift
        fwd, up = fwd * math.cos(t) + up * math.sin(t), up * math.cos(t) - fwd * math.sin(t)
    return Cam(img, fwd, up, hfov, name)


def cap_cam(img, up_deg, fov, name, down=False):
    c = math.radians(up_deg)
    upv = np.array([math.sin(c), math.cos(c), 0.0])
    return Cam(img, [0, 0, -1.0] if down else [0, 0, 1.0], upv, fov, name)


def dirs(lat, lon):
    cl = np.cos(lat)
    return np.stack([np.sin(lon) * cl, np.cos(lon) * cl, np.sin(lat)], -1)


def feather(px, py, fx=0.22, fy=0.10):
    wx = np.clip((1 - np.abs(px)) / fx, 0, 1); wy = np.clip((1 - np.abs(py)) / fy, 0, 1)
    wx = wx * wx * (3 - 2 * wx); wy = wy * wy * (3 - 2 * wy)
    return wx * wy


def solve_gains(cams, n_ring):
    """Exposure match of neighbouring ring plates on their overlap (log-space least squares, H0 fixed)."""
    lat = np.radians(np.linspace(-15, 15, 31))[:, None]
    lon = np.radians(np.linspace(0, 360, 1440, endpoint=False))[None, :]
    d = dirs(np.broadcast_to(lat, (31, 1440)), np.broadcast_to(lon, (31, 1440))).reshape(-1, 3)
    rows, rhs = [], []
    ring = cams[:n_ring]
    for i in range(n_ring):
        j = (i + 1) % n_ring
        pi, qi, oi = ring[i].project(d); pj, qj, oj = ring[j].project(d)
        both = oi & oj
        if both.sum() < 20:
            continue
        a = ring[i].sample(pi[both], qi[both]).mean(0); b = ring[j].sample(pj[both], qj[both]).mean(0)
        r = np.zeros(n_ring); r[i] = 1; r[j] = -1
        rows.append(r); rhs.append(np.log(np.maximum(b, 1e-3)) - np.log(np.maximum(a, 1e-3)))
    if not rows:
        return [1.0] * n_ring
    r0 = np.zeros(n_ring); r0[0] = 1
    A = np.array(rows + [r0 * 10]); g = np.zeros((n_ring, 3))
    for c in range(3):
        y = np.array([x[c] for x in rhs] + [0.0])
        sol, *_ = np.linalg.lstsq(A, y, rcond=None)
        g[:, c] = sol
    g = np.clip(np.exp(g), 0.8, 1.25)
    for k, cm in enumerate(ring):
        cm.gain = g[k].astype(np.float32)
    return g.round(4).tolist()


def render(cams, W, H, lat0=90.0, lat1=-90.0, chunk=128):
    out = np.zeros((H, W, 3), np.float32); cov = np.zeros((H, W), np.float32)
    lon = (np.arange(W) + 0.5) / W * 2 * math.pi
    for y0 in range(0, H, chunk):
        y1 = min(H, y0 + chunk)
        lat = np.radians(lat0 + (np.arange(y0, y1) + 0.5) / H * (lat1 - lat0))
        LA, LO = np.meshgrid(lat, lon, indexing="ij")
        d = dirs(LA, LO).reshape(-1, 3)
        acc = np.zeros((len(d), 3), np.float32); ws = np.zeros(len(d), np.float32)
        for cm in cams:
            px, py, ok = cm.project(d)
            if not ok.any():
                continue
            w = feather(px[ok], py[ok], *(cm.feather if hasattr(cm, "feather") else (0.22, 0.10)))
            acc[ok] += cm.sample(px[ok], py[ok]) * w[:, None]; ws[ok] += w
        blk = np.where(ws[:, None] > 1e-4, acc / np.maximum(ws, 1e-4)[:, None], 0)
        out[y0:y1] = blk.reshape(y1 - y0, W, 3); cov[y0:y1] = np.minimum(ws, 1).reshape(y1 - y0, W)
    return out, cov


def bridge(img, cov, lat0, lat1, max_w=2048):
    """Large outputs: the bridge is smooth by construction, so solve it at <= max_w and upsample the fill."""
    H, W, _ = img.shape
    if W <= max_w:
        return bridge_full(img, cov)
    f = max_w / W
    hs, ws = max(2, round(H * f)), max_w
    small = np.asarray(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((ws, hs), Image.BILINEAR), np.float32) / 255
    cs = np.asarray(Image.fromarray((np.clip(cov, 0, 1) * 255).astype(np.uint8)).resize((ws, hs), Image.BILINEAR), np.float32) / 255
    fill_s = bridge_full(small, cs)
    fill = np.stack([np.asarray(Image.fromarray(fill_s[..., c]).resize((W, H), Image.BILINEAR)) for c in range(3)], -1)
    w = np.clip(cov / 0.3, 0, 1)[..., None]
    return (img * w + fill * (1 - w)).astype(np.float32)


def bridge_full(img, cov):
    """Fill latitudes nobody covers. For each uncovered texel: blend between the colour of the nearest covered row
    above and below in its column, where those edge colours are blurred around the ring with a radius that grows
    with the distance into the gap (no column streaks). Past the last covered row (a pole with no cap plate) the
    colour relaxes toward the ring mean, so the pole is one colour (no pinch). Imagine pixels only."""
    H, W, _ = img.shape
    covered = cov > 0.02
    if covered.all():
        return img
    out = img.copy()
    ys = np.arange(H)[:, None]
    cov_idx = np.where(covered, ys, -1)
    up = np.maximum.accumulate(cov_idx, axis=0)                   # nearest covered row above (or -1)
    cov_idx2 = np.where(covered, ys, H)
    dn = np.minimum.accumulate(cov_idx2[::-1], axis=0)[::-1]      # nearest covered row below (or H)
    xs = np.broadcast_to(np.arange(W), (H, W))
    has_up = up >= 0; has_dn = dn < H
    E_up = np.where(has_up[..., None], img[np.clip(up, 0, H - 1), xs], 0)
    E_dn = np.where(has_dn[..., None], img[np.clip(dn, 0, H - 1), xs], 0)
    gap = (~covered)
    # distance into the gap (rows) -> blur radius around the ring
    d_up = np.where(has_up, ys - up, H); d_dn = np.where(has_dn, dn - ys, H)
    dist = np.minimum(d_up, d_dn).astype(np.float32)
    sig_levels = [1, 4, 12, 32, 96]
    def blurred_stack(E):
        return [np.stack([ndimage.gaussian_filter1d(E[..., c], s_, axis=1, mode="wrap") for c in range(3)], -1) for s_ in sig_levels]
    Su, Sd = blurred_stack(E_up), blurred_stack(E_dn)
    sig = np.clip(1 + dist * 1.5, 1, 96)
    lv = np.interp(sig, sig_levels, np.arange(len(sig_levels)))
    lo = np.floor(lv).astype(int); hi = np.minimum(lo + 1, len(sig_levels) - 1); fr = (lv - lo)[..., None]
    def pick(S):
        A = np.zeros_like(img)
        for k in range(len(sig_levels)):
            A = np.where((lo == k)[..., None], S[k] * (1 - fr), A)
        B = np.zeros_like(img)
        for k in range(len(sig_levels)):
            B = np.where((hi == k)[..., None], S[k] * fr, B)
        return A + B
    U, D = pick(Su), pick(Sd)
    both = has_up & has_dn
    t = np.where(both, d_up / np.maximum(d_up + d_dn, 1), 0).astype(np.float32)
    t = t * t * (3 - 2 * t)
    fillc = np.where(both[..., None], U * (1 - t[..., None]) + D * t[..., None], np.where(has_up[..., None], U, D))
    # poles without a cap: relax toward the ring mean of the edge row
    for top in (True, False):
        only = (has_dn & ~has_up) if top else (has_up & ~has_dn)
        if not only.any():
            continue
        rows = np.where(only.any(1))[0]
        edge = rows[-1] + 1 if top else rows[0] - 1
        edge = int(np.clip(edge, 0, H - 1))
        ring_mean = img[edge].mean(0)
        span = max(1, edge if top else H - 1 - edge)
        tt = ((edge - ys) / span if top else (ys - edge) / span).astype(np.float32)
        tt = np.clip(tt, 0, 1); tt = (tt * tt * (3 - 2 * tt))[..., None]
        fillc = np.where(only[..., None], fillc * (1 - tt) + ring_mean * tt, fillc)
    # partially covered texels (feather tails) fade into the bridge
    w = np.clip(cov / 0.3, 0, 1)[..., None]
    out = np.where(gap[..., None], fillc, img * w + fillc * (1 - w))
    return out.astype(np.float32)


def flatten(img, hfrac=0.5):
    """Remove a plate's own left-right exposure drift (vignette / falloff) in the sky part: divide by its heavily
    smoothed column profile. Skipped for the sun plate (its glow is real light)."""
    sky = img[: int(img.shape[0] * hfrac)]
    if float(np.percentile(sky @ np.array([0.2126, 0.7152, 0.0722], np.float32), 99.9)) > 0.97:
        return img, False
    prof = sky.mean(0)                                   # (W, 3)
    prof = ndimage.gaussian_filter1d(prof, img.shape[1] / 6, axis=0, mode="nearest")
    corr = np.clip(prof.mean(0) / np.maximum(prof, 1e-3), 0.85, 1.15)
    return np.clip(img * corr[None], 0, 1), True


def save_jpg(a, p, q=90, max_w=None):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    if max_w and im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(p, quality=q)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--biome", required=True)
    ap.add_argument("--slots"); ap.add_argument("--h"); ap.add_argument("--zenith"); ap.add_argument("--nadir")
    ap.add_argument("--hfov", type=float); ap.add_argument("--cap-fov", type=float); ap.add_argument("--heading0", type=float)
    ap.add_argument("--size"); ap.add_argument("--band"); ap.add_argument("--band-lat", default="-15,30")
    ap.add_argument("--no-flatten", action="store_true", help="keep each plate's own left-right falloff")
    ap.add_argument("--no-align", action="store_true", help="do not re-level plates whose horizon is off mid-height")
    ap.add_argument("--write-back", action="store_true"); ap.add_argument("--out-dir")
    A = ap.parse_args()
    b, _ = bl.load_biome(A.biome)
    sky = b["sky"]
    out_dir = A.out_dir or os.path.join(bl.HERE, "out", b["id"], "sky")
    os.makedirs(out_dir, exist_ok=True)
    sd = A.slots or os.path.join(bl.HERE, "out", b["id"], "slots")

    def slot(name):
        for e in (".png", ".jpg", ".jpeg", ".webp"):
            p = os.path.join(sd, name + e)
            if os.path.exists(p):
                return p
        return None
    if A.h:
        hs = A.h.split(",")
    else:
        hs = []
        for i in range(sky["horizonPlates"]):
            p = slot(f"sky-H{i}")
            if p: hs.append(p)
    if len(hs) < 3:
        raise SystemExit(f"[stitch] need >= 3 horizon plates, got {len(hs)}")
    zen = A.zenith or (slot("sky-Z") if sky.get("zenith", True) else None)
    nad = A.nadir or (slot("sky-N") if sky.get("nadir", True) else None)
    n = len(hs)
    hfov = A.hfov or sky["plateHFovDeg"]
    h0 = b["sun"]["azimuthDeg"] if A.heading0 is None else A.heading0
    step = 360.0 / n
    cams, info = [], {"plates": [], "hfov": hfov, "heading0": h0, "step": step}
    for i, p in enumerate(hs):
        img = load_rgb(p)
        flat = False
        if not A.no_flatten:
            img, flat = flatten(img)
        vs = 0.0
        if not A.no_align:
            L = ndimage.gaussian_filter(img @ np.array([0.2126, 0.7152, 0.0722], np.float32), 2).mean(1)
            g = np.abs(np.diff(L)); hh = len(L)
            hr = (int(hh * .3) + int(np.argmax(g[int(hh * .3):int(hh * .7)]))) / hh
            ty = math.tan(math.radians(hfov) / 2) * img.shape[0] / img.shape[1]
            off = (0.5 - hr) * 2 * ty  # horizon above centre -> camera looked down
            vs = -math.atan(off) if abs(hr - 0.5) > 0.015 else 0.0
        cams.append(level_cam(img, h0 + i * step, hfov, f"H{i}", vs))
        info["plates"].append({"file": os.path.basename(p), "heading": round((h0 + i * step) % 360, 2), "tiltDeg": round(math.degrees(vs), 2), "flattened": flat, "px": [img.shape[1], img.shape[0]]})
    ring_overlap = n * hfov - 360
    info["ringOverlapDeg"] = round(ring_overlap, 1)
    if ring_overlap <= 0:
        print(f"[stitch] WARNING: {n} x {hfov} deg leaves {-ring_overlap:.1f} deg of gaps around the ring (bridged)")
    info["gains"] = solve_gains(cams, n)
    capf = A.cap_fov or sky.get("capFovDeg", 100)
    if zen:
        c = cap_cam(load_rgb(zen), h0, capf, "Z"); c.feather = (0.35, 0.35); cams.append(c)
    if nad:
        c = cap_cam(load_rgb(nad), h0, capf, "N", down=True); c.feather = (0.35, 0.35); cams.append(c)
    info["zenith"] = os.path.basename(zen) if zen else None; info["nadir"] = os.path.basename(nad) if nad else None
    W, H = (int(x) for x in (A.size or "x".join(map(str, sky.get("outSize", [4096, 2048])))).split("x"))
    eq, cov = render(cams, W, H)
    info["coverage"] = round(float((cov > 0.02).mean()), 4)
    eq = bridge(eq, cov, 90, -90)
    save_jpg(eq, os.path.join(out_dir, "sky-equirect.jpg"), 92)
    # wrap + pole checks
    lab = bl.rgb_to_lab(eq[H // 8: 7 * H // 8])
    info["wrapDE"] = round(float(np.mean(bl.delta_e2000(lab[:, 0], lab[:, -1]))), 3)
    info["zenithRowStd"] = round(float(eq[0].std(0).mean()), 4)
    info["size"] = [W, H]
    # preview: equirect + the same rolled half a turn (the wrap seam lands in the middle)
    prev = np.concatenate([eq, np.roll(eq, W // 2, 1)], 0)
    save_jpg(prev, os.path.join(out_dir, "sky-preview.jpg"), 82, 1600)
    if A.band:
        bw, bh = (int(x) for x in A.band.split("x")); la0, la1 = (float(x) for x in A.band_lat.split(","))
        band, bcov = render(cams, bw, bh, la1, la0)
        band = bridge(band, bcov, la1, la0)
        save_jpg(band, os.path.join(out_dir, "sky-band.jpg"), 92)
        info["band"] = {"size": [bw, bh], "latDeg": [la0, la1], "pxPerDeg": round(bw / 360, 2)}
    # samples back into the bible: horizon just above lat 0, near haze just below, far cool band higher and away from the sun
    def rows(la, lb):
        y0 = int((90 - lb) / 180 * H); y1 = max(y0 + 1, int((90 - la) / 180 * H))
        return eq[y0:y1]
    hor = np.median(rows(0.5, 3.0).reshape(-1, 3), 0)
    near = np.median(rows(-6.0, -2.0).reshape(-1, 3), 0)
    away = np.roll(rows(6.0, 14.0), -int(((h0 + 180) % 360) / 360 * W) + W // 4, 1)[:, : W // 2]
    far = np.median(away.reshape(-1, 3), 0)
    lum_band = ndimage.gaussian_filter(rows(-2, 25).mean(0) @ np.array([0.2126, 0.7152, 0.0722]), 4, mode="wrap")
    sun_h = (np.argmax(lum_band) + 0.5) / W * 360
    info["sampled"] = {"horizon": bl.rgb01_to_hex(hor), "nearHaze": bl.rgb01_to_hex(near), "farCool": bl.rgb01_to_hex(far),
                       "sunHeadingMeasured": round(float(sun_h), 1), "sunHeadingBible": b["sun"]["azimuthDeg"]}
    dsun = abs((sun_h - b["sun"]["azimuthDeg"] + 180) % 360 - 180)
    info["sunHeadingErrorDeg"] = round(float(dsun), 1)
    bl.write_json(os.path.join(out_dir, "sky-stitch.json"), info)
    if A.write_back:
        lp = bl.biome_paths(A.biome)[1]
        loc = bl.read_json(lp) if os.path.exists(lp) else {}
        loc.setdefault("palette", {})["horizonSampled"] = info["sampled"]["horizon"]
        fog = loc.setdefault("fog", {})
        fog["color"] = info["sampled"]["horizon"]
        bands = fog.get("bands") or [{}, {}, {}]
        for k, key in enumerate(("nearHaze", "horizon", "farCool")):
            bands[k] = dict(bands[k] or {}, color=info["sampled"][key])
        fog["bands"] = bands
        bl.write_json(lp, loc)
    print(f"[stitch] {b['id']}: {n} plates x {hfov} deg (overlap {ring_overlap:+.0f} deg), zenith {'yes' if zen else 'bridged'}, "
          f"nadir {'yes' if nad else 'bridged'} -> {W}x{H}, coverage {info['coverage']:.2%}, wrap dE {info['wrapDE']}, "
          f"horizon {info['sampled']['horizon']} sun heading {sun_h:.0f} (bible {b['sun']['azimuthDeg']}){' -> written back' if A.write_back else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
