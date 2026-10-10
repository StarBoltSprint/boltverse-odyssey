"""object-gate key-compare: key image vs key-matched in-game render, per element of the key.

python3 keycompare.py <job.json>
job = {key, game, out, elements:[...], thresholds:{type: {...}}, masks:{name: png}, title}
Element: {id, name, type, key:{rect:[x0,y0,x1,y1] (0..1 of the frame), mask:RULE}, game:{rect?, mask:RULE|{img,png}},
          metrics:[iou, colour, structure], missing?:bool, note?}
RULE = "all" | "sky" | "skycore" | "notsky" | "dark" | "bright" | "warm" | "sand" | "rock" | "rocktex" | "magenta" | {"lumAbove": L}
       | {"lumBelow": L} | {"tophat": dL, "k": px} | {"and": [...]} | {"not": RULE};  side.thin: px = thin-structure tolerance band
Writes <out>/key-compare.json, key-compare.md, sheet.jpg (phone width 1080), sheet-small.jpg (540), crops/*.png.
Metrics (per element):
  iou          outline IoU of the element masks in FRAME coordinates (position + shape); also iouAligned = best IoU
               over translations within +-6 % of the frame (shape only, info)
  deLit/deShadow  CIEDE2000 between the mean CIELAB colours of the lit (L >= element median) and shadow (L < median)
               parts of the element mask, each image split on its own median
  structure    SSIM of luminance (gaussian, sigma 1.5) after ECC alignment of the game crop onto the key crop
               (affine, both resized to the key crop size, max side 256), inside the dilated element mask bbox
  lpips        LPIPS (alex) of the aligned crops when the model weights are available (info)
"""
import sys, json, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import cv2
from skimage.color import rgb2lab, deltaE_ciede2000
from skimage.metrics import structural_similarity

F = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def font(s, b=False):
    try: return ImageFont.truetype(FB if b else F, s)
    except Exception: return ImageFont.load_default()

