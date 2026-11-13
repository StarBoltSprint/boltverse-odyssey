#!/usr/bin/env python3
# Offline gate for a crust atlas, before any chase render.
# (a) autocorrelation peaks. (b) the column grid metric on a perspective
# ground projection at the near-lane scale.
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

H, W = 1280, 720
FOV = 62 * np.pi / 180
FOCAL = (H / 2) / np.tan(FOV / 2)
PX_PER_M = 2048.0


def grid_peak(img):
    # img: uint8 or float (H, W, 3). Same score as grid-measure.mjs, no Bolt mask.
    rgb = img.astype(np.float64)
    luma = rgb[:, :, 0] * 0.3 + rgb[:, :, 1] * 0.59 + rgb[:, :, 2] * 0.11
    y0, y1 = int(H * 0.55), int(H * 0.96)
    sig = luma[y0:y1:2].mean(axis=0)
    # Same high-pass as grid-measure.mjs: sig[i] - sig[max(0, i-24)].
    src = np.empty(W)
    for i in range(W):
        src[i] = sig[max(0, i - 24)]
    hp = sig - src
    mean = hp.mean()
    d = hp - mean
    v = np.dot(d, d) / W
    if v < 1e-6:
        return 0.0

    def ac(lag):
        m = W - lag
        return float(np.dot(d[:m], d[lag:]) / (m * v))

    peak = max(ac(8), ac(16), ac(24))
    beside = (ac(11) + ac(13) + ac(19) + ac(21)) / 4
    return peak / (abs(beside) + 0.08)


def ground_xz(eye_h, pitch):
    xs = (np.arange(W) - W / 2) / FOCAL
    ys = (H / 2 - np.arange(H)) / FOCAL
    dx = np.broadcast_to(xs, (H, W)).astype(np.float64)
    dy = np.broadcast_to(ys[:, None], (H, W)).copy()
    dz = np.ones((H, W))
    inv = 1.0 / np.sqrt(dx * dx + dy * dy + dz * dz)
    dx *= inv
    dy *= inv
    dz *= inv
    cp, sp = np.cos(pitch), np.sin(pitch)
    wy = dy * cp - dz * sp
    wz = dy * sp + dz * cp
    t = np.divide(-eye_h, wy, out=np.full_like(wy, np.nan), where=wy < -1e-4)
    return t * dx, t * wz


def scale_report(gx):
    rows = {}
    finite = np.isfinite(gx).any(axis=1)
    horizon = int(np.argmax(finite)) if finite.any() else 0
    samples = [("horizon", horizon + 8), ("top", int(H * 0.55)), ("mid", int(H * 0.75)), ("near", int(H * 0.90)), ("bottom", int(H * 0.955))]
    for name, y in samples:
        step = np.abs(np.diff(gx[y]))
        step = step[np.isfinite(step) & (step > 1e-6)]
        if not len(step):
            rows[name] = None
            continue
        m = float(np.median(step))
        rows[name] = {"metresPerPx": round(m, 4), "pxPerHalfMetre": round(0.5 / m, 1)}
    return rows


def srgb_to_lin(u8):
    x = u8.astype(np.float32) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_u8(lin):
    y = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.maximum(lin, 0), 1.0 / 2.4) - 0.055)
    return np.clip(y, 0, 1) * 255


def build_mips(atlas):
    # Linear-light box chain, the same filter the GPU mip build uses.
    chain = [srgb_to_lin(atlas)]
    cur = chain[0]
    while min(cur.shape[:2]) > 1:
        h, w, _ = cur.shape
        nh, nw = h // 2, w // 2
        chain.append(cur[: nh * 2, : nw * 2].reshape(nh, 2, nw, 2, 3).mean(axis=(1, 3)).astype(np.float32))
        cur = chain[-1]
    return chain


def bilinear(level, uu, vv):
    ah, aw = level.shape[:2]
    su = np.mod(uu, aw)
    sv = np.mod(vv, ah)
    u0 = np.floor(su).astype(np.int32) % aw
    v0 = np.floor(sv).astype(np.int32) % ah
    u1 = (u0 + 1) % aw
    v1 = (v0 + 1) % ah
    du = (su - np.floor(su))[..., None]
    dv = (sv - np.floor(sv))[..., None]
    return ((level[v0, u0] * (1 - du) + level[v0, u1] * du) * (1 - dv)
            + (level[v1, u0] * (1 - du) + level[v1, u1] * du) * dv)


