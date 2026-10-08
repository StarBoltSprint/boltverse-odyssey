#!/usr/bin/env python3
"""qc.py - colour / quality gate of every Imagine plate against the anchor (key still) of the biome bible.

  python3 tools/biome/qc.py anchor --biome ember-mesa --image key.jpg [--horizon-row 0.52]
  python3 tools/biome/qc.py check  --biome ember-mesa [--slots DIR] [--image f.png --profile sky|skycap|ground|object|planet]
                                   [--apply] [--redact] [--report out.json] [--no-attempts]
  python3 tools/biome/qc.py apply-lut --biome ember-mesa --in plate.png --out graded.png [--slot S --report R]
  python3 tools/biome/qc.py cube --biome ember-mesa --out ember-mesa.cube [--size 33]

Targets come from the anchor (anchor.sampled, written by `anchor`); before the key still exists they fall back to the
palette hex of the bible. All colour distances are CIE Lab Delta E (2000 by default, `qc.deltaE`). Thresholds
(Grok chat answer, 2026-10-08) live in the bible `qc` block:
  horizon band < 6 | shadow < 10 and L > 8 | highlight / lit < 12 | object lit face < 14 | saturation within 0.08
  seam overlap < 8 | object content bbox >= 70 % | grain Laplacian variance > ~80.
Decision per plate: pass | lut (a global grade fixes it: fitted, re-checked, applied offline) | regenerate
(shape / grain / bbox / seam or colour beyond lutMaxFactor x threshold) | fallback (after maxFails=2 regenerates:
catalogue pack). Fails are counted in out/<id>/attempts.json, which manifest.py reads.
"""
import argparse, glob, json, os, sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import biome_lib as bl  # noqa: E402

WORK = 768  # analysis resolution (longest side): stable statistics, fast


# ------------------------------------------------------------------ io
def load(path, work=WORK):
    im = Image.open(path)
    has_a = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA")
    if work and max(im.size) > work:
        s = work / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    return a[..., :3], (a[..., 3] if has_a else None)


def lum(rgb):
    return rgb @ np.array([0.2126, 0.7152, 0.0722])


def hsv_sat(rgb):
    mx = rgb.max(-1); mn = rgb.min(-1)
    return np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0.0)


def lab_of(rgb):
    return bl.rgb_to_lab(rgb)


def de(b, l1, l2):
    return float((bl.delta_e76 if str(b.get("qc", {}).get("deltaE", "2000")) == "76" else bl.delta_e2000)(l1, l2))


