"""Stage 'compare' (q16 #1, the most important signal): in-game capture vs key, from MATCHED angles.

For each (key image, capture) pair taken from the same camera (the key camera for the key crop; the view camera for an
accepted Imagine view):
  LPIPS (AlexNet, CPU torch)      <= 0.15        perceptual distance on the object (background neutralised)
  SSIM (luma, Gaussian window)    >= ssimMin     structure inside the union mask
  colour: mean dE2000 <= 12, a*b* histogram Bhattacharyya <= 0.35
  silhouette IoU                  >= 0.87        height-normalised, base-centred
  shadow chroma (capture)         spread <= object-gate shadow.maxTintChroma, not violet (r,b > g x 1.08)
  feature checklist               >= 90 %        per item: NCC template match of the item's key region in the
                                                 capture (+ ORB inliers), else a recorded Grok-vision/owner pass
                                                 (object-gate records/<id>.verified.yaml, same dHash rule), else FAIL
Outputs: <out>/compare-report.json + .md + compare-sheet.jpg (key | capture | diff heat | silhouettes), built with
object-gate lib/analyze.py (sheet, phash) so the two tools share one format.

  python3 compare.py --key key.png --capture shot.png --type rock --out DIR [--checklist items.yaml] [--records rec.yaml]
                     [--key-mask m] [--cap-mask m] [--object-id mesa]
"""
import argparse, importlib.util, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import i23d_common as C

_LP = None


def analyze_mod():
    spec = importlib.util.spec_from_file_location("og_analyze", os.path.join(C.OBJECT_GATE_DIR, "lib", "analyze.py"))
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def lpips_dist(a, b):
    """LPIPS-Alex on CPU (pip lpips + torch CPU). a, b float RGB 0..1 same shape."""
    global _LP
    import torch, lpips
    if _LP is None:
        _LP = lpips.LPIPS(net="alex", verbose=False).eval()
    t = lambda x: torch.from_numpy(x.transpose(2, 0, 1)[None].astype(np.float32) * 2 - 1)
    with torch.no_grad(): return float(_LP(t(a), t(b)).item())


def prep(img, mask, H=384, pad=0.06):
    """Crop to the object bbox (+pad) and resize an ANALYSIS copy to height H (metrics only)."""
    x0, y0, x1, y1 = C.bbox(mask); h, w = mask.shape
    px, py = int((x1 - x0) * pad), int((y1 - y0) * pad)
    x0, y0, x1, y1 = max(0, x0 - px), max(0, y0 - py), min(w, x1 + px), min(h, y1 + py)
    return img[y0:y1, x0:x1], mask[y0:y1, x0:x1]