def project(chain, heading, offset, gx, gz):
    c, s = np.cos(heading), np.sin(heading)
    x = gx + offset[0]
    z = gz + offset[1]
    u = (x * c - z * s) * PX_PER_M
    v = (x * s + z * c) * PX_PER_M
    valid = np.isfinite(gx)
    mpp = np.empty_like(gx)
    mpp[:, 1:] = np.abs(np.diff(gx, axis=1))
    mpp[:, 0] = mpp[:, 1]
    mpp = np.where(np.isfinite(mpp) & (mpp > 0), mpp, 1.0)
    # One screen pixel covers this many mip0 texels. The GPU picks that mip.
    lod = np.log2(np.clip(mpp * PX_PER_M, 1.0, 256.0))
    out = np.full((H, W, 3), 186, np.float32)
    # Lod is nearly constant along a row. Sample row groups.
    row_lod = np.nanmedian(np.where(valid, lod, np.nan), axis=1)
    for y in range(H):
        if not np.isfinite(row_lod[y]):
            continue
        l0 = int(np.clip(np.floor(row_lod[y]), 0, len(chain) - 1))
        l1 = min(l0 + 1, len(chain) - 1)
        t = float(np.clip(row_lod[y] - l0, 0, 1))
        scale0 = chain[0].shape[0] / chain[l0].shape[0]
        samp = bilinear(chain[l0], u[y] / scale0, v[y] / scale0)
        if l1 != l0 and t > 0:
            scale1 = chain[0].shape[0] / chain[l1].shape[0]
            samp = samp * (1 - t) + bilinear(chain[l1], u[y] / scale1, v[y] / scale1) * t
        mask = valid[y]
        out[y, mask] = lin_to_u8(samp[mask])
    return out


def autocorrelation(atlas):
    gray = atlas.astype(np.float64).mean(axis=2)
    gray -= gray.mean()
    spec = np.fft.rfft2(gray)
    ac = np.fft.irfft2(spec * np.conj(spec), s=gray.shape)
    if not np.isfinite(ac[0, 0]) or abs(ac[0, 0]) < 1e-8:
        return {"top3": [], "watch": {"512": {"ac": 0, "ratio": 0, "ac2": 0}, "1024": {"ac": 0, "ratio": 0, "ac2": 0}}}
    ac /= ac[0, 0]
    # Column signal: the period that becomes vertical seams.
    sig = gray.mean(axis=0)
    sig -= sig.mean()
    var = np.dot(sig, sig) / len(sig)
    if not np.isfinite(ac[0, 0]) or ac[0, 0] == 0 or var < 1e-8:
        return {"top3": [], "watch": {"512": {"ac": 0, "ratio": 0, "ac2": 0}, "1024": {"ac": 0, "ratio": 0, "ac2": 0}}}

    def ac1(k):
        return float(np.dot(sig[: len(sig) - k], sig[k:]) / ((len(sig) - k) * var))

    lags = np.arange(32, 2048)
    vals = np.array([ac1(int(k)) for k in lags])
    # Local peak: higher than both neighbors by a margin, scored against a wide baseline.
    peaks = []
    for i in range(2, len(lags) - 2):
        if vals[i] < vals[i - 1] or vals[i] < vals[i + 1]:
            continue
        beside = np.mean([vals[i - 2], vals[i + 2], vals[max(0, i - 8)], vals[min(len(vals) - 1, i + 8)]])
        ratio = float(vals[i] / (abs(beside) + 0.08))
        peaks.append({"lag": int(lags[i]), "ac": round(float(vals[i]), 4), "ratio": round(ratio, 3)})
    peaks.sort(key=lambda p: p["ratio"], reverse=True)
    watch = {}
    for lag in (512, 1024):
        beside = (ac1(lag - 64) + ac1(lag + 64) + ac1(lag - 128) + ac1(lag + 128)) / 4
        watch[str(lag)] = {
            "ac": round(ac1(lag), 4),
            "ratio": round(ac1(lag) / (abs(beside) + 0.08), 3),
            "ac2": round(float(max(ac[0, lag], ac[lag, 0])), 4),
        }
    return {"top3": peaks[:3], "watch": watch}


def synth(atlas, gx, gz):
    chain = build_mips(atlas)
    headings = [i * np.pi / 12 for i in range(12)]
    headings.append(0.41)
    offsets = [(0, 0), (0.25, 0), (0.5, 0.1), (0.13, 0.37), (1.0, 0.5), (0.07, 1.3)]
    worst = {"peak": 0}
    overs = []
    for h in headings:
        for off in offsets:
            img = project(chain, h, off, gx, gz)
            peak = grid_peak(img)
            row = {"headingDeg": round(float(h * 180 / np.pi), 1), "offset": [off[0], off[1]], "peak": round(peak, 3)}
            if peak > worst["peak"]:
                worst = row
            if peak > 1.8:
                overs.append(row)
    return {"views": len(headings) * len(offsets), "worst": worst, "over": len(overs), "overs": overs[:12]}


def main():
    paths = [Path(p) for p in sys.argv[1:]]
    # Eye and pitch chosen so the gate band's near rows sit at 80–140 px per 0.5 m.
    eye_h, pitch = 1.35, -0.11
    gx, gz = ground_xz(eye_h, pitch)
    report = {"focalPx": round(FOCAL, 1), "eyeM": eye_h, "pitchDeg": round(pitch * 180 / np.pi, 2), "scale": scale_report(gx)}
    print(json.dumps({"scale": report}, indent=2))
    out = []
    for path in paths:
        atlas = np.asarray(Image.open(path).convert("RGB"))
        row = {"file": path.name, "autocorr": autocorrelation(atlas), "synth": synth(atlas, gx, gz)}
        out.append(row)
        print(json.dumps({"file": path.name, "top3": row["autocorr"]["top3"], "watch": row["autocorr"]["watch"], "synth": row["synth"]["worst"], "over": row["synth"]["over"]}, indent=2), flush=True)
    Path("/tmp/r21-precheck.json").write_text(json.dumps({"camera": report, "atlases": out}, indent=2) + "\n")


if __name__ == "__main__":
    main()
