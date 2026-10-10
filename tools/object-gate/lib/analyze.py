#!/usr/bin/env python3
"""object-gate image analysis (numpy + Pillow). Called by gate.mjs with one JSON argument; prints one JSON line.

ops:
  repetition  {img, mask?, rect?}            periodic tiling score of a capture crop (autocorrelation of the high-pass luma)
  phash       {img}                          64-bit difference hash (hex) for checklist records
  colour      {img, mask?, key}              mean CIELAB of the object pixels vs the key crop, deltaE76
  visible_px  {img, mask?, rect?, screenPxPerM, tau?}  render-based visible px/m (detail actually present on screen)
  sheet       {out, key?, tiles:[{img,label}], title}   capture sheet next to the key crop
"""
import json, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def luma(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32) / 255.0
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def load_mask(spec, size):
    if not spec:
        return None
    m = Image.open(spec).convert("L").resize(size, Image.NEAREST)
    return np.asarray(m) > 127

def best_rect(mask, min_side=48):
    """Largest axis-aligned rectangle fully inside the mask (histogram method)."""
    h, w = mask.shape
    hist = np.zeros(w, dtype=np.int32)
    best = (0, None)
    for y in range(h):
        hist = np.where(mask[y], hist + 1, 0)
        stack = []
        for x in range(w + 1):
            cur = hist[x] if x < w else 0
            start = x
            while stack and stack[-1][1] >= cur:
                s, hh = stack.pop()
                area = hh * (x - s)
                if area > best[0] and hh >= min_side and (x - s) >= min_side:
                    best = (area, (s, y - hh + 1, x, y + 1))
                start = s
            stack.append((start, cur))
    return best[1]