def load(p, size=None):
    im = Image.open(p).convert("RGB")
    if size and im.size != tuple(size): im = im.resize(tuple(size), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255.0

def lum(a): return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def rule_mask(a, rule, masks=None, H=None, W=None):
    r, g, b = a[..., 0] * 255, a[..., 1] * 255, a[..., 2] * 255
    L = lum(a) * 255; mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); sat = (mx - mn) / (mx + 1)
    if isinstance(rule, dict):
        if "img" in rule:   # a mask render (e.g. ?mesaMask=1&mesaOnly=1 -> magenta), same frame
            m = load(rule["img"], (a.shape[1], a.shape[0]))
            return (m[..., 0] > 0.78) & (m[..., 1] < 0.24) & (m[..., 2] > 0.78)
        if "lumAbove" in rule: return L >= rule["lumAbove"]
        if "lumBelow" in rule: return L < rule["lumBelow"]
        if "and" in rule:
            m = np.ones(a.shape[:2], bool)
            for x in rule["and"]: m &= rule_mask(a, x, masks)
            return m
        if "not" in rule: return ~rule_mask(a, rule["not"], masks)
        if "tophat" in rule:   # thin bright lines (ring arcs, beams): brighter than the local background by >= t (L 0..255)
            k = int(rule.get("k", 9)); Lf = L.astype(np.float32)
            return (Lf - cv2.morphologyEx(Lf, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))) > rule["tophat"]
    sky = (b > 1.03 * g) & (L > 40)
    if rule == "all": return np.ones(a.shape[:2], bool)
    if rule == "sky": return sky
    if rule == "notsky": return ~sky
    if rule == "dark": return (L < 70) & (sat < 0.45)
    if rule == "bright": return L > 200
    if rule == "warm": return (r > g * 1.08) & (g > b * 1.02) & (L > 45)
    if rule == "sand": return (r > g * 1.08) & (g > b * 1.05) & (L > 70)
    if rule == "rock": return (r > g * 1.05) & ~sky & (L > 25) & (L < 200)
    if rule == "rocktex":   # rock WITHOUT smooth sand (2026-10-10): sand and lit rock share hue in key-city3, so split on
        # texture: blurred local std of L (9 px window, 15 px smoothing) >= 3.2 (key: sand dunes 0.29, arch 0.81, mesas 0.72 kept)
        rk = (r > g * 1.05) & ~sky & (L > 25) & (L < 200); Lf = L.astype(np.float32)
        m = cv2.blur(Lf, (9, 9)); S = cv2.blur(np.sqrt(np.maximum(cv2.blur(Lf * Lf, (9, 9)) - m * m, 0)), (15, 15))
        return cv2.morphologyEx((rk & (S >= 3.2)).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)).astype(bool) & rk
    if rule == "skycore":   # sky away from any structure edge (closed 5 px, eroded 15 px): ring arcs, not tower rims
        sk = cv2.morphologyEx(sky.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        return cv2.erode(sk, np.ones((15, 15), np.uint8)).astype(bool)
    if rule == "magenta": return (r > 200) & (g < 60) & (b > 200)
    raise ValueError(f"unknown mask rule {rule}")

def rect_px(rc, W, H):
    x0, y0, x1, y1 = rc; return int(round(x0 * W)), int(round(y0 * H)), int(round(x1 * W)), int(round(y1 * H))

def elem_mask(a, side, W, H):
    m = np.zeros((H, W), bool); x0, y0, x1, y1 = rect_px(side["rect"], W, H)
    m[y0:y1, x0:x1] = rule_mask(a, side.get("mask", "all"))[y0:y1, x0:x1]
    if side.get("thin"):   # thin structures (ring arcs): keep 1-2 px lines, then widen to a tolerance band (both images)
        m = cv2.dilate(m.astype(np.uint8), np.ones((int(side["thin"]), int(side["thin"])), np.uint8)).astype(bool)
        m[:y0] = False; m[y1:] = False; m[:, :x0] = False; m[:, x1:] = False
        return m
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    return m

def iou(a, b):
    u = (a | b).sum(); return float((a & b).sum() / u) if u else float("nan")

def iou_aligned(km, gm, frac=0.06):
    H, W = km.shape; best = iou(km, gm); s = max(2, int(frac * W) // 12)
    ys, xs = np.nonzero(gm)
    if not len(ys): return best
    for dy in range(-int(frac * H), int(frac * H) + 1, s):
        for dx in range(-int(frac * W), int(frac * W) + 1, s):
            sh = np.zeros_like(gm); y2, x2 = ys + dy, xs + dx; ok = (y2 >= 0) & (y2 < H) & (x2 >= 0) & (x2 < W)
            sh[y2[ok], x2[ok]] = True; best = max(best, iou(km, sh))
    return best

def lab_split(a, m):
    if m.sum() < 30: return None
    lab = rgb2lab(a[m].reshape(-1, 1, 3)).reshape(-1, 3); med = np.median(lab[:, 0])
    lit, sh = lab[lab[:, 0] >= med], lab[lab[:, 0] < med]
    return dict(all=lab.mean(0), lit=lit.mean(0) if len(lit) else lab.mean(0), shadow=sh.mean(0) if len(sh) else lab.mean(0), medL=float(med))

def de(a, b): return float(deltaE_ciede2000(np.array(a).reshape(1, 1, 3), np.array(b).reshape(1, 1, 3))[0, 0])

def crop_box(m, rc, W, H, pad=0.04):
    ys, xs = np.nonzero(m)
    if len(ys) < 30: x0, y0, x1, y1 = rect_px(rc, W, H)
    else: x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    px, py = int(pad * W), int(pad * H)
    return max(0, x0 - px), max(0, y0 - py), min(W, x1 + px), min(H, y1 + py)

_LP = None
def lpips_d(a, b):
    global _LP
    try:
        import torch, lpips
        if _LP is None:
            import contextlib, io
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()): _LP = lpips.LPIPS(net="alex", verbose=False)
        t = lambda x: torch.from_numpy(x.transpose(2, 0, 1)[None] * 2 - 1).float()
        with torch.no_grad(): return float(_LP(t(a), t(b)).item())
    except Exception as e:
        _LP = False if _LP is None else _LP; return None

def structure(kc, gc, km=None):
    """ECC-align gc onto kc (affine), SSIM on luminance. Returns (ssim, aligned gc)."""
    h, w = kc.shape[:2]; s = min(1.0, 256 / max(h, w)); size = (max(16, int(w * s)), max(16, int(h * s)))
    k = cv2.resize(kc, size, interpolation=cv2.INTER_AREA); g = cv2.resize(gc, size, interpolation=cv2.INTER_AREA)
    kl, gl = lum(k).astype(np.float32), lum(g).astype(np.float32)
    warp = np.eye(2, 3, dtype=np.float32)
    try:
        _, warp = cv2.findTransformECC(cv2.GaussianBlur(kl, (5, 5), 0), cv2.GaussianBlur(gl, (5, 5), 0), warp, cv2.MOTION_AFFINE,
                                       (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-5), None, 5)
        sc = math.sqrt(abs(np.linalg.det(warp[:, :2])))
        if not (0.6 < sc < 1.6): warp = np.eye(2, 3, dtype=np.float32)
    except cv2.error: pass
    ga = cv2.warpAffine(g, warp, size, flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    ss = structural_similarity(kl, lum(ga).astype(np.float32), data_range=1.0, gaussian_weights=True, sigma=1.5, use_sample_covariance=False)
    return float(ss), k, ga

def ceiling(kc, kmc):
    """Measurement ceiling (honest upper bound of what ANY render can score here): the key crop against itself after the
    unavoidable losses of a game render of the same view: 1 px misregistration, render resolution 0.75 x, AA blur.
    A 3D object seen from one angle against a 2D painting scores below this; the fix loop reports its gap to it."""
    h, w = kc.shape[:2]
    if h < 8 or w < 8: return {}
    d = cv2.resize(cv2.resize(kc, (max(4, int(w * 0.75)), max(4, int(h * 0.75))), interpolation=cv2.INTER_AREA), (w, h), interpolation=cv2.INTER_LINEAR)
    d = np.roll(cv2.GaussianBlur(d, (3, 3), 0.6), 1, axis=1)
    ss, _, _ = structure(kc, d)
    m2 = np.roll(cv2.dilate(kmc.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool), 1, axis=0)
    return dict(structure=round(ss, 3), iou=round(iou(kmc, m2), 3), deLit=0.0, deShadow=0.0)

def verdict_of(row, th, tg):
    """FAIL if any gated metric is outside the gate threshold; CLOSE if all gated pass but a target is missed; MATCH otherwise."""
    fails, gaps = [], []
    chk = [("iou", ">=", "iouMin", "iouTarget"), ("deLit", "<=", "deLitMax", "deLitTarget"), ("deShadow", "<=", "deShadowMax", "deShadowTarget"),
           ("structure", ">=", "structureMin", "structureTarget")]
    for k, op, gk, tk in chk:
        v = row.get(k)
        if v is None or (isinstance(v, float) and math.isnan(v)): continue
        lim, tar = th.get(gk), tg.get(tk) if tg else None
        bad = lambda L: L is not None and ((v < L) if op == ">=" else (v > L))
        if bad(lim): fails.append(f"{k} {v:.3g} {'<' if op == '>=' else '>'} {lim}")
        if bad(tar): gaps.append(dict(metric=k, value=round(v, 3), target=tar, gap=round(abs(v - tar), 3)))
    return fails, gaps


def main():
    job = json.load(open(sys.argv[1])); out = job["out"]; os.makedirs(out + "/crops", exist_ok=True)
    key = load(job["key"]); H, W = key.shape[:2]; game = load(job["game"], (W, H))
    TH = job["thresholds"]; rows = []
    for e in job["elements"]:
        t = TH.get(e["type"]) or TH.get("_default", {}); th, tg = t.get("gate", {}), t.get("target", {})
        mets = e.get("metrics", ["iou", "colour", "structure"])
        r = dict(id=e["id"], name=e.get("name", e["id"]), type=e["type"], note=e.get("note", ""), missing=bool(e.get("missing")),
                 reportOnly=bool(e.get("reportOnly") or t.get("reportOnly")))
        if e.get("notInKey"):   # present in the game but outside the key frame by design: nothing to compare
            r.update(verdict="N/A", fails=[], gaps=[], gate=th, target=tg, keyBox=None, gameBox=None); rows.append(r); continue
        km = elem_mask(key, e["key"], W, H)
        gside = e.get("game") or e["key"]
        if "rect" not in gside: gside = dict(gside, rect=e["key"]["rect"])
        gimg = load(job["renders"][e["gameRender"]], (W, H)) if e.get("gameRender") and job.get("renders", {}).get(e["gameRender"]) else game
        gm = np.zeros_like(km) if r["missing"] else elem_mask(gimg, gside, W, H)
        if gside.get("visible") and gm.any():   # silhouette from a mask render (no occluders) -> keep only what the beauty render shows
            sil = gm; gm = sil & rule_mask(gimg, gside["visible"])
            Image.fromarray((sil * 255).astype(np.uint8)).save(f"{out}/crops/{e['id']}-gamesil.png")   # silhouette (fixloop warp)
            r["iouSilhouette"] = round(iou(km, sil), 3); r["visibleOfSilhouette"] = round(float(gm.sum() / max(1, sil.sum())), 3)
            if r["visibleOfSilhouette"] < 0.5: r["note"] = (r["note"] + " · " if r["note"] else "") + f"occulté: {int(100 * (1 - r['visibleOfSilhouette']))} % de la silhouette caché"
        r["keyCover"] = round(float(km.mean()), 4); r["gameCover"] = round(float(gm.mean()), 4)
        kb = crop_box(km, e["key"]["rect"], W, H); gb = crop_box(gm, gside["rect"], W, H) if gm.sum() >= 30 else kb
        kc = key[kb[1]:kb[3], kb[0]:kb[2]]; gc = gimg[gb[1]:gb[3], gb[0]:gb[2]]
        r["keyBox"], r["gameBox"] = list(map(int, kb)), list(map(int, gb))
        if r["missing"] or gm.sum() < 30:
            r["missing"] = True; r["fails"] = ["missing in game"]; r["verdict"] = "MISSING"
        else:
            if "iou" in mets:
                r["iou"] = round(iou(km, gm), 3); r["iouAligned"] = round(iou_aligned(km, gm), 3)
            if "colour" in mets:
                a, b = lab_split(key, km), lab_split(gimg, gm)
                if a and b:
                    r["deLit"] = round(de(a["lit"], b["lit"]), 2); r["deShadow"] = round(de(a["shadow"], b["shadow"]), 2)
                    r["labKeyLit"] = [round(float(x), 1) for x in a["lit"]]; r["labGameLit"] = [round(float(x), 1) for x in b["lit"]]
                    r["labKeyShadow"] = [round(float(x), 1) for x in a["shadow"]]; r["labGameShadow"] = [round(float(x), 1) for x in b["shadow"]]
            if "structure" in mets:
                ss, k2, g2 = structure(kc, gc)
                r["structure"] = round(ss, 3); lp = lpips_d(k2, g2); r["lpips"] = None if lp is None else round(lp, 3)
            r["ceiling"] = ceiling(kc, km[kb[1]:kb[3], kb[0]:kb[2]])
            fails, gaps = verdict_of(r, th, tg)
            r["fails"], r["gaps"] = fails, gaps
            r["verdict"] = "FAIL" if fails else ("CLOSE" if gaps else "MATCH")
        r["gate"], r["target"] = th, tg
        Image.fromarray((kc * 255).astype(np.uint8)).save(f"{out}/crops/{e['id']}-key.png")
        Image.fromarray((gc * 255).astype(np.uint8)).save(f"{out}/crops/{e['id']}-game.png")
        Image.fromarray((km * 255).astype(np.uint8)).save(f"{out}/crops/{e['id']}-keymask.png")
        Image.fromarray((gm * 255).astype(np.uint8)).save(f"{out}/crops/{e['id']}-gamemask.png")
        rows.append(r)
    verdict = "FAIL" if any(r["verdict"] in ("FAIL", "MISSING") and not r["reportOnly"] for r in rows) else "PASS"
    res = dict(tool="object-gate key-compare", key=job["key"], game=job["game"], verdict=verdict, elements=rows,
               summary={v: sum(r["verdict"] == v for r in rows) for v in ("MATCH", "CLOSE", "FAIL", "MISSING", "N/A")})
    json.dump(clean(res), open(f"{out}/key-compare.json", "w"), indent=1)
    sheet(job, key, game, rows, out)
    open(f"{out}/key-compare.md", "w").write(markdown(res, job))
    print(json.dumps(dict(verdict=verdict, summary=res["summary"], sheet=f"{out}/sheet.jpg")))

def clean(x):
    """NaN (empty union, e.g. an empty mask) -> null: key-compare.json must be strict JSON."""
    if isinstance(x, float) and math.isnan(x): return None
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items()}
    if isinstance(x, list): return [clean(v) for v in x]
    return x

def fmt(v, d=2): return "-" if v is None or (isinstance(v, float) and math.isnan(v)) else f"{v:.{d}f}"

def markdown(res, job):
    L = [f"# key-compare — {res['verdict']}", "", f"key `{res['key']}` · game `{res['game']}`", "",
         "| Element | Type | Verdict | IoU (frame / shape) | ΔE lit | ΔE shadow | Structure (SSIM) | LPIPS | Out of bounds | Gap to target |", "|---|---|---|---|---|---|---|---|---|---|"]
    for r in res["elements"]:
        L.append(f"| {r['name']} | {r['type']} | **{r['verdict']}** | {fmt(r.get('iou'))} / {fmt(r.get('iouAligned'))}{f" (silhouette {fmt(r['iouSilhouette'])}, visible {fmt(r['visibleOfSilhouette'])})" if r.get('iouSilhouette') is not None else ""} | {fmt(r.get('deLit'), 1)} | {fmt(r.get('deShadow'), 1)} | {fmt(r.get('structure'))} | {fmt(r.get('lpips'))} | "
                 f"{'; '.join(r.get('fails', [])) or '-'} | {'; '.join(f'{g['metric']} {g['value']}→{g['target']}' for g in r.get('gaps', [])) or '-'} |")
    return "\n".join(L) + "\n"

COL = {"N/A": (90, 90, 100), "MATCH": (60, 170, 80), "CLOSE": (220, 160, 40), "FAIL": (210, 60, 50), "MISSING": (150, 40, 160)}
def sheet(job, key, game, rows, out, Wd=1080):
    K = Image.fromarray((key * 255).astype(np.uint8)); G = Image.fromarray((game * 255).astype(np.uint8))
    fh = int(Wd * K.size[1] / K.size[0])
    pad, hdr = 16, 56
    blocks = []
    def label(txt, w, h=hdr, size=34, bg=(18, 18, 22), fg=(240, 240, 240), b=True):
        im = Image.new("RGB", (w, h), bg); d = ImageDraw.Draw(im); d.text((pad, (h - size) // 2 - 2), txt, font=font(size, b), fill=fg); return im
    blocks.append(label(job.get("title", "Clé vs jeu"), Wd, 80, 42))
    blocks.append(label("IMAGE CLÉ", Wd, hdr, 30)); blocks.append(K.resize((Wd, fh), Image.LANCZOS))
    blocks.append(label("EN JEU (même caméra)", Wd, hdr, 30)); blocks.append(G.resize((Wd, fh), Image.LANCZOS))
    half = (Wd - pad) // 2
    for r in rows:
        if r["verdict"] == "N/A":
            t = Image.new("RGB", (Wd, 60), (90, 90, 100)); d = ImageDraw.Draw(t); d.text((pad, 10), f"{r['name']} : hors du cadre de la clé", font=font(30, True), fill=(255, 255, 255))
            blocks += [t, Image.new("RGB", (Wd, 12), (0, 0, 0))]; continue
        kc = Image.open(f"{out}/crops/{r['id']}-key.png"); gc = Image.open(f"{out}/crops/{r['id']}-game.png")
        ch = int(min(520, max(200, half * kc.size[1] / max(1, kc.size[0]))))
        def fit(im):
            c = Image.new("RGB", (half, ch), (10, 10, 12)); s = min(half / im.size[0], ch / im.size[1]); t = im.resize((max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s))), Image.LANCZOS)
            c.paste(t, ((half - t.size[0]) // 2, (ch - t.size[1]) // 2)); return c
        row = Image.new("RGB", (Wd, ch), (10, 10, 12)); row.paste(fit(kc), (0, 0))
        if r["verdict"] == "MISSING":
            g = Image.new("RGB", (half, ch), (40, 10, 45)); ImageDraw.Draw(g).text((24, ch // 2 - 24), "ABSENT ICI", font=font(40, True), fill=(240, 200, 250)); row.paste(g, (half + pad, 0))
        else: row.paste(fit(gc), (half + pad, 0))
        v = r["verdict"]; t = Image.new("RGB", (Wd, 60), COL[v]); d = ImageDraw.Draw(t)
        d.text((pad, 10), f"{r['name']}", font=font(34, True), fill=(255, 255, 255))
        tw = d.textlength(v, font=font(34, True)); d.text((Wd - pad - tw, 10), v, font=font(34, True), fill=(255, 255, 255))
        m = Image.new("RGB", (Wd, 100), (24, 24, 28)); d = ImageDraw.Draw(m)
        l1 = f"Forme {fmt(r.get('iou'))}   Couleur ΔE clair {fmt(r.get('deLit'), 1)} / ombre {fmt(r.get('deShadow'), 1)}   Détail {fmt(r.get('structure'))}"
        l2 = (r.get("note") or "")[:70]
        d.text((pad, 8), l1, font=font(28), fill=(235, 235, 235)); d.text((pad, 52), l2, font=font(26), fill=(200, 200, 200))
        blocks += [t, row, m, Image.new("RGB", (Wd, 12), (0, 0, 0))]
    Ht = sum(b.size[1] for b in blocks); S = Image.new("RGB", (Wd, Ht), (0, 0, 0)); y = 0
    for b in blocks: S.paste(b, (0, y)); y += b.size[1]
    S.save(f"{out}/sheet.jpg", quality=86)
    S.resize((Wd // 2, Ht // 2), Image.LANCZOS).save(f"{out}/sheet-small.jpg", quality=82)


# ---------------------------------------------------------------- camera solver score (key-compare --solve)
def classes(a):
    sky = rule_mask(a, "sky"); dark = rule_mask(a, "dark") & ~sky
    c = np.full(a.shape[:2], 2, np.uint8); c[sky] = 0; c[dark] = 1; return c

def score_main(key, pngs):
    k = load(key, (256, 144)); kc = classes(k); out = []
    for p in pngs:
        g = load(p, (256, 144)); gc = classes(g)
        agree = float((kc == gc).mean())
        sk = iou(kc == 0, gc == 0); dk = iou(kc == 1, gc == 1)
        out.append(dict(png=p, score=round(0.4 * agree + 0.3 * sk + 0.3 * (0 if math.isnan(dk) else dk), 4), agree=round(agree, 3), skyIoU=round(sk, 3), darkIoU=round(dk, 3)))
    print(json.dumps(out))

if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "score": score_main(sys.argv[2], json.load(open(sys.argv[3])))
    else: main()