def segment(rgb, alpha):
    """Object mask: alpha if present, else 'different from the border colour' + biggest blob."""
    if alpha is not None and alpha.min() < 0.9:
        return alpha > 0.5
    from scipy import ndimage
    border = np.concatenate([rgb[:4].reshape(-1, 3), rgb[-4:].reshape(-1, 3), rgb[:, :4].reshape(-1, 3), rgb[:, -4:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = bl.delta_e76(lab_of(rgb), lab_of(bg))
    m = d > 12
    m = ndimage.binary_opening(m, iterations=2)
    lab_, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab_, range(1, n + 1))
    m = lab_ == (1 + int(np.argmax(sizes)))
    return ndimage.binary_fill_holes(m)


def pct_mean(rgb, L, mask, lo, hi):
    v = L[mask]
    if v.size < 16:
        return None
    a, b_ = np.percentile(v, [lo, hi])
    sel = mask & (L >= a) & (L <= b_)
    return rgb[sel].mean(0) if sel.any() else None


def lap_var(rgb, mask=None):
    from scipy import ndimage
    g = lum(rgb) * 255.0
    l = ndimage.laplace(g)
    if mask is not None:
        from scipy import ndimage as nd
        m = nd.binary_erosion(mask, iterations=3)
        return float(l[m].var()) if m.sum() > 64 else 0.0
    return float(l[2:-2, 2:-2].var())


def detect_horizon(rgb, lo=0.25, hi=0.75):
    from scipy import ndimage
    L = ndimage.gaussian_filter(lum(rgb), 2)
    rows = L.mean(1)
    g = np.abs(np.diff(rows))
    h = len(rows)
    a, b_ = int(h * lo), int(h * hi)
    return (a + int(np.argmax(g[a:b_]))) / h


# ------------------------------------------------------------------ anchor
def sample_scene(rgb, horizon_row):
    h = rgb.shape[0]
    hr = int(round(horizon_row * h))
    L = lum(rgb)
    full = np.ones(L.shape, bool)
    below = np.zeros_like(full); below[min(h - 1, hr + max(2, h // 50)):] = True
    out = {
        "horizon": np.median(rgb[max(0, hr - max(3, h // 25)):max(1, hr - 1)].reshape(-1, 3), 0),
        "sky": np.median(rgb[:max(2, h // 10)].reshape(-1, 3), 0),
        "ground": np.median(rgb[below].reshape(-1, 3), 0) if below.any() else None,
        "shadow": pct_mean(rgb, L, full, 2, 8),
        "highlight": pct_mean(rgb, L, full, 97, 99.7),
        "lit": pct_mean(rgb, L, below if below.any() else full, 85, 97),
    }
    res = {k: [round(float(x), 3) for x in lab_of(v)] for k, v in out.items() if v is not None}
    res["saturation"] = round(float(hsv_sat(rgb).mean()), 4)
    res["horizonRow"] = round(horizon_row, 4)
    return res


def targets(b):
    s = b.get("anchor", {}).get("sampled")
    if isinstance(s, dict) and "horizon" in s:
        return s, "anchor"
    pal = b.get("palette") if isinstance(b.get("palette"), dict) else None
    if not pal:
        raise SystemExit("[qc] no anchor.sampled and no palette (local file missing) - run `qc.py anchor` first")
    L = lambda h: [round(float(x), 3) for x in lab_of(np.array(bl.hex_to_rgb01(h)))]  # noqa: E731
    lit = bl.rgb01_to_hex((np.array(bl.hex_to_rgb01(pal["key"])) + np.array(bl.hex_to_rgb01(pal["ground"]))) / 2)
    sat = float(np.mean([hsv_sat(np.array(bl.hex_to_rgb01(pal[k]))) for k in ("horizon", "ground", "fill")]))
    return {"horizon": L(pal["horizon"]), "sky": L(pal["zenith"]), "ground": L(pal["ground"]), "shadow": L(pal["shadow"]),
            "highlight": L(pal["key"]), "lit": L(lit), "saturation": round(sat, 4)}, "palette"


# ------------------------------------------------------------------ correction (offline "LUT")
def apply_correction(rgb, corr):
    out = rgb * np.array(corr["gain"]) + np.array(corr["lift"])
    s = corr.get("saturation", 1.0)
    if abs(s - 1) > 1e-4:
        y = lum(np.clip(out, 0, 1))[..., None]
        out = y + (out - y) * s
    return np.clip(out, 0, 1)


def apply_biome_lut(rgb, lut):
    """Biome master grade: lift / gamma / gain (ASC-CDL style) + saturation + contrast. Same math as runtime/biome-runtime.js."""
    lift, gamma, gain = np.array(lut["lift"]), np.array(lut["gamma"]), np.array(lut["gain"])
    c = np.clip(rgb * gain + lift * (1 - rgb), 0, 1) ** (1.0 / np.maximum(gamma, 1e-3))
    y = lum(c)[..., None]
    c = y + (c - y) * lut.get("saturation", 1.0)
    k = lut.get("contrast", 1.0)
    return np.clip((c - 0.5) * k + 0.5, 0, 1)


# ------------------------------------------------------------------ checks
def thresholds(b):
    q = b.get("qc", {})
    return dict(horizonDE=q.get("horizonDE", 6), shadowDE=q.get("shadowDE", 10), shadowLMin=q.get("shadowLMin", 8),
                highlightDE=q.get("highlightDE", 12), satTol=q.get("satTol", 0.08), objectLitDE=q.get("objectLitDE", 14),
                seamDE=q.get("seamDE", 8), bboxMin=q.get("bboxMin", 0.70), grainLapVarMin=q.get("grainLapVarMin", 80))


def pct_mask(L, mask, lo, hi):
    v = L[mask]
    if v.size < 16:
        return None
    a, b_ = np.percentile(v, [lo, hi])
    sel = mask & (L >= a) & (L <= b_)
    return sel if sel.any() else None


def regions(b, rgb, alpha, profile):
    """Fixed pixel sets per colour check (chosen once on the original plate, reused while fitting a LUT)."""
    th = thresholds(b)
    L = lum(rgb); h, w = L.shape
    full = np.ones(L.shape, bool)
    R = {"colour": {}, "satMask": full, "shape": {}, "profile": profile}
    if profile == "object":
        mask = segment(rgb, alpha)
        R["mask"] = mask; R["satMask"] = mask
        R["colour"]["lit"] = (pct_mask(L, mask, 80, 97), "lit", th["objectLitDE"], False)
        R["colour"]["shadow"] = (pct_mask(L, mask, 2, 10), "shadow", th["shadowDE"], True)
    elif profile == "sky":
        hr = detect_horizon(rgb)
        band = np.zeros_like(full); band[max(0, int(hr * h) - max(3, h // 25)):max(1, int(hr * h) - 1)] = True
        R["horizonRow"] = hr
        R["colour"]["horizon"] = (band, "horizon", th["horizonDE"], False)
        if float(np.percentile(L, 99.9)) > 0.97:  # sun in frame -> its hot core must match the anchor highlight
            R["colour"]["highlight"] = (pct_mask(L, full, 99.0, 99.9), "highlight", th["highlightDE"], False)
    elif profile == "skycap":
        R["colour"]["cap"] = (full, "sky", th["horizonDE"] * 2, False)
    elif profile in ("ground", "anchor"):
        R["colour"]["shadow"] = (pct_mask(L, full, 2, 8), "shadow", th["shadowDE"], True)
        R["colour"]["lit"] = (pct_mask(L, full, 85, 97), "lit", th["highlightDE"], False)
    R["colour"] = {k: v for k, v in R["colour"].items() if v[0] is not None}
    return R


def measure(b, T, rgb, alpha, R, full_checks=True):
    th = thresholds(b)
    L = lum(rgb); h, w = L.shape
    m, fails = {}, []
    T_lab = {k: np.array(v) for k, v in T.items() if isinstance(v, list)}
    for name, (sel, tkey, thr, need_L) in R["colour"].items():
        if tkey not in T_lab:
            continue
        mean = np.median(rgb[sel], 0) if name == "horizon" else rgb[sel].mean(0)
        lab = lab_of(mean); d = de(b, lab, T_lab[tkey])
        m[name] = {"dE": round(d, 2), "thr": thr, "L": round(float(lab[0]), 1), "lab": [round(float(x), 2) for x in lab]}
        okL = (not need_L) or float(lab[0]) > th["shadowLMin"]
        if d >= thr or not okL:
            fails.append({"check": name, "kind": "colour", "dE": round(d, 2), "thr": thr,
                          "note": "" if okL else f"L {lab[0]:.1f} must be > {th['shadowLMin']}"})
    sm = R["satMask"]
    sat = float(hsv_sat(rgb[sm]).mean()) if sm.any() else 0.0
    ts = T.get("saturation")
    if ts is not None:
        m["saturation"] = {"value": round(sat, 4), "target": ts, "delta": round(sat - ts, 4), "tol": th["satTol"]}
        if abs(sat - ts) > th["satTol"]:
            fails.append({"check": "saturation", "kind": "colour", "delta": round(sat - ts, 4), "thr": th["satTol"]})
    if not full_checks:
        return m, fails
    prof = R["profile"]
    if prof == "object":
        mask = R["mask"]
        if mask.any():
            ys, xs = np.where(mask)
            bw, bh = (xs.max() - xs.min() + 1) / w, (ys.max() - ys.min() + 1) / h
        else:
            bw = bh = 0.0
        fillv = max(bw, bh)
        m["bbox"] = {"fill": round(float(fillv), 3), "w": round(float(bw), 3), "h": round(float(bh), 3), "coverage": round(float(mask.mean()), 3), "thr": th["bboxMin"]}
        if fillv < th["bboxMin"]:
            fails.append({"check": "bbox", "kind": "shape", "value": round(float(fillv), 3), "thr": th["bboxMin"]})
        if alpha is not None:
            from scipy import ndimage
            ring = mask & ~ndimage.binary_erosion(mask, iterations=2)
            fr = float((lab_of(rgb[ring])[:, 0] < 8).mean()) if ring.any() else 0.0
            m["fringe"] = {"darkEdgeFrac": round(fr, 4), "note": "edge pixels with L < 8 (black matte): bleed + premultiply offline"}
        gv = lap_var(rgb, mask)
    else:
        if prof == "sky":
            m["horizonRow"] = round(R["horizonRow"], 3)
        if prof in ("ground", "planet"):
            lab = lab_of(rgb)
            lr = float(np.mean(bl.delta_e2000(lab[:, 0], lab[:, -1])))
            m["wrapLR"] = {"dE": round(lr, 2), "thr": th["seamDE"]}
            bad = lr >= th["seamDE"]
            if prof == "ground":
                tb = float(np.mean(bl.delta_e2000(lab[0], lab[-1])))
                m["wrapTB"] = {"dE": round(tb, 2), "thr": th["seamDE"]}
                bad = bad or tb >= th["seamDE"]
            if bad:
                fails.append({"check": "wrap", "kind": "seam", "lr": round(lr, 2), "thr": th["seamDE"]})
        gv = lap_var(rgb)
    gated = prof in ("ground", "object")
    m["grainLapVar"] = {"value": round(gv, 1), "thr": th["grainLapVarMin"], "gated": gated}
    if gated and gv < th["grainLapVarMin"]:
        fails.append({"check": "grain", "kind": "texture", "value": round(gv, 1), "thr": th["grainLapVarMin"]})
    return m, fails


def fit_lut(b, T, rgb, R):
    """Find the global grade (gain, lift per channel + saturation) that best brings the fixed regions onto the
    anchor targets. Nelder-Mead on region means + a 20k pixel subsample for saturation: ~0.1 s per plate."""
    from scipy.optimize import minimize
    th = thresholds(b)
    T_lab = {k: np.array(v) for k, v in T.items() if isinstance(v, list)}
    regs = [(rgb[sel].mean(0) if name != "horizon" else np.median(rgb[sel], 0), T_lab[tkey], thr)
            for name, (sel, tkey, thr, _) in R["colour"].items() if tkey in T_lab]
    pix = rgb[R["satMask"]]
    if len(pix) > 20000:
        pix = pix[np.random.default_rng(0).choice(len(pix), 20000, replace=False)]
    ts = T.get("saturation")

    def corr_of(x):
        return {"gain": list(np.clip(1 + x[0:3], 0.6, 1.6)), "lift": list(np.clip(x[3:6], -0.15, 0.15)), "saturation": float(np.clip(1 + x[6], 0.6, 1.5))}

    def loss(x):
        c = corr_of(x); e = 0.0
        for mean, tl, thr in regs:
            e += (de(b, lab_of(apply_correction(mean[None], c)[0]), tl) / thr) ** 2
        if ts is not None:
            e += ((float(hsv_sat(apply_correction(pix, c)).mean()) - ts) / th["satTol"]) ** 2
        return e + 0.05 * float(np.sum(x ** 2))

    r = minimize(loss, np.zeros(7), method="Nelder-Mead", options={"maxiter": 600, "xatol": 1e-3, "fatol": 1e-4})
    c = corr_of(r.x)
    return {"gain": [round(float(v), 4) for v in c["gain"]], "lift": [round(float(v), 4) for v in c["lift"]], "saturation": round(c["saturation"], 4)}


def decide(b, T, rgb, alpha, profile):
    q = b.get("qc", {})
    R = regions(b, rgb, alpha, profile)
    m, fails = measure(b, T, rgb, alpha, R)
    if not fails:
        return {"decision": "pass", "metrics": m, "fails": []}
    hard = [f for f in fails if f["kind"] != "colour"]
    far = [f for f in fails if f["kind"] == "colour" and "dE" in f and f["dE"] > q.get("lutMaxFactor", 2.0) * f["thr"]]
    res = {"metrics": m, "fails": fails}
    if not hard and not far:
        corr = fit_lut(b, T, rgb, R)
        m2, f2 = measure(b, T, apply_correction(rgb, corr), alpha, R, full_checks=False)
        res["lutTry"] = {"correction": corr, "failsAfter": f2, "metricsAfter": {k: v for k, v in m2.items() if isinstance(v, dict) and ("dE" in v or "delta" in v)}}
        if not f2:
            res["decision"] = "lut"; res["correction"] = corr
            return res
    res["decision"] = "regenerate"
    res["why"] = "shape/texture/seam" if hard else ("colour beyond LUT range" if far else "a global grade cannot fix it")
    return res


def find_duplicates(rows, tol=0.012):
    """Plates of one family that are (nearly) the same image: mean abs difference of a 128x72 thumbnail < tol.
    Catches a ring of copied sky slices (the zone B "8 identical sunless slices" defect) or a copied object view."""
    def fam(s):
        return "sky-H" if s.startswith("sky-H") else "ground" if s.startswith("ground-") else s.rsplit("-", 1)[0]
    th = {}
    for r in rows:
        im = Image.open(r["file"]).convert("RGB").resize((128, 72), Image.BOX)
        th[r["slot"]] = (fam(r["slot"]), np.asarray(im, np.float32) / 255.0)
    out, keys = [], sorted(th)
    for i, a in enumerate(keys):
        for c in keys[i + 1:]:
            if th[a][0] == th[c][0]:
                d = float(np.mean(np.abs(th[a][1] - th[c][1])))
                if d < tol:
                    out.append({"pair": [a, c], "meanAbsDiff": round(d, 4)})
    return out


def neighbour_seams(b, rows):
    """sky-H{i} vs sky-H{i+1}: compare the strips that should show the same sky. With plateHFovDeg > 360/n the
    plates overlap: the right overlap strip of H{i} against the left overlap strip of H{i+1}; without overlap the
    edge columns. Median colour per row band, mean Delta E."""
    thr = b.get("qc", {}).get("seamDE", 8)
    hs = sorted([r for r in rows if r["slot"].startswith("sky-H")], key=lambda r: int(r["slot"][5:]))
    n_plan = b.get("sky", {}).get("horizonPlates", len(hs))
    hfov = b.get("sky", {}).get("plateHFovDeg", 360.0 / max(1, n_plan))
    ov = max(0.0, (hfov - 360.0 / max(1, n_plan)) / hfov)
    out = []
    for i, r in enumerate(hs):
        n = hs[(i + 1) % len(hs)]
        if int(n["slot"][5:]) != (int(r["slot"][5:]) + 1) % n_plan:
            continue  # not neighbours on the planned ring
        a, _ = load(r["file"], 384); c, _ = load(n["file"], 384)
        hh = min(a.shape[0], c.shape[0])
        wa = max(2, int(a.shape[1] * max(ov, 0.02))); wc = max(2, int(c.shape[1] * max(ov, 0.02)))
        sa = np.median(a[:hh, -wa:], 1); sc = np.median(c[:hh, :wc], 1)
        k = max(1, hh // 24)
        ba = np.array([sa[j:j + k].mean(0) for j in range(0, hh - k + 1, k)]); bc = np.array([sc[j:j + k].mean(0) for j in range(0, hh - k + 1, k)])
        d = float(np.mean(bl.delta_e2000(lab_of(ba), lab_of(bc))))
        out.append({"pair": [r["slot"], n["slot"]], "dE": round(d, 2), "thr": thr, "ok": d < thr, "overlapFrac": round(ov, 3)})
    return out


def redact(o):
    if isinstance(o, dict):
        return {k: redact(v) for k, v in o.items() if k not in ("lab", "L", "target_lab")}
    if isinstance(o, list):
        return [redact(x) for x in o]
    return o


PROFILE_OF = {"key": "anchor", "sky-H": "sky", "sky-Z": "skycap", "sky-N": "skycap", "ground-": "ground",
              "planet-": "planet", "obj-": "object"}


def profile_for(slot, fallback="object"):
    for k, v in PROFILE_OF.items():
        if slot == k or slot.startswith(k):
            return v
    return fallback


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a1 = sub.add_parser("anchor"); a1.add_argument("--biome", required=True); a1.add_argument("--image", required=True)
    a1.add_argument("--horizon-row", type=float); a1.add_argument("--no-write", action="store_true")
    a2 = sub.add_parser("check"); a2.add_argument("--biome", required=True); a2.add_argument("--slots")
    a2.add_argument("--image", action="append", default=[]); a2.add_argument("--profile")
    a2.add_argument("--apply", action="store_true", help="write graded copies for 'lut' plates to out/<id>/graded/")
    a2.add_argument("--redact", action="store_true", help="drop absolute Lab values (for committing a proof)")
    a2.add_argument("--report"); a2.add_argument("--no-attempts", action="store_true")
    a2.add_argument("--targets", choices=["anchor", "palette"], help="force the target source")
    a3 = sub.add_parser("apply-lut"); a3.add_argument("--biome", required=True); a3.add_argument("--in", dest="inp", required=True)
    a3.add_argument("--out", required=True); a3.add_argument("--slot"); a3.add_argument("--report")
    a4 = sub.add_parser("cube"); a4.add_argument("--biome", required=True); a4.add_argument("--out", required=True)
    a4.add_argument("--size", type=int, default=33)
    A = ap.parse_args()
    b, info = bl.load_biome(A.biome)
    out_dir = os.path.join(bl.HERE, "out", b["id"])
    os.makedirs(out_dir, exist_ok=True)

    if A.cmd == "anchor":
        rgb, _ = load(A.image, 1024)
        planned = b.get("anchor", {}).get("horizonRow")
        detected = detect_horizon(rgb, 0.15, 0.85)
        hr = A.horizon_row if A.horizon_row is not None else detected
        s = sample_scene(rgb, hr)
        s["file"] = os.path.basename(A.image)
        s["horizonRowPlanned"] = planned
        if planned is not None and abs(detected - planned) > 0.08:
            print(f"[qc] note: key still horizon at {detected:.2f} of the height, bible planned {planned:.2f} (framing off; sampled at {hr:.2f})")
        bl.write_json(os.path.join(out_dir, "anchor.json"), s)
        if not A.no_write:
            lp = bl.biome_paths(A.biome)[1]
            loc = bl.read_json(lp) if os.path.exists(lp) else {}
            loc.setdefault("anchor", {})["sampled"] = s
            bl.write_json(lp, loc)  # sampled colours = palette -> local file only
        print(f"[qc] anchor sampled ({len(s)} values, horizon row {hr:.3f}) -> {out_dir}/anchor.json" + ("" if A.no_write else f" + {os.path.basename(bl.biome_paths(A.biome)[1])}"))
        return 0

    if A.cmd == "cube":
        n = A.size
        g = np.linspace(0, 1, n)
        bgr = np.stack(np.meshgrid(g, g, g, indexing="ij"), -1)  # [b][g][r]
        rgb = bgr[..., ::-1].reshape(-1, 3)
        out = apply_biome_lut(rgb, b["lut"])
        with open(A.out, "w") as f:
            f.write(f'TITLE "{b["id"]} master grade (bible v{b["bibleVersion"]})"\nLUT_3D_SIZE {n}\n')
            for r_, g_, b_ in out:
                f.write(f"{r_:.6f} {g_:.6f} {b_:.6f}\n")
        print(f"[qc] cube {n}^3 -> {A.out}")
        return 0

    if A.cmd == "apply-lut":
        im = Image.open(A.inp).convert("RGBA")
        a = np.asarray(im, dtype=np.float32) / 255.0
        if A.slot and A.report:
            corr = bl.read_json(A.report)["plates"][A.slot]["correction"]
            out = apply_correction(a[..., :3], corr)
        else:
            out = apply_biome_lut(a[..., :3], b["lut"])
        res = np.concatenate([out, a[..., 3:]], -1)
        Image.fromarray((res * 255 + 0.5).astype(np.uint8), "RGBA").convert(im.mode if A.out.lower().endswith(".png") else "RGB").save(A.out, quality=95)
        print(f"[qc] graded -> {A.out}")
        return 0

    # check
    if A.targets == "palette":
        b2 = dict(b); b2["anchor"] = {k: v for k, v in b.get("anchor", {}).items() if k != "sampled"}
        T, src = targets(b2)
    else:
        T, src = targets(b)
    rows = []
    if A.image:
        for f in A.image:
            rows.append({"slot": os.path.splitext(os.path.basename(f))[0], "file": f, "profile": A.profile or "object"})
    else:
        sd = A.slots or os.path.join(out_dir, "slots")
        for f in sorted(glob.glob(os.path.join(sd, "*"))):
            if os.path.splitext(f)[1].lower() in (".png", ".jpg", ".jpeg", ".webp"):
                s = os.path.splitext(os.path.basename(f))[0]
                rows.append({"slot": s, "file": f, "profile": profile_for(s)})
    plates = {}
    for r in rows:
        if r["profile"] == "anchor":
            continue
        rgb, alpha = load(r["file"])
        res = decide(b, T, rgb, alpha, r["profile"])
        res["profile"] = r["profile"]; res["file"] = os.path.basename(r["file"])
        plates[r["slot"]] = res
        if A.apply and res["decision"] == "lut":
            gd = os.path.join(out_dir, "graded"); os.makedirs(gd, exist_ok=True)
            im = Image.open(r["file"]).convert("RGBA"); a = np.asarray(im, dtype=np.float32) / 255.0
            o = np.concatenate([apply_correction(a[..., :3], res["correction"]), a[..., 3:]], -1)
            Image.fromarray((o * 255 + 0.5).astype(np.uint8), "RGBA").save(os.path.join(gd, r["slot"] + ".png"))
    seams = neighbour_seams(b, [r for r in rows if r["profile"] == "sky"]) if sum(r["profile"] == "sky" for r in rows) >= 2 else []
    for sm in seams:  # a bad seam is a regenerate on the right-hand plate (left one is the reference going round)
        if not sm["ok"] and sm["pair"][1] in plates and plates[sm["pair"][1]]["decision"] in ("pass", "lut"):
            plates[sm["pair"][1]]["decision"] = "regenerate"; plates[sm["pair"][1]]["why"] = "seam with " + sm["pair"][0]
    # duplicates: two plates of one family (sky ring, ground set, one object's views) that are the same picture
    dups = find_duplicates(rows)
    for d in dups:
        p = plates.get(d["pair"][1])
        if p and p["decision"] in ("pass", "lut"):
            p["decision"] = "regenerate"; p["why"] = "duplicate of " + d["pair"][0]
    # attempts / fallback
    att_p = os.path.join(out_dir, "attempts.json")
    att = bl.read_json(att_p) if os.path.exists(att_p) else {}
    mf = b.get("qc", {}).get("maxFails", 2)
    for s, res in plates.items():
        if res["decision"] == "regenerate":
            n = int(att.get(s, {}).get("fails", 0)) + (0 if A.no_attempts else 1)
            if not A.no_attempts:
                att[s] = {"fails": n}
            if n >= mf:
                res["decision"] = "fallback"; res["why"] = f"{n} fails >= {mf}: use the catalogue pack"
    if not A.no_attempts:
        bl.write_json(att_p, att)
    counts = {}
    for res in plates.values():
        counts[res["decision"]] = counts.get(res["decision"], 0) + 1
    rep = {"biome": b["id"], "bibleVersion": b["bibleVersion"], "targets": src, "deltaE": b.get("qc", {}).get("deltaE", "2000"),
           "thresholds": b.get("qc"), "counts": counts, "seams": seams, "duplicates": dups, "plates": plates}
    if A.redact:
        rep = redact(rep)
    rp = A.report or os.path.join(out_dir, "qc-report.json")
    bl.write_json(rp, rep)
    print(f"[qc] {b['id']}: {len(plates)} plates vs {src} -> {counts} | seams bad {sum(not s['ok'] for s in seams)}/{len(seams)} -> {rp}")
    for s, res in plates.items():
        fl = ", ".join(f["check"] + (f" dE {f['dE']}" if "dE" in f else (f" {f.get('value', f.get('delta', ''))}")) for f in res["fails"])
        print(f"   {s:<22} {res['profile']:<7} {res['decision']:<10} {fl}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
