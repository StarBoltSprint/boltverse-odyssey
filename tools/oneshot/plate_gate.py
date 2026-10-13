"""Plate gate built from learn/proposals/plate-precheck.json (Art Director, v1). 9 checks.
Reuses tools/gate/nogrey.py, tools/sky-band-gate (assess_plate), tools/sky-magnification/starmip.py,
and object-gate painted_duplicate.py. style_match is an eye check: reported EYE, never auto PASS."""
import json, os, sys, subprocess, re
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
for p in ("tools/gate", "tools/sky-band-gate", "tools/sky-magnification"): sys.path.insert(0, os.path.join(REPO, p))
import nogrey, measures, starmip
PAINTED = os.environ.get("BOLT_PAINTED_DUP", "/workspace/grokcli/wt/zd-terrace-1012/tools/object-gate/py/painted_duplicate.py")
KEY_ZD = "/workspace/zd-preview-1012/assets/key-zd1-b.jpg"
SKY_MAG_MIN = 0.7359  # spine v1.2 worst case

def rgb(p): return np.asarray(Image.open(p).convert("RGB"))
def L(a): return a.astype(np.float32).mean(2)

def native_res(a, kind):
    h, w = a.shape[:2]
    if kind == "sky" and (w, h) != (1280, 720): return False, {"size": [w, h], "want": [1280, 720]}
    if kind == "object" and max(w, h) != 1024: return False, {"size": [w, h], "want_long": 1024}
    # upscale test: share of energy above half-Nyquist. A 2x upscale has almost none.
    F = np.abs(np.fft.rfft2(L(a) - L(a).mean())) ** 2
    fy = np.abs(np.fft.fftfreq(h))[:, None]; fx = np.fft.rfftfreq(w)[None, :]
    hi = (np.maximum(fy, fx) > 0.25)
    r = float(F[hi].sum() / max(F.sum(), 1e-9))
    return r >= 0.002, {"size": [w, h], "hf_share": round(r, 5), "min": 0.002}

def grey(path):
    r = nogrey.check(path); return r["pass_"], {"nFailing": r["nFailing"], "worst": r["worstRegionFrac"]}

def sky_band(a, ring_v):
    row = measures.assess_plate(a, key_b_med=None, ring_median_v=ring_v)
    return row["status"] == "PASS", {"reasons": row["reasons"], "median_star_px": row.get("median_star_px")}