def to_size(img, mask, W, H):
    i = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    m = np.asarray(Image.fromarray(mask.astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 127
    return i, m


def shadow_check(img, mask, gate_shadow):
    """Ground shadow next to the object in the capture: per-channel ratio shadow/lit ground."""
    h, w = mask.shape; ys = np.nonzero(mask.any(1))[0]
    if not len(ys): return dict(status="n/a", note="no object")
    base = ys.max(); band = np.zeros_like(mask); band[max(0, base - int(0.25 * h)):min(h, base + int(0.25 * h))] = True
    ground = band & ~ndi.binary_dilation(mask, iterations=3)
    if ground.sum() < 200: return dict(status="n/a", note="no ground visible")
    L = C.luma(img); med = np.median(L[ground])
    sh = ground & (L < 0.6 * med); lit = ground & (L > 0.9 * med)
    if sh.sum() < 100 or lit.sum() < 100: return dict(status="n/a", note="no cast shadow found in the capture")
    ratio = img[sh].mean(0) / np.maximum(img[lit].mean(0), 1e-3)
    spread = float((ratio.max() - ratio.min()) / max(1e-6, ratio.mean()))
    vr = gate_shadow.get("violetRatio", 1.08)
    violet = bool(ratio[0] > ratio[1] * vr and ratio[2] > ratio[1] * vr)
    ok = spread <= gate_shadow.get("maxTintChroma", 0.18) and not violet
    return dict(status="PASS" if ok else "FAIL", ratio=[round(float(x), 3) for x in ratio], spread=round(spread, 3), violet=violet,
                limit=gate_shadow.get("maxTintChroma", 0.18), pixels=int(sh.sum()))


def ncc_find(cap, tpl, expect_xy, search=0.18):
    """Best normalised cross-correlation of tpl in cap around expect_xy (fractions), scale 0.8-1.25."""
    import cv2
    g = (C.luma(cap) * 255).astype(np.uint8); best = (-1, None)
    for s in (0.8, 0.9, 1.0, 1.12, 1.25):
        t = cv2.resize((C.luma(tpl) * 255).astype(np.uint8), None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        if t.shape[0] < 8 or t.shape[1] < 8 or t.shape[0] >= g.shape[0] or t.shape[1] >= g.shape[1]: continue
        r = cv2.matchTemplate(g, t, cv2.TM_CCOEFF_NORMED)
        H, W = g.shape; ex, ey = expect_xy[0] * W - t.shape[1] / 2, expect_xy[1] * H - t.shape[0] / 2
        x0, x1 = int(max(0, ex - search * W)), int(min(r.shape[1], ex + search * W + 1))
        y0, y1 = int(max(0, ey - search * H)), int(min(r.shape[0], ey + search * H + 1))
        if x1 <= x0 or y1 <= y0: continue
        sub = r[y0:y1, x0:x1]; v = float(sub.max())
        if v > best[0]: iy, ix = np.unravel_index(sub.argmax(), sub.shape); best = (v, (ix + x0, iy + y0, s))
    return best


def orb_inliers(a, b):
    import cv2
    o = cv2.ORB_create(1500)
    ka, da = o.detectAndCompute((C.luma(a) * 255).astype(np.uint8), None)
    kb, db = o.detectAndCompute((C.luma(b) * 255).astype(np.uint8), None)
    if da is None or db is None or len(ka) < 8 or len(kb) < 8: return 0
    mm = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
    good = [m[0] for m in mm if len(m) == 2 and m[0].distance < 0.8 * m[1].distance]
    if len(good) < 8: return len(good) // 2
    pa = np.float32([ka[m.queryIdx].pt for m in good]); pb = np.float32([kb[m.trainIdx].pt for m in good])
    _, inl = cv2.findHomography(pa, pb, cv2.RANSAC, 6.0)
    return int(inl.sum()) if inl is not None else 0


def checklist_score(key_c, cap_c, items, records, cap_hash, max_hash=12):
    rows = []
    rec_items = (records or {}).get("items", {}) if records else {}
    for it in items or []:
        r = dict(id=it["id"], feature=it.get("feature", ""), status="FAIL", how="")
        rg = it.get("region")
        if rg:
            x0, y0, x1, y1 = rg; kh, kw = key_c.shape[:2]
            tpl = key_c[int(y0):int(y1), int(x0):int(x1)]
            if tpl.size:
                v, at = ncc_find(cap_c, tpl, ((x0 + x1) / 2 / kw, (y0 + y1) / 2 / kh))
                inl = orb_inliers(tpl, cap_c) if tpl.shape[0] >= 32 and tpl.shape[1] >= 32 else 0
                r.update(ncc=round(v, 3), orbInliers=inl)
                if v >= 0.5 or inl >= 12: r.update(status="PASS", how="ncc" if v >= 0.5 else "orb")
        if r["status"] != "PASS" and it["id"] in rec_items:
            ri = rec_items[it["id"]]; hs = (ri.get("captures") or {}).values()
            same = any(bin(int(h, 16) ^ int(cap_hash, 16)).count("1") <= max_hash for h in hs) if hs else False
            if ri.get("pass") and same: r.update(status="PASS", how=f"record ({ri.get('by', '?')})")
            elif ri.get("pass"): r.update(status="FAIL", how="record is for an older capture (dHash) -> re-verify")
        if r["status"] != "PASS" and not r["how"]: r["how"] = "no region match and no current vision record -> needs Grok vision"
        rows.append(r)
    n = len(rows); p = sum(r["status"] == "PASS" for r in rows)
    return (p / n if n else None), rows


def compare(key, capture, obj_type, out, items=None, records=None, key_mask=None, cap_mask=None, object_id=None):
    os.makedirs(out, exist_ok=True)
    prof = C.load_profile(obj_type); T = prof["thresholds"]; G = prof["gateResolved"]
    K, Cp = C.load_rgb(key), C.load_rgb(capture)
    km = C.load_mask(key_mask, (K.shape[1], K.shape[0])) if key_mask else C.object_mask(K)
    cm = C.load_mask(cap_mask, (Cp.shape[1], Cp.shape[0])) if cap_mask else C.object_mask(Cp)
    rep = C.Report(f"compare {object_id or os.path.basename(capture)} vs key ({obj_type})")
    kc, kmc = prep(K, km); cc, cmc = prep(Cp, cm)
    H = 384; W = max(64, int(round(kc.shape[1] * H / kc.shape[0])))
    kr, kmr = to_size(kc, kmc, W, H); cr, cmr = to_size(cc, cmc, W, H)
    u = kmr | cmr
    neutral = lambda x: np.where(u[..., None], x, 0.5)
    lp = lpips_dist(neutral(kr), neutral(cr))
    rep.row("LPIPS (alex)", lp <= T["lpips"], round(lp, 4), f"<= {T['lpips']}")
    ss = float(C.ssim(C.luma(kr), C.luma(cr))[u].mean())
    rep.row("SSIM (object)", ss >= T["ssimMin"], round(ss, 4), f">= {T['ssimMin']}")
    la, lb = C.srgb_to_lab(kr[kmr]), C.srgb_to_lab(cr[cmr])
    de = float(C.delta_e2000(la.mean(0), lb.mean(0)))
    rep.row("colour mean dE2000", de <= T["deltaE2000Max"], round(de, 2), f"<= {T['deltaE2000Max']}")
    bins = np.linspace(-40, 60, 17)
    ha, _, _ = np.histogram2d(la[:, 1], la[:, 2], bins=[bins, bins]); hb, _, _ = np.histogram2d(lb[:, 1], lb[:, 2], bins=[bins, bins])
    ha /= max(1, ha.sum()); hb /= max(1, hb.sum()); bh = float(np.sqrt(max(0.0, 1 - np.sqrt(ha * hb).sum())))
    rep.row("colour a*b* histogram (Bhattacharyya)", bh <= T["histBhattMax"], round(bh, 3), f"<= {T['histBhattMax']}")
    if T.get("silhouetteIoU") is not None:
        io = C.silhouette_iou(km, cm); rep.row("silhouette IoU", io >= T["silhouetteIoU"], round(io, 4), f">= {T['silhouetteIoU']}")
    sh = shadow_check(Cp, cm, G.get("shadow", {}))
    rep.row("shadow neutral (capture)", sh["status"] != "FAIL", sh.get("ratio", sh.get("note")), f"spread <= {sh.get('limit', G.get('shadow', {}).get('maxTintChroma'))}, not violet",
            "" if sh["status"] != "n/a" else "n/a: " + sh.get("note", ""))
    A = analyze_mod()
    cap_hash = A.phash({"img": capture})["hash"]
    items = items if items is not None else (G.get("checklistTemplate") or [])
    score, crow = checklist_score(K, Cp, items, records, cap_hash, G.get("checklist", {}).get("maxHashDistance", 12))
    rep.row("feature checklist", score is not None and score >= T["checklistMin"], None if score is None else round(score, 3),
            f">= {T['checklistMin']}", f"{sum(r['status'] == 'PASS' for r in crow)}/{len(crow)} items")
    # sheet (object-gate format): key | capture | diff heat | silhouettes
    diff = np.abs(C.luma(kr) - C.luma(cr)); heat = np.stack([np.clip(diff * 3, 0, 1), np.clip(1 - diff * 3, 0, 1) * 0.3, np.zeros_like(diff)], -1)
    sil = np.zeros((H, W, 3)); sil[..., 0] = kmr; sil[..., 1] = cmr
    paths = {}
    for n, x in (("key", kr), ("capture", cr), ("diff", heat), ("silhouettes", sil)):
        paths[n] = C.save_rgb(x, os.path.join(out, f"cmp-{n}.png"))
    sheet = os.path.join(out, "compare-sheet.jpg")
    A.sheet({"out": sheet, "title": f"{rep.name}: {'PASS' if rep.ok else 'FAIL'}  LPIPS {lp:.3f}  SSIM {ss:.3f}  dE {de:.1f}",
             "tiles": [{"img": paths["key"], "label": "KEY"}, {"img": paths["capture"], "label": "IN-GAME (same angle)"},
                       {"img": paths["diff"], "label": "|luma diff|"}, {"img": paths["silhouettes"], "label": "red key / green game"}]})
    r = rep.as_dict(); r.update(key=os.path.abspath(key), capture=os.path.abspath(capture), captureHash=cap_hash, checklist=crow, shadow=sh, sheet=sheet)
    C.dump(r, os.path.join(out, "compare-report.json")); open(os.path.join(out, "compare-report.md"), "w").write(rep.md())
    return r


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    for k in ("key", "capture", "type", "out"): ap.add_argument("--" + k, required=True)
    for k in ("checklist", "records", "key-mask", "cap-mask", "object-id"): ap.add_argument("--" + k)
    a = ap.parse_args()
    items = C.read_yaml(a.checklist) if a.checklist else None
    if isinstance(items, dict): items = items.get("checklist") or items.get("items")
    recs = C.read_yaml(a.records) if a.records and os.path.exists(a.records) else None
    r = compare(a.key, a.capture, a.type, a.out, items, recs, a.key_mask, a.cap_mask, a.object_id)
    for row in r["rows"]: print(row["status"], row["check"], row["value"], row["limit"], row["note"])
    print("VERDICT", r["verdict"]); sys.exit(0 if r["verdict"] == "PASS" else 1)
