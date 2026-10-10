"""Image consistency check (MANDATORY, SmiR 2026-10-10): every new Imagine reference image is compared to the biome key
before it is used, and views of the same object are compared to each other on their overlap.

  python3 consistency.py check IMG [IMG ...] --key key.jpg --palette P --material sand [--key-rect x0,y0,x1,y1] --out DIR
  python3 consistency.py views V1 V2 [V3 ...] [--masks M1 M2 ...] --out DIR
  -> DIR/consistency-report.json (+ .md) and DIR/imagine-requests.json (regeneration requests, NEVER run here)

check (per image, after the palette grade when the caller grades first):
  palette ΔE   CIEDE2000 of the image's lit / shadow mean vs the palette material entry
  style score  0..1 vs the key crop of the element (images are not pixel-aligned to the key, so no SSIM here):
               0.4 x (1 - Bhattacharyya distance of the a*b* histograms) + 0.3 x gradient-orientation histogram
               similarity + 0.3 x detail-energy ratio similarity (Laplacian variance, min/max); LPIPS reported as info
  verdict      ACCEPT / FLAG (regenerate: a request is written) / REJECT (not usable, request written)
views (q17): every pair is registered (ORB + RANSAC homography); on the overlap: SSIM(luma) >= 0.92 and mean ΔE < 3.5.
  No reliable overlap (< 12 inliers) = INFO, not a pass.
Thresholds: profile `consistency:` (imagine-to-3d profiles/<type>.yaml), defaults below.
"""
import argparse, json, os, sys, time
import numpy as np
import cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C
import palette as PAL

DEFAULTS = dict(accept=dict(deLit=6, deShadow=8, style=0.70), reject=dict(deLit=12, deShadow=14, style=0.50),
                views=dict(ssimMin=0.92, deMax=3.5, minInliers=12))


def thresholds(obj_type=None):
    t = json.loads(json.dumps(DEFAULTS))
    if obj_type:
        try:
            p = C.read_yaml(os.path.join(C.HERE, "profiles", f"{obj_type}.yaml")).get("consistency") or {}
            for k, v in p.items(): t[k].update(v)
        except FileNotFoundError: pass
    return t


def _ab_hist(lab):
    h, _, _ = np.histogram2d(lab[..., 1].ravel(), lab[..., 2].ravel(), bins=24, range=[[-40, 60], [-40, 60]]); h = h / max(1, h.sum()); return h

def _orient_hist(g):
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1); mag = np.hypot(gx, gy); ang = (np.degrees(np.arctan2(gy, gx)) % 180)
    h, _ = np.histogram(ang, bins=18, range=(0, 180), weights=mag); return h / max(1e-9, h.sum())

def style_score(img, ref):
    s = 256 / max(img.shape[:2]); a = cv2.resize(img, (int(img.shape[1] * s), int(img.shape[0] * s)), interpolation=cv2.INTER_AREA)
    s = 256 / max(ref.shape[:2]); b = cv2.resize(ref, (int(ref.shape[1] * s), int(ref.shape[0] * s)), interpolation=cv2.INTER_AREA)
    la, lb = C.srgb_to_lab(a), C.srgb_to_lab(b)
    bc = float(np.sum(np.sqrt(_ab_hist(la) * _ab_hist(lb)))); col = bc   # Bhattacharyya coefficient (1 = same)
    oa, ob = _orient_hist(C.luma(a).astype(np.float32)), _orient_hist(C.luma(b).astype(np.float32)); ori = float(np.minimum(oa, ob).sum())
    ea, eb = C.laplacian_sharpness(a), C.laplacian_sharpness(b); det = float(min(ea, eb) / max(ea, eb, 1e-9))
    return dict(style=round(0.4 * col + 0.3 * ori + 0.3 * det, 3), colourHist=round(col, 3), orientation=round(ori, 3), detailEnergy=round(det, 3))


