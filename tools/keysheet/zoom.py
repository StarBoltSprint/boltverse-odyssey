#!/usr/bin/env python3
"""tools/keysheet/zoom.py - per-element zoomed comparison render vs key (blocking, MIN over elements).
For every element mask of a sheet, crop the element's bbox in key and render and measure:
  straight  fraction of Canny edge pixels on long straight segments (HoughP, >= 12 % of crop width): "too clean
            geometry". FAIL if render > key + tol_straight.
  rough     silhouette roughness of the bright (snow/ice) boundary: std of the 2nd difference of the per-column
            lowest-bright-pixel profile, normalised by crop height. FAIL if render < key * min_rough_rel (too smooth).
  edges     Canny edge density ratio render/key, must lie in [lo, hi].
  thick     (band elements) median vertical bright-run thickness ratio render/key, within +-25 %.
  colour    mean Lab dE76 of the crop, <= tol_dE.
  dino      DINOv2 patch cosine of the zoomed crops (dino_elems.py in the torch venv), >= min_dino.
Each sub-score maps to 0..100 (100 = matches key); element score = MIN of sub-scores; report score = MIN over
elements. Any element below `block` = FAIL.  usage: zoom.py RENDER SHEET_DIR/sheet.json [--out zoom.json] [--pairs DIR]"""
import argparse, json, subprocess, sys
from pathlib import Path
import cv2, numpy as np
HERE = Path(__file__).resolve().parent
DEF = {"tol_straight": 0.08, "min_rough_rel": 0.6, "edges": [0.5, 2.0], "tol_thick": 0.25, "tol_dE": 15.0, "min_dino": 0.45, "block": 50.0}


def crop(img, M, pad=8):
    ys, xs = np.nonzero(M)
    x0, y0 = max(xs.min() - pad, 0), max(ys.min() - pad, 0); x1, y1 = min(xs.max() + pad, M.shape[1]), min(ys.max() + pad, M.shape[0])
    return img[y0:y1, x0:x1], M[y0:y1, x0:x1], (int(x0), int(y0), int(x1), int(y1))


def feats(c, m, thr_L):
    from skimage.color import rgb2lab
    g = cv2.cvtColor(c, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 40, 110) & (m.astype(np.uint8) * 255)
    W = c.shape[1]
    lines = cv2.HoughLinesP(e, 1, np.pi / 180, 20, minLineLength=max(12, int(0.12 * W)), maxLineGap=2)
    on = np.zeros_like(e)
    if lines is not None:
        for x1, y1, x2, y2 in np.asarray(lines).reshape(-1, 4):
            cv2.line(on, (x1, y1), (x2, y2), 255, 2)
    ne = max(int((e > 0).sum()), 1)
    straight = float(((on > 0) & (e > 0)).sum()) / ne
    lab = rgb2lab(c[:, :, ::-1] / 255.0); L = lab[..., 0]
    br = (L >= thr_L) & m
    # silhouette roughness: lowest bright pixel per column (the drooping lip / slab underside)
    cols = [np.nonzero(br[:, x])[0] for x in range(br.shape[1])]
    prof = np.array([cc.max() if len(cc) else np.nan for cc in cols], float)
    ok = ~np.isnan(prof)
    rough = float(np.nanstd(np.diff(prof[ok], 2)) / c.shape[0]) if ok.sum() > 8 else 0.0
    runs = []
    for x in range(br.shape[1]):
        v = br[:, x].astype(np.int8); d = np.diff(np.r_[0, v, 0]); s_, e_ = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
        runs += list(e_ - s_)
    return {"straight": straight, "rough": rough, "edges": float((e > 0).sum()) / max(int(m.sum()), 1),
            "thick": float(np.median(runs)) if runs else 0.0, "lab": [float(lab[..., k][m].mean()) for k in range(3)]}


def lin(v, good, bad):
    """100 at `good`, 0 at `bad`, linear, clipped."""
    if good == bad:
        return 100.0
    return float(np.clip(100 * (v - bad) / (good - bad), 0, 100))