def repetition(a):
    im = Image.open(a["img"]).convert("RGB")
    rect = a.get("rect")
    if not rect and a.get("mask"):
        m = load_mask(a["mask"], im.size)
        # shrink the mask a little so object edges / sky are out
        rect = best_rect(m)
    if not rect:
        return {"ok": False, "why": "no object area >= 48x48 px in the capture"}
    x0, y0, x1, y1 = [int(v) for v in rect]
    crop = im.crop((x0, y0, x1, y1))
    y = luma(crop)
    blur = np.asarray(Image.fromarray((y * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255.0
    hp = y - blur
    hp -= hp.mean()
    hh, ww = hp.shape
    # unbiased autocorrelation (divided by the overlap at each lag), normalised to 1 at lag 0
    F = np.fft.fft2(hp, s=(2 * hh, 2 * ww))
    ac = np.fft.fftshift(np.fft.ifft2(np.abs(F) ** 2).real)
    O = np.fft.fft2(np.ones_like(hp), s=(2 * hh, 2 * ww))
    ov = np.fft.fftshift(np.fft.ifft2(np.abs(O) ** 2).real)
    cy, cx = hh, ww
    acn = (ac / np.maximum(ov, 1)) / (ac[cy, cx] / ov[cy, cx] + 1e-12)
    yy, xx = np.mgrid[0:2 * hh, 0:2 * ww]
    r = np.hypot(yy - cy, xx - cx)
    valid = (ov >= 0.3 * hh * ww) & (r > max(12, 0.08 * min(hh, ww)))
    ac2 = np.where(valid, acn, -1)
    k = int(np.argmax(ac2))
    py, px = divmod(k, 2 * ww)
    peak = float(ac2[py, px])
    atLag = None
    L = a.get("expectLagPx")
    if L:
        ang = np.degrees(np.arctan2(np.abs(yy - cy), np.abs(xx - cx)))
        axis = (ang < 10) | (ang > 80)
        ring = (np.abs(r - L) <= 0.05 * L + 3) & axis & (ov >= 0.15 * hh * ww)
        if ring.any():
            atLag = round(float(acn[ring].max()), 4)
    return {"ok": True, "atExpectedLag": atLag, "expectLagPx": L, "rect": [x0, y0, x1, y1], "peak": round(peak, 4), "lagPx": [int(px - cx), int(py - cy)], "crop": [ww, hh]}

def phash(a):
    im = Image.open(a["img"]).convert("L").resize((9, 8), Image.BILINEAR)
    p = np.asarray(im).astype(np.int16)
    bits = (p[:, 1:] > p[:, :-1]).flatten()
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    return {"hash": "%016x" % v}

def srgb_to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def colour(a):
    im = Image.open(a["img"]).convert("RGB")
    px = np.asarray(im).astype(np.float32)
    m = load_mask(a.get("mask"), im.size)
    sel = px[m] if m is not None and m.sum() > 50 else px.reshape(-1, 3)
    key = np.asarray(Image.open(a["key"]).convert("RGB")).astype(np.float32).reshape(-1, 3)
    l1 = srgb_to_lab(sel).mean(0)
    l2 = srgb_to_lab(key).mean(0)
    return {"labObject": [round(float(v), 1) for v in l1], "labKey": [round(float(v), 1) for v in l2], "deltaE": round(float(np.linalg.norm(l1 - l2)), 2)}

def sheet(a):
    tiles = a["tiles"]
    H = 520
    ims = []
    if a.get("key"):
        k = Image.open(a["key"]).convert("RGB")
        ims.append((k, "KEY CROP"))
    for t in tiles:
        try:
            ims.append((Image.open(t["img"]).convert("RGB"), t["label"]))
        except Exception:
            pass
    scaled = [(im.resize((max(1, int(im.width * H / im.height)), H)), lab) for im, lab in ims]
    W = sum(i.width for i, _ in scaled) + 10 * (len(scaled) + 1)
    out = Image.new("RGB", (W, H + 70), (18, 18, 20))
    d = ImageDraw.Draw(out)
    d.text((10, 6), a.get("title", ""), fill=(240, 240, 240))
    x = 10
    for im, lab in scaled:
        out.paste(im, (x, 30))
        d.text((x + 4, H + 36), lab[:60], fill=(230, 210, 120))
        x += im.width + 10
    out.save(a["out"], quality=92)
    return {"out": a["out"], "size": [W, H + 70]}

def size(a):
    im = Image.open(a["img"])
    return {"w": im.width, "h": im.height, "mode": im.mode, "format": im.format}

def mask_png(a):
    w, h, s = a["w"], a["h"], a["bits"]
    arr = (np.frombuffer(s.encode(), dtype=np.uint8) == ord("1")).reshape(h, w)[::-1]
    Image.fromarray((arr * 255).astype(np.uint8)).save(a["out"])
    return {"out": a["out"], "cover": round(float(arr.mean()), 4)}

KS = [round(1.06 ** i, 3) for i in range(0, 49)]   # 1 .. 16.4, 6 % steps

def _resample(L, k):
    h, w = L.shape
    im = Image.fromarray(L.astype(np.float32), mode="F")
    d = im.resize((max(2, int(round(w / k))), max(2, int(round(h / k)))), Image.BOX)
    return np.asarray(d.resize((w, h), Image.BILINEAR), dtype=np.float32)

def visible_px(a):
    """Render-based visible px/m. The surface is captured at a known screen px/m S (`screenPxPerM`, camera at the
    real view distance, zoomed so S has headroom over the target). If the material carries real detail at P px/m on
    screen, the capture is band-limited at P: down-sampling it by k <= S/P loses (almost) nothing. Per 64 px tile:
    k_eff = largest k whose down/up-sample loss stays under `tau` of the tile's detail energy; visible px/m = S / k_eff.
    Median over textured tiles inside the mask (geometry edges only move a few tiles). Same estimator for any material
    method (unique plates, tiling + macro + hex tiling): it only looks at the final pixels."""
    im = Image.open(a["img"])
    L = luma(im) * 255.0
    h, w = L.shape
    m = load_mask(a.get("mask"), (w, h))
    if m is None:
        m = np.ones((h, w), bool)
    if a.get("rect"):
        x0, y0, x1, y1 = a["rect"]; mm = np.zeros_like(m); mm[y0:y1, x0:x1] = True; m &= mm
    S = float(a["screenPxPerM"]); T = int(a.get("tile", 64))
    tau = float(a.get("tau", 0.10))   # calibrated: Imagine 1024 plates magnified 1.5-2.5x read median 1.0x their true px/m (p10 0.75, p90 1.35)
    ref = (L - _resample(L, 16.0)) ** 2
    errs = {k: (L - _resample(L, k)) ** 2 for k in KS[1:]}
    ks, used, inside = [], 0, 0
    for y in range(0, h - T + 1, T):
        for x in range(0, w - T + 1, T):
            if not m[y:y + T, x:x + T].all():
                continue
            inside += 1
            e0 = ref[y:y + T, x:x + T].mean()
            if e0 < float(a.get("minEnergy", 1.0)):   # flat tile (< 1 grey level of detail): no information (dark walls still count: checked, 8-bit quantisation does not inflate the result)
                continue
            used += 1
            kk = 1.0
            for k in KS[1:]:
                if errs[k][y:y + T, x:x + T].mean() / e0 <= tau:
                    kk = k
                else:
                    break
            ks.append(kk)
    if not ks:
        if inside:   # the surface is there but shows no detail at all (flat / black): nothing visible
            return {"ok": True, "flat": True, "screenPxPerM": round(S, 1), "tiles": 0, "insideTiles": int(inside), "kMedian": None,
                    "visiblePxPerM": 0.0, "p25PxPerM": 0.0, "capped": False, "tau": tau}
        return {"ok": False, "why": "the surface is not inside the measured part of the frame", "screenPxPerM": S}
    ks = np.array(ks)
    med = float(np.median(ks))
    return {"ok": True, "screenPxPerM": round(S, 1), "tiles": int(used), "kMedian": round(med, 3),
            "visiblePxPerM": round(S / med, 1), "p25PxPerM": round(S / float(np.percentile(ks, 75)), 1),
            "capped": bool(med <= 1.0), "tau": tau}

if __name__ == "__main__":
    arg = json.loads(sys.argv[2]) if len(sys.argv) > 2 else json.load(sys.stdin)
    op = sys.argv[1]
    print(json.dumps({"repetition": repetition, "phash": phash, "colour": colour, "sheet": sheet, "mask_png": mask_png, "size": size, "visible_px": visible_px}[op](arg)))