def check(imgs, key, palette, material, key_rect=None, out=None, obj_type=None):
    T = thresholds(obj_type); P = json.load(open(palette)) if isinstance(palette, str) else palette
    k = C.load_rgb(key)
    if key_rect:
        H, W = k.shape[:2]; x0, y0, x1, y1 = key_rect; k = k[int(y0 * H):int(y1 * H), int(x0 * W):int(x1 * W)]
    rows, req = [], []
    for p in imgs:
        a = C.load_rgb(p); m = PAL.measure(a, P, material); s = style_score(a, k)
        acc = m["deLit"] <= T["accept"]["deLit"] and m["deShadow"] <= T["accept"]["deShadow"] and s["style"] >= T["accept"]["style"]
        rej = m["deLit"] > T["reject"]["deLit"] or m["deShadow"] > T["reject"]["deShadow"] or s["style"] < T["reject"]["style"]
        v = "ACCEPT" if acc else ("REJECT" if rej else "FLAG")
        why = [f"{n} {m[n]} > {T['accept'][n]}" for n in ("deLit", "deShadow") if m[n] > T["accept"][n]] + ([f"style {s['style']} < {T['accept']['style']}"] if s["style"] < T["accept"]["style"] else [])
        rows.append(dict(image=os.path.abspath(p), material=material, verdict=v, why=why, **m, **s))
        if v != "ACCEPT":
            req.append(dict(kind="imagine_edit", status="NEEDS_APPROVAL", image=os.path.abspath(p), reason="; ".join(why),
                            sources=[os.path.abspath(p), os.path.abspath(key)],
                            prompt=f"Same {material} image, re-lit and re-coloured to match the reference key (dusk, low warm sun on the right, "
                                   f"violet sky bounce in the shadows); keep the composition, detail and size; no new objects."))
    rep = dict(tool="imagine-to-3d consistency", at=time.strftime("%Y-%m-%d %H:%M:%S"), kind="check", thresholds=T, rows=rows,
               verdict="FAIL" if any(r["verdict"] == "REJECT" for r in rows) else ("FLAG" if any(r["verdict"] == "FLAG" for r in rows) else "PASS"))
    _write(rep, req, out); return rep