def star_mip(base_f, mip1=None):
    """mip1=None -> star-preserving (what sky-pack ships); 'box' -> box filter. Rule 0.97 of no-mip peak, <=2 px."""
    m = starmip.mip1_box(base_f) if mip1 == "box" else starmip.mip1_star(base_f)
    h, w = base_f.shape[:2]; reg = (w // 4, h // 4, w // 4 + 256, h // 4 + 256)
    r, _ = starmip.compare(base_f, m, SKY_MAG_MIN, reg)
    return r["verdict"] == "PASS", {k: r[k] for k in ("peak_vs_nomip", "median_size_px", "bg_drift_vs_nomip")}

def seam(a, b):
    d = abs(float(L(a[:, -8:]).mean()) - float(L(b[:, :8]).mean()))
    return d <= 2.0, {"step_255": round(d, 3), "max": 2.0}

def ice(a):
    clip = (a.min(2) >= 250); f = float(clip.mean())
    lab, n = ndi.label(clip); big = max(ndi.sum(clip, lab, range(1, n + 1)), default=0) if n else 0
    ok = f <= 0.002 and big <= 0.0005 * clip.size
    return ok, {"clipped_frac": round(f, 5), "largest_hot_px": int(big)}

def hard_dark(a):
    """Stray shadow/floor planes: flat near-black, straight-edged, lying flat (wider than 2x tall) and
    darker than its surroundings. Portrait openings (doorways in the plate) are reported, not failed."""
    l = L(a); m = ndi.uniform_filter(l, 5); sd = np.sqrt(np.maximum(ndi.uniform_filter(l * l, 5) - m * m, 0))
    dark = ndi.binary_opening((l < 24) & (sd < 1.5), iterations=2)
    lab, n = ndi.label(dark); hits, openings = [], []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None: continue
        hh, ww = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        reg = lab[sl] == i; area = int(reg.sum())
        if area < 0.004 * l.size or min(hh, ww) < 8 or area / (hh * ww) < 0.6: continue
        ring = ndi.binary_dilation(lab == i, iterations=12) & ~(lab == i)
        rec = {"bbox": [sl[1].start, sl[0].start, sl[1].stop, sl[0].stop], "fill": round(area / (hh * ww), 3),
               "frac": round(area / l.size, 4), "contrast": round(float(l[ring].mean() - l[lab == i].mean()), 1)}
        (hits if ww >= 2 * hh and rec["contrast"] >= 10 else openings).append(rec)
    return not hits, {"rects": hits[:5], "portrait_openings_not_failed": len(openings)}

def style(a, key=KEY_ZD):
    if not os.path.exists(key): return None, {"note": "key image missing"}
    k = rgb(key)
    d = float(np.abs(a.reshape(-1, 3).mean(0) - k.reshape(-1, 3).mean(0)).mean())
    return None, {"mean_rgb_dist": round(d, 2), "note": "eye check by Art Director"}

def painted_dup(spec):
    r = subprocess.run([sys.executable, PAINTED, spec], capture_output=True, text=True, cwd=os.path.dirname(PAINTED))
    j = json.loads(r.stdout); return j["status"] == "PASS", {k: j[k] for k in ("failing_face_ids", "overlap_m", "ghosts")}

def gate_plate(path, kind, ring_v=None, mip1=None):
    a = rgb(path); res = {}
    def put(k, okinfo):
        ok, info = okinfo; res[k] = {"status": "EYE" if ok is None else ("PASS" if ok else "FAIL"), **info}
    put("native_res", native_res(a, kind))
    put("grey_untextured", grey(path) if kind == "object" else (True, {"note": "sky: dark field by design; no-grey runs on object plates"}))
    put("hard_dark_shapes", hard_dark(a))
    if kind == "sky":
        put("sky_band", sky_band(a, ring_v if ring_v is not None else measures.mean_v(a)))
        put("star_size", star_mip(a.astype(np.float32) / 255.0, mip1))
    else:
        put("ice_material", ice(a))
    put("style_match", style(a))
    auto = [v["status"] for k, v in res.items() if v["status"] != "EYE"]
    return {"path": path, "kind": kind, "checks": res, "status": "FAIL" if "FAIL" in auto else "PASS"}

def gate_sky_set(paths, mip1=None):
    arrs = [rgb(p) for p in paths]; vs = [measures.mean_v(x) for x in arrs]; ring = float(sorted(vs)[len(vs) // 2])
    rows = [gate_plate(p, "sky", ring, mip1) for p in paths]
    for i in range(len(arrs)):
        ok, info = seam(arrs[i], arrs[(i + 1) % len(arrs)])
        rows[i]["checks"]["seams"] = {"status": "PASS" if ok else "FAIL", "next": os.path.basename(paths[(i + 1) % len(paths)]), **info}
        if not ok: rows[i]["status"] = "FAIL"
    return rows

def gate_object_set(paths, painted_spec=None):
    rows = [gate_plate(p, "object") for p in paths]
    if painted_spec:
        ok, info = painted_dup(painted_spec); st = "PASS" if ok else "FAIL"
        imgs = {pl["image"] for pl in json.load(open(painted_spec))["plates"]}
        for r in rows:
            if r["path"] in imgs:
                r["checks"]["painted_duplicate"] = {"status": st, **info}
                if not ok: r["status"] = "FAIL"
    else:
        for r in rows: r["checks"]["painted_duplicate"] = {"status": "NOT_IMPLEMENTED", "note": "no painted-duplicate spec for this object"}
    return rows

if __name__ == "__main__":
    for p in sys.argv[1:]:
        r = gate_plate(p, "sky" if Image.open(p).size == (1280, 720) else "object")
        print(r["status"], os.path.basename(p), {k: (v["status"], {x: y for x, y in v.items() if x != "status"}) for k, v in r["checks"].items()})