def compare(render, sheet_path, pairs=None, venv="/workspace/.venv-sam2/bin/python", dino=True):
    sp = Path(sheet_path); sh = json.loads(sp.read_text()); W = sh["frame_px"]
    R = cv2.resize(cv2.imread(str(render)), (W, W), interpolation=cv2.INTER_AREA)
    K = cv2.resize(cv2.imread(sh["key"] if Path(sh["key"]).exists() else str(sp.parents[3] / "tools/gatesuite/fixtures/key-zd1-b.jpg")), (W, W), interpolation=cv2.INTER_AREA)
    masks = {e["id"]: sp.parent / e["mask"] for e in sh["elements"] if e.get("zoom", True)}
    dres = {}
    if dino and Path(venv).exists():
        import tempfile
        with tempfile.TemporaryDirectory() as t:
            rp, kp = f"{t}/r.png", f"{t}/k.png"; cv2.imwrite(rp, R); cv2.imwrite(kp, K)
            o = subprocess.run([venv, str(HERE / "dino_elems.py"), rp, kp, *map(str, masks.values())], capture_output=True, text=True, timeout=1200)
            try:
                dres = json.loads(o.stdout.strip().splitlines()[-1])
            except Exception:  # noqa: BLE001
                dres = {}
    rows, tiles = [], []
    for e in sh["elements"]:
        if not e.get("zoom", True):
            continue
        p = {**DEF, **e.get("zoom_rule", {})}
        M = cv2.imread(str(masks[e["id"]]), 0) > 127
        kc, km, box = crop(K, M); rc, _, _ = crop(R, M)
        thr = e["params"].get("thr_L", 60.0)
        fk, fr = feats(kc, km, thr), feats(rc, km, thr)
        sub = {}
        sub["straight"] = lin(fr["straight"] - fk["straight"], p["tol_straight"], p["tol_straight"] + 0.25) if fr["straight"] > fk["straight"] + p["tol_straight"] else 100.0
        if fk["rough"] > 1e-4 and e["kind"] in ("band", "drips", "straight_bar"):
            rr = fr["rough"] / fk["rough"]
            sub["rough"] = 100.0 if rr >= p["min_rough_rel"] else lin(rr, p["min_rough_rel"], 0.0)
        er = fr["edges"] / max(fk["edges"], 1e-6)
        lo, hi = p["edges"]
        sub["edges"] = 100.0 if lo <= er <= hi else (lin(er, lo, 0.0) if er < lo else lin(er, hi, hi * 3))
        if e["kind"] == "band" and fk["thick"] > 0:
            tr = fr["thick"] / fk["thick"]
            sub["thick"] = 100.0 if abs(tr - 1) <= p["tol_thick"] else lin(abs(tr - 1), p["tol_thick"], 1.0)
        dE = float(np.linalg.norm(np.array(fr["lab"]) - np.array(fk["lab"])))
        sub["colour"] = 100.0 if dE <= p["tol_dE"] else lin(dE, p["tol_dE"], p["tol_dE"] * 3)
        dk = dres.get(str(masks[e["id"]]))
        if dk is not None:
            sub["dino"] = 100.0 if dk["patch_cos"] >= p["min_dino"] else lin(dk["patch_cos"], p["min_dino"], 0.0)
        else:
            sub["dino"] = 0.0      # no DINO evidence = not PASS
        score = min(sub.values())
        rows.append({"check": f"zoom {e['id']}: min sub-score >= {p['block']}", "ok": bool(score >= p["block"]), "value": round(score, 1),
                     "sub": {k: round(v, 1) for k, v in sub.items()},
                     "measured": {"render": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in fr.items() if k != "lab"},
                                  "key": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in fk.items() if k != "lab"},
                                  "dE": round(dE, 1), "dino": dk}, "box": box})
        if pairs is not None:
            h = 220; s = h / kc.shape[0]
            pk = cv2.resize(kc, (max(1, int(kc.shape[1] * s)), h)); pr = cv2.resize(rc, (pk.shape[1], h))
            t = np.hstack([pk, np.full((h, 4, 3), 255, np.uint8), pr])
            cv2.putText(t, f"{e['id']} {score:.0f}", (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 0) if score >= p["block"] else (0, 0, 255), 2)
            tiles.append(t)
    if pairs is not None and tiles:
        Wt = max(t.shape[1] for t in tiles)
        sheet = np.vstack([np.hstack([t, np.zeros((t.shape[0], Wt - t.shape[1], 3), np.uint8)]) for t in tiles])
        Path(pairs).mkdir(parents=True, exist_ok=True); cv2.imwrite(str(Path(pairs) / "zoom-pairs.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return rows, (min(r["value"] for r in rows) if rows else 0.0)


def main(argv=None):
    ap = argparse.ArgumentParser(); ap.add_argument("render"); ap.add_argument("sheet"); ap.add_argument("--out"); ap.add_argument("--pairs")
    ap.add_argument("--no-dino", action="store_true")
    a = ap.parse_args(argv)
    rows, mn = compare(a.render, a.sheet, a.pairs, dino=not a.no_dino)
    rep = {"min_element_score": mn, "verdict": "PASS" if all(r["ok"] for r in rows) else "FAIL", "rows": rows}
    if a.out:
        Path(a.out).write_text(json.dumps(rep, indent=1))
    for r in rows:
        print(("PASS " if r["ok"] else "FAIL ") + r["check"] + f"  score {r['value']}  {r['sub']}")
    print("min", mn, rep["verdict"]); return 0 if rep["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