def overlap_pair(a, b, ma=None, mb=None, T=None):
    T = T or DEFAULTS["views"]; ga, gb = (C.luma(a) * 255).astype(np.uint8), (C.luma(b) * 255).astype(np.uint8)
    orb = cv2.ORB_create(4000); ka, da = orb.detectAndCompute(ga, None if ma is None else ma.astype(np.uint8)); kb, db = orb.detectAndCompute(gb, None if mb is None else mb.astype(np.uint8))
    if da is None or db is None: return dict(status="INFO", note="no features")
    mt = sorted(cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True).match(da, db), key=lambda m: m.distance)[:800]
    if len(mt) < T["minInliers"]: return dict(status="INFO", note=f"{len(mt)} matches: no reliable overlap")
    pa = np.float32([ka[m.queryIdx].pt for m in mt]); pb = np.float32([kb[m.trainIdx].pt for m in mt])
    Hm, inl = cv2.findHomography(pb, pa, cv2.RANSAC, 4.0)
    n = int(inl.sum()) if inl is not None else 0
    if Hm is None or n < T["minInliers"]: return dict(status="INFO", note=f"{n} inliers: no reliable overlap")
    h, w = a.shape[:2]; bw = cv2.warpPerspective(b, Hm, (w, h)); valid = cv2.warpPerspective(np.ones(b.shape[:2], np.uint8), Hm, (w, h)) > 0
    if ma is not None: valid &= ma > 0
    if mb is not None: valid &= cv2.warpPerspective(mb.astype(np.uint8), Hm, (w, h)) > 0
    valid = cv2.erode(valid.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    if valid.mean() < 0.03: return dict(status="INFO", note=f"overlap {valid.mean():.3f} of the frame: too small", inliers=n)
    ys, xs = np.nonzero(valid); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    s = C.ssim(C.luma(a)[y0:y1, x0:x1], C.luma(bw)[y0:y1, x0:x1])[valid[y0:y1, x0:x1]].mean()
    de = float(np.median(C.delta_e2000(C.srgb_to_lab(a)[valid], C.srgb_to_lab(bw)[valid])))
    deMean = float(C.delta_e2000(C.srgb_to_lab(a)[valid].mean(0), C.srgb_to_lab(bw)[valid].mean(0)))
    ok = s >= T["ssimMin"] and deMean < T["deMax"]
    return dict(status="PASS" if ok else "FAIL", ssim=round(float(s), 3), deMean=round(deMean, 2), deMedianPx=round(de, 2), overlap=round(float(valid.mean()), 3), inliers=n)


def views(paths, masks=None, out=None, obj_type=None):
    T = thresholds(obj_type)["views"]; imgs = [C.load_rgb(p) for p in paths]
    ms = [C.load_mask(m, imgs[i].shape[1::-1]) for i, m in enumerate(masks)] if masks else [None] * len(paths)
    rows, req = [], []
    for i in range(len(paths)):
        for j in range(i + 1, len(paths)):
            b = imgs[j] if imgs[j].shape == imgs[i].shape else cv2.resize(imgs[j], imgs[i].shape[1::-1], interpolation=cv2.INTER_AREA)
            r = overlap_pair(imgs[i], b, ms[i], ms[j], T); r.update(a=os.path.abspath(paths[i]), b=os.path.abspath(paths[j])); rows.append(r)
            if r["status"] == "FAIL":
                req.append(dict(kind="imagine_edit", status="NEEDS_APPROVAL", image=r["b"], reason=f"view overlap vs {os.path.basename(r['a'])}: SSIM {r['ssim']} (>= {T['ssimMin']}), ΔE {r['deMean']} (< {T['deMax']})",
                                sources=[r["b"], r["a"]], prompt="Same object from the same camera, with the exact materials, colours and lighting of the second reference view; keep the geometry and framing."))
    rep = dict(tool="imagine-to-3d consistency", at=time.strftime("%Y-%m-%d %H:%M:%S"), kind="views", thresholds=T, rows=rows,
               verdict="FAIL" if any(r["status"] == "FAIL" for r in rows) else ("PASS" if any(r["status"] == "PASS" for r in rows) else "NO_OVERLAP"))
    _write(rep, req, out); return rep


def _write(rep, req, out):
    if not out: return
    os.makedirs(out, exist_ok=True); C.dump(rep, os.path.join(out, f"consistency-{rep['kind']}.json"))
    rp = os.path.join(out, "imagine-requests.json"); old = json.load(open(rp)) if os.path.exists(rp) else []
    C.dump(old + req, rp)
    L = [f"# consistency ({rep['kind']}): {rep['verdict']}", ""]
    if rep["kind"] == "check":
        L += ["| image | verdict | ΔE lit | ΔE shadow | style | why |", "|---|---|---|---|---|---|"]
        L += [f"| {os.path.basename(r['image'])} | {r['verdict']} | {r['deLit']} | {r['deShadow']} | {r['style']} | {'; '.join(r['why'])} |" for r in rep["rows"]]
    else:
        L += ["| a | b | status | SSIM | ΔE | overlap | note |", "|---|---|---|---|---|---|---|"]
        L += [f"| {os.path.basename(r['a'])} | {os.path.basename(r['b'])} | {r['status']} | {r.get('ssim', '-')} | {r.get('deMean', '-')} | {r.get('overlap', '-')} | {r.get('note', '')} |" for r in rep["rows"]]
    if req: L += ["", f"{len(req)} Imagine regeneration request(s) written to `imagine-requests.json` (NOT run: needs approval)."]
    open(os.path.join(out, f"consistency-{rep['kind']}.md"), "w").write("\n".join(L) + "\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["check", "views"]); ap.add_argument("imgs", nargs="+")
    ap.add_argument("--key"); ap.add_argument("--palette"); ap.add_argument("--material"); ap.add_argument("--key-rect"); ap.add_argument("--out")
    ap.add_argument("--masks", nargs="*"); ap.add_argument("--type")
    a = ap.parse_args()
    if a.cmd == "check":
        r = check(a.imgs, a.key, a.palette, a.material, [float(x) for x in a.key_rect.split(",")] if a.key_rect else None, a.out, a.type)
    else:
        r = views(a.imgs, a.masks, a.out, a.type)
    print(json.dumps(dict(verdict=r["verdict"], rows=[{k: v for k, v in x.items() if k in ("image", "a", "b", "verdict", "status", "deLit", "deShadow", "style", "ssim", "deMean", "note")} for x in r["rows"]])))
    sys.exit({"PASS": 0, "NO_OVERLAP": 0, "FLAG": 3}.get(r["verdict"], 1))
